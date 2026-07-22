import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { authorizeApiPermission } from "@/lib/auth/api-authorization";
import { prisma } from "@/lib/db/prisma";
import {
  getRequestIp,
  getRequestUserAgent,
  isSameOriginRequest,
} from "@/lib/http/request-metadata";
import { todayInPalestine } from "@/lib/memorization-sessions/date";
import { transferStudentSchema } from "@/lib/student-transfers/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const studentIdSchema = z.string().uuid();

class TransferValidationError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateValue(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function previousDate(value: string): Date {
  const date = dateOnly(value);
  date.setUTCDate(date.getUTCDate() - 1);
  return date;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ studentId: string }> },
) {
  if (!isSameOriginRequest(request)) {
    return errorResponse("تم رفض الطلب لأسباب أمنية.", 403);
  }

  const authorization = await authorizeApiPermission("transfers.manage");
  if (authorization.response) return authorization.response;

  const { studentId } = await context.params;
  if (!studentIdSchema.safeParse(studentId).success) {
    return errorResponse("معرف الطالب غير صالح.", 400);
  }

  const parsed = transferStudentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "بيانات النقل غير صالحة.", 400);
  }

  if (parsed.data.transferDate > todayInPalestine()) {
    return errorResponse("لا يمكن تنفيذ نقل بتاريخ مستقبلي.", 400);
  }

  const existingRequest = await prisma.studentTransfer.findUnique({
    where: { idempotencyKey: parsed.data.idempotencyKey },
    select: {
      id: true,
      studentId: true,
      transferDate: true,
      toEnrollment: { select: { halaqa: { select: { nameAr: true } } } },
    },
  });

  if (existingRequest) {
    if (existingRequest.studentId !== studentId) {
      return errorResponse("معرف العملية مستخدم في عملية نقل أخرى.", 409);
    }

    return NextResponse.json({
      message: `تم تنفيذ النقل مسبقاً إلى ${existingRequest.toEnrollment.halaqa.nameAr}.`,
      transfer: {
        id: existingRequest.id,
        transferDate: dateValue(existingRequest.transferDate),
      },
    });
  }

  const requestId = randomUUID();
  const ipAddress = getRequestIp(request);
  const userAgent = getRequestUserAgent(request);
  const effectiveDate = dateOnly(parsed.data.transferDate);
  const sourceEndDate = previousDate(parsed.data.transferDate);

  try {
    const result = await prisma.$transaction(
      async (transaction) => {
        const repeatedRequest = await transaction.studentTransfer.findUnique({
          where: { idempotencyKey: parsed.data.idempotencyKey },
          select: {
            id: true,
            studentId: true,
            transferDate: true,
            toEnrollment: { select: { halaqa: { select: { nameAr: true } } } },
          },
        });

        if (repeatedRequest) {
          if (repeatedRequest.studentId !== studentId) {
            throw new TransferValidationError("معرف العملية مستخدم في عملية نقل أخرى.", 409);
          }

          return {
            repeated: true as const,
            transferId: repeatedRequest.id,
            transferDate: dateValue(repeatedRequest.transferDate),
            fromHalaqaName: "",
            toHalaqaName: repeatedRequest.toEnrollment.halaqa.nameAr,
          };
        }

        const student = await transaction.student.findFirst({
          where: { id: studentId, isActive: true, deletedAt: null },
          select: {
            id: true,
            displayName: true,
            enrollments: {
              where: {
                status: "ACTIVE",
                endedOn: null,
                deletedAt: null,
                program: { code: "BASE_PROGRAM", status: "ACTIVE", deletedAt: null },
              },
              take: 2,
              select: {
                id: true,
                programId: true,
                halaqaId: true,
                startedOn: true,
                halaqa: {
                  select: {
                    nameAr: true,
                    stage: { select: { nameAr: true } },
                  },
                },
              },
            },
          },
        });

        if (!student) {
          throw new TransferValidationError("الطالب غير موجود أو ملفه غير نشط.", 400);
        }

        if (student.enrollments.length !== 1) {
          throw new TransferValidationError(
            student.enrollments.length
              ? "يوجد أكثر من تسجيل أساسي نشط للطالب ويجب تصحيح البيانات أولاً."
              : "لا يوجد تسجيل أساسي نشط يمكن نقله.",
            409,
          );
        }

        const source = student.enrollments[0];
        if (source.halaqaId === parsed.data.toHalaqaId) {
          throw new TransferValidationError("الطالب مسجل بالفعل في الحلقة المختارة.", 409);
        }

        const sourceStartedOn = dateValue(source.startedOn);
        if (parsed.data.transferDate <= sourceStartedOn) {
          throw new TransferValidationError(
            `يجب أن يبدأ النقل بعد تاريخ التسجيل الحالي (${sourceStartedOn}) حتى لا تتداخل التسجيلات.`,
            400,
          );
        }

        const target = await transaction.halaqa.findFirst({
          where: {
            id: parsed.data.toHalaqaId,
            programId: source.programId,
            status: "ACTIVE",
            deletedAt: null,
            program: { code: "BASE_PROGRAM", status: "ACTIVE", deletedAt: null },
          },
          select: {
            id: true,
            programId: true,
            nameAr: true,
            stage: { select: { nameAr: true } },
          },
        });

        if (!target) {
          throw new TransferValidationError("الحلقة الجديدة غير موجودة أو غير نشطة.", 400);
        }

        const [sourceSessionRecords, sourceOfficialExams, overlappingTargetEnrollment] =
          await Promise.all([
            transaction.sessionRecordItem.count({
              where: {
                enrollmentId: source.id,
                session: { sessionDate: { gte: effectiveDate }, deletedAt: null },
              },
            }),
            transaction.officialExam.count({
              where: {
                enrollmentId: source.id,
                examDate: { gte: effectiveDate },
                status: "ACTIVE",
              },
            }),
            transaction.studentEnrollment.findFirst({
              where: {
                studentId,
                halaqaId: target.id,
                deletedAt: null,
                OR: [{ endedOn: null }, { endedOn: { gte: effectiveDate } }],
              },
              select: { id: true, startedOn: true, endedOn: true },
            }),
          ]);

        if (sourceSessionRecords || sourceOfficialExams) {
          throw new TransferValidationError(
            "توجد سجلات تسميع أو اختبارات مرتبطة بالحلقة القديمة في تاريخ النقل أو بعده. اختر تاريخاً أحدث من آخر سجل.",
            409,
          );
        }

        if (overlappingTargetEnrollment) {
          throw new TransferValidationError(
            "يوجد تسجيل سابق في الحلقة الجديدة يتداخل مع تاريخ النقل المختار.",
            409,
          );
        }

        const sourceUpdate = await transaction.studentEnrollment.updateMany({
          where: {
            id: source.id,
            studentId,
            status: "ACTIVE",
            endedOn: null,
            deletedAt: null,
          },
          data: {
            status: "TRANSFERRED",
            endedOn: sourceEndDate,
            endReason: `نقل إلى ${target.nameAr} بتاريخ ${parsed.data.transferDate}`,
          },
        });

        if (sourceUpdate.count !== 1) {
          throw new TransferValidationError(
            "تغير تسجيل الطالب أثناء تنفيذ العملية. حدّث الصفحة وحاول مرة أخرى.",
            409,
          );
        }

        const targetEnrollment = await transaction.studentEnrollment.create({
          data: {
            studentId,
            programId: target.programId,
            halaqaId: target.id,
            status: "ACTIVE",
            startedOn: effectiveDate,
            createdByUserId: authorization.session.user.id,
          },
          select: { id: true, startedOn: true },
        });

        const transfer = await transaction.studentTransfer.create({
          data: {
            studentId,
            fromEnrollmentId: source.id,
            toEnrollmentId: targetEnrollment.id,
            transferredByUserId: authorization.session.user.id,
            transferDate: effectiveDate,
            note: parsed.data.note || null,
            idempotencyKey: parsed.data.idempotencyKey,
          },
          select: { id: true, transferDate: true },
        });

        await transaction.auditLog.create({
          data: {
            actorUserId: authorization.session.user.id,
            action: "STUDENT_TRANSFERRED",
            entityType: "student_transfer",
            entityId: transfer.id,
            requestId,
            ipAddress,
            userAgent,
            oldValues: {
              studentId,
              studentName: student.displayName,
              enrollmentId: source.id,
              halaqaId: source.halaqaId,
              halaqaName: source.halaqa.nameAr,
              stageName: source.halaqa.stage?.nameAr ?? null,
              startedOn: sourceStartedOn,
              status: "ACTIVE",
            },
            newValues: {
              enrollmentId: targetEnrollment.id,
              halaqaId: target.id,
              halaqaName: target.nameAr,
              stageName: target.stage?.nameAr ?? null,
              startedOn: parsed.data.transferDate,
              status: "ACTIVE",
            },
            metadata: {
              transferDate: parsed.data.transferDate,
              sourceEndedOn: dateValue(sourceEndDate),
              note: parsed.data.note || null,
              idempotencyKey: parsed.data.idempotencyKey,
            },
          },
        });

        return {
          repeated: false as const,
          transferId: transfer.id,
          transferDate: dateValue(transfer.transferDate),
          fromHalaqaName: source.halaqa.nameAr,
          toHalaqaName: target.nameAr,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json(
      {
        message: result.repeated
          ? `تم تنفيذ النقل مسبقاً إلى ${result.toHalaqaName}.`
          : `تم نقل الطالب من ${result.fromHalaqaName} إلى ${result.toHalaqaName} مع الحفاظ على جميع سجلاته.`,
        transfer: {
          id: result.transferId,
          transferDate: result.transferDate,
        },
      },
      { status: result.repeated ? 200 : 201 },
    );
  } catch (error) {
    if (error instanceof TransferValidationError) {
      return errorResponse(error.message, error.status);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return errorResponse(
          "تم تنفيذ عملية مماثلة أو يوجد تسجيل نشط آخر. حدّث الصفحة وتحقق من سجل النقل.",
          409,
        );
      }
      if (error.code === "P2034") {
        return errorResponse("حدث تعارض أثناء النقل. حدّث الصفحة وحاول مرة أخرى.", 409);
      }
    }

    console.error("Transfer student failed:", error);
    return errorResponse("تعذر نقل الطالب حالياً.", 500);
  }
}
