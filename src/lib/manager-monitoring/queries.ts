import "server-only";

import { prisma } from "@/lib/db/prisma";
import { dateOnlyToUtc, weekdayFromDateOnly } from "@/lib/memorization-sessions/date";
import { WEEKDAY_LABELS } from "@/lib/halaqat/weekdays";
import type {
  ManagerDailyHalaqaMonitoringItem,
  ManagerDailyMonitoringData,
  MonitoringActivitySummary,
  MonitoringAttendanceSummary,
  MonitoringSessionStatus,
} from "@/lib/manager-monitoring/types";

function emptyAttendance(): MonitoringAttendanceSummary {
  return { present: 0, absent: 0, excused: 0, notHeard: 0 };
}

function emptyActivities(): MonitoringActivitySummary {
  return { memorizationPages: 0, reviewPages: 0, recitationPages: 0, totalPages: 0 };
}

function addAttendance(
  target: MonitoringAttendanceSummary,
  source: MonitoringAttendanceSummary,
): void {
  target.present += source.present;
  target.absent += source.absent;
  target.excused += source.excused;
  target.notHeard += source.notHeard;
}

function addActivities(target: MonitoringActivitySummary, source: MonitoringActivitySummary): void {
  target.memorizationPages += source.memorizationPages;
  target.reviewPages += source.reviewPages;
  target.recitationPages += source.recitationPages;
  target.totalPages += source.totalPages;
}

export async function getManagerDailyMonitoringData(
  dateValue: string,
): Promise<ManagerDailyMonitoringData> {
  const date = dateOnlyToUtc(dateValue);
  const weekday = weekdayFromDateOnly(dateValue);

  const halaqat = await prisma.halaqa.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      program: {
        code: "BASE_PROGRAM",
        status: "ACTIVE",
        deletedAt: null,
      },
      schedules: {
        some: {
          weekday,
          effectiveFrom: { lte: date },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
        },
      },
    },
    orderBy: [{ stage: { sortOrder: "asc" } }, { nameAr: "asc" }],
    select: {
      id: true,
      nameAr: true,
      stage: { select: { nameAr: true } },
      staffAssignments: {
        where: {
          role: "PRIMARY_TEACHER",
          deletedAt: null,
          startsOn: { lte: date },
          OR: [{ endsOn: null }, { endsOn: { gte: date } }],
        },
        take: 1,
        select: {
          user: {
            select: { id: true, displayName: true, status: true },
          },
        },
      },
      enrollments: {
        where: {
          deletedAt: null,
          startedOn: { lte: date },
          OR: [{ endedOn: null }, { endedOn: { gte: date } }],
          student: { deletedAt: null },
        },
        select: { id: true },
      },
      sessions: {
        where: { sessionDate: date, deletedAt: null },
        take: 1,
        select: {
          id: true,
          status: true,
          updatedAt: true,
          completedAt: true,
          items: {
            select: {
              attendance: true,
              activities: {
                select: { type: true, pageCount: true },
              },
            },
          },
        },
      },
    },
  });

  const mappedHalaqat: ManagerDailyHalaqaMonitoringItem[] = halaqat.map((halaqa) => {
    const session = halaqa.sessions[0] ?? null;
    const attendance = emptyAttendance();
    const activities = emptyActivities();
    let recordedStudents = 0;

    for (const item of session?.items ?? []) {
      if (item.attendance === "PENDING") continue;
      recordedStudents += 1;

      if (item.attendance === "PRESENT") attendance.present += 1;
      if (item.attendance === "ABSENT") attendance.absent += 1;
      if (item.attendance === "EXCUSED") attendance.excused += 1;
      if (item.attendance === "NOT_HEARD") attendance.notHeard += 1;

      for (const activity of item.activities) {
        const pages = Number(activity.pageCount);
        if (activity.type === "MEMORIZATION") activities.memorizationPages += pages;
        if (activity.type === "REVIEW") activities.reviewPages += pages;
        if (activity.type === "RECITATION") activities.recitationPages += pages;
      }
    }

    activities.totalPages =
      activities.memorizationPages + activities.reviewPages + activities.recitationPages;

    const expectedStudents = halaqa.enrollments.length;
    const safeRecordedStudents = Math.min(recordedStudents, expectedStudents);
    let monitoringStatus: MonitoringSessionStatus = "NOT_RECORDED";

    if (safeRecordedStudents > 0 && session) {
      monitoringStatus = session.status;
    }

    return {
      id: halaqa.id,
      nameAr: halaqa.nameAr,
      stageName: halaqa.stage?.nameAr ?? "غير محددة",
      teacher: halaqa.staffAssignments[0]?.user ?? null,
      expectedStudents,
      recordedStudents: safeRecordedStudents,
      remainingStudents: Math.max(expectedStudents - safeRecordedStudents, 0),
      monitoringStatus,
      session: session
        ? {
            id: session.id,
            status: session.status,
            updatedAt: session.updatedAt.toISOString(),
            completedAt: session.completedAt?.toISOString() ?? null,
          }
        : null,
      attendance,
      activities,
    };
  });

  const totalAttendance = emptyAttendance();
  const totalActivities = emptyActivities();

  for (const halaqa of mappedHalaqat) {
    addAttendance(totalAttendance, halaqa.attendance);
    addActivities(totalActivities, halaqa.activities);
  }

  return {
    date: dateValue,
    weekday,
    weekdayLabel: WEEKDAY_LABELS[weekday],
    summary: {
      expectedHalaqat: mappedHalaqat.length,
      recordedHalaqat: mappedHalaqat.filter((halaqa) => halaqa.monitoringStatus !== "NOT_RECORDED")
        .length,
      completedHalaqat: mappedHalaqat.filter(
        (halaqa) => halaqa.monitoringStatus === "COMPLETED" || halaqa.monitoringStatus === "LOCKED",
      ).length,
      draftHalaqat: mappedHalaqat.filter((halaqa) => halaqa.monitoringStatus === "DRAFT").length,
      notRecordedHalaqat: mappedHalaqat.filter(
        (halaqa) => halaqa.monitoringStatus === "NOT_RECORDED",
      ).length,
      expectedStudents: mappedHalaqat.reduce(
        (sum, halaqa) => sum + halaqa.expectedStudents,
        0,
      ),
      recordedStudents: mappedHalaqat.reduce(
        (sum, halaqa) => sum + halaqa.recordedStudents,
        0,
      ),
      attendance: totalAttendance,
      activities: totalActivities,
    },
    halaqat: mappedHalaqat,
  };
}
