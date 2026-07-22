import "server-only";

import { prisma } from "@/lib/db/prisma";
import { dateOnlyToUtc, todayInPalestine, weekdayFromDateOnly } from "@/lib/memorization-sessions/date";
import { WEEKDAY_LABELS, sortWeekdays, type WeekdayCode } from "@/lib/halaqat/weekdays";
import type {
  SessionActivityCode,
  SessionActivityValue,
  SessionAttendanceCode,
  SessionStudentValue,
  TeacherSessionDashboardData,
  TeacherSessionEditorData,
} from "@/lib/memorization-sessions/types";


type ExistingSessionItem = {
  id: string;
  studentId: string;
  enrollmentId: string | null;
  attendance: SessionAttendanceCode;
  notes: string | null;
  version: number;
  activities: Array<{
    type: SessionActivityCode;
    pageCount: unknown;
    details: unknown;
  }>;
};

function dateValue(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function activityText(details: unknown): string {
  if (!details || typeof details !== "object" || Array.isArray(details)) return "";
  const text = (details as { text?: unknown }).text;
  return typeof text === "string" ? text : "";
}

function mapActivities(
  activities: Array<{ type: SessionActivityCode; pageCount: unknown; details: unknown }>,
): SessionActivityValue[] {
  const byType = new Map(activities.map((activity) => [activity.type, activity]));
  const types: SessionActivityCode[] = ["MEMORIZATION", "REVIEW", "RECITATION"];

  return types.map((type) => {
    const activity = byType.get(type);
    return {
      type,
      text: activityText(activity?.details),
      pageCount: activity ? Number(activity.pageCount) : 0,
    };
  });
}

export async function getTeacherSessionDashboard(
  userId: string,
): Promise<TeacherSessionDashboardData> {
  const today = dateOnlyToUtc(todayInPalestine());

  const assignments = await prisma.halaqaStaffAssignment.findMany({
    where: {
      userId,
      deletedAt: null,
      startsOn: { lte: today },
      OR: [{ endsOn: null }, { endsOn: { gte: today } }],
      halaqa: {
        status: "ACTIVE",
        deletedAt: null,
        program: { status: "ACTIVE", deletedAt: null },
      },
    },
    orderBy: [{ halaqa: { stage: { sortOrder: "asc" } } }, { halaqa: { nameAr: "asc" } }],
    select: {
      startsOn: true,
      endsOn: true,
      halaqa: {
        select: {
          id: true,
          nameAr: true,
          stage: { select: { nameAr: true } },
          schedules: {
            where: {
              effectiveFrom: { lte: today },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
            },
            select: { weekday: true },
          },
          enrollments: {
            where: {
              deletedAt: null,
              startedOn: { lte: today },
              OR: [{ endedOn: null }, { endedOn: { gte: today } }],
              student: { deletedAt: null, isActive: true },
            },
            select: { id: true },
          },
        },
      },
    },
  });

  const uniqueHalaqat = new Map<string, TeacherSessionDashboardData["halaqat"][number]>();
  for (const assignment of assignments) {
    const halaqa = assignment.halaqa;
    uniqueHalaqat.set(halaqa.id, {
      id: halaqa.id,
      nameAr: halaqa.nameAr,
      stageName: halaqa.stage?.nameAr ?? "غير محددة",
      weekdays: sortWeekdays(halaqa.schedules.map((schedule) => schedule.weekday as WeekdayCode)),
      activeStudentCount: halaqa.enrollments.length,
    });
  }

  const halaqaIds = [...uniqueHalaqat.keys()];
  const recentSessions = halaqaIds.length
    ? await prisma.memorizationSession.findMany({
        where: {
          deletedAt: null,
          OR: assignments.map((assignment) => ({
            halaqaId: assignment.halaqa.id,
            sessionDate: {
              gte: assignment.startsOn,
              ...(assignment.endsOn ? { lte: assignment.endsOn } : {}),
            },
          })),
        },
        orderBy: [{ sessionDate: "desc" }, { updatedAt: "desc" }],
        take: 12,
        select: {
          id: true,
          halaqaId: true,
          sessionDate: true,
          status: true,
          halaqa: {
            select: {
              nameAr: true,
              enrollments: {
                where: { deletedAt: null },
                select: { id: true, startedOn: true, endedOn: true },
              },
            },
          },
          items: {
            where: { attendance: { not: "PENDING" } },
            select: { id: true },
          },
        },
      })
    : [];

  return {
    halaqat: [...uniqueHalaqat.values()],
    recentSessions: recentSessions.map((session) => ({
      id: session.id,
      halaqaId: session.halaqaId,
      halaqaName: session.halaqa.nameAr,
      sessionDate: dateValue(session.sessionDate),
      status: session.status,
      recordedStudents: session.items.length,
      totalStudents: session.halaqa.enrollments.filter(
        (enrollment) =>
          enrollment.startedOn <= session.sessionDate &&
          (!enrollment.endedOn || enrollment.endedOn >= session.sessionDate),
      ).length,
    })),
  };
}

export async function getTeacherSessionEditorData(input: {
  userId: string;
  halaqaId: string;
  sessionDate: string;
}): Promise<TeacherSessionEditorData | null> {
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
      halaqa: {
        select: {
          id: true,
          nameAr: true,
          stage: { select: { nameAr: true } },
          schedules: {
            where: {
              effectiveFrom: { lte: date },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
            },
            select: { weekday: true },
          },
        },
      },
    },
  });

  if (!assignment) return null;

  const weekdays = sortWeekdays(
    assignment.halaqa.schedules.map((schedule) => schedule.weekday as WeekdayCode),
  );
  const allowed = weekdays.includes(weekday);

  const session = await prisma.memorizationSession.findUnique({
    where: {
      halaqaId_sessionDate: {
        halaqaId: input.halaqaId,
        sessionDate: date,
      },
    },
    select: {
      id: true,
      status: true,
      version: true,
      completedAt: true,
      items: {
        select: {
          id: true,
          studentId: true,
          enrollmentId: true,
          attendance: true,
          notes: true,
          version: true,
          student: { select: { fullName: true, displayName: true } },
          activities: {
            orderBy: [{ type: "asc" }, { orderNo: "asc" }],
            select: { type: true, pageCount: true, details: true },
          },
        },
      },
    },
  });

  if (!allowed) {
    return {
      allowed: false,
      reason: `التاريخ المختار يوافق يوم ${WEEKDAY_LABELS[weekday]}، وهو ليس من أيام الحلقة.`,
      date: input.sessionDate,
      weekday,
      weekdayLabel: WEEKDAY_LABELS[weekday],
      halaqa: {
        id: assignment.halaqa.id,
        nameAr: assignment.halaqa.nameAr,
        stageName: assignment.halaqa.stage?.nameAr ?? "غير محددة",
        weekdays,
      },
      session: session
        ? {
            id: session.id,
            status: session.status,
            version: session.version,
            completedAt: session.completedAt?.toISOString() ?? null,
          }
        : null,
      students: [],
    };
  }

  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      halaqaId: input.halaqaId,
      deletedAt: null,
      startedOn: { lte: date },
      OR: [{ endedOn: null }, { endedOn: { gte: date } }],
      student: { deletedAt: null },
    },
    orderBy: [{ student: { displayName: "asc" } }, { startedOn: "asc" }],
    select: {
      id: true,
      studentId: true,
      student: { select: { fullName: true, displayName: true } },
    },
  });

  const existingByStudent = new Map<string, ExistingSessionItem>(
    ((session?.items ?? []) as ExistingSessionItem[]).map((item) => [item.studentId, item]),
  );
  const students: SessionStudentValue[] = enrollments.map((enrollment) => {
    const existing = existingByStudent.get(enrollment.studentId);
    return {
      studentId: enrollment.studentId,
      enrollmentId: enrollment.id,
      displayName: enrollment.student.displayName,
      fullName: enrollment.student.fullName,
      attendance: existing?.attendance ?? "PENDING",
      notes: existing?.notes ?? "",
      itemId: existing?.id ?? null,
      version: existing?.version ?? null,
      activities: mapActivities(existing?.activities ?? []),
    };
  });

  return {
    allowed: true,
    reason: null,
    date: input.sessionDate,
    weekday,
    weekdayLabel: WEEKDAY_LABELS[weekday],
    halaqa: {
      id: assignment.halaqa.id,
      nameAr: assignment.halaqa.nameAr,
      stageName: assignment.halaqa.stage?.nameAr ?? "غير محددة",
      weekdays,
    },
    session: session
      ? {
          id: session.id,
          status: session.status,
          version: session.version,
          completedAt: session.completedAt?.toISOString() ?? null,
        }
      : null,
    students,
  };
}
