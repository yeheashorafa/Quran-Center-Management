import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { authorizeApiPermission } from "@/lib/auth/api-authorization";
import { prisma } from "@/lib/db/prisma";
import {
  getRequestIp,
  getRequestUserAgent,
  isSameOriginRequest,
} from "@/lib/http/request-metadata";
import { normalizeArabicName } from "@/lib/students/normalize";
import { createStudentSchema } from "@/lib/students/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return errorResponse("تم رفض الطلب لأسباب أمنية.", 403);
  }

  const authorization = await authorizeApiPermission("students.manage");
  if (authorization.response) return authorization.response;

  const parsed = createStudentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "بيانات الطالب غير صالحة.", 400);
  }

  const input = parsed.data;
  const normalizedFullName = normalizeArabicName(input.fullName);
  const halaqa = await prisma.halaqa.findFirst({
    where: {
      id: input.halaqaId,
      status: "ACTIVE",
      deletedAt: null,
      program: { code: "BASE_PROGRAM", status: "ACTIVE", deletedAt: null },
    },
    select: {
      id: true,
      nameAr: true,
      programId: true,
      stage: { select: { nameAr: true } },
    },
  });

  if (!halaqa) {
    return errorResponse("الحلقة غير موجودة أو غير نشطة.", 400);
  }

  const possibleDuplicate = await prisma.student.findFirst({
    where: {
      normalizedFullName,
      deletedAt: null,
      enrollments: {
        some: {
          halaqaId: halaqa.id,
          status: "ACTIVE",
          endedOn: null,
          deletedAt: null,
        },
      },
    },
    select: { id: true, displayName: true },
  });

  if (possibleDuplicate) {
    return errorResponse(
      `يوجد طالب بالاسم نفسه مسجل حالياً في هذه الحلقة: ${possibleDuplicate.displayName}.`,
      409,
    );
  }

  const requestId = randomUUID();
  const ipAddress = getRequestIp(request);
  const userAgent = getRequestUserAgent(request);
  const startedOn = dateOnly(input.startedOn);

  try {
    const student = await prisma.$transaction(async (transaction) => {
      const created = await transaction.student.create({
        data: {
          fullName: input.fullName.trim(),
          normalizedFullName,
          displayName: input.displayName?.trim() || input.fullName.trim(),
          parentPhone: input.parentPhone?.trim() || null,
          gradeLevel: input.gradeLevel?.trim() || null,
          memorizationStartedOn: input.memorizationStartedOn
            ? dateOnly(input.memorizationStartedOn)
            : null,
          notes: input.notes?.trim() || null,
          createdByUserId: authorization.session.user.id,
          enrollments: {
            create: {
              programId: halaqa.programId,
              halaqaId: halaqa.id,
              startedOn,
              createdByUserId: authorization.session.user.id,
            },
          },
        },
        select: {
          id: true,
          fullName: true,
          displayName: true,
          isActive: true,
        },
      });

      await transaction.auditLog.create({
        data: {
          actorUserId: authorization.session.user.id,
          action: "STUDENT_CREATED_AND_ENROLLED",
          entityType: "student",
          entityId: created.id,
          requestId,
          ipAddress,
          userAgent,
          newValues: {
            fullName: created.fullName,
            displayName: created.displayName,
            isActive: created.isActive,
            halaqaId: halaqa.id,
            halaqaName: halaqa.nameAr,
            stageName: halaqa.stage?.nameAr ?? null,
            startedOn: input.startedOn,
          },
        },
      });

      return created;
    });

    return NextResponse.json(
      { message: "تم إنشاء ملف الطالب وتسجيله في الحلقة بنجاح.", student },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return errorResponse("تعذر تسجيل الطالب بسبب تعارض في بيانات التسجيل.", 409);
    }

    console.error("Create student failed:", error);
    return errorResponse("تعذر إنشاء ملف الطالب حالياً.", 500);
  }
}
