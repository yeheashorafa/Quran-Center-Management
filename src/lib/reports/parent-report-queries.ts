import "server-only";

import { appConfig } from "@/config/app";
import type { AuthenticatedSession } from "@/lib/auth/types";
import { prisma } from "@/lib/db/prisma";
import { dateOnlyToUtc } from "@/lib/memorization-sessions/date";
import type { ParentReportData, ParentReportEvaluation } from "./parent-report-types";

function monthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = `${month}-01`;
  const endDate = new Date(Date.UTC(year || 2026, monthNumber || 7, 0));
  const end = endDate.toISOString().slice(0, 10);
  return {
    start,
    end,
    startDate: dateOnlyToUtc(start),
    endDate: dateOnlyToUtc(end),
  };
}

function monthLabel(month: string): string {
  try {
    return new Intl.DateTimeFormat("ar-PS", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(dateOnlyToUtc(`${month}-01`));
  } catch {
    return month;
  }
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function computeEvaluation(
  attendanceRate: number,
  totalPages: number,
  absent: number,
  notHeard: number,
): {
  code: ParentReportEvaluation;
  label: string;
  colorClass: string;
  description: string;
} {
  if (attendanceRate >= 90 && totalPages >= 15 && absent <= 1 && notHeard <= 1) {
    return {
      code: "EXCELLENT",
      label: "ممتاز ✨",
      colorClass: "bg-emerald-100 text-emerald-950 border-emerald-300",
      description: "الطالب ملتزم جداً بالحضور، ويحقق معدل إنجاز متميز وحفظ متقن.",
    };
  }

  if (attendanceRate >= 80 && totalPages >= 8 && absent <= 2) {
    return {
      code: "VERY_GOOD",
      label: "جيد جداً 🌟",
      colorClass: "bg-blue-100 text-blue-950 border-blue-300",
      description: "مستوى الطالب جيد جداً وأداؤه ثابت، مع مواظبة مستمرة على التسميع.",
    };
  }

  if (attendanceRate >= 65 && absent <= 4) {
    return {
      code: "GOOD",
      label: "جيد 👍",
      colorClass: "bg-amber-100 text-amber-950 border-amber-300",
      description: "أداء مقبول مع وجود إنجاز، ويحتاج قليلاً من التشجيع والمواظبة.",
    };
  }

  return {
    code: "NEEDS_FOLLOW_UP",
    label: "يحتاج متابعة ⚠️",
    colorClass: "bg-red-100 text-red-950 border-red-300",
    description: "نسبة الغياب أو عدم التسميع مرتفعة، نرجو من ولي الأمر المتابعة الحثيثة مع الشيخ.",
  };
}

export async function getParentStudentReportData(
  session: AuthenticatedSession,
  studentId: string,
  month: string,
): Promise<ParentReportData | null> {
  const range = monthRange(month);

  const isManager = session.permissions.includes("reports.export.all") || session.role.code === "CENTER_MANAGER";

  // 1. Fetch Student & Enrollment
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      deletedAt: null,
      ...(!isManager
        ? {
            enrollments: {
              some: {
                deletedAt: null,
                halaqa: {
                  staffAssignments: {
                    some: { userId: session.user.id, deletedAt: null },
                  },
                },
              },
            },
          }
        : {}),
    },
    select: {
      id: true,
      fullName: true,
      displayName: true,
      parentPhone: true,
      gradeLevel: true,
      memorizationStartedOn: true,
      createdAt: true,
      enrollments: {
        where: { deletedAt: null },
        orderBy: { startedOn: "desc" },
        take: 1,
        select: {
          id: true,
          halaqa: {
            select: {
              id: true,
              nameAr: true,
              stage: { select: { nameAr: true } },
              staffAssignments: {
                where: { role: "PRIMARY_TEACHER", deletedAt: null },
                orderBy: { startsOn: "desc" },
                take: 1,
                select: { user: { select: { displayName: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!student) return null;

  const currentEnrollment = student.enrollments[0];
  const halaqaName = currentEnrollment?.halaqa.nameAr ?? "حلقة التحفيظ";
  const stageName = currentEnrollment?.halaqa.stage?.nameAr ?? "مركز التحفيظ";
  const teacherName = currentEnrollment?.halaqa.staffAssignments[0]?.user.displayName ?? null;

  // 2. Fetch Session Records for student in selected month
  const sessionItems = await prisma.sessionRecordItem.findMany({
    where: {
      studentId: student.id,
      session: {
        sessionDate: { gte: range.startDate, lte: range.endDate },
        deletedAt: null,
      },
    },
    orderBy: { session: { sessionDate: "desc" } },
    select: {
      attendance: true,
      notes: true,
      session: { select: { sessionDate: true } },
      activities: {
        select: {
          type: true,
          surahName: true,
          notes: true,
          pageCount: true,
        },
      },
    },
  });

  let present = 0;
  let absent = 0;
  let excused = 0;
  let notHeard = 0;
  let memorizationPages = 0;
  let reviewPages = 0;
  let recitationPages = 0;
  let latestAchievementText: string | null = null;
  let latestTeacherNote: string | null = null;

  for (const item of sessionItems) {
    if (item.attendance === "PRESENT") present += 1;
    else if (item.attendance === "ABSENT") absent += 1;
    else if (item.attendance === "EXCUSED") excused += 1;
    else if (item.attendance === "NOT_HEARD") notHeard += 1;

    if (item.notes && !latestTeacherNote) {
      latestTeacherNote = item.notes;
    }

    for (const activity of item.activities) {
      const pages = Number(activity.pageCount || 0);
      if (activity.type === "MEMORIZATION") memorizationPages += pages;
      else if (activity.type === "REVIEW") reviewPages += pages;
      else if (activity.type === "RECITATION") recitationPages += pages;

      const text = activity.surahName ? `سورة ${activity.surahName}` : activity.notes || "";
      if (text && !latestAchievementText) {
        latestAchievementText = text;
      }
    }
  }

  const recordedSessions = sessionItems.filter((item) => item.attendance !== "PENDING").length;
  const totalAttendanceDays = present + absent + excused + notHeard;
  const attendanceRate = totalAttendanceDays ? round2((present / totalAttendanceDays) * 100) : 0;
  const totalPages = round2(memorizationPages + reviewPages + recitationPages);

  // 3. Fetch Latest Official Exam
  const latestOfficialExam = await prisma.officialExam.findFirst({
    where: {
      studentId: student.id,
      status: "ACTIVE",
    },
    orderBy: { examDate: "desc" },
    select: {
      id: true,
      examDate: true,
      examType: true,
      score: true,
      resultLabel: true,
      notes: true,
      scopes: {
        orderBy: { orderNo: "asc" },
        select: {
          type: true,
          juzFrom: true,
          juzTo: true,
          surahName: true,
          customText: true,
        },
      },
    },
  });

  let examTypeLabel = "اختبار رسمي";
  if (latestOfficialExam?.examType === "INDIVIDUAL") examTypeLabel = "اختبار فردي";
  else if (latestOfficialExam?.examType === "COLLECTIVE") examTypeLabel = "اختبار مجمع";

  let scopeLabel = "نطاق مخصص";
  if (latestOfficialExam?.scopes[0]) {
    const scope = latestOfficialExam.scopes[0];
    if (scope.type === "JUZ" && scope.juzFrom) {
      scopeLabel = scope.juzTo && scope.juzTo !== scope.juzFrom ? `من الجزء ${scope.juzFrom} إلى ${scope.juzTo}` : `الجزء ${scope.juzFrom}`;
    } else if (scope.surahName) {
      scopeLabel = `سورة ${scope.surahName}`;
    } else if (scope.customText) {
      scopeLabel = scope.customText;
    }
  }

  const evaluation = computeEvaluation(attendanceRate, totalPages, absent, notHeard);

  return {
    centerName: appConfig.centerName,
    reportTitle: "تقرير متابعة مستوى الطالب",
    generatedAt: new Date().toISOString(),
    month,
    monthLabel: monthLabel(month),
    student: {
      id: student.id,
      fullName: student.fullName,
      displayName: student.displayName,
      parentPhone: student.parentPhone,
      gradeLevel: student.gradeLevel,
      memorizationStartedOn: student.memorizationStartedOn
        ? student.memorizationStartedOn.toISOString().slice(0, 10)
        : null,
    },
    halaqa: {
      id: currentEnrollment?.halaqa.id ?? "",
      nameAr: halaqaName,
      stageName,
      teacherName,
    },
    attendance: {
      present,
      absent,
      excused,
      notHeard,
      recordedSessions,
      attendanceRate,
    },
    achievement: {
      memorizationPages: round2(memorizationPages),
      reviewPages: round2(reviewPages),
      recitationPages: round2(recitationPages),
      totalPages,
      latestAchievementText,
      latestTeacherNote,
    },
    latestExam: latestOfficialExam
      ? {
          id: latestOfficialExam.id,
          examDate: latestOfficialExam.examDate.toISOString().slice(0, 10),
          examType: examTypeLabel,
          score: latestOfficialExam.score === null ? null : Number(latestOfficialExam.score),
          resultLabel: latestOfficialExam.resultLabel,
          scopeLabel,
        }
      : null,
    evaluation,
  };
}
