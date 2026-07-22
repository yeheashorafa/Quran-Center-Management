import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeApiPermission } from "@/lib/auth/api-authorization";
import { prisma } from "@/lib/db/prisma";
import {
  getRequestIp,
  getRequestUserAgent,
  isSameOriginRequest,
} from "@/lib/http/request-metadata";
import { voidOfficialExamSchema } from "@/lib/official-exams/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const examIdSchema = z.string().uuid();

function errorResponse(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ examId: string }> },
) {
  if (!isSameOriginRequest(request)) return errorResponse("تم رفض الطلب لأسباب أمنية.", 403);

  const authorization = await authorizeApiPermission("exams.manage");
  if (authorization.response) return authorization.response;

  const { examId } = await context.params;
  if (!examIdSchema.safeParse(examId).success) return errorResponse("معرف الاختبار غير صالح.", 400);

  const parsed = voidOfficialExamSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "سبب الإلغاء غير صالح.", 400);
  }

  const existing = await prisma.officialExam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      status: true,
      version: true,
      studentId: true,
      examDate: true,
      score: true,
      resultLabel: true,
    },
  });
  if (!existing) return errorResponse("الاختبار غير موجود.", 404);
  if (existing.status === "VOIDED") return NextResponse.json({ message: "الاختبار ملغى مسبقاً." });

  const requestId = randomUUID();
  const ipAddress = getRequestIp(request);
  const userAgent = getRequestUserAgent(request);

  try {
    const updated = await prisma.$transaction(async (transaction) => {
      const result = await transaction.officialExam.updateMany({
        where: { id: examId, status: "ACTIVE", version: parsed.data.version },
        data: {
          status: "VOIDED",
          voidedAt: new Date(),
          voidReason: parsed.data.reason,
          version: { increment: 1 },
        },
      });

      if (result.count !== 1) return false;

      await transaction.auditLog.create({
        data: {
          actorUserId: authorization.session.user.id,
          action: "OFFICIAL_EXAM_VOIDED",
          entityType: "official_exam",
          entityId: examId,
          requestId,
          ipAddress,
          userAgent,
          oldValues: {
            status: existing.status,
            version: existing.version,
            studentId: existing.studentId,
            examDate: existing.examDate.toISOString().slice(0, 10),
            score: existing.score === null ? null : Number(existing.score),
            resultLabel: existing.resultLabel,
          },
          newValues: {
            status: "VOIDED",
            reason: parsed.data.reason,
            version: parsed.data.version + 1,
          },
        },
      });

      return true;
    });

    if (!updated) {
      return errorResponse("تم تعديل الاختبار من جهاز آخر. حدّث السجل وحاول مرة أخرى.", 409);
    }

    return NextResponse.json({ message: "تم إلغاء الاختبار مع الاحتفاظ به في السجل التاريخي." });
  } catch (error) {
    console.error("Void official exam failed:", error);
    return errorResponse("تعذر إلغاء الاختبار حالياً.", 500);
  }
}
