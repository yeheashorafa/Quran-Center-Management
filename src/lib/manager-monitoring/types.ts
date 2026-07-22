import type { WeekdayCode } from "@/lib/halaqat/weekdays";

export type MonitoringSessionStatus = "NOT_RECORDED" | "DRAFT" | "COMPLETED" | "LOCKED";

export type MonitoringAttendanceSummary = {
  present: number;
  absent: number;
  excused: number;
  notHeard: number;
};

export type MonitoringActivitySummary = {
  memorizationPages: number;
  reviewPages: number;
  recitationPages: number;
  totalPages: number;
};

export type ManagerDailyHalaqaMonitoringItem = {
  id: string;
  nameAr: string;
  stageName: string;
  teacher: {
    id: string;
    displayName: string;
    status: "ACTIVE" | "DISABLED" | "LOCKED";
  } | null;
  expectedStudents: number;
  recordedStudents: number;
  remainingStudents: number;
  monitoringStatus: MonitoringSessionStatus;
  session: {
    id: string;
    status: "DRAFT" | "COMPLETED" | "LOCKED";
    updatedAt: string;
    completedAt: string | null;
  } | null;
  attendance: MonitoringAttendanceSummary;
  activities: MonitoringActivitySummary;
};

export type ManagerDailyMonitoringData = {
  date: string;
  weekday: WeekdayCode;
  weekdayLabel: string;
  summary: {
    expectedHalaqat: number;
    recordedHalaqat: number;
    completedHalaqat: number;
    draftHalaqat: number;
    notRecordedHalaqat: number;
    expectedStudents: number;
    recordedStudents: number;
    attendance: MonitoringAttendanceSummary;
    activities: MonitoringActivitySummary;
  };
  halaqat: ManagerDailyHalaqaMonitoringItem[];
};
