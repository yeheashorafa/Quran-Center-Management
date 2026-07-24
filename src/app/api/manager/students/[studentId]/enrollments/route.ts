import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { authorizeApiPermission } from "@/lib/auth/api-authorization";
import { prisma } from "@/lib/db/prisma";
import {
  getRequestIp,
  getRequestUserAgent,
  isSameOriginRequest,
} from "@/lib/http/request-metadata";
import { createStudentEnrollmentSchema } from "@/lib/students/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const studentIdSchema = z.string().uuid();

function errorResponse(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ studentId: string }> },
) {
  if (!isSameOriginRequest(request)) {
    return errorResponse("تم رفض الطلب لأسباب أمنية.", 403);
  }

  const authorization = await authorizeApiPermission("students.manage");
  if (authorization.response) return authorization.response;

  const { studentId } = await context.params;
  if (!studentIdSchema.safeParse(studentId).success) {
    return errorResponse("معرف الطالب غير صالح.", 400);
  }

  const parsed = createStudentEnrollmentSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "بيانات التسجيل غير صالحة.", 400);
  }

  const [student, halaqa] = await Promise.all([
    prisma.student.findFirst({
      where: { id: studentId, isActive: true, deletedAt: null },
      select: { id: true, displayName: true },
    }),
    prisma.halaqa.findFirst({
      where: {
        id: parsed.data.halaqaId,
        status: "ACTIVE",
        deletedAt: null,
        program: { code: "BASE_PROGRAM", status: "ACTIVE", deletedAt: null },
      },
      select: { id: true, nameAr: true, programId: true },
    }),
  ]);

  if (!student) return errorResponse("الطالب غير موجود أو ملفه غير نشط.", 400);
  if (!halaqa) return errorResponse("الحلقة غير موجودة أو غير نشطة.", 400);

  const activeEnrollment = await prisma.studentEnrollment.findFirst({
    where: {
      studentId,
      programId: halaqa.programId,
      status: "ACTIVE",
      endedOn: null,
      deletedAt: null,
    },
    select: { id: true, halaqa: { select: { nameAr: true } } },
  });

  if (activeEnrollment) {
    return errorResponse(
      `الطالب مسجل حالياً في ${activeEnrollment.halaqa.nameAr}. استخدم عملية نقل الطالب عند تغيير الحلقة.`,
      409,
    );
  }

  const requestId = randomUUID();
  const ipAddress = getRequestIp(request);
  const userAgent = getRequestUserAgent(request);

  try {
    const enrollment = await prisma.$transaction(async (transaction) => {
      const created = await transaction.studentEnrollment.create({
        data: {
          studentId,
          programId: halaqa.programId,
          halaqaId: halaqa.id,
          startedOn: dateOnly(parsed.data.startedOn),
          createdByUserId: authorization.session.user.id,
        },
        select: { id: true, status: true, startedOn: true },
      });

      await transaction.auditLog.create({
        data: {
          actorUserId: authorization.session.user.id,
          action: "STUDENT_ENROLLED",
          entityType: "student_enrollment",
          entityId: created.id,
          requestId,
          ipAddress,
          userAgent,
          newValues: {
            studentId,
            studentName: student.displayName,
            halaqaId: halaqa.id,
            halaqaName: halaqa.nameAr,
            startedOn: parsed.data.startedOn,
            status: created.status,
          },
        },
      });

      return created;
    });

    return NextResponse.json(
      { message: "تم تسجيل الطالب في الحلقة بنجاح.", enrollment },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return errorResponse("يوجد تسجيل نشط للطالب داخل البرنامج الأساسي.", 409);
    }

    console.error("Create student enrollment failed:", error);
    return errorResponse("تعذر تسجيل الطالب في الحلقة حالياً.", 500);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ studentId: string }> },
) {
  if (!isSameOriginRequest(request)) {
    return errorResponse("تم رفض الطلب لأسباب أمنية.", 403);
  }

  const authorization = await authorizeApiPermission("students.manage");
  if (authorization.response) return authorization.response;

  const { studentId } = await context.params;
  if (!studentIdSchema.safeParse(studentId).success) {
    return errorResponse("معرف الطالب غير صالح.", 400);
  }

  const url = new URL(request.url);
  const enrollmentId = url.searchParams.get("enrollmentId");

  const enrollment = await prisma.studentEnrollment.findFirst({
    where: enrollmentId
      ? { id: enrollmentId, studentId, deletedAt: null }
      : { studentId, status: "ACTIVE", endedOn: null, deletedAt: null },
    select: {
      id: true,
      student: { select: { displayName: true } },
      halaqa: { select: { nameAr: true } },
    },
  });

  if (!enrollment) {
    return errorResponse("التسجيل النشط للطالب غير موجود.", 404);
  }

  const requestId = randomUUID();
  const ipAddress = getRequestIp(request);
  const userAgent = getRequestUserAgent(request);
  const now = new Date();

  await prisma.$transaction(async (transaction) => {
    await transaction.studentEnrollment.update({
      where: { id: enrollment.id },
      data: {
        status: "INACTIVE",
        endedOn: now,
        endReason: "تم إزالة الطالب من الحلقة",
      },
    });

    await transaction.auditLog.create({
      data: {
        actorUserId: authorization.session.user.id,
        action: "STUDENT_REMOVED_FROM_HALAQA",
        entityType: "student_enrollment",
        entityId: enrollment.id,
        requestId,
        ipAddress,
        userAgent,
        newValues: {
          studentId,
          studentName: enrollment.student.displayName,
          halaqaName: enrollment.halaqa.nameAr,
          endedOn: now.toISOString().slice(0, 10),
        },
      },
    });
  });

  return NextResponse.json({
    message: `تمت إزالة الطالب من ${enrollment.halaqa.nameAr} وحفظ سجلاته التاريخية.`,
  });
}
