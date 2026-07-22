import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { AuthenticatedSession } from "@/lib/auth/types";
import { prisma } from "@/lib/db/prisma";
import { dateOnlyToUtc, weekdayFromDateOnly } from "@/lib/memorization-sessions/date";
import type {
  HalaqaMonthlyReport,
  MonthlyExamReportRow,
  MonthlyReportData,
  MonthlyReportFilter,
  MonthlyReportOptions,
  StudentMonthlyReportRow,
} from "@/lib/reports/types";

function monthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = `${month}-01`;
  const endDate = new Date(Date.UTC(year, monthNumber, 0));
  const end = endDate.toISOString().slice(0, 10);
  return {
    start,
    end,
    startDate: dateOnlyToUtc(start),
    endDate: dateOnlyToUtc(end),
  };
}

function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("ar", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(dateOnlyToUtc(`${month}-01`));
}

function dateIso(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return round2(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function attendanceRate(present: number, absent: number, excused: number, notHeard: number): number {
  const total = present + absent + excused + notHeard;
  return total ? round2((present / total) * 100) : 0;
}

function examTypeLabel(type: string): string {
  if (type === "INDIVIDUAL") return "منفرد";
  if (type === "COLLECTIVE") return "مجتمع";
  return "مخصص";
}

function examStatusLabel(status: string): string {
  return status === "VOIDED" ? "ملغى" : "فعال";
}

function scopeLabel(scope: {
  type: string;
  juzFrom: number | null;
  juzTo: number | null;
  surahName: string | null;
  ayahFrom: number | null;
  ayahTo: number | null;
  pageFrom: number | null;
  pageTo: number | null;
  customText: string | null;
}): string {
  if (scope.type === "JUZ" && scope.juzFrom) {
    return scope.juzTo && scope.juzTo !== scope.juzFrom
      ? `من الجزء ${scope.juzFrom} إلى الجزء ${scope.juzTo}`
      : `الجزء ${scope.juzFrom}`;
  }
  if (scope.type === "SURAH" && scope.surahName) return `سورة ${scope.surahName}`;
  if (scope.type === "AYAH_RANGE" && scope.surahName) {
    return `سورة ${scope.surahName}${scope.ayahFrom ? ` من آية ${scope.ayahFrom}` : ""}${scope.ayahTo ? ` إلى آية ${scope.ayahTo}` : ""}`;
  }
  if (scope.type === "PAGE_RANGE" && scope.pageFrom) {
    return scope.pageTo && scope.pageTo !== scope.pageFrom
      ? `من صفحة ${scope.pageFrom} إلى صفحة ${scope.pageTo}`
      : `صفحة ${scope.pageFrom}`;
  }
  return scope.customText || "نطاق مخصص";
}

function expectedDates(
  start: string,
  end: string,
  schedules: Array<{ weekday: string; effectiveFrom: Date; effectiveTo: Date | null }>,
): string[] {
  const result = new Set<string>();
  const cursor = dateOnlyToUtc(start);
  const last = dateOnlyToUtc(end);

  while (cursor <= last) {
    const iso = dateIso(cursor);
    const weekday = weekdayFromDateOnly(iso);
    const matches = schedules.some(
      (schedule) =>
        schedule.weekday === weekday &&
        schedule.effectiveFrom <= cursor &&
        (!schedule.effectiveTo || schedule.effectiveTo >= cursor),
    );
    if (matches) result.add(iso);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return [...result];
}

function initialStudentRow(studentId: string, displayName: string): StudentMonthlyReportRow {
  return {
    studentId,
    displayName,
    present: 0,
    absent: 0,
    excused: 0,
    notHeard: 0,
    pending: 0,
    memorizationPages: 0,
    reviewPages: 0,
    recitationPages: 0,
    totalPages: 0,
    examCount: 0,
    examAverage: null,
  };
}

export async function getMonthlyReportOptions(
  session: AuthenticatedSession,
): Promise<MonthlyReportOptions> {
  const canExportAll = session.permissions.includes("reports.export.all");

  const halaqat = canExportAll
    ? await prisma.halaqa.findMany({
        where: { deletedAt: null, program: { code: "BASE_PROGRAM", deletedAt: null } },
        orderBy: [{ stage: { sortOrder: "asc" } }, { nameAr: "asc" }],
        select: {
          id: true,
          nameAr: true,
          stage: { select: { id: true, nameAr: true } },
          staffAssignments: {
            where: { role: "PRIMARY_TEACHER", deletedAt: null },
            orderBy: { startsOn: "desc" },
            take: 1,
            select: { user: { select: { displayName: true } } },
          },
        },
      })
    : await prisma.halaqa.findMany({
        where: {
          deletedAt: null,
          program: { code: "BASE_PROGRAM", deletedAt: null },
          staffAssignments: { some: { userId: session.user.id, deletedAt: null } },
        },
        orderBy: [{ stage: { sortOrder: "asc" } }, { nameAr: "asc" }],
        select: {
          id: true,
          nameAr: true,
          stage: { select: { id: true, nameAr: true } },
          staffAssignments: {
            where: { userId: session.user.id, deletedAt: null },
            orderBy: { startsOn: "desc" },
            take: 1,
            select: { user: { select: { displayName: true } } },
          },
        },
      });

  const stages = new Map<string, MonthlyReportOptions["stages"][number]>();
  for (const halaqa of halaqat) {
    const stageId = halaqa.stage?.id ?? "unassigned";
    const current: MonthlyReportOptions["stages"][number] =
      stages.get(stageId) ?? {
        id: stageId,
        nameAr: halaqa.stage?.nameAr ?? "بدون مرحلة",
        halaqat: [],
      };
    current.halaqat.push({
      id: halaqa.id,
      nameAr: halaqa.nameAr,
      stageId: halaqa.stage?.id ?? null,
      stageName: halaqa.stage?.nameAr ?? "بدون مرحلة",
      teacherName: halaqa.staffAssignments[0]?.user.displayName ?? null,
    });
    stages.set(stageId, current);
  }

  const allowedKinds =
    session.role.code === "EXAMINER"
      ? (["EXAMS"] as const)
      : session.role.code === "TEACHER"
        ? (["COMPREHENSIVE"] as const)
        : (["COMPREHENSIVE", "EXAMS"] as const);

  return {
    roleCode: session.role.code,
    defaultKind: session.role.code === "EXAMINER" ? "EXAMS" : "COMPREHENSIVE",
    allowedKinds: [...allowedKinds],
    stages: [...stages.values()],
  };
}

export async function getMonthlyReportData(
  session: AuthenticatedSession,
  filter: MonthlyReportFilter,
): Promise<MonthlyReportData> {
  const range = monthRange(filter.month);
  const canExportAll = session.permissions.includes("reports.export.all");

  const halaqaWhere: Prisma.HalaqaWhereInput = {
    deletedAt: null,
    program: { code: "BASE_PROGRAM", deletedAt: null },
    ...(filter.halaqaId ? { id: filter.halaqaId } : {}),
    ...(filter.stageId ? { stageId: filter.stageId } : {}),
    ...(!canExportAll
      ? {
          staffAssignments: {
            some: {
              userId: session.user.id,
              deletedAt: null,
              startsOn: { lte: range.endDate },
              OR: [{ endsOn: null }, { endsOn: { gte: range.startDate } }],
            },
          },
        }
      : {}),
  };

  const halaqat = await prisma.halaqa.findMany({
    where: halaqaWhere,
    orderBy: [{ stage: { sortOrder: "asc" } }, { nameAr: "asc" }],
    select: {
      id: true,
      nameAr: true,
      stage: { select: { id: true, nameAr: true } },
      schedules: {
        where: {
          effectiveFrom: { lte: range.endDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: range.startDate } }],
        },
        select: { weekday: true, effectiveFrom: true, effectiveTo: true },
      },
      staffAssignments: {
        where: {
          role: "PRIMARY_TEACHER",
          deletedAt: null,
          startsOn: { lte: range.endDate },
          OR: [{ endsOn: null }, { endsOn: { gte: range.startDate } }],
        },
        orderBy: { startsOn: "asc" },
        select: { user: { select: { displayName: true } } },
      },
      enrollments: {
        where: {
          deletedAt: null,
          startedOn: { lte: range.endDate },
          OR: [{ endedOn: null }, { endedOn: { gte: range.startDate } }],
          student: { deletedAt: null },
        },
        select: {
          id: true,
          student: { select: { id: true, displayName: true } },
        },
      },
      sessions: {
        where: {
          deletedAt: null,
          sessionDate: { gte: range.startDate, lte: range.endDate },
        },
        orderBy: { sessionDate: "asc" },
        select: {
          id: true,
          sessionDate: true,
          status: true,
          items: {
            select: {
              attendance: true,
              student: { select: { id: true, displayName: true } },
              activities: { select: { type: true, pageCount: true } },
            },
          },
        },
      },
    },
  });

  const halaqaIds = halaqat.map((halaqa) => halaqa.id);
  const exams = halaqaIds.length
    ? await prisma.officialExam.findMany({
        where: {
          examDate: { gte: range.startDate, lte: range.endDate },
          ...(filter.includeVoided ? {} : { status: "ACTIVE" }),
          enrollment: { halaqaId: { in: halaqaIds } },
        },
        orderBy: [{ examDate: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          examDate: true,
          examType: true,
          status: true,
          score: true,
          resultLabel: true,
          notes: true,
          student: { select: { id: true, displayName: true } },
          examinerUser: { select: { displayName: true } },
          enrollment: {
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
          scopes: {
            orderBy: { orderNo: "asc" },
            select: {
              type: true,
              juzFrom: true,
              juzTo: true,
              surahName: true,
              ayahFrom: true,
              ayahTo: true,
              pageFrom: true,
              pageTo: true,
              customText: true,
            },
          },
        },
      })
    : [];

  const examsByHalaqa = new Map<string, typeof exams>();
  for (const exam of exams) {
    const halaqaId = exam.enrollment?.halaqa.id;
    if (!halaqaId) continue;
    const list = examsByHalaqa.get(halaqaId) ?? [];
    list.push(exam);
    examsByHalaqa.set(halaqaId, list);
  }

  const reportHalaqat: HalaqaMonthlyReport[] = halaqat.map((halaqa) => {
    const students = new Map<string, StudentMonthlyReportRow>();
    for (const enrollment of halaqa.enrollments) {
      if (!students.has(enrollment.student.id)) {
        students.set(
          enrollment.student.id,
          initialStudentRow(enrollment.student.id, enrollment.student.displayName),
        );
      }
    }

    let present = 0;
    let absent = 0;
    let excused = 0;
    let notHeard = 0;
    let pending = 0;
    let memorizationPages = 0;
    let reviewPages = 0;
    let recitationPages = 0;

    for (const memorizationSession of halaqa.sessions) {
      for (const item of memorizationSession.items) {
        const row = students.get(item.student.id) ?? initialStudentRow(item.student.id, item.student.displayName);
        students.set(item.student.id, row);

        if (item.attendance === "PRESENT") {
          present += 1;
          row.present += 1;
        } else if (item.attendance === "ABSENT") {
          absent += 1;
          row.absent += 1;
        } else if (item.attendance === "EXCUSED") {
          excused += 1;
          row.excused += 1;
        } else if (item.attendance === "NOT_HEARD") {
          notHeard += 1;
          row.notHeard += 1;
        } else {
          pending += 1;
          row.pending += 1;
        }

        for (const activity of item.activities) {
          const pages = Number(activity.pageCount);
          if (activity.type === "MEMORIZATION") {
            memorizationPages += pages;
            row.memorizationPages += pages;
          } else if (activity.type === "REVIEW") {
            reviewPages += pages;
            row.reviewPages += pages;
          } else if (activity.type === "RECITATION") {
            recitationPages += pages;
            row.recitationPages += pages;
          }
          row.totalPages += pages;
        }
      }
    }

    const halaqaExams = examsByHalaqa.get(halaqa.id) ?? [];
    const activeScores: number[] = [];
    const studentScores = new Map<string, number[]>();
    for (const exam of halaqaExams) {
      if (exam.status !== "ACTIVE") continue;
      const score = exam.score === null ? null : Number(exam.score);
      const row = students.get(exam.student.id) ?? initialStudentRow(exam.student.id, exam.student.displayName);
      students.set(exam.student.id, row);
      row.examCount += 1;
      if (score !== null) {
        activeScores.push(score);
        const scores = studentScores.get(exam.student.id) ?? [];
        scores.push(score);
        studentScores.set(exam.student.id, scores);
      }
    }

    for (const [studentId, scores] of studentScores) {
      const row = students.get(studentId);
      if (row) row.examAverage = average(scores);
    }

    const expectedSessionDates = expectedDates(range.start, range.end, halaqa.schedules);
    const recordedSessions = halaqa.sessions.filter((session) =>
      session.items.some((item) => item.attendance !== "PENDING"),
    ).length;
    const completedSessions = halaqa.sessions.filter(
      (session) => session.status === "COMPLETED" || session.status === "LOCKED",
    ).length;
    const draftSessions = halaqa.sessions.filter((session) => session.status === "DRAFT").length;

    const mappedStudents = [...students.values()]
      .map((row) => ({
        ...row,
        memorizationPages: round2(row.memorizationPages),
        reviewPages: round2(row.reviewPages),
        recitationPages: round2(row.recitationPages),
        totalPages: round2(row.totalPages),
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "ar"));

    return {
      id: halaqa.id,
      nameAr: halaqa.nameAr,
      stageName: halaqa.stage?.nameAr ?? "بدون مرحلة",
      teacherNames: [...new Set(halaqa.staffAssignments.map((item) => item.user.displayName))],
      expectedSessionDates,
      recordedSessions,
      completedSessions,
      draftSessions,
      studentsCount: mappedStudents.length,
      present,
      absent,
      excused,
      notHeard,
      pending,
      attendanceRate: attendanceRate(present, absent, excused, notHeard),
      memorizationPages: round2(memorizationPages),
      reviewPages: round2(reviewPages),
      recitationPages: round2(recitationPages),
      totalPages: round2(memorizationPages + reviewPages + recitationPages),
      examCount: halaqaExams.filter((exam) => exam.status === "ACTIVE").length,
      examAverage: average(activeScores),
      students: mappedStudents,
    };
  });

  const examRows: MonthlyExamReportRow[] = exams.map((exam) => ({
    id: exam.id,
    date: dateIso(exam.examDate),
    studentName: exam.student.displayName,
    stageName: exam.enrollment?.halaqa.stage?.nameAr ?? "بدون مرحلة",
    halaqaName: exam.enrollment?.halaqa.nameAr ?? "غير محددة",
    examinerName: exam.examinerUser.displayName,
    examType: examTypeLabel(exam.examType),
    scopeLabel: exam.scopes.map(scopeLabel).join("، ") || "غير محدد",
    score: exam.score === null ? null : Number(exam.score),
    resultLabel: exam.resultLabel ?? "—",
    status: examStatusLabel(exam.status),
    notes: exam.notes ?? "",
  }));

  const allStudents = new Set<string>();
  const activeExamScores = examRows
    .filter((exam) => exam.status === "فعال" && exam.score !== null)
    .map((exam) => exam.score as number);
  for (const halaqa of reportHalaqat) {
    for (const student of halaqa.students) allStudents.add(student.studentId);
  }

  const present = reportHalaqat.reduce((sum, item) => sum + item.present, 0);
  const absent = reportHalaqat.reduce((sum, item) => sum + item.absent, 0);
  const excused = reportHalaqat.reduce((sum, item) => sum + item.excused, 0);
  const notHeard = reportHalaqat.reduce((sum, item) => sum + item.notHeard, 0);
  const pending = reportHalaqat.reduce((sum, item) => sum + item.pending, 0);

  const scopeLabelValue = filter.halaqaId
    ? reportHalaqat[0]?.nameAr ?? "حلقة غير موجودة"
    : filter.stageId
      ? reportHalaqat[0]?.stageName ?? "مرحلة غير موجودة"
      : canExportAll
        ? "جميع حلقات المركز"
        : "الحلقات المعيّن عليها";

  const title =
    filter.kind === "EXAMS"
      ? "تقرير الاختبارات الرسمية الشهري"
      : canExportAll
        ? "التقرير الشهري الشامل للمركز"
        : "التقرير الشهري للحلقات";

  return {
    title,
    month: filter.month,
    monthLabel: monthLabel(filter.month),
    kind: filter.kind,
    scopeLabel: scopeLabelValue,
    generatedAt: new Date().toISOString(),
    generatedBy: session.user.displayName,
    summary: {
      halaqatCount: reportHalaqat.length,
      studentsCount: allStudents.size,
      expectedSessions: reportHalaqat.reduce(
        (sum, item) => sum + item.expectedSessionDates.length,
        0,
      ),
      recordedSessions: reportHalaqat.reduce((sum, item) => sum + item.recordedSessions, 0),
      completedSessions: reportHalaqat.reduce((sum, item) => sum + item.completedSessions, 0),
      draftSessions: reportHalaqat.reduce((sum, item) => sum + item.draftSessions, 0),
      present,
      absent,
      excused,
      notHeard,
      pending,
      attendanceRate: attendanceRate(present, absent, excused, notHeard),
      memorizationPages: round2(
        reportHalaqat.reduce((sum, item) => sum + item.memorizationPages, 0),
      ),
      reviewPages: round2(reportHalaqat.reduce((sum, item) => sum + item.reviewPages, 0)),
      recitationPages: round2(
        reportHalaqat.reduce((sum, item) => sum + item.recitationPages, 0),
      ),
      totalPages: round2(reportHalaqat.reduce((sum, item) => sum + item.totalPages, 0)),
      examCount: examRows.filter((exam) => exam.status === "فعال").length,
      examAverage: average(activeExamScores),
    },
    halaqat: reportHalaqat,
    exams: examRows,
  };
}
