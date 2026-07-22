import "server-only";

import { prisma } from "@/lib/db/prisma";
import { getManagerDailyMonitoringData } from "@/lib/manager-monitoring/queries";
import { dateOnlyToUtc } from "@/lib/memorization-sessions/date";
import { getStudentFollowUpData } from "@/lib/student-follow-up/queries";
import type {
  ManagerAlertItem,
  ManagerAlertsData,
  ManagerAlertSeverity,
} from "@/lib/manager-alerts/types";

function subtractDays(value: string, days: number): string {
  const date = dateOnlyToUtc(value);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function severityRank(value: ManagerAlertSeverity): number {
  if (value === "CRITICAL") return 3;
  if (value === "WARNING") return 2;
  return 1;
}

export async function getManagerAlertsData(
  dateValue: string,
  lookbackDays: number,
): Promise<ManagerAlertsData> {
  const date = dateOnlyToUtc(dateValue);
  const staleFrom = dateOnlyToUtc(subtractDays(dateValue, lookbackDays));
  const followUpFrom = subtractDays(dateValue, 30);

  const [monitoring, activeHalaqat, staleDrafts, inactiveHalaqatWithStudents, followUp] =
    await Promise.all([
      getManagerDailyMonitoringData(dateValue),
      prisma.halaqa.findMany({
        where: {
          status: "ACTIVE",
          deletedAt: null,
          program: { code: "BASE_PROGRAM", status: "ACTIVE", deletedAt: null },
        },
        orderBy: { nameAr: "asc" },
        select: {
          id: true,
          nameAr: true,
          staffAssignments: {
            where: {
              role: "PRIMARY_TEACHER",
              startsOn: { lte: date },
              OR: [{ endsOn: null }, { endsOn: { gte: date } }],
              deletedAt: null,
            },
            take: 1,
            select: { user: { select: { displayName: true, status: true } } },
          },
        },
      }),
      prisma.memorizationSession.findMany({
        where: {
          status: "DRAFT",
          deletedAt: null,
          sessionDate: { gte: staleFrom, lt: date },
          halaqa: { program: { code: "BASE_PROGRAM" } },
        },
        orderBy: { sessionDate: "asc" },
        select: {
          id: true,
          sessionDate: true,
          halaqa: { select: { id: true, nameAr: true } },
          items: { where: { attendance: { not: "PENDING" } }, select: { id: true } },
        },
      }),
      prisma.halaqa.findMany({
        where: {
          status: { not: "ACTIVE" },
          deletedAt: null,
          program: { code: "BASE_PROGRAM" },
          enrollments: {
            some: { status: "ACTIVE", endedOn: null, deletedAt: null },
          },
        },
        select: {
          id: true,
          nameAr: true,
          _count: {
            select: {
              enrollments: {
                where: { status: "ACTIVE", endedOn: null, deletedAt: null },
              },
            },
          },
        },
      }),
      getStudentFollowUpData({
        from: followUpFrom,
        to: dateValue,
        attendanceThreshold: 70,
      }),
    ]);

  const alerts: ManagerAlertItem[] = [];

  for (const halaqa of monitoring.halaqat) {
    if (halaqa.monitoringStatus === "NOT_RECORDED") {
      alerts.push({
        id: `not-recorded-${halaqa.id}-${dateValue}`,
        severity: "CRITICAL",
        category: "SESSION",
        title: `لم تُسجل جلسة ${halaqa.nameAr}`,
        description: `الحلقة مجدولة يوم ${monitoring.weekdayLabel} ولديها ${halaqa.expectedStudents} طالباً متوقعاً دون تسجيل جلسة.`,
        date: dateValue,
        href: `/manager?tab=monitoring&date=${dateValue}`,
      });
    } else if (halaqa.monitoringStatus === "DRAFT") {
      alerts.push({
        id: `draft-${halaqa.id}-${dateValue}`,
        severity: "WARNING",
        category: "SESSION",
        title: `جلسة ${halaqa.nameAr} غير مكتملة`,
        description: `تم تسجيل ${halaqa.recordedStudents} من أصل ${halaqa.expectedStudents} طالباً، والمتبقي ${halaqa.remainingStudents}.`,
        date: dateValue,
        href: `/manager?tab=monitoring&date=${dateValue}`,
      });
    }
  }

  for (const halaqa of activeHalaqat) {
    const assignment = halaqa.staffAssignments[0];
    if (!assignment) {
      alerts.push({
        id: `no-teacher-${halaqa.id}`,
        severity: "CRITICAL",
        category: "HALAQA",
        title: `الحلقة ${halaqa.nameAr} بلا شيخ أساسي`,
        description: "الحلقة نشطة لكن لا يوجد تعيين شيخ أساسي سارٍ في التاريخ المحدد.",
        date: dateValue,
        href: "/manager?tab=halaqat",
      });
    } else if (assignment.user.status !== "ACTIVE") {
      alerts.push({
        id: `inactive-teacher-${halaqa.id}`,
        severity: "CRITICAL",
        category: "USER",
        title: `حساب شيخ ${halaqa.nameAr} غير نشط`,
        description: `${assignment.user.displayName} مرتبط بالحَلَقة لكن حالة حسابه ${assignment.user.status}.`,
        date: dateValue,
        href: "/manager?tab=users",
      });
    }
  }

  for (const session of staleDrafts) {
    alerts.push({
      id: `stale-draft-${session.id}`,
      severity: "WARNING",
      category: "SESSION",
      title: `مسودة قديمة في ${session.halaqa.nameAr}`,
      description: `جلسة ${session.sessionDate.toISOString().slice(0, 10)} ما زالت مسودة وبها ${session.items.length} سجل طالب.`,
      date: session.sessionDate.toISOString().slice(0, 10),
      href: `/manager?tab=monitoring&date=${session.sessionDate.toISOString().slice(0, 10)}`,
    });
  }

  for (const halaqa of inactiveHalaqatWithStudents) {
    alerts.push({
      id: `inactive-halaqa-enrollments-${halaqa.id}`,
      severity: "CRITICAL",
      category: "HALAQA",
      title: `طلاب نشطون في حلقة متوقفة`,
      description: `الحلقة ${halaqa.nameAr} متوقفة لكن ما زال فيها ${halaqa._count.enrollments} تسجيل طالب نشط.`,
      date: null,
      href: "/manager?tab=students",
    });
  }

  if (followUp.summary.studentsNeedingFollowUp > 0) {
    alerts.push({
      id: `follow-up-summary-${dateValue}`,
      severity: followUp.summary.highPriority > 0 ? "CRITICAL" : "WARNING",
      category: "STUDENT",
      title: `${followUp.summary.studentsNeedingFollowUp} طالباً يحتاجون متابعة`,
      description: `منهم ${followUp.summary.highPriority} أولوية عالية و${followUp.summary.mediumPriority} أولوية متوسطة خلال آخر 30 يوماً.`,
      date: dateValue,
      href: "/manager?tab=followup",
    });
  }

  alerts.sort((a, b) => {
    const severity = severityRank(b.severity) - severityRank(a.severity);
    if (severity !== 0) return severity;
    return (b.date ?? "").localeCompare(a.date ?? "");
  });

  return {
    date: dateValue,
    lookbackDays,
    summary: {
      total: alerts.length,
      critical: alerts.filter((item) => item.severity === "CRITICAL").length,
      warning: alerts.filter((item) => item.severity === "WARNING").length,
      info: alerts.filter((item) => item.severity === "INFO").length,
    },
    alerts,
  };
}
