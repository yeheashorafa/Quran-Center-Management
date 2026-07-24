import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeApiPermission } from "@/lib/auth/api-authorization";
import { prisma } from "@/lib/db/prisma";
import { getRequestIp, getRequestUserAgent, isSameOriginRequest } from "@/lib/http/request-metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const addTeacherStudentSchema = z.object({
  halaqaId: z.string().uuid("معرف الحلقة غير صالح."),
  fullName: z.string().trim().min(3, "يجب أن يتكون اسم الطالب من 3 أحرف على الأقل."),
  displayName: z.string().trim().min(2, "يجب أن يتكون اسم العرض من حرفين على الأقل."),
  parentPhone: z.string().trim().nullable().optional(),
  gradeLevel: z.string().trim().nullable().optional(),
  memorizationStartedOn: z.string().trim().nullable().optional(),
});

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return errorResponse("تم رفض الطلب لأسباب أمنية.", 403);
  }

  const authorization = await authorizeApiPermission("sessions.manage.own");
  if (authorization.response) return authorization.response;

  const parsed = addTeacherStudentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "بيانات الطالب غير صالحة.", 400);
  }

  // Validate teacher assignment on this halaqa
  const assignment = await prisma.halaqaStaffAssignment.findFirst({
    where: {
      userId: authorization.session.user.id,
      halaqaId: parsed.data.halaqaId,
      deletedAt: null,
    },
    select: { halaqa: { select: { id: true, programId: true, nameAr: true } } },
  });

  if (!assignment) {
    return errorResponse("ليس لديك صلاحية إضافة طالب لهذه الحلقة.", 403);
  }

  const normalizedFullName = normalize(parsed.data.fullName);
  const requestId = randomUUID();
  const ipAddress = getRequestIp(request);
  const userAgent = getRequestUserAgent(request);

  try {
    const student = await prisma.$transaction(async (tx) => {
      let existingStudent = await tx.student.findFirst({
        where: { normalizedFullName, deletedAt: null },
      });

      if (!existingStudent) {
        existingStudent = await tx.student.create({
          data: {
            fullName: parsed.data.fullName,
            normalizedFullName,
            displayName: parsed.data.displayName,
            parentPhone: parsed.data.parentPhone || null,
            gradeLevel: parsed.data.gradeLevel || null,
            memorizationStartedOn: parsed.data.memorizationStartedOn
              ? new Date(parsed.data.memorizationStartedOn)
              : new Date(),
            createdByUserId: authorization.session.user.id,
            isActive: true,
          },
        });
      }

      // Check if already enrolled in this halaqa
      const existingEnrollment = await tx.studentEnrollment.findFirst({
        where: {
          studentId: existingStudent.id,
          halaqaId: parsed.data.halaqaId,
          deletedAt: null,
          status: "ACTIVE",
        },
      });

      if (existingEnrollment) {
        return existingStudent;
      }

      await tx.studentEnrollment.create({
        data: {
          studentId: existingStudent.id,
          programId: assignment.halaqa.programId,
          halaqaId: parsed.data.halaqaId,
          status: "ACTIVE",
          startedOn: new Date(),
          createdByUserId: authorization.session.user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: authorization.session.user.id,
          action: "TEACHER_STUDENT_ADDED",
          entityType: "student",
          entityId: existingStudent.id,
          requestId,
          ipAddress,
          userAgent,
          newValues: {
            fullName: existingStudent.fullName,
            halaqaId: parsed.data.halaqaId,
            halaqaName: assignment.halaqa.nameAr,
          },
        },
      });

      return existingStudent;
    });

    return NextResponse.json({
      message: "تمت إضافة الطالب للحلقة بنجاح.",
      student: { id: student.id, displayName: student.displayName },
    });
  } catch (err) {
    console.error("Add teacher student failed:", err);
    return errorResponse("تعذر إضافة الطالب حالياً.", 500);
  }
}

const updateTeacherStudentSchema = z.object({
  studentId: z.string().uuid("معرف الطالب غير صالح."),
  fullName: z.string().trim().min(3, "يجب أن يتكون اسم الطالب من 3 أحرف على الأقل."),
  displayName: z.string().trim().min(2, "يجب أن يتكون اسم العرض من حرفين على الأقل."),
  parentPhone: z.string().trim().nullable().optional(),
  gradeLevel: z.string().trim().nullable().optional(),
  memorizationStartedOn: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(request: Request) {
  if (!isSameOriginRequest(request)) {
    return errorResponse("تم رفض الطلب لأسباب أمنية.", 403);
  }

  const authorization = await authorizeApiPermission("sessions.manage.own");
  if (authorization.response) return authorization.response;

  const parsed = updateTeacherStudentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "بيانات الطالب غير صالحة.", 400);
  }

  // Verify teacher is assigned to a halaqa where student is enrolled
  const isEnrolledInTeacherHalaqa = await prisma.studentEnrollment.findFirst({
    where: {
      studentId: parsed.data.studentId,
      deletedAt: null,
      halaqa: {
        staffAssignments: {
          some: {
            userId: authorization.session.user.id,
            deletedAt: null,
          },
        },
      },
    },
  });

  if (!isEnrolledInTeacherHalaqa) {
    return errorResponse("ليس لديك صلاحية تعديل بيانات هذا الطالب.", 403);
  }

  const normalizedFullName = normalize(parsed.data.fullName);
  const requestId = randomUUID();
  const ipAddress = getRequestIp(request);
  const userAgent = getRequestUserAgent(request);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const student = await tx.student.update({
        where: { id: parsed.data.studentId },
        data: {
          fullName: parsed.data.fullName,
          normalizedFullName,
          displayName: parsed.data.displayName,
          parentPhone: parsed.data.parentPhone || null,
          gradeLevel: parsed.data.gradeLevel || null,
          memorizationStartedOn: parsed.data.memorizationStartedOn
            ? new Date(parsed.data.memorizationStartedOn)
            : undefined,
          notes: parsed.data.notes !== undefined ? parsed.data.notes || null : undefined,
          isActive: parsed.data.isActive !== undefined ? parsed.data.isActive : undefined,
        },
      });

      if (parsed.data.isActive === false) {
        await tx.studentEnrollment.updateMany({
          where: {
            studentId: parsed.data.studentId,
            status: "ACTIVE",
            endedOn: null,
            deletedAt: null,
          },
          data: {
            status: "INACTIVE",
            endedOn: new Date(),
            endReason: "تم إيقاف الطالب من الشيخ",
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: authorization.session.user.id,
          action: "TEACHER_STUDENT_UPDATED",
          entityType: "student",
          entityId: student.id,
          requestId,
          ipAddress,
          userAgent,
          newValues: {
            fullName: student.fullName,
            displayName: student.displayName,
            parentPhone: student.parentPhone,
            gradeLevel: student.gradeLevel,
            notes: student.notes,
            isActive: student.isActive,
          },
        },
      });

      return student;
    });

    return NextResponse.json({
      message: "تم تحديث بيانات الطالب بنجاح.",
      student: { id: updated.id, displayName: updated.displayName },
    });
  } catch (err) {
    console.error("Update teacher student failed:", err);
    return errorResponse("تعذر تحديث بيانات الطالب حالياً.", 500);
  }
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) {
    return errorResponse("تم رفض الطلب لأسباب أمنية.", 403);
  }

  const authorization = await authorizeApiPermission("sessions.manage.own");
  if (authorization.response) return authorization.response;

  const url = new URL(request.url);
  const studentId = url.searchParams.get("studentId");
  const halaqaId = url.searchParams.get("halaqaId");
  const action = url.searchParams.get("action") || "remove";

  if (!studentId || !halaqaId) {
    return errorResponse("معرف الطالب والحلقة مطلوبان.", 400);
  }

  // Verify teacher is assigned to this halaqa
  const assignment = await prisma.halaqaStaffAssignment.findFirst({
    where: {
      userId: authorization.session.user.id,
      halaqaId,
      deletedAt: null,
    },
    select: { halaqa: { select: { id: true, nameAr: true } } },
  });

  if (!assignment) {
    return errorResponse("ليس لديك صلاحية لإدارة طلاب هذه الحلقة.", 403);
  }

  const enrollment = await prisma.studentEnrollment.findFirst({
    where: {
      studentId,
      halaqaId,
      deletedAt: null,
      status: "ACTIVE",
    },
    select: { id: true, student: { select: { displayName: true } } },
  });

  if (!enrollment) {
    return errorResponse("تسجيل الطالب في هذه الحلقة غير موجود أو غير نشط.", 404);
  }

  const requestId = randomUUID();
  const ipAddress = getRequestIp(request);
  const userAgent = getRequestUserAgent(request);
  const now = new Date();

  if (action === "delete") {
    // Check if student has ANY records (sessions or exams)
    const [sessionCount, examCount] = await Promise.all([
      prisma.sessionRecordItem.count({ where: { studentId } }),
      prisma.officialExam.count({ where: { studentId } }),
    ]);

    if (sessionCount > 0 || examCount > 0) {
      return errorResponse(
        "الطالب لديه سجلات تسميع أو اختبارات. لا يمكن حذفه نهائياً، يمكنك إزالته من الحلقة أو تعطيله فقط.",
        400,
      );
    }

    // Unused test student with 0 records -> permanent delete student enrollment and student
    await prisma.$transaction(async (tx) => {
      await tx.studentEnrollment.deleteMany({ where: { studentId } });
      await tx.student.delete({ where: { id: studentId } });

      await tx.auditLog.create({
        data: {
          actorUserId: authorization.session.user.id,
          action: "TEACHER_STUDENT_DELETED",
          entityType: "student",
          entityId: studentId,
          requestId,
          ipAddress,
          userAgent,
          metadata: { halaqaId, halaqaName: assignment.halaqa.nameAr },
        },
      });
    });

    return NextResponse.json({
      message: "تم حذف الطالب التجريبي نهائياً لعدم وجود سجلات مرتبطة به.",
    });
  }

  // Default action: "remove" / deactivate from this halaqa
  await prisma.$transaction(async (tx) => {
    await tx.studentEnrollment.update({
      where: { id: enrollment.id },
      data: {
        status: "INACTIVE",
        endedOn: now,
        endReason: "تم إزالة الطالب بواسطة الشيخ",
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: authorization.session.user.id,
        action: "TEACHER_STUDENT_REMOVED_FROM_HALAQA",
        entityType: "student_enrollment",
        entityId: enrollment.id,
        requestId,
        ipAddress,
        userAgent,
        newValues: {
          studentId,
          studentName: enrollment.student.displayName,
          halaqaId,
          halaqaName: assignment.halaqa.nameAr,
        },
      },
    });
  });

  return NextResponse.json({
    message: `تمت إزالة الطالب من ${assignment.halaqa.nameAr} بنجاح وحفظ سجلاته.`,
  });
}
