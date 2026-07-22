import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { authorizeApiPermission } from "@/lib/auth/api-authorization";
import { updateHalaqaStatusSchema } from "@/lib/manager/schemas";
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

export async function PATCH(
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

  const parsed = updateHalaqaStatusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "حالة الحلقة غير صالحة.", 400);
  }

  const existingHalaqa = await prisma.halaqa.findFirst({
    where: { id: halaqaId, deletedAt: null },
    select: {
      id: true,
      nameAr: true,
      status: true,
      staffAssignments: {
        where: { endsOn: null, deletedAt: null },
        select: { userId: true },
      },
    },
  });

  if (!existingHalaqa) {
    return errorResponse("الحلقة غير موجودة.", 404);
  }

  if (existingHalaqa.status === parsed.data.status) {
    return NextResponse.json({ message: "حالة الحلقة محدثة مسبقاً." });
  }

  const requestId = randomUUID();
  const ipAddress = getRequestIp(request);
  const userAgent = getRequestUserAgent(request);
  const now = new Date();

  await prisma.$transaction(async (transaction) => {
    await transaction.halaqa.update({
      where: { id: halaqaId },
      data: { status: parsed.data.status },
    });

    if (parsed.data.status === "INACTIVE") {
      const teacherIds = existingHalaqa.staffAssignments.map(({ userId }) => userId);
      if (teacherIds.length) {
        await transaction.authSession.updateMany({
          where: { userId: { in: teacherIds }, revokedAt: null },
          data: { revokedAt: now },
        });
      }
    }

    await transaction.auditLog.create({
      data: {
        actorUserId: authorization.session.user.id,
        action: parsed.data.status === "ACTIVE" ? "HALAQA_ACTIVATED" : "HALAQA_DISABLED",
        entityType: "halaqa",
        entityId: halaqaId,
        requestId,
        ipAddress,
        userAgent,
        oldValues: { status: existingHalaqa.status },
        newValues: { status: parsed.data.status },
        metadata: { nameAr: existingHalaqa.nameAr },
      },
    });
  });

  return NextResponse.json({
    message: parsed.data.status === "ACTIVE" ? "تم تفعيل الحلقة." : "تم إيقاف الحلقة دون حذف سجلاتها.",
  });
}
