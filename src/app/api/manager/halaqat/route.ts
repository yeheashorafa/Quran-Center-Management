import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { authorizeApiPermission } from "@/lib/auth/api-authorization";
import { createHalaqaSchema } from "@/lib/manager/schemas";
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

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function createHalaqaCode(stageCode: string): string {
  return `${stageCode}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return errorResponse("تم رفض الطلب لأسباب أمنية.", 403);
  }

  const authorization = await authorizeApiPermission("halaqat.manage");
  if (authorization.response) return authorization.response;

  const parsed = createHalaqaSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "بيانات الحلقة غير صالحة.", 400);
  }

  const input = parsed.data;
  const [program, stage, teacher, duplicateName] = await Promise.all([
    prisma.program.findFirst({
      where: { code: "BASE_PROGRAM", status: "ACTIVE", deletedAt: null },
      select: { id: true },
    }),
    prisma.stage.findFirst({
      where: { id: input.stageId, isActive: true },
      select: { id: true, code: true, nameAr: true },
    }),
    prisma.user.findFirst({
      where: {
        id: input.teacherUserId,
        status: "ACTIVE",
        deletedAt: null,
        roles: { some: { role: { code: "TEACHER" } } },
      },
      select: { id: true, displayName: true },
    }),
    prisma.halaqa.findFirst({
      where: {
        nameAr: { equals: input.nameAr.trim(), mode: "insensitive" },
        stageId: input.stageId,
        deletedAt: null,
      },
      select: { id: true },
    }),
  ]);

  if (!program) return errorResponse("البرنامج الأساسي غير موجود أو غير نشط.", 400);
  if (!stage) return errorResponse("المرحلة المحددة غير موجودة.", 400);
  if (!teacher) return errorResponse("الشيخ المحدد غير نشط أو لا يملك دور الشيخ.", 400);
  if (duplicateName) return errorResponse("توجد حلقة بالاسم نفسه داخل هذه المرحلة.", 409);

  const effectiveFrom = dateOnly(input.effectiveFrom);
  const requestId = randomUUID();
  const ipAddress = getRequestIp(request);
  const userAgent = getRequestUserAgent(request);

  try {
    const halaqa = await prisma.$transaction(async (transaction) => {
      const created = await transaction.halaqa.create({
        data: {
          code: createHalaqaCode(stage.code),
          nameAr: input.nameAr.trim(),
          programId: program.id,
          stageId: stage.id,
          notes: input.notes || null,
          schedules: {
            create: input.weekdays.map((weekday) => ({ weekday, effectiveFrom })),
          },
          staffAssignments: {
            create: {
              userId: teacher.id,
              role: "PRIMARY_TEACHER",
              startsOn: effectiveFrom,
            },
          },
        },
        select: { id: true, code: true, nameAr: true, status: true },
      });

      await transaction.auditLog.create({
        data: {
          actorUserId: authorization.session.user.id,
          action: "HALAQA_CREATED",
          entityType: "halaqa",
          entityId: created.id,
          requestId,
          ipAddress,
          userAgent,
          newValues: {
            code: created.code,
            nameAr: created.nameAr,
            status: created.status,
            stageId: stage.id,
            stageName: stage.nameAr,
            teacherUserId: teacher.id,
            teacherName: teacher.displayName,
            weekdays: input.weekdays,
            effectiveFrom: input.effectiveFrom,
          },
        },
      });

      return created;
    });

    return NextResponse.json(
      { message: "تم إنشاء الحلقة وربط الشيخ بها بنجاح.", halaqa },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return errorResponse("تعذر إنشاء الحلقة بسبب تعارض في البيانات.", 409);
    }

    console.error("Create halaqa failed:", error);
    return errorResponse("تعذر إنشاء الحلقة حالياً.", 500);
  }
}
