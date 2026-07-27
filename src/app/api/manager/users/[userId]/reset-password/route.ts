import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { authorizeApiPermission } from "@/lib/auth/api-authorization";
import { hashPassword } from "@/lib/auth/password";
import { resetUserPasswordSchema } from "@/lib/manager/schemas";
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

function generateTemporaryPassword(length = 10): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(
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

  const parsed = resetUserPasswordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "بيانات إعادة تعيين كلمة المرور غير صالحة.", 400);
  }

  const existingUser = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      username: true,
      displayName: true,
      roles: { select: { role: { select: { code: true } } } },
    },
  });

  if (!existingUser) {
    return errorResponse("المستخدم غير موجود.", 404);
  }

  const newPasswordText =
    parsed.data.mode === "generate"
      ? generateTemporaryPassword(10)
      : parsed.data.newPassword!;

  const newPasswordHash = await hashPassword(newPasswordText);
  const requestId = randomUUID();
  const ipAddress = getRequestIp(request);
  const userAgent = getRequestUserAgent(request);
  const now = new Date();

  await prisma.$transaction(async (transaction) => {
    await transaction.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        passwordChangedAt: now,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });

    await transaction.auditLog.create({
      data: {
        actorUserId: authorization.session.user.id,
        action: "USER_PASSWORD_RESET",
        entityType: "user",
        entityId: userId,
        requestId,
        ipAddress,
        userAgent,
        newValues: {
          targetUserId: userId,
          resetByUserId: authorization.session.user.id,
          username: existingUser.username,
          mode: parsed.data.mode,
          timestamp: now.toISOString(),
        },
      },
    });
  });

  return NextResponse.json({
    message: "تم إعادة تعيين كلمة المرور بنجاح. انسخ كلمة المرور الجديدة قبل إغلاق النافذة.",
    temporaryPassword: newPasswordText,
  });
}
