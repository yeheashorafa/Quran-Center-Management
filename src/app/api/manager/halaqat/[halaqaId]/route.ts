import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { authorizeApiPermission } from "@/lib/auth/api-authorization";
import {
  getRequestIp,
  getRequestUserAgent,
  isSameOriginRequest,
} from "@/lib/http/request-metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const halaqaIdSchema = z.string().uuid();

function errorResponse(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ halaqaId: string }> },
) {
  const authorization = await authorizeApiPermission("halaqat.manage");
  if (authorization.response) return authorization.response;

  const { halaqaId } = await context.params;
  if (!halaqaIdSchema.safeParse(halaqaId).success) {
    return errorResponse("معرف الحلقة غير صالح.", 400);
  }

  const halaqa = await prisma.halaqa.findUnique({
    where: { id: halaqaId },
    select: { id: true, nameAr: true, code: true, status: true },
  });

  if (!halaqa) {
    return errorResponse("الحلقة غير موجودة.", 404);
  }

  const [enrollmentCount, sessionCount, examCount] = await Promise.all([
    prisma.studentEnrollment.count({ where: { halaqaId } }),
    prisma.memorizationSession.count({ where: { halaqaId } }),
    prisma.officialExam.count({ where: { enrollment: { halaqaId } } }),
  ]);

  return NextResponse.json({
    halaqa,
    counts: {
      enrollments: enrollmentCount,
      sessions: sessionCount,
      exams: examCount,
    },
    hasLinkedData: enrollmentCount > 0 || sessionCount > 0 || examCount > 0,
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ halaqaId: string }> },
) {
  if (!isSameOriginRequest(request)) {
    return errorResponse("تم رفض الطلب لأسباب أمنية.", 403);
  }

  const authorization = await authorizeApiPermission("halaqat.manage");
  if (authorization.response) return authorization.response;

  const { halaqaId } = await context.params;
  if (!halaqaIdSchema.safeParse(halaqaId).success) {
    return errorResponse("معرف الحلقة غير صالح.", 400);
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "true";

  const halaqa = await prisma.halaqa.findUnique({
    where: { id: halaqaId },
    select: { id: true, nameAr: true, code: true, status: true },
  });

  if (!halaqa) {
    return errorResponse("الحلقة غير موجودة.", 404);
  }

  const [enrollmentCount, sessionCount, examCount] = await Promise.all([
    prisma.studentEnrollment.count({ where: { halaqaId } }),
    prisma.memorizationSession.count({ where: { halaqaId } }),
    prisma.officialExam.count({ where: { enrollment: { halaqaId } } }),
  ]);

  const hasLinkedData = enrollmentCount > 0 || sessionCount > 0 || examCount > 0;

  if (hasLinkedData && !force) {
    return NextResponse.json(
      {
        message: "هذه الحلقة تحتوي على بيانات مرتبطة. يجب تأكيد الحذف النهائي.",
        counts: {
          enrollments: enrollmentCount,
          sessions: sessionCount,
          exams: examCount,
        },
        hasLinkedData: true,
      },
      { status: 400 },
    );
  }

  const requestId = randomUUID();
  const ipAddress = getRequestIp(request);
  const userAgent = getRequestUserAgent(request);

  await prisma.$transaction(async (transaction) => {
    // 1. Get enrollments and sessions for this halaqa
    const enrollments = await transaction.studentEnrollment.findMany({
      where: { halaqaId },
      select: { id: true },
    });
    const enrollmentIds = enrollments.map((e) => e.id);

    const sessions = await transaction.memorizationSession.findMany({
      where: { halaqaId },
      select: { id: true },
    });
    const sessionIds = sessions.map((s) => s.id);

    // 2. Delete session activities & items
    if (sessionIds.length > 0) {
      const sessionRecordItems = await transaction.sessionRecordItem.findMany({
        where: { sessionId: { in: sessionIds } },
        select: { id: true },
      });
      const itemIds = sessionRecordItems.map((i) => i.id);

      if (itemIds.length > 0) {
        await transaction.sessionActivity.deleteMany({
          where: { itemId: { in: itemIds } },
        });
      }

      await transaction.sessionRecordItem.deleteMany({
        where: { sessionId: { in: sessionIds } },
      });

      await transaction.memorizationSession.deleteMany({
        where: { halaqaId },
      });
    }

    // 3. Delete official exams & transfers linked to these enrollments
    if (enrollmentIds.length > 0) {
      const exams = await transaction.officialExam.findMany({
        where: { enrollmentId: { in: enrollmentIds } },
        select: { id: true },
      });
      const examIds = exams.map((ex) => ex.id);

      if (examIds.length > 0) {
        await transaction.officialExamScope.deleteMany({
          where: { examId: { in: examIds } },
        });
        await transaction.officialExam.deleteMany({
          where: { id: { in: examIds } },
        });
      }

      await transaction.studentTransfer.deleteMany({
        where: {
          OR: [
            { fromEnrollmentId: { in: enrollmentIds } },
            { toEnrollmentId: { in: enrollmentIds } },
          ],
        },
      });

      await transaction.studentEnrollment.deleteMany({
        where: { halaqaId },
      });
    }

    // 4. Delete staff assignments & schedules
    await transaction.halaqaStaffAssignment.deleteMany({
      where: { halaqaId },
    });

    await transaction.halaqaSchedule.deleteMany({
      where: { halaqaId },
    });

    // 5. Delete the Halaqa itself
    await transaction.halaqa.delete({
      where: { id: halaqaId },
    });

    // 6. Audit Log
    await transaction.auditLog.create({
      data: {
        actorUserId: authorization.session.user.id,
        action: "HALAQA_PERMANENTLY_DELETED",
        entityType: "halaqa",
        entityId: halaqaId,
        requestId,
        ipAddress,
        userAgent,
        oldValues: { nameAr: halaqa.nameAr, code: halaqa.code },
        metadata: {
          deletedStudentsCount: enrollmentCount,
          deletedSessionsCount: sessionCount,
          deletedExamsCount: examCount,
          forced: force,
        },
      },
    });
  });

  return NextResponse.json({
    message: "تم حذف الحلقة وتصفية بياناتها نهائياً بنجاح.",
  });
}
