import type { StudentTransferHistoryItem } from "@/lib/student-transfers/types";

export type StudentHalaqaOption = {
  id: string;
  nameAr: string;
  stageName: string;
  teacherName: string | null;
};

export type ManagerStudentItem = {
  id: string;
  fullName: string;
  displayName: string;
  parentPhone: string | null;
  gradeLevel: string | null;
  isActive: boolean;
  activeEnrollment: {
    id: string;
    startedOn: string;
    halaqa: {
      id: string;
      nameAr: string;
      stageName: string;
      teacherName: string | null;
    };
  } | null;
  enrollmentsCount: number;
};

export type StudentProfileData = {
  student: {
    id: string;
    fullName: string;
    displayName: string;
    parentPhone: string | null;
    gradeLevel: string | null;
    memorizationStartedOn: string | null;
    notes: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
  activeEnrollment: StudentProfileEnrollment | null;
  enrollmentHistory: StudentProfileEnrollment[];
  summary: {
    attendanceRecords: number;
    officialExams: number;
    transfers: number;
  };
  availableHalaqat: StudentHalaqaOption[];
  transferHistory: StudentTransferHistoryItem[];
};

export type StudentProfileEnrollment = {
  id: string;
  status: "ACTIVE" | "COMPLETED" | "TRANSFERRED" | "WITHDRAWN" | "INACTIVE";
  startedOn: string;
  endedOn: string | null;
  endReason: string | null;
  halaqa: {
    id: string;
    nameAr: string;
    stageName: string;
    teacherName: string | null;
  };
};
