export type LegacyRow = Record<string, string>;

export type LegacyFileName =
  | "teachers_rows.csv"
  | "camp_teachers_rows.csv"
  | "students_rows.csv"
  | "sessions_rows.csv"
  | "session_records_rows.csv"
  | "exams_rows.csv"
  | "official_exams_rows.csv"
  | "student_transfer_log_rows.csv";

export interface LoadedLegacySources {
  inputDir: string;
  files: Partial<Record<LegacyFileName, LegacyRow[]>>;
  hashes: Partial<Record<LegacyFileName, string>>;
  missingOptionalFiles: LegacyFileName[];
  fingerprint: string;
}

export interface PlanWarning {
  code: string;
  severity: "INFO" | "WARNING" | "ERROR";
  message: string;
  sourceFile?: string;
  legacyId?: string;
  details?: Record<string, unknown>;
}

export interface PlannedUser {
  id: string;
  displayName: string;
  username: string;
  normalizedUsername: string;
  roleCodes: Array<"TEACHER" | "CENTER_MANAGER" | "EXAMINER">;
  status: "DISABLED";
  legacyIds: Array<{ entityType: "teacher" | "camp_teacher"; legacyId: string }>;
}

export interface PlannedProgram {
  id: string;
  code: string;
  nameAr: string;
  type: "BASE" | "SEASONAL";
  status: "ACTIVE" | "ARCHIVED";
  startsOn: string | null;
  endsOn: string | null;
}

export interface PlannedHalaqa {
  id: string;
  code: string;
  nameAr: string;
  programCode: string;
  stageCode: "BRAAIM" | "ASHBAL" | "NASHIEEN" | null;
  status: "ACTIVE" | "ARCHIVED";
  sheikhNormalizedName: string;
  sourceGroupName: string;
  sourceSheikhName: string;
  observedWeekdays: string[];
  firstObservedOn: string;
  lastObservedOn: string | null;
}

export interface PlannedStaffAssignment {
  id: string;
  halaqaId: string;
  plannedUserId: string;
  role: "PRIMARY_TEACHER";
  startsOn: string;
  endsOn: string | null;
}

export interface PlannedStudent {
  id: string;
  fullName: string;
  normalizedFullName: string;
  displayName: string;
  parentPhone: string | null;
  gradeLevel: string | null;
  memorizationStartedOn: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  synthetic: boolean;
  legacyIds: string[];
}

export interface PlannedEnrollment {
  id: string;
  studentId: string;
  halaqaId: string;
  programCode: string;
  status: "ACTIVE" | "COMPLETED" | "INACTIVE";
  startedOn: string;
  endedOn: string | null;
  endReason: string | null;
  legacyStudentIds: string[];
}

export interface PlannedActivity {
  id: string;
  type: "MEMORIZATION" | "REVIEW" | "RECITATION";
  orderNo: number;
  surahName: string | null;
  fromAyah: number | null;
  toAyah: number | null;
  pageCount: number;
  details: Record<string, unknown>;
}

export interface PlannedSessionItem {
  id: string;
  studentId: string;
  enrollmentId: string | null;
  attendance: "PENDING" | "PRESENT" | "ABSENT" | "EXCUSED" | "NOT_HEARD";
  notes: string | null;
  legacyRecordId: string;
  activities: PlannedActivity[];
}

export interface PlannedSession {
  id: string;
  halaqaId: string;
  assignmentId: string | null;
  sessionDate: string;
  status: "DRAFT" | "COMPLETED";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  legacySessionId: string | null;
  items: PlannedSessionItem[];
}

export interface PlannedExamScope {
  id: string;
  orderNo: number;
  type: "JUZ" | "CUSTOM";
  juzFrom: number | null;
  juzTo: number | null;
  customText: string | null;
}

export interface PlannedExam {
  id: string;
  studentId: string;
  enrollmentId: string | null;
  examinerPlannedUserId: string;
  examDate: string;
  examType: "INDIVIDUAL" | "COLLECTIVE" | "CUSTOM";
  score: number | null;
  resultLabel: string | null;
  notes: string | null;
  legacyEntityType: "exam" | "official_exam";
  legacyId: string;
  scopes: PlannedExamScope[];
}

export interface LegacyMapPlan {
  entityType: string;
  legacyId: string;
  plannedNewId: string;
  canonicalKey: string | null;
  metadata?: Record<string, unknown>;
}

export interface MigrationPlan {
  version: 1;
  sourceSystem: string;
  sourceFingerprint: string;
  generatedAt: string;
  inputManifest: Array<{ file: string; rowCount: number; sha256: string }>;
  dateRange: { from: string | null; to: string | null };
  statistics: Record<string, number>;
  users: PlannedUser[];
  programs: PlannedProgram[];
  halaqat: PlannedHalaqa[];
  staffAssignments: PlannedStaffAssignment[];
  students: PlannedStudent[];
  enrollments: PlannedEnrollment[];
  sessions: PlannedSession[];
  exams: PlannedExam[];
  legacyMaps: LegacyMapPlan[];
  warnings: PlanWarning[];
}
