import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizeApiPermission } from "@/lib/auth/api-authorization";
import { prisma } from "@/lib/db/prisma";
import { dateOnlyToUtc, isIsoDateOnly } from "@/lib/memorization-sessions/date";
import { getTeacherSessionEditorData } from "@/lib/memorization-sessions/queries";
import {
  getRequestIp,
  getRequestUserAgent,
  isSameOriginRequest,
} from "@/lib/http/request-metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ halaqaId: string; sessionDate: string; studentId: string }>;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return errorResponse("تم رفض الطلب لأسباب أمنية.", 403);
  }

  const authorization = await authorizeApiPermission("sessions.manage.own");
  if (authorization.response) return authorization.response;

  const { halaqaId, sessionDate, studentId } = await context.params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(halaqaId)) {
    return errorResponse("معرف الحلقة غير صالح.", 400);
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(studentId)) {
    return errorResponse("معرف الطالب غير صالح.", 400);
  }
  if (!isIsoDateOnly(sessionDate)) {
    return errorResponse("التاريخ غير صالح.", 400);
  }

  const date = dateOnlyToUtc(sessionDate);

  // Check teacher assignment scope
  const assignment = await prisma.halaqaStaffAssignment.findFirst({
    where: {
      userId: authorization.session.user.id,
      halaqaId,
      deletedAt: null,
      startsOn: { lte: date },
      OR: [{ endsOn: null }, { endsOn: { gte: date } }],
      halaqa: { deletedAt: null, program: { deletedAt: null } },
    },
    select: { id: true },
  });

  if (!assignment) {
    return errorResponse("الحلقة غير موجودة ضمن الحلقات المعيّن عليها في هذا التاريخ.", 404);
  }

  const session = await prisma.memorizationSession.findUnique({
    where: { halaqaId_sessionDate: { halaqaId, sessionDate: date } },
    select: { id: true, status: true },
  });

  if (!session) {
    return errorResponse("الجلسة غير موجودة أصلاً.", 404);
  }

  if (session.status === "LOCKED") {
    return errorResponse("الجلسة مقفلة ولا يمكن التعديل عليها.", 423);
  }

  const recordItem = await prisma.sessionRecordItem.findUnique({
    where: {
      sessionId_studentId: {
        sessionId: session.id,
        studentId,
      },
    },
    select: { id: true },
  });

  if (!recordItem) {
    return errorResponse("لا يوجد تسميع لهذا الطالب داخل هذه الجلسة.", 404);
  }

  const requestId = randomUUID();
  const ipAddress = getRequestIp(request);
  const userAgent = getRequestUserAgent(request);

  try {
    await prisma.$transaction(async (transaction) => {
      // 1. Delete all activities for this student item
      await transaction.sessionActivity.deleteMany({
        where: { itemId: recordItem.id },
      });

      // 2. Delete the record item itself
      await transaction.sessionRecordItem.delete({
        where: { id: recordItem.id },
      });

      // 3. Increment session version
      await transaction.memorizationSession.update({
        where: { id: session.id },
        data: { version: { increment: 1 } },
      });

      // 4. Audit Log
      await transaction.auditLog.create({
        data: {
          actorUserId: authorization.session.user.id,
          action: "STUDENT_SESSION_RECITATION_DELETED",
          entityType: "session_record_item",
          entityId: recordItem.id,
          requestId,
          ipAddress,
          userAgent,
          newValues: {
            halaqaId,
            sessionDate,
            studentId,
          },
        },
      });
    });

    const data = await getTeacherSessionEditorData({
      userId: authorization.session.user.id,
      halaqaId,
      sessionDate,
    });

    return NextResponse.json({
      message: "تم حذف تسميع الطالب بنجاح من هذه الجلسة.",
      data,
    });
  } catch (error) {
    console.error("Delete student recitation failed:", error);
    return errorResponse("تعذر حذف تسميع الطالب حالياً.", 500);
  }
}
