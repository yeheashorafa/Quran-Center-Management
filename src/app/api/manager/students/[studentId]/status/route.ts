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
import { updateStudentStatusSchema } from "@/lib/students/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const studentIdSchema = z.string().uuid();

function errorResponse(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
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

  const parsed = updateStudentStatusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "حالة الطالب غير صالحة.", 400);
  }

  const student = await prisma.student.findFirst({
    where: { id: studentId, deletedAt: null },
    select: {
      id: true,
      displayName: true,
      isActive: true,
      enrollments: {
        where: { status: "ACTIVE", endedOn: null, deletedAt: null },
        select: { id: true, halaqaId: true },
      },
    },
  });

  if (!student) return errorResponse("الطالب غير موجود.", 404);
  if (student.isActive === parsed.data.isActive) {
    return NextResponse.json({ message: "حالة الطالب محدثة مسبقاً." });
  }

  const requestId = randomUUID();
  const ipAddress = getRequestIp(request);
  const userAgent = getRequestUserAgent(request);
  const effectiveOn = dateOnly(parsed.data.effectiveOn);

  await prisma.$transaction(async (transaction) => {
    await transaction.student.update({
      where: { id: studentId },
      data: { isActive: parsed.data.isActive },
    });

    if (!parsed.data.isActive) {
      await transaction.studentEnrollment.updateMany({
        where: {
          studentId,
          status: "ACTIVE",
          endedOn: null,
          deletedAt: null,
        },
        data: {
          status: "INACTIVE",
          endedOn: effectiveOn,
          endReason: "تم إيقاف ملف الطالب",
        },
      });
    }

    await transaction.auditLog.create({
      data: {
        actorUserId: authorization.session.user.id,
        action: parsed.data.isActive ? "STUDENT_ACTIVATED" : "STUDENT_DEACTIVATED",
        entityType: "student",
        entityId: studentId,
        requestId,
        ipAddress,
        userAgent,
        oldValues: { isActive: student.isActive },
        newValues: {
          isActive: parsed.data.isActive,
          effectiveOn: parsed.data.effectiveOn,
          closedEnrollmentIds: parsed.data.isActive
            ? []
            : student.enrollments.map((enrollment) => enrollment.id),
        },
        metadata: { displayName: student.displayName },
      },
    });
  });

  return NextResponse.json({
    message: parsed.data.isActive
      ? "تم تفعيل ملف الطالب. يمكنك تسجيله في حلقة من ملفه."
      : "تم إيقاف ملف الطالب وإنهاء تسجيله النشط بدون حذف سجلاته.",
  });
}
