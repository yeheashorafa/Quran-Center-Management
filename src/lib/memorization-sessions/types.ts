import type { WeekdayCode } from "@/lib/halaqat/weekdays";

export type SessionAttendanceCode =
  | "PENDING"
  | "PRESENT"
  | "ABSENT"
  | "EXCUSED"
  | "NOT_HEARD";

export type SessionActivityCode = "MEMORIZATION" | "REVIEW" | "RECITATION";
export type SessionStatusCode = "DRAFT" | "COMPLETED" | "LOCKED";

export type TeacherHalaqaSummary = {
  id: string;
  nameAr: string;
  stageName: string;
  weekdays: WeekdayCode[];
  activeStudentCount: number;
};

export type TeacherRecentSession = {
  id: string;
  halaqaId: string;
  halaqaName: string;
  sessionDate: string;
  status: SessionStatusCode;
  recordedStudents: number;
  totalStudents: number;
};

export type TeacherSessionDashboardData = {
  halaqat: TeacherHalaqaSummary[];
  recentSessions: TeacherRecentSession[];
};

export type SessionActivityValue = {
  type: SessionActivityCode;
  text: string;
  pageCount: number;
};

export type SessionStudentValue = {
  studentId: string;
  enrollmentId: string;
  displayName: string;
  fullName: string;
  attendance: SessionAttendanceCode;
  notes: string;
  itemId: string | null;
  version: number | null;
  activities: SessionActivityValue[];
};

export type TeacherSessionEditorData = {
  allowed: boolean;
  reason: string | null;
  date: string;
  weekday: WeekdayCode;
  weekdayLabel: string;
  halaqa: {
    id: string;
    nameAr: string;
    stageName: string;
    weekdays: WeekdayCode[];
  };
  session: {
    id: string;
    status: SessionStatusCode;
    version: number;
    completedAt: string | null;
  } | null;
  students: SessionStudentValue[];
};
