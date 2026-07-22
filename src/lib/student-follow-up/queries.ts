import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { dateOnlyToUtc } from "@/lib/memorization-sessions/date";
import type {
  FollowUpReason,
  FollowUpSeverity,
  FollowUpStudentItem,
  StudentFollowUpData,
} from "@/lib/student-follow-up/types";

export type StudentFollowUpInput = {
  from: string;
  to: string;
  stageId?: string;
  halaqaId?: string;
  attendanceThreshold: number;
};

function severityWeight(severity: FollowUpSeverity): number {
  if (severity === "HIGH") return 5;
  if (severity === "MEDIUM") return 3;
  return 1;
}

function reason(
  code: FollowUpReason["code"],
  severity: FollowUpSeverity,
  label: string,
  detail: string,
): FollowUpReason {
  return { code, severity, label, detail };
}

export async function getStudentFollowUpData(
  input: StudentFollowUpInput,
): Promise<StudentFollowUpData> {
  const fromDate = dateOnlyToUtc(input.from);
  const toDate = dateOnlyToUtc(input.to);

  const halaqaWhere: Prisma.HalaqaWhereInput = {
    program: { code: "BASE_PROGRAM" },
    ...(input.stageId ? { stageId: input.stageId } : {}),
    ...(input.halaqaId ? { id: input.halaqaId } : {}),
  };

  const students = await prisma.student.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      enrollments: {
        some: {
          deletedAt: null,
          startedOn: { lte: toDate },
          OR: [{ endedOn: null }, { endedOn: { gte: fromDate } }],
          halaqa: halaqaWhere,
        },
      },
    },
    orderBy: { displayName: "asc" },
    select: {
      id: true,
      fullName: true,
      displayName: true,
      parentPhone: true,
      gradeLevel: true,
      enrollments: {
        where: {
          deletedAt: null,
          startedOn: { lte: toDate },
          OR: [{ endedOn: null }, { endedOn: { gte: fromDate } }],
          halaqa: halaqaWhere,
        },
        orderBy: { startedOn: "desc" },
        select: {
          halaqa: {
            select: {
              id: true,
              nameAr: true,
              stage: { select: { nameAr: true } },
            },
          },
        },
      },
      sessionItems: {
        where: {
          attendance: { not: "PENDING" },
          session: {
            deletedAt: null,
            sessionDate: { gte: fromDate, lte: toDate },
            halaqa: halaqaWhere,
          },
        },
        orderBy: { session: { sessionDate: "desc" } },
        select: {
          attendance: true,
          session: { select: { sessionDate: true } },
          activities: { select: { pageCount: true } },
        },
      },
    },
  });

  const mapped: FollowUpStudentItem[] = [];

  for (const student of students) {
    const records = student.sessionItems;
    if (!records.length) continue;

    let present = 0;
    let absent = 0;
    let excused = 0;
    let notHeard = 0;
    let totalPages = 0;
    let zeroPagePresentSessions = 0;

    for (const item of records) {
      const itemPages = item.activities.reduce((sum, activity) => sum + Number(activity.pageCount), 0);
      totalPages += itemPages;
      if (item.attendance === "PRESENT") {
        present += 1;
        if (itemPages <= 0) zeroPagePresentSessions += 1;
      }
      if (item.attendance === "ABSENT") absent += 1;
      if (item.attendance === "EXCUSED") excused += 1;
      if (item.attendance === "NOT_HEARD") notHeard += 1;
    }

    let consecutiveAbsences = 0;
    for (const item of records) {
      if (item.attendance !== "ABSENT") break;
      consecutiveAbsences += 1;
    }

    const recordedSessions = records.length;
    const attendanceRate = recordedSessions
      ? Math.round((present / recordedSessions) * 100)
      : 0;
    const reasons: FollowUpReason[] = [];

    if (consecutiveAbsences >= 3) {
      reasons.push(
        reason(
          "CONSECUTIVE_ABSENCE",
          "HIGH",
          "غياب متتالٍ",
          `غاب الطالب ${consecutiveAbsences} جلسات متتالية.`,
        ),
      );
    }
    if (absent >= 3) {
      reasons.push(
        reason(
          "REPEATED_ABSENCE",
          absent >= 5 ? "HIGH" : "MEDIUM",
          "غياب متكرر",
          `سُجل غياب الطالب في ${absent} جلسات ضمن الفترة.`,
        ),
      );
    }
    if (recordedSessions >= 3 && attendanceRate < input.attendanceThreshold) {
      reasons.push(
        reason(
          "LOW_ATTENDANCE",
          attendanceRate < 50 ? "HIGH" : "MEDIUM",
          "نسبة حضور منخفضة",
          `نسبة الحضور ${attendanceRate}%، والحد المعتمد للمتابعة ${input.attendanceThreshold}%.`,
        ),
      );
    }
    if (notHeard >= 2) {
      reasons.push(
        reason(
          "REPEATED_NOT_HEARD",
          notHeard >= 4 ? "HIGH" : "MEDIUM",
          "لم يسمع بشكل متكرر",
          `سُجلت حالة «لم يسمع» ${notHeard} مرات.`,
        ),
      );
    }
    if (present >= 3 && totalPages <= 0) {
      reasons.push(
        reason(
          "NO_PROGRESS",
          "MEDIUM",
          "لا يوجد إنجاز مسجل",
          `حضر الطالب ${present} جلسات دون صفحات حفظ أو مراجعة أو سرد مسجلة.`,
        ),
      );
    } else if (zeroPagePresentSessions >= 3) {
      reasons.push(
        reason(
          "ZERO_PAGE_SESSIONS",
          "LOW",
          "جلسات حضور دون صفحات",
          `لدى الطالب ${zeroPagePresentSessions} جلسات حضور دون صفحات مسجلة.`,
        ),
      );
    }

    if (!reasons.length) continue;

    const currentEnrollment = student.enrollments[0] ?? null;
    const priorityScore = reasons.reduce(
      (sum, item) => sum + severityWeight(item.severity),
      0,
    );

    mapped.push({
      studentId: student.id,
      displayName: student.displayName,
      fullName: student.fullName,
      parentPhone: student.parentPhone,
      gradeLevel: student.gradeLevel,
      currentHalaqa: currentEnrollment
        ? {
            id: currentEnrollment.halaqa.id,
            nameAr: currentEnrollment.halaqa.nameAr,
            stageName: currentEnrollment.halaqa.stage?.nameAr ?? "غير محددة",
          }
        : null,
      metrics: {
        recordedSessions,
        present,
        absent,
        excused,
        notHeard,
        attendanceRate,
        consecutiveAbsences,
        zeroPagePresentSessions,
        totalPages: Number(totalPages.toFixed(2)),
        lastRecordDate: records[0]?.session.sessionDate.toISOString().slice(0, 10) ?? null,
      },
      reasons,
      priorityScore,
    });
  }

  mapped.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    if (a.metrics.attendanceRate !== b.metrics.attendanceRate) {
      return a.metrics.attendanceRate - b.metrics.attendanceRate;
    }
    return a.displayName.localeCompare(b.displayName, "ar");
  });

  const priority = (item: FollowUpStudentItem): FollowUpSeverity => {
    if (item.reasons.some((entry) => entry.severity === "HIGH")) return "HIGH";
    if (item.reasons.some((entry) => entry.severity === "MEDIUM")) return "MEDIUM";
    return "LOW";
  };

  return {
    period: { from: input.from, to: input.to },
    summary: {
      studentsNeedingFollowUp: mapped.length,
      highPriority: mapped.filter((item) => priority(item) === "HIGH").length,
      mediumPriority: mapped.filter((item) => priority(item) === "MEDIUM").length,
      lowPriority: mapped.filter((item) => priority(item) === "LOW").length,
    },
    students: mapped,
  };
}
