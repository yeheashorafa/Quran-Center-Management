import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { authorizeApiPermission } from "@/lib/auth/api-authorization";
import { normalizeUsername } from "@/lib/auth/normalize";
import { hashPassword } from "@/lib/auth/password";
import { createManagedUserSchema } from "@/lib/manager/schemas";
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

  const authorization = await authorizeApiPermission("users.manage");
  if (authorization.response) return authorization.response;

  const parsed = createManagedUserSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "بيانات المستخدم غير صالحة.", 400);
  }

  const input = parsed.data;
  const normalizedUsername = normalizeUsername(input.username);
  const passwordHash = await hashPassword(input.password);
  const requestId = randomUUID();
  const ipAddress = getRequestIp(request);
  const userAgent = getRequestUserAgent(request);

  const role = await prisma.role.findUnique({
    where: { code: input.role },
    select: { id: true, code: true, nameAr: true },
  });

  if (!role) {
    return errorResponse("الدور المطلوب غير موجود في قاعدة البيانات.", 400);
  }

  const duplicate = await prisma.user.findUnique({
    where: { normalizedUsername },
    select: { id: true },
  });

  if (duplicate) {
    return errorResponse("اسم المستخدم مستخدم مسبقاً.", 409);
  }

  try {
    const createdUser = await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          username: input.username.trim(),
          normalizedUsername,
          displayName: input.displayName.trim(),
          passwordHash,
          passwordChangedAt: new Date(),
          roles: {
            create: { roleId: role.id },
          },
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          status: true,
        },
      });

      await transaction.auditLog.create({
        data: {
          actorUserId: authorization.session.user.id,
          action: "USER_CREATED",
          entityType: "user",
          entityId: user.id,
          requestId,
          ipAddress,
          userAgent,
          newValues: {
            username: user.username,
            displayName: user.displayName,
            status: user.status,
            role: role.code,
          },
        },
      });

      return user;
    });

    return NextResponse.json(
      {
        message: "تم إنشاء المستخدم بنجاح.",
        user: {
          ...createdUser,
          role: { code: role.code, nameAr: role.nameAr },
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return errorResponse("اسم المستخدم مستخدم مسبقاً.", 409);
    }

    console.error("Create managed user failed:", error);
    return errorResponse("تعذر إنشاء المستخدم حالياً.", 500);
  }
}
