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
import { normalizeUsername } from "@/lib/auth/normalize";
import { updateManagedUserSchema } from "@/lib/manager/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const userIdSchema = z.string().uuid();

function errorResponse(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const authorization = await authorizeApiPermission("users.manage");
  if (authorization.response) return authorization.response;

  const { userId } = await context.params;
  if (!userIdSchema.safeParse(userId).success) {
    return errorResponse("معرف المستخدم غير صالح.", 400);
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      username: true,
      displayName: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
      roles: {
        select: { role: { select: { code: true, nameAr: true } } },
      },
      staffAssignments: {
        where: { deletedAt: null, endsOn: null },
        select: {
          role: true,
          halaqa: {
            select: {
              id: true,
              nameAr: true,
              stage: { select: { id: true, nameAr: true } },
            },
          },
        },
      },
    },
  });

  if (!user) {
    return errorResponse("المستخدم غير موجود.", 404);
  }

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      status: user.status,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      roles: user.roles.map(({ role }) => role),
      activeHalaqat: user.staffAssignments.map(({ halaqa }) => ({
        id: halaqa.id,
        nameAr: halaqa.nameAr,
        stageName: halaqa.stage?.nameAr ?? null,
      })),
      isCurrentUser: user.id === authorization.session.user.id,
    },
  });
}

export async function PATCH(
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

  const parsed = updateManagedUserSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "بيانات المستخدم غير صالحة.", 400);
  }

  if (userId === authorization.session.user.id && parsed.data.status === "DISABLED") {
    return errorResponse("لا يمكنك إيقاف حسابك الحالي.", 400);
  }

  if (userId === authorization.session.user.id && parsed.data.role !== "CENTER_MANAGER") {
    return errorResponse("لا يمكنك إزالة صلاحية المدير عن حسابك الحالي.", 400);
  }

  const existingUser = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      username: true,
      displayName: true,
      status: true,
      roles: { select: { role: { select: { code: true } } } },
    },
  });

  if (!existingUser) {
    return errorResponse("المستخدم غير موجود.", 404);
  }

  const normalizedUsername = normalizeUsername(parsed.data.username);
  const duplicate = await prisma.user.findFirst({
    where: {
      normalizedUsername,
      id: { not: userId },
      deletedAt: null,
    },
    select: { id: true },
  });

  if (duplicate) {
    return errorResponse("اسم المستخدم مستخدم مسبقاً.", 409);
  }

  const newRoleObj = await prisma.role.findUnique({
    where: { code: parsed.data.role },
    select: { id: true, code: true, nameAr: true },
  });

  if (!newRoleObj) {
    return errorResponse("الدور المطلوب غير موجود.", 400);
  }

  const requestId = randomUUID();
  const ipAddress = getRequestIp(request);
  const userAgent = getRequestUserAgent(request);
  const now = new Date();

  await prisma.$transaction(async (transaction) => {
    await transaction.user.update({
      where: { id: userId },
      data: {
        displayName: parsed.data.displayName.trim(),
        username: parsed.data.username.trim(),
        normalizedUsername,
        status: parsed.data.status,
      },
    });

    await transaction.userRole.deleteMany({ where: { userId } });
    await transaction.userRole.create({
      data: {
        userId,
        roleId: newRoleObj.id,
      },
    });

    if (parsed.data.status === "DISABLED") {
      await transaction.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
    }

    await transaction.auditLog.create({
      data: {
        actorUserId: authorization.session.user.id,
        action: "USER_UPDATED",
        entityType: "user",
        entityId: userId,
        requestId,
        ipAddress,
        userAgent,
        oldValues: {
          displayName: existingUser.displayName,
          username: existingUser.username,
          status: existingUser.status,
          role: existingUser.roles[0]?.role.code ?? null,
        },
        newValues: {
          displayName: parsed.data.displayName.trim(),
          username: parsed.data.username.trim(),
          status: parsed.data.status,
          role: parsed.data.role,
        },
      },
    });
  });

  return NextResponse.json({
    message: "تم تحديث بيانات المستخدم بنجاح.",
  });
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
