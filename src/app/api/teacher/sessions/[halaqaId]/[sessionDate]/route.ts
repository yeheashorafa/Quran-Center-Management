import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { authorizeApiPermission } from "@/lib/auth/api-authorization";
import { prisma } from "@/lib/db/prisma";
import {
  dateOnlyToUtc,
  isFutureDateInPalestine,
  isIsoDateOnly,
  weekdayFromDateOnly,
} from "@/lib/memorization-sessions/date";
import { getTeacherSessionEditorData } from "@/lib/memorization-sessions/queries";
import { saveSessionItemsSchema } from "@/lib/memorization-sessions/schemas";
import {
  getRequestIp,
  getRequestUserAgent,
  isSameOriginRequest,
} from "@/lib/http/request-metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ halaqaId: string; sessionDate: string }>;
};

class SessionConflictError extends Error {}
class SessionIncompleteError extends Error {}
class SessionLockedError extends Error {}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

async function resolveTeacherScope(input: {
  userId: string;
  halaqaId: string;
  sessionDate: string;
}) {
  const date = dateOnlyToUtc(input.sessionDate);
  const weekday = weekdayFromDateOnly(input.sessionDate);

  const assignment = await prisma.halaqaStaffAssignment.findFirst({
    where: {
      userId: input.userId,
      halaqaId: input.halaqaId,
      deletedAt: null,
      startsOn: { lte: date },
      OR: [{ endsOn: null }, { endsOn: { gte: date } }],
      halaqa: { deletedAt: null, program: { deletedAt: null } },
    },
    select: {
      id: true,
      halaqa: {
        select: {
          id: true,
          nameAr: true,
          schedules: {
            where: {
              weekday,
              effectiveFrom: { lte: date },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
            },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!assignment) return null;

  return {
    assignmentId: assignment.id,
    halaqaId: assignment.halaqa.id,
    halaqaName: assignment.halaqa.nameAr,
    allowedDay: assignment.halaqa.schedules.length > 0,
    date,
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const authorization = await authorizeApiPermission("sessions.read.own");
  if (authorization.response) return authorization.response;

  const { halaqaId, sessionDate } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(halaqaId)) {
    return errorResponse("معرف الحلقة غير صالح.", 400);
  }
  if (!isIsoDateOnly(sessionDate)) {
    return errorResponse("التاريخ غير صالح.", 400);
  }

  const data = await getTeacherSessionEditorData({
    userId: authorization.session.user.id,
    halaqaId,
    sessionDate,
  });

  if (!data) {
    return errorResponse("الحلقة غير موجودة ضمن الحلقات المعيّن عليها في هذا التاريخ.", 404);
  }

  return NextResponse.json(data);
}

export async function PUT(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return errorResponse("تم رفض الطلب لأسباب أمنية.", 403);
  }

  const authorization = await authorizeApiPermission("sessions.manage.own");
  if (authorization.response) return authorization.response;

  const { halaqaId, sessionDate } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(halaqaId)) {
    return errorResponse("معرف الحلقة غير صالح.", 400);
  }
  if (!isIsoDateOnly(sessionDate)) {
    return errorResponse("التاريخ غير صالح.", 400);
  }
  if (isFutureDateInPalestine(sessionDate)) {
    return errorResponse("لا يمكن تسجيل جلسة في تاريخ مستقبلي.", 400);
  }

  const parsed = saveSessionItemsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "بيانات الجلسة غير صالحة.", 400);
  }
  if (parsed.data.date !== sessionDate) {
    return errorResponse("تاريخ الطلب لا يطابق تاريخ الجلسة.", 400);
  }

  const duplicateStudents = new Set<string>();
  for (const item of parsed.data.items) {
    if (duplicateStudents.has(item.studentId)) {
      return errorResponse("تم تكرار الطالب داخل طلب الحفظ.", 400);
    }
    duplicateStudents.add(item.studentId);

    if (new Set(item.activities.map((activity) => activity.type)).size !== item.activities.length) {
      return errorResponse("تم تكرار نوع الإنجاز للطالب نفسه.", 400);
    }
  }

  const scope = await resolveTeacherScope({
    userId: authorization.session.user.id,
    halaqaId,
    sessionDate,
  });

  if (!scope) {
    return errorResponse("الحلقة غير موجودة ضمن الحلقات المعيّن عليها في هذا التاريخ.", 404);
  }
  if (!scope.allowedDay) {
    return errorResponse("التاريخ المختار لا يوافق أحد أيام الحلقة، لذلك تم منع الحفظ.", 422);
  }

  const enrollmentIds = parsed.data.items.map((item) => item.enrollmentId);
  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      id: { in: enrollmentIds },
      halaqaId,
      deletedAt: null,
      startedOn: { lte: scope.date },
      OR: [{ endedOn: null }, { endedOn: { gte: scope.date } }],
    },
    select: { id: true, studentId: true },
  });
  const validEnrollmentById = new Map<string, { id: string; studentId: string }>(
    enrollments.map((enrollment) => [enrollment.id, enrollment]),
  );

  for (const item of parsed.data.items) {
    const enrollment = validEnrollmentById.get(item.enrollmentId);
    if (!enrollment || enrollment.studentId !== item.studentId) {
      return errorResponse("أحد الطلاب لا ينتمي إلى الحلقة في التاريخ المحدد.", 400);
    }
  }

  const allEnrollmentStudents = await prisma.studentEnrollment.findMany({
    where: {
      halaqaId,
      deletedAt: null,
      startedOn: { lte: scope.date },
      OR: [{ endedOn: null }, { endedOn: { gte: scope.date } }],
      student: { deletedAt: null },
    },
    select: { studentId: true },
  });

  const requestId = randomUUID();
  const ipAddress = getRequestIp(request);
  const userAgent = getRequestUserAgent(request);

  try {
    await prisma.$transaction(async (transaction) => {
      const existingSession = await transaction.memorizationSession.findUnique({
        where: { halaqaId_sessionDate: { halaqaId, sessionDate: scope.date } },
        select: { id: true, status: true },
      });

      if (existingSession?.status === "LOCKED") {
        throw new SessionLockedError("الجلسة مقفلة ولا يمكن تعديلها.");
      }

      const memorizationSession = existingSession
        ? existingSession
        : await transaction.memorizationSession.create({
            data: {
              halaqaId,
              teacherAssignmentId: scope.assignmentId,
              sessionDate: scope.date,
              status: "DRAFT",
              createdByUserId: authorization.session.user.id,
            },
            select: { id: true, status: true },
          });

      for (const item of parsed.data.items) {
        const existingItem = await transaction.sessionRecordItem.findUnique({
          where: {
            sessionId_studentId: {
              sessionId: memorizationSession.id,
              studentId: item.studentId,
            },
          },
          select: { id: true, version: true },
        });

        if (existingItem) {
          if (item.baseVersion == null || existingItem.version !== item.baseVersion) {
            throw new SessionConflictError(
              "تم تعديل بيانات أحد الطلاب من جهاز آخر. حدّث الجلسة ثم أعد المحاولة.",
            );
          }
        } else if (item.baseVersion != null) {
          throw new SessionConflictError(
            "تغيّرت بيانات الجلسة منذ فتحها. حدّث الصفحة ثم أعد المحاولة.",
          );
        }

        const savedItem = existingItem
          ? await transaction.sessionRecordItem.update({
              where: { id: existingItem.id },
              data: {
                enrollmentId: item.enrollmentId,
                attendance: item.attendance,
                notes: item.notes || null,
                version: { increment: 1 },
              },
              select: { id: true },
            })
          : await transaction.sessionRecordItem.create({
              data: {
                sessionId: memorizationSession.id,
                studentId: item.studentId,
                enrollmentId: item.enrollmentId,
                attendance: item.attendance,
                notes: item.notes || null,
              },
              select: { id: true },
            });

        await transaction.sessionActivity.deleteMany({ where: { itemId: savedItem.id } });

        if (item.attendance === "PRESENT") {
          const activities = item.activities.filter(
            (activity) => activity.text.trim() || activity.pageCount > 0,
          );
          if (activities.length) {
            await transaction.sessionActivity.createMany({
              data: activities.map((activity, index) => ({
                itemId: savedItem.id,
                type: activity.type,
                orderNo: index + 1,
                pageCount: activity.pageCount,
                details: { text: activity.text.trim() },
              })),
            });
          }
        }
      }

      if (parsed.data.complete) {
        const allStudentIds = allEnrollmentStudents.map((item) => item.studentId);
        const savedItems = await transaction.sessionRecordItem.findMany({
          where: { sessionId: memorizationSession.id, studentId: { in: allStudentIds } },
          select: { studentId: true, attendance: true },
        });
        const attendanceByStudent = new Map(
          savedItems.map((item) => [item.studentId, item.attendance]),
        );
        const hasIncompleteStudent = allStudentIds.some(
          (studentId) =>
            !attendanceByStudent.has(studentId) || attendanceByStudent.get(studentId) === "PENDING",
        );

        if (hasIncompleteStudent) {
          throw new SessionIncompleteError(
            "لا يمكن اعتماد الجلسة قبل تسجيل حالة جميع الطلاب.",
          );
        }
      }

      const updatedSession = await transaction.memorizationSession.update({
        where: { id: memorizationSession.id },
        data: parsed.data.complete
          ? {
              status: "COMPLETED",
              completedAt: new Date(),
              completedByUserId: authorization.session.user.id,
              version: { increment: 1 },
            }
          : {
              status: memorizationSession.status,
              version: { increment: 1 },
            },
        select: { id: true, status: true, version: true },
      });

      await transaction.auditLog.create({
        data: {
          actorUserId: authorization.session.user.id,
          action: parsed.data.complete
            ? "MEMORIZATION_SESSION_COMPLETED"
            : "MEMORIZATION_SESSION_ITEMS_SAVED",
          entityType: "memorization_session",
          entityId: updatedSession.id,
          requestId,
          ipAddress,
          userAgent,
          newValues: {
            halaqaId,
            halaqaName: scope.halaqaName,
            sessionDate,
            status: updatedSession.status,
            savedStudents: parsed.data.items.length,
            version: updatedSession.version,
          },
        },
      });
    });

    const data = await getTeacherSessionEditorData({
      userId: authorization.session.user.id,
      halaqaId,
      sessionDate,
    });

    return NextResponse.json({
      message: parsed.data.complete
        ? "تم اعتماد جلسة التسميع بنجاح."
        : parsed.data.items.length === 1
          ? "تم حفظ بيانات الطالب بنجاح."
          : "تم حفظ بيانات الجلسة بنجاح.",
      data,
    });
  } catch (error) {
    if (error instanceof SessionConflictError) return errorResponse(error.message, 409);
    if (error instanceof SessionIncompleteError) return errorResponse(error.message, 400);
    if (error instanceof SessionLockedError) return errorResponse(error.message, 423);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return errorResponse("حدث تعارض أثناء حفظ الجلسة. حدّث البيانات ثم أعد المحاولة.", 409);
    }

    console.error("Save memorization session failed:", error);
    return errorResponse("تعذر حفظ جلسة التسميع حالياً.", 500);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return errorResponse("تم رفض الطلب لأسباب أمنية.", 403);
  }

  const authorization = await authorizeApiPermission("sessions.manage.own");
  if (authorization.response) return authorization.response;

  const { halaqaId, sessionDate } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(halaqaId)) {
    return errorResponse("معرف الحلقة غير صالح.", 400);
  }
  if (!isIsoDateOnly(sessionDate)) {
    return errorResponse("التاريخ غير صالح.", 400);
  }

  const scope = await resolveTeacherScope({
    userId: authorization.session.user.id,
    halaqaId,
    sessionDate,
  });

  if (!scope) {
    return errorResponse("الحلقة غير موجودة ضمن الحلقات المعيّن عليها.", 404);
  }

  const session = await prisma.memorizationSession.findUnique({
    where: { halaqaId_sessionDate: { halaqaId, sessionDate: scope.date } },
    select: { id: true, status: true },
  });

  if (!session) {
    return errorResponse("الجلسة غير موجودة أصلاً.", 404);
  }
  if (session.status === "LOCKED") {
    return errorResponse("الجلسة مقفلة ولا يمكن حذفها.", 423);
  }

  const requestId = randomUUID();
  const ipAddress = getRequestIp(request);
  const userAgent = getRequestUserAgent(request);

  try {
    await prisma.$transaction(async (transaction) => {
      const items = await transaction.sessionRecordItem.findMany({
        where: { sessionId: session.id },
        select: { id: true },
      });
      const itemIds = items.map((item) => item.id);

      if (itemIds.length) {
        await transaction.sessionActivity.deleteMany({
          where: { itemId: { in: itemIds } },
        });
      }

      await transaction.sessionRecordItem.deleteMany({
        where: { sessionId: session.id },
      });

      await transaction.memorizationSession.delete({
        where: { id: session.id },
      });

      await transaction.auditLog.create({
        data: {
          actorUserId: authorization.session.user.id,
          action: "MEMORIZATION_SESSION_DELETED",
          entityType: "memorization_session",
          entityId: session.id,
          requestId,
          ipAddress,
          userAgent,
          newValues: {
            halaqaId,
            halaqaName: scope.halaqaName,
            sessionDate,
          },
        },
      });
    });

    return NextResponse.json({ message: "تم حذف الجلسة بالكامل مع كافة التسميعات المرتبطة بها." });
  } catch (error) {
    console.error("Delete memorization session failed:", error);
    return errorResponse("تعذر حذف الجلسة حالياً.", 500);
  }
}
