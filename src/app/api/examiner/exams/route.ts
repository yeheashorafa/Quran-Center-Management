import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { authorizeApiPermission } from "@/lib/auth/api-authorization";
import { prisma } from "@/lib/db/prisma";
import {
  getRequestIp,
  getRequestUserAgent,
  isSameOriginRequest,
} from "@/lib/http/request-metadata";
import {
  dateOnlyToUtc,
  isFutureDateInPalestine,
} from "@/lib/memorization-sessions/date";
import { officialExamResultLabel } from "@/lib/official-exams/grading";
import { getOfficialExamList } from "@/lib/official-exams/queries";
import {
  createOfficialExamSchema,
  officialExamQuerySchema,
} from "@/lib/official-exams/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET(request: NextRequest) {
  const authorization = await authorizeApiPermission("exams.read.all");
  if (authorization.response) return authorization.response;

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = officialExamQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "خيارات البحث غير صالحة.", 400);
  }

  if (parsed.data.from && parsed.data.to && parsed.data.from > parsed.data.to) {
    return errorResponse("تاريخ البداية يجب أن يسبق تاريخ النهاية.", 400);
  }

  const data = await getOfficialExamList(parsed.data);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return errorResponse("تم رفض الطلب لأسباب أمنية.", 403);
  }

  const authorization = await authorizeApiPermission("exams.manage");
  if (authorization.response) return authorization.response;

  const parsed = createOfficialExamSchema.safeParse(await request.json().catch(() => null));
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
    const result = await prisma.$transaction(
      async (transaction) => {
        const repeated = await transaction.officialExam.findUnique({
          where: { idempotencyKey: parsed.data.idempotencyKey },
          select: { id: true, studentId: true },
        });

        if (repeated) {
          if (repeated.studentId !== parsed.data.studentId) {
            throw new ExamValidationError("معرف العملية مستخدم لاختبار آخر.", 409);
          }
          return { id: repeated.id, repeated: true as const };
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
                    stage: { select: { id: true, code: true, nameAr: true } },
                  },
                },
              },
            },
          },
        });

        if (!student) throw new ExamValidationError("الطالب غير موجود.", 404);
        if (student.enrollments.length !== 1) {
          throw new ExamValidationError(
            student.enrollments.length
              ? "يوجد أكثر من تسجيل ساري للطالب في تاريخ الاختبار ويجب تصحيح البيانات أولاً."
              : "لم يكن الطالب مسجلاً في حلقة أساسية في تاريخ الاختبار.",
            409,
          );
        }

        const enrollment = student.enrollments[0];
        const duplicate = await transaction.officialExam.findFirst({
          where: {
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
          throw new ExamValidationError(
            "يوجد اختبار فعال لنفس الطالب والتاريخ والنطاق. عدّل الاختبار الموجود بدلاً من إنشاء نسخة أخرى.",
            409,
          );
        }

        const resultLabel = officialExamResultLabel(
          parsed.data.score,
          enrollment.halaqa.stage?.code,
        );

        const exam = await transaction.officialExam.create({
          data: {
            studentId: student.id,
            enrollmentId: enrollment.id,
            examinerUserId: authorization.session.user.id,
            createdByUserId: authorization.session.user.id,
            examDate,
            examType: parsed.data.examType,
            score: parsed.data.score,
            resultLabel,
            notes: parsed.data.notes || null,
            idempotencyKey: parsed.data.idempotencyKey,
            scopes: {
              create: {
                orderNo: 1,
                type: "JUZ",
                juzFrom: parsed.data.juzFrom,
                juzTo: parsed.data.juzTo,
              },
            },
          },
          select: { id: true },
        });

        await transaction.auditLog.create({
          data: {
            actorUserId: authorization.session.user.id,
            action: "OFFICIAL_EXAM_CREATED",
            entityType: "official_exam",
            entityId: exam.id,
            requestId,
            ipAddress,
            userAgent,
            newValues: {
              studentId: student.id,
              studentName: student.displayName,
              enrollmentId: enrollment.id,
              halaqaId: enrollment.halaqa.id,
              halaqaName: enrollment.halaqa.nameAr,
              stageName: enrollment.halaqa.stage?.nameAr ?? null,
              examDate: parsed.data.examDate,
              examType: parsed.data.examType,
              juzFrom: parsed.data.juzFrom,
              juzTo: parsed.data.juzTo,
              score: parsed.data.score,
              resultLabel,
              notes: parsed.data.notes || null,
            },
          },
        });

        return { id: exam.id, repeated: false as const };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json(
      {
        message: result.repeated ? "تم حفظ هذا الاختبار مسبقاً." : "تم حفظ الاختبار الرسمي بنجاح.",
        exam: { id: result.id },
      },
      { status: result.repeated ? 200 : 201 },
    );
  } catch (error) {
    if (error instanceof ExamValidationError) {
      return errorResponse(error.message, error.status);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") return errorResponse("تم تنفيذ العملية مسبقاً.", 409);
      if (error.code === "P2034") return errorResponse("حدث تعارض. حدّث الصفحة وحاول مرة أخرى.", 409);
    }

    console.error("Create official exam failed:", error);
    return errorResponse("تعذر حفظ الاختبار حالياً.", 500);
  }
}
