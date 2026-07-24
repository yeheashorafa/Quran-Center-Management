import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeApiPermission } from "@/lib/auth/api-authorization";
import { prisma } from "@/lib/db/prisma";
import {
  getRequestIp,
  getRequestUserAgent,
  isSameOriginRequest,
} from "@/lib/http/request-metadata";
import { normalizeArabicName } from "@/lib/students/normalize";
import { updateStudentSchema } from "@/lib/students/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const studentIdSchema = z.string().uuid();

function errorResponse(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ studentId: string }> },
) {
  const authorization = await authorizeApiPermission("students.manage");
  if (authorization.response) return authorization.response;

  const { studentId } = await context.params;
  if (!studentIdSchema.safeParse(studentId).success) {
    return errorResponse("معرف الطالب غير صالح.", 400);
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, fullName: true, displayName: true, isActive: true },
  });

  if (!student) {
    return errorResponse("الطالب غير موجود.", 404);
  }

  const [enrollmentCount, sessionCount, examCount] = await Promise.all([
    prisma.studentEnrollment.count({ where: { studentId } }),
    prisma.sessionRecordItem.count({ where: { studentId } }),
    prisma.officialExam.count({ where: { studentId } }),
  ]);

  return NextResponse.json({
    student,
    counts: {
      enrollments: enrollmentCount,
      sessions: sessionCount,
      exams: examCount,
    },
    hasLinkedData: enrollmentCount > 0 || sessionCount > 0 || examCount > 0,
  });
}

export async function PATCH(
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

  const parsed = updateStudentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "بيانات الطالب غير صالحة.", 400);
  }

  const existing = await prisma.student.findFirst({
    where: { id: studentId, deletedAt: null },
    select: {
      id: true,
      fullName: true,
      normalizedFullName: true,
      displayName: true,
      parentPhone: true,
      gradeLevel: true,
      memorizationStartedOn: true,
      notes: true,
    },
  });

  if (!existing) return errorResponse("الطالب غير موجود.", 404);

  const input = parsed.data;
  const requestId = randomUUID();
  const ipAddress = getRequestIp(request);
  const userAgent = getRequestUserAgent(request);

  const newValues = {
    fullName: input.fullName.trim(),
    normalizedFullName: normalizeArabicName(input.fullName),
    displayName: input.displayName.trim(),
    parentPhone: input.parentPhone?.trim() || null,
    gradeLevel: input.gradeLevel?.trim() || null,
    memorizationStartedOn: input.memorizationStartedOn
      ? dateOnly(input.memorizationStartedOn)
      : null,
    notes: input.notes?.trim() || null,
  };

  await prisma.$transaction(async (transaction) => {
    await transaction.student.update({
      where: { id: studentId },
      data: newValues,
    });

    await transaction.auditLog.create({
      data: {
        actorUserId: authorization.session.user.id,
        action: "STUDENT_PROFILE_UPDATED",
        entityType: "student",
        entityId: studentId,
        requestId,
        ipAddress,
        userAgent,
        oldValues: {
          fullName: existing.fullName,
          displayName: existing.displayName,
          parentPhone: existing.parentPhone,
          gradeLevel: existing.gradeLevel,
          memorizationStartedOn: existing.memorizationStartedOn?.toISOString().slice(0, 10) ?? null,
          notes: existing.notes,
        },
        newValues: {
          fullName: newValues.fullName,
          displayName: newValues.displayName,
          parentPhone: newValues.parentPhone,
          gradeLevel: newValues.gradeLevel,
          memorizationStartedOn:
            newValues.memorizationStartedOn?.toISOString().slice(0, 10) ?? null,
          notes: newValues.notes,
        },
      },
    });
  });

  return NextResponse.json({ message: "تم تحديث ملف الطالب بنجاح." });
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
  const force = url.searchParams.get("force") === "true";

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, fullName: true, displayName: true },
  });

  if (!student) {
    return errorResponse("الطالب غير موجود.", 404);
  }

  const [enrollmentCount, sessionCount, examCount] = await Promise.all([
    prisma.studentEnrollment.count({ where: { studentId } }),
    prisma.sessionRecordItem.count({ where: { studentId } }),
    prisma.officialExam.count({ where: { studentId } }),
  ]);

  const hasLinkedData = enrollmentCount > 0 || sessionCount > 0 || examCount > 0;

  if (hasLinkedData && !force) {
    return NextResponse.json(
      {
        message: "هذا الطالب لديه بيانات مرتبطة. يجب تأكيد الحذف النهائي.",
        counts: {
          enrollments: enrollmentCount,
          sessions: sessionCount,
          exams: examCount,
        },
        hasLinkedData: true,
      },
      { status: 400 },
    );
  }

  const requestId = randomUUID();
  const ipAddress = getRequestIp(request);
  const userAgent = getRequestUserAgent(request);

  await prisma.$transaction(async (transaction) => {
    // 1. Delete SessionActivities for this student
    const recordItems = await transaction.sessionRecordItem.findMany({
      where: { studentId },
      select: { id: true },
    });
    const itemIds = recordItems.map((i) => i.id);

    if (itemIds.length > 0) {
      await transaction.sessionActivity.deleteMany({
        where: { itemId: { in: itemIds } },
      });
    }

    // 2. Delete SessionRecordItems for this student
    await transaction.sessionRecordItem.deleteMany({
      where: { studentId },
    });

    // 3. Delete OfficialExams and OfficialExamScopes for this student
    const exams = await transaction.officialExam.findMany({
      where: { studentId },
      select: { id: true },
    });
    const examIds = exams.map((ex) => ex.id);

    if (examIds.length > 0) {
      await transaction.officialExamScope.deleteMany({
        where: { examId: { in: examIds } },
      });
      await transaction.officialExam.deleteMany({
        where: { studentId },
      });
    }

    // 4. Delete StudentTransfers referencing this student
    await transaction.studentTransfer.deleteMany({
      where: { studentId },
    });

    // 5. Delete StudentEnrollments for this student
    await transaction.studentEnrollment.deleteMany({
      where: { studentId },
    });

    // 6. Delete Student record itself
    await transaction.student.delete({
      where: { id: studentId },
    });

    // 7. Audit Log
    await transaction.auditLog.create({
      data: {
        actorUserId: authorization.session.user.id,
        action: "STUDENT_PERMANENTLY_DELETED",
        entityType: "student",
        entityId: studentId,
        requestId,
        ipAddress,
        userAgent,
        oldValues: { fullName: student.fullName, displayName: student.displayName },
        metadata: {
          deletedEnrollmentsCount: enrollmentCount,
          deletedSessionsCount: sessionCount,
          deletedExamsCount: examCount,
          forced: force,
        },
      },
    });
  });

  return NextResponse.json({
    message: "تم حذف الطالب وتصفية كافة بياناته نهائياً بنجاح.",
  });
}
