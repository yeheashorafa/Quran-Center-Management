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
