import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { dateOnlyToUtc } from "@/lib/memorization-sessions/date";
import type {
  OfficialExamFilters,
  OfficialExamListItem,
  OfficialExamOptionsData,
  OfficialExamScopeData,
} from "@/lib/official-exams/types";

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

function mapScope(scope: {
  id: string;
  type: "JUZ" | "SURAH" | "AYAH_RANGE" | "PAGE_RANGE" | "CUSTOM";
  juzFrom: number | null;
  juzTo: number | null;
  surahName: string | null;
  ayahFrom: number | null;
  ayahTo: number | null;
  pageFrom: number | null;
  pageTo: number | null;
  customText: string | null;
}): OfficialExamScopeData {
  return { ...scope, label: scopeLabel(scope) };
}

export async function getOfficialExamOptions(): Promise<OfficialExamOptionsData> {
  const stages = await prisma.stage.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { nameAr: "asc" }],
    select: {
      id: true,
      code: true,
      nameAr: true,
      halaqat: {
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
            where: { role: "PRIMARY_TEACHER", endsOn: null, deletedAt: null },
            take: 1,
            select: { user: { select: { displayName: true } } },
          },
          enrollments: {
            where: {
              status: "ACTIVE",
              endedOn: null,
              deletedAt: null,
              student: { isActive: true, deletedAt: null },
            },
            orderBy: { student: { displayName: "asc" } },
            select: {
              id: true,
              student: { select: { id: true, displayName: true } },
            },
          },
        },
      },
    },
  });

  return {
    stages: stages.map((stage) => ({
      id: stage.id,
      code: stage.code,
      nameAr: stage.nameAr,
      halaqat: stage.halaqat.map((halaqa) => ({
        id: halaqa.id,
        nameAr: halaqa.nameAr,
        stageId: stage.id,
        stageName: stage.nameAr,
        teacherName: halaqa.staffAssignments[0]?.user.displayName ?? null,
        students: halaqa.enrollments.map((enrollment) => ({
          id: enrollment.student.id,
          displayName: enrollment.student.displayName,
          enrollmentId: enrollment.id,
        })),
      })),
    })),
  };
}

export async function getOfficialExamList(
  filters: OfficialExamFilters = {},
  teacherUserId?: string,
): Promise<OfficialExamListItem[]> {
  const where: Prisma.OfficialExamWhereInput = {
    ...(filters.status && filters.status !== "ALL" ? { status: filters.status } : {}),
    ...(filters.studentId ? { studentId: filters.studentId } : {}),
    ...(filters.from || filters.to
      ? {
          examDate: {
            ...(filters.from ? { gte: dateOnlyToUtc(filters.from) } : {}),
            ...(filters.to ? { lte: dateOnlyToUtc(filters.to) } : {}),
          },
        }
      : {}),
  };

  if (filters.halaqaId || filters.stageId || teacherUserId) {
    const enrollmentWhere: Prisma.StudentEnrollmentWhereInput = {};
    if (filters.halaqaId) enrollmentWhere.halaqaId = filters.halaqaId;

    const halaqaWhere: Prisma.HalaqaWhereInput = {};
    if (filters.stageId) halaqaWhere.stageId = filters.stageId;
    if (teacherUserId) {
      halaqaWhere.staffAssignments = {
        some: { userId: teacherUserId, endsOn: null, deletedAt: null },
      };
    }
    if (Object.keys(halaqaWhere).length) enrollmentWhere.halaqa = halaqaWhere;
    where.enrollment = enrollmentWhere;
  }

  const exams = await prisma.officialExam.findMany({
    where,
    orderBy: [{ examDate: "desc" }, { createdAt: "desc" }],
    take: filters.limit ?? 100,
    select: {
      id: true,
      examDate: true,
      examType: true,
      status: true,
      score: true,
      resultLabel: true,
      notes: true,
      version: true,
      voidedAt: true,
      voidReason: true,
      createdAt: true,
      updatedAt: true,
      student: { select: { id: true, displayName: true } },
      enrollment: {
        select: {
          id: true,
          halaqa: {
            select: {
              id: true,
              nameAr: true,
              stage: { select: { id: true, nameAr: true } },
            },
          },
        },
      },
      examinerUser: { select: { id: true, displayName: true } },
      scopes: {
        orderBy: { orderNo: "asc" },
        select: {
          id: true,
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
  });

  return exams.map((exam) => ({
    id: exam.id,
    student: exam.student,
    enrollment: exam.enrollment
      ? {
          id: exam.enrollment.id,
          halaqaId: exam.enrollment.halaqa.id,
          halaqaName: exam.enrollment.halaqa.nameAr,
          stageId: exam.enrollment.halaqa.stage?.id ?? null,
          stageName: exam.enrollment.halaqa.stage?.nameAr ?? "غير محددة",
        }
      : null,
    examiner: exam.examinerUser,
    examDate: exam.examDate.toISOString().slice(0, 10),
    examType: exam.examType,
    status: exam.status,
    score: exam.score === null ? null : Number(exam.score),
    resultLabel: exam.resultLabel,
    notes: exam.notes,
    version: exam.version,
    scopes: exam.scopes.map(mapScope),
    voidedAt: exam.voidedAt?.toISOString() ?? null,
    voidReason: exam.voidReason,
    createdAt: exam.createdAt.toISOString(),
    updatedAt: exam.updatedAt.toISOString(),
  }));
}

export async function getRecentOfficialExamsForTeacher(userId: string) {
  return getOfficialExamList({ status: "ACTIVE", limit: 20 }, userId);
}

export async function getRecentOfficialExamsForManager() {
  return getOfficialExamList({ status: "ACTIVE", limit: 30 });
}
