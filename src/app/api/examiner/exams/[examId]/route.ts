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
import { dateOnlyToUtc, isFutureDateInPalestine } from "@/lib/memorization-sessions/date";
import { officialExamResultLabel } from "@/lib/official-exams/grading";
import { updateOfficialExamSchema } from "@/lib/official-exams/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const examIdSchema = z.string().uuid();

class ExamValidationError extends Error {
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ examId: string }> },
) {
  if (!isSameOriginRequest(request)) return errorResponse("تم رفض الطلب لأسباب أمنية.", 403);

  const authorization = await authorizeApiPermission("exams.manage");
  if (authorization.response) return authorization.response;

  const { examId } = await context.params;
  if (!examIdSchema.safeParse(examId).success) return errorResponse("معرف الاختبار غير صالح.", 400);

  const parsed = updateOfficialExamSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "بيانات الاختبار غير صالحة.", 400);
  }
  if (isFutureDateInPalestine(parsed.data.examDate)) {
    return errorResponse("لا يمكن تسجيل اختبار بتاريخ مستقبلي.", 400);
  }

  const examDate = dateOnlyToUtc(parsed.data.examDate);
  const requestId = randomUUID();
  const ipAddress = getRequestIp(request);
  const userAgent = getRequestUserAgent(request);

  try {
    await prisma.$transaction(
      async (transaction) => {
        const existing = await transaction.officialExam.findUnique({
          where: { id: examId },
          select: {
            id: true,
            studentId: true,
            examDate: true,
            examType: true,
            status: true,
            score: true,
            resultLabel: true,
            notes: true,
            version: true,
            scopes: {
              orderBy: { orderNo: "asc" },
              select: { type: true, juzFrom: true, juzTo: true },
            },
          },
        });

        if (!existing) throw new ExamValidationError("الاختبار غير موجود.", 404);
        if (existing.status !== "ACTIVE") {
          throw new ExamValidationError("لا يمكن تعديل اختبار ملغى.", 409);
        }

        const student = await transaction.student.findFirst({
          where: { id: parsed.data.studentId, deletedAt: null },
          select: {
            id: true,
            displayName: true,
            enrollments: {
              where: {
                deletedAt: null,
                startedOn: { lte: examDate },
                OR: [{ endedOn: null }, { endedOn: { gte: examDate } }],
                program: { code: "BASE_PROGRAM", deletedAt: null },
              },
              take: 2,
              select: {
                id: true,
                halaqa: {
                  select: {
                    id: true,
                    nameAr: true,
                    stage: { select: { code: true, nameAr: true } },
                  },
                },
              },
            },
          },
        });

        if (!student) throw new ExamValidationError("الطالب غير موجود.", 404);
        if (student.enrollments.length !== 1) {
          throw new ExamValidationError("لا يوجد تسجيل أساسي واحد ساري للطالب في تاريخ الاختبار.", 409);
        }

        const enrollment = student.enrollments[0];
        const duplicate = await transaction.officialExam.findFirst({
          where: {
            id: { not: examId },
            studentId: student.id,
            examDate,
            examType: parsed.data.examType,
            status: "ACTIVE",
            scopes: {
              some: {
                type: "JUZ",
                juzFrom: parsed.data.juzFrom,
                juzTo: parsed.data.juzTo,
              },
            },
          },
          select: { id: true },
        });
        if (duplicate) {
          throw new ExamValidationError("يوجد اختبار آخر بنفس التاريخ والنطاق.", 409);
        }

        const resultLabel = officialExamResultLabel(
          parsed.data.score,
          enrollment.halaqa.stage?.code,
        );
        const updated = await transaction.officialExam.updateMany({
          where: { id: examId, status: "ACTIVE", version: parsed.data.version },
          data: {
            studentId: student.id,
            enrollmentId: enrollment.id,
            examDate,
            examType: parsed.data.examType,
            score: parsed.data.score,
            resultLabel,
            notes: parsed.data.notes || null,
            version: { increment: 1 },
          },
        });

        if (updated.count !== 1) {
          throw new ExamValidationError(
            "تم تعديل الاختبار من جهاز آخر. حدّث السجل قبل إعادة المحاولة.",
            409,
          );
        }

        await transaction.officialExamScope.deleteMany({ where: { examId } });
        await transaction.officialExamScope.create({
          data: {
            examId,
            orderNo: 1,
            type: "JUZ",
            juzFrom: parsed.data.juzFrom,
            juzTo: parsed.data.juzTo,
          },
        });

        await transaction.auditLog.create({
          data: {
            actorUserId: authorization.session.user.id,
            action: "OFFICIAL_EXAM_UPDATED",
            entityType: "official_exam",
            entityId: examId,
            requestId,
            ipAddress,
            userAgent,
            oldValues: {
              studentId: existing.studentId,
              examDate: existing.examDate.toISOString().slice(0, 10),
              examType: existing.examType,
              score: existing.score === null ? null : Number(existing.score),
              resultLabel: existing.resultLabel,
              notes: existing.notes,
              scopes: existing.scopes,
              version: existing.version,
            },
            newValues: {
              studentId: student.id,
              studentName: student.displayName,
              enrollmentId: enrollment.id,
              halaqaName: enrollment.halaqa.nameAr,
              stageName: enrollment.halaqa.stage?.nameAr ?? null,
              examDate: parsed.data.examDate,
              examType: parsed.data.examType,
              juzFrom: parsed.data.juzFrom,
              juzTo: parsed.data.juzTo,
              score: parsed.data.score,
              resultLabel,
              notes: parsed.data.notes || null,
              version: parsed.data.version + 1,
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json({ message: "تم تحديث الاختبار الرسمي بنجاح." });
  } catch (error) {
    if (error instanceof ExamValidationError) return errorResponse(error.message, error.status);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return errorResponse("حدث تعارض. حدّث الصفحة وحاول مرة أخرى.", 409);
    }
    console.error("Update official exam failed:", error);
    return errorResponse("تعذر تحديث الاختبار حالياً.", 500);
  }
}
