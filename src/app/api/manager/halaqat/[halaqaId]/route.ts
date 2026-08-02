import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { authorizeApiPermission } from "@/lib/auth/api-authorization";
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

const updateHalaqaSchema = z.object({
  nameAr: z.string().trim().min(2, "اسم الحلقة يجب أن يتكون من حرفين على الأقل.").optional(),
  stageId: z.string().min(1, "المرحلة غير صالحة.").optional(),
  teacherUserId: z.string().min(1, "الشيخ غير صالح.").optional(),
  weekdays: z.array(z.enum(["SATURDAY", "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"])).min(1, "اختر يوماً واحداً على الأقل.").optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  notes: z.string().nullable().optional(),
});

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

  const body = await request.json().catch(() => null);
  const parsed = updateHalaqaSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "بيانات التعديل غير صالحة.", 400);
  }

  const input = parsed.data;

  const existingHalaqa = await prisma.halaqa.findUnique({
    where: { id: halaqaId },
    select: {
      id: true,
      nameAr: true,
      code: true,
      stageId: true,
      status: true,
      notes: true,
    },
  });

  if (!existingHalaqa) {
    return errorResponse("الحلقة غير موجودة.", 404);
  }

  const targetStageId = input.stageId || existingHalaqa.stageId;
  const targetNameAr = input.nameAr ? input.nameAr.trim() : existingHalaqa.nameAr;

  // Check duplicate name inside the same stage if nameAr or stageId changed
  if (input.nameAr || input.stageId) {
    const duplicate = await prisma.halaqa.findFirst({
      where: {
        id: { not: halaqaId },
        nameAr: { equals: targetNameAr, mode: "insensitive" },
        stageId: targetStageId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (duplicate) {
      return errorResponse("توجد حلقة بالاسم نفسه داخل هذه المرحلة.", 409);
    }
  }

  if (input.stageId) {
    const stageExists = await prisma.stage.findFirst({
      where: { id: input.stageId, isActive: true },
      select: { id: true },
    });
    if (!stageExists) {
      return errorResponse("المرحلة المحددة غير موجودة.", 400);
    }
  }

  if (input.teacherUserId) {
    const teacherExists = await prisma.user.findFirst({
      where: {
        id: input.teacherUserId,
        status: "ACTIVE",
        deletedAt: null,
        roles: { some: { role: { code: "TEACHER" } } },
      },
      select: { id: true },
    });
    if (!teacherExists) {
      return errorResponse("الشيخ المحدد غير نشط أو لا يملك دور الشيخ.", 400);
    }
  }

  const requestId = randomUUID();
  const ipAddress = getRequestIp(request);
  const userAgent = getRequestUserAgent(request);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // 1. Update basic Halaqa info
    await tx.halaqa.update({
      where: { id: halaqaId },
      data: {
        ...(input.nameAr ? { nameAr: input.nameAr.trim() } : {}),
        ...(input.stageId ? { stageId: input.stageId } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });

    // 2. Update weekdays schedules if provided
    if (input.weekdays && input.weekdays.length > 0) {
      await tx.halaqaSchedule.deleteMany({
        where: { halaqaId },
      });
      await tx.halaqaSchedule.createMany({
        data: input.weekdays.map((weekday) => ({
          halaqaId,
          weekday,
          effectiveFrom: now,
        })),
      });
    }

    // 3. Update primary teacher assignment if provided
    if (input.teacherUserId) {
      await tx.halaqaStaffAssignment.deleteMany({
        where: { halaqaId, role: "PRIMARY_TEACHER" },
      });
      await tx.halaqaStaffAssignment.create({
        data: {
          halaqaId,
          userId: input.teacherUserId,
          role: "PRIMARY_TEACHER",
          startsOn: now,
        },
      });
    }

    // 4. Create Audit Log
    await tx.auditLog.create({
      data: {
        actorUserId: authorization.session.user.id,
        action: "HALAQA_UPDATED",
        entityType: "halaqa",
        entityId: halaqaId,
        requestId,
        ipAddress,
        userAgent,
        oldValues: {
          nameAr: existingHalaqa.nameAr,
          stageId: existingHalaqa.stageId,
          status: existingHalaqa.status,
          notes: existingHalaqa.notes,
        },
        newValues: {
          nameAr: targetNameAr,
          stageId: targetStageId,
          status: input.status || existingHalaqa.status,
          weekdays: input.weekdays,
          teacherUserId: input.teacherUserId,
          notes: input.notes !== undefined ? input.notes : existingHalaqa.notes,
        },
      },
    });
  });

  const updatedHalaqa = await prisma.halaqa.findUnique({
    where: { id: halaqaId },
    select: {
      id: true,
      nameAr: true,
      code: true,
      status: true,
      notes: true,
      stage: { select: { id: true, nameAr: true } },
      staffAssignments: {
        where: { role: "PRIMARY_TEACHER", endsOn: null },
        select: { user: { select: { id: true, displayName: true } } },
        take: 1,
      },
      schedules: { select: { weekday: true } },
    },
  });

  return NextResponse.json({
    message: "تم تحديث بيانات الحلقة بنجاح.",
    halaqa: updatedHalaqa,
  });
}

export async function DELETE(
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

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "true";

  const halaqa = await prisma.halaqa.findUnique({
    where: { id: halaqaId },
    select: { id: true, nameAr: true, code: true, status: true },
  });

  if (!halaqa) {
    return errorResponse("الحلقة غير موجودة.", 404);
  }

  const [enrollmentCount, sessionCount, examCount] = await Promise.all([
    prisma.studentEnrollment.count({ where: { halaqaId } }),
    prisma.memorizationSession.count({ where: { halaqaId } }),
    prisma.officialExam.count({ where: { enrollment: { halaqaId } } }),
  ]);

  const hasLinkedData = enrollmentCount > 0 || sessionCount > 0 || examCount > 0;

  if (hasLinkedData && !force) {
    return NextResponse.json(
      {
        message: "هذه الحلقة تحتوي على بيانات مرتبطة. يجب تأكيد الحذف النهائي.",
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
    // 1. Get enrollments and sessions for this halaqa
    const enrollments = await transaction.studentEnrollment.findMany({
      where: { halaqaId },
      select: { id: true },
    });
    const enrollmentIds = enrollments.map((e) => e.id);

    const sessions = await transaction.memorizationSession.findMany({
      where: { halaqaId },
      select: { id: true },
    });
    const sessionIds = sessions.map((s) => s.id);

    // 2. Delete session activities & items
    if (sessionIds.length > 0) {
      const sessionRecordItems = await transaction.sessionRecordItem.findMany({
        where: { sessionId: { in: sessionIds } },
        select: { id: true },
      });
      const itemIds = sessionRecordItems.map((i) => i.id);

      if (itemIds.length > 0) {
        await transaction.sessionActivity.deleteMany({
          where: { itemId: { in: itemIds } },
        });
      }

      await transaction.sessionRecordItem.deleteMany({
        where: { sessionId: { in: sessionIds } },
      });

      await transaction.memorizationSession.deleteMany({
        where: { halaqaId },
      });
    }

    // 3. Delete official exams & transfers linked to these enrollments
    if (enrollmentIds.length > 0) {
      const exams = await transaction.officialExam.findMany({
        where: { enrollmentId: { in: enrollmentIds } },
        select: { id: true },
      });
      const examIds = exams.map((ex) => ex.id);

      if (examIds.length > 0) {
        await transaction.officialExamScope.deleteMany({
          where: { examId: { in: examIds } },
        });
        await transaction.officialExam.deleteMany({
          where: { id: { in: examIds } },
        });
      }

      await transaction.studentTransfer.deleteMany({
        where: {
          OR: [
            { fromEnrollmentId: { in: enrollmentIds } },
            { toEnrollmentId: { in: enrollmentIds } },
          ],
        },
      });

      await transaction.studentEnrollment.deleteMany({
        where: { halaqaId },
      });
    }

    // 4. Delete staff assignments & schedules
    await transaction.halaqaStaffAssignment.deleteMany({
      where: { halaqaId },
    });

    await transaction.halaqaSchedule.deleteMany({
      where: { halaqaId },
    });

    // 5. Delete the Halaqa itself
    await transaction.halaqa.delete({
      where: { id: halaqaId },
    });

    // 6. Audit Log
    await transaction.auditLog.create({
      data: {
        actorUserId: authorization.session.user.id,
        action: "HALAQA_PERMANENTLY_DELETED",
        entityType: "halaqa",
        entityId: halaqaId,
        requestId,
        ipAddress,
        userAgent,
        oldValues: { nameAr: halaqa.nameAr, code: halaqa.code },
        metadata: {
          deletedStudentsCount: enrollmentCount,
          deletedSessionsCount: sessionCount,
          deletedExamsCount: examCount,
          forced: force,
        },
      },
    });
  });

  return NextResponse.json({
    message: "تم حذف الحلقة وتصفية بياناتها نهائياً بنجاح.",
  });
}
