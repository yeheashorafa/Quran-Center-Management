export type FollowUpSeverity = "HIGH" | "MEDIUM" | "LOW";

export type FollowUpReasonCode =
  | "CONSECUTIVE_ABSENCE"
  | "REPEATED_ABSENCE"
  | "LOW_ATTENDANCE"
  | "REPEATED_NOT_HEARD"
  | "NO_PROGRESS"
  | "ZERO_PAGE_SESSIONS";

export type FollowUpReason = {
  code: FollowUpReasonCode;
  severity: FollowUpSeverity;
  label: string;
  detail: string;
};

export type FollowUpStudentItem = {
  studentId: string;
  displayName: string;
  fullName: string;
  parentPhone: string | null;
  gradeLevel: string | null;
  currentHalaqa: {
    id: string;
    nameAr: string;
    stageName: string;
  } | null;
  metrics: {
    recordedSessions: number;
    present: number;
    absent: number;
    excused: number;
    notHeard: number;
    attendanceRate: number;
    consecutiveAbsences: number;
    zeroPagePresentSessions: number;
    totalPages: number;
    lastRecordDate: string | null;
  };
  reasons: FollowUpReason[];
  priorityScore: number;
};

export type StudentFollowUpData = {
  period: { from: string; to: string };
  summary: {
    studentsNeedingFollowUp: number;
    highPriority: number;
    mediumPriority: number;
    lowPriority: number;
  };
  students: FollowUpStudentItem[];
};
