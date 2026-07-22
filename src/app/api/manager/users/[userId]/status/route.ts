import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { authorizeApiPermission } from "@/lib/auth/api-authorization";
import { updateManagedUserStatusSchema } from "@/lib/manager/schemas";
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

  const parsed = updateManagedUserStatusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "حالة المستخدم غير صالحة.", 400);
  }

  if (userId === authorization.session.user.id && parsed.data.status === "DISABLED") {
    return errorResponse("لا يمكنك إيقاف حسابك الحالي.", 400);
  }

  const existingUser = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, displayName: true, status: true },
  });

  if (!existingUser) {
    return errorResponse("المستخدم غير موجود.", 404);
  }

  if (existingUser.status === parsed.data.status) {
    return NextResponse.json({ message: "حالة المستخدم محدثة مسبقاً." });
  }

  const requestId = randomUUID();
  const ipAddress = getRequestIp(request);
  const userAgent = getRequestUserAgent(request);
  const now = new Date();

  await prisma.$transaction(async (transaction) => {
    await transaction.user.update({
      where: { id: userId },
      data: {
        status: parsed.data.status,
        failedLoginCount: parsed.data.status === "ACTIVE" ? 0 : undefined,
        lockedUntil: parsed.data.status === "ACTIVE" ? null : undefined,
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
        action: parsed.data.status === "ACTIVE" ? "USER_ACTIVATED" : "USER_DISABLED",
        entityType: "user",
        entityId: userId,
        requestId,
        ipAddress,
        userAgent,
        oldValues: { status: existingUser.status },
        newValues: { status: parsed.data.status },
        metadata: { displayName: existingUser.displayName },
      },
    });
  });

  return NextResponse.json({
    message: parsed.data.status === "ACTIVE" ? "تم تفعيل المستخدم." : "تم إيقاف المستخدم.",
  });
}
