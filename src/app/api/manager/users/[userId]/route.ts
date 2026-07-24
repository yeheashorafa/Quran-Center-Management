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

const userIdSchema = z.string().uuid();

function errorResponse(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  if (!isSameOriginRequest(request)) {
    return errorResponse("تم رفض الطلب لأسباب أمنية.", 403);
  }

  const authorization = await authorizeApiPermission("users.manage");
  if (authorization.response) return authorization.response;

  const { userId } = await context.params;
  if (!userIdSchema.safeParse(userId).success) {
    return errorResponse("معرف المستخدم غير صالح.", 400);
  }

  if (userId === authorization.session.user.id) {
    return errorResponse("لا يمكنك حذف حسابك الحالي.", 400);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, displayName: true },
  });

  if (!user) {
    return errorResponse("المستخدم غير موجود.", 404);
  }

  // Check for any linked records in the system
  const [
    createdStudentsCount,
    createdEnrollmentsCount,
    transferredStudentsCount,
    createdSessionsCount,
    completedSessionsCount,
    examinedExamsCount,
    createdExamsCount,
    staffAssignmentsCount,
    auditLogsCount,
  ] = await Promise.all([
    prisma.student.count({ where: { createdByUserId: userId } }),
    prisma.studentEnrollment.count({ where: { createdByUserId: userId } }),
    prisma.studentTransfer.count({ where: { transferredByUserId: userId } }),
    prisma.memorizationSession.count({ where: { createdByUserId: userId } }),
    prisma.memorizationSession.count({ where: { completedByUserId: userId } }),
    prisma.officialExam.count({ where: { examinerUserId: userId } }),
    prisma.officialExam.count({ where: { createdByUserId: userId } }),
    prisma.halaqaStaffAssignment.count({ where: { userId } }),
    prisma.auditLog.count({ where: { actorUserId: userId } }),
  ]);

  const totalLinkedRecords =
    createdStudentsCount +
    createdEnrollmentsCount +
    transferredStudentsCount +
    createdSessionsCount +
    completedSessionsCount +
    examinedExamsCount +
    createdExamsCount +
    staffAssignmentsCount +
    auditLogsCount;

  if (totalLinkedRecords > 0) {
    return errorResponse(
      "لا يمكن حذف هذا المستخدم لأنه مرتبط بسجلات في النظام. يمكنك تعطيله فقط للحفاظ على السجلات.",
      400,
    );
  }

  const requestId = randomUUID();
  const ipAddress = getRequestIp(request);
  const userAgent = getRequestUserAgent(request);

  await prisma.$transaction(async (transaction) => {
    await transaction.userRole.deleteMany({ where: { userId } });
    await transaction.authSession.deleteMany({ where: { userId } });
    await transaction.user.delete({ where: { id: userId } });

    await transaction.auditLog.create({
      data: {
        actorUserId: authorization.session.user.id,
        action: "USER_PERMANENTLY_DELETED",
        entityType: "user",
        entityId: userId,
        requestId,
        ipAddress,
        userAgent,
        oldValues: { username: user.username, displayName: user.displayName },
      },
    });
  });

  return NextResponse.json({
    message: "تم حذف المستخدم نهائياً بنجاح.",
  });
}
