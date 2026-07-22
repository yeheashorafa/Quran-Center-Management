import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { loginSchema } from "@/lib/auth/schemas";
import { verifyPassword } from "@/lib/auth/password";
import { generateSessionToken, hashSessionToken } from "@/lib/auth/token";
import {
  getDashboardPath,
  LOGIN_LOCK_DURATION_MS,
  MAX_FAILED_LOGIN_ATTEMPTS,
  REMEMBERED_SESSION_DURATION_MS,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
} from "@/lib/auth/constants";
import {
  getRequestIp,
  getRequestUserAgent,
  isSameOriginRequest,
} from "@/lib/http/request-metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return errorResponse("تم رفض الطلب لأسباب أمنية.", 403);
  }

  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "بيانات الدخول غير صالحة.", 400);
  }

  const input = parsed.data;
  const now = new Date();
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const requestId = randomUUID();
  const ipAddress = getRequestIp(request);
  const userAgent = getRequestUserAgent(request);

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      displayName: true,
      passwordHash: true,
      status: true,
      deletedAt: true,
      failedLoginCount: true,
      lockedUntil: true,
      roles: {
        where: { role: { code: input.role } },
        select: { role: { select: { id: true, code: true } } },
      },
      staffAssignments: input.role === "TEACHER"
        ? {
            where: {
              deletedAt: null,
              startsOn: { lte: today },
              OR: [{ endsOn: null }, { endsOn: { gte: today } }],
              halaqa: {
                stageId: input.stageId || undefined,
                status: "ACTIVE",
                deletedAt: null,
              },
            },
            select: { id: true },
            take: 1,
          }
        : false,
    },
  });

  const role = user?.roles[0]?.role;
  const teacherAssignmentIsValid =
    input.role !== "TEACHER" || Boolean(user && "staffAssignments" in user && user.staffAssignments.length);

  if (
    !user ||
    !role ||
    !teacherAssignmentIsValid ||
    user.deletedAt ||
    user.status !== "ACTIVE"
  ) {
    return errorResponse("بيانات الدخول غير صحيحة.", 401);
  }

  if (user.lockedUntil && user.lockedUntil > now) {
    return errorResponse("تم إيقاف محاولات الدخول مؤقتاً. حاول بعد عدة دقائق.", 423);
  }

  const passwordIsValid = await verifyPassword(user.passwordHash, input.password);

  if (!passwordIsValid) {
    const failedLoginCount = user.failedLoginCount + 1;
    const shouldLock = failedLoginCount >= MAX_FAILED_LOGIN_ATTEMPTS;
    const lockedUntil = shouldLock
      ? new Date(now.getTime() + LOGIN_LOCK_DURATION_MS)
      : null;

    await prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: shouldLock ? MAX_FAILED_LOGIN_ATTEMPTS : failedLoginCount,
          lockedUntil,
        },
      });

      await transaction.auditLog.create({
        data: {
          action: "AUTH_LOGIN_FAILED",
          entityType: "user",
          entityId: user.id,
          requestId,
          ipAddress,
          userAgent,
          metadata: {
            selectedRole: input.role,
            locked: shouldLock,
          },
        },
      });
    });

    return errorResponse(
      shouldLock
        ? "تم إيقاف محاولات الدخول لمدة 15 دقيقة بسبب تكرار كلمة دخول خاطئة."
        : "بيانات الدخول غير صحيحة.",
      shouldLock ? 423 : 401,
    );
  }

  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const duration = input.rememberDevice
    ? REMEMBERED_SESSION_DURATION_MS
    : SESSION_DURATION_MS;
  const expiresAt = new Date(now.getTime() + duration);

  await prisma.$transaction(async (transaction) => {
    await transaction.authSession.deleteMany({
      where: {
        userId: user.id,
        OR: [{ expiresAt: { lte: now } }, { revokedAt: { not: null } }],
      },
    });

    const session = await transaction.authSession.create({
      data: {
        userId: user.id,
        tokenHash,
        rememberDevice: input.rememberDevice,
        deviceLabel: input.rememberDevice ? "جهاز متذكر" : null,
        userAgent,
        ipAddress,
        expiresAt,
      },
      select: { id: true },
    });

    await transaction.$executeRaw`
      UPDATE "auth_sessions"
      SET "active_role_id" = CAST(${role.id} AS UUID)
      WHERE "id" = CAST(${session.id} AS UUID)
    `;

    await transaction.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: now,
      },
    });

    await transaction.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "AUTH_LOGIN_SUCCESS",
        entityType: "auth_session",
        entityId: session.id,
        requestId,
        ipAddress,
        userAgent,
        metadata: {
          selectedRole: input.role,
          rememberDevice: input.rememberDevice,
        },
      },
    });
  });

  const response = NextResponse.json({
    redirectTo: getDashboardPath(role.code),
    user: { displayName: user.displayName },
  });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    priority: "high",
  });

  return response;
}
