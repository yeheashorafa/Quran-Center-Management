export type OfficialExamStatus = "ACTIVE" | "VOIDED";
export type OfficialExamType = "INDIVIDUAL" | "COLLECTIVE" | "CUSTOM";

export type OfficialExamStudentOption = {
  id: string;
  displayName: string;
  enrollmentId: string;
};

export type OfficialExamHalaqaOption = {
  id: string;
  nameAr: string;
  stageId: string;
  stageName: string;
  teacherName: string | null;
  students: OfficialExamStudentOption[];
};

export type OfficialExamStageOption = {
  id: string;
  code: string;
  nameAr: string;
  halaqat: OfficialExamHalaqaOption[];
};

export type OfficialExamOptionsData = {
  stages: OfficialExamStageOption[];
};

export type OfficialExamScopeData = {
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
  label: string;
};

export type OfficialExamListItem = {
  id: string;
  student: {
    id: string;
    displayName: string;
  };
  enrollment: {
    id: string;
    halaqaId: string;
    halaqaName: string;
    stageId: string | null;
    stageName: string;
  } | null;
  examiner: {
    id: string;
    displayName: string;
  };
  examDate: string;
  examType: OfficialExamType;
  status: OfficialExamStatus;
  score: number | null;
  resultLabel: string | null;
  notes: string | null;
  version: number;
  scopes: OfficialExamScopeData[];
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OfficialExamFilters = {
  stageId?: string;
  halaqaId?: string;
  studentId?: string;
  from?: string;
  to?: string;
  status?: OfficialExamStatus | "ALL";
  limit?: number;
};
