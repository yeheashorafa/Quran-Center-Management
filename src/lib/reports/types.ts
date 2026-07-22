import type { AppRoleCode } from "@/lib/auth/constants";

export type ReportKind = "COMPREHENSIVE" | "EXAMS";
export type ReportFormat = "excel" | "pdf" | "csv";

export type ReportHalaqaOption = {
  id: string;
  nameAr: string;
  stageId: string | null;
  stageName: string;
  teacherName: string | null;
};

export type ReportStageOption = {
  id: string;
  nameAr: string;
  halaqat: ReportHalaqaOption[];
};

export type MonthlyReportOptions = {
  roleCode: AppRoleCode;
  defaultKind: ReportKind;
  allowedKinds: ReportKind[];
  stages: ReportStageOption[];
};

export type MonthlyReportFilter = {
  month: string;
  kind: ReportKind;
  stageId?: string;
  halaqaId?: string;
  includeVoided: boolean;
};

export type StudentMonthlyReportRow = {
  studentId: string;
  displayName: string;
  present: number;
  absent: number;
  excused: number;
  notHeard: number;
  pending: number;
  memorizationPages: number;
  reviewPages: number;
  recitationPages: number;
  totalPages: number;
  examCount: number;
  examAverage: number | null;
};

export type MonthlyExamReportRow = {
  id: string;
  date: string;
  studentName: string;
  stageName: string;
  halaqaName: string;
  examinerName: string;
  examType: string;
  scopeLabel: string;
  score: number | null;
  resultLabel: string;
  status: string;
  notes: string;
};

export type HalaqaMonthlyReport = {
  id: string;
  nameAr: string;
  stageName: string;
  teacherNames: string[];
  expectedSessionDates: string[];
  recordedSessions: number;
  completedSessions: number;
  draftSessions: number;
  studentsCount: number;
  present: number;
  absent: number;
  excused: number;
  notHeard: number;
  pending: number;
  attendanceRate: number;
  memorizationPages: number;
  reviewPages: number;
  recitationPages: number;
  totalPages: number;
  examCount: number;
  examAverage: number | null;
  students: StudentMonthlyReportRow[];
};

export type MonthlyReportSummary = {
  halaqatCount: number;
  studentsCount: number;
  expectedSessions: number;
  recordedSessions: number;
  completedSessions: number;
  draftSessions: number;
  present: number;
  absent: number;
  excused: number;
  notHeard: number;
  pending: number;
  attendanceRate: number;
  memorizationPages: number;
  reviewPages: number;
  recitationPages: number;
  totalPages: number;
  examCount: number;
  examAverage: number | null;
};

export type MonthlyReportData = {
  title: string;
  month: string;
  monthLabel: string;
  kind: ReportKind;
  scopeLabel: string;
  generatedAt: string;
  generatedBy: string;
  summary: MonthlyReportSummary;
  halaqat: HalaqaMonthlyReport[];
  exams: MonthlyExamReportRow[];
};
