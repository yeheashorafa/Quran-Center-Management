import type { ManagerStudentItem, StudentHalaqaOption } from "@/lib/students/types";
import type { AppRoleCode } from "@/lib/auth/constants";
import type { WeekdayCode } from "@/lib/halaqat/weekdays";

export type ManagedUserStatus = "ACTIVE" | "DISABLED" | "LOCKED";
export type ManagedHalaqaStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export type ManagerStageOption = {
  id: string;
  code: string;
  nameAr: string;
  defaultWeekdays: WeekdayCode[];
};

export type ManagerUserItem = {
  id: string;
  username: string;
  displayName: string;
  status: ManagedUserStatus;
  roles: Array<{
    code: AppRoleCode;
    nameAr: string;
  }>;
  activeHalaqat: Array<{
    id: string;
    nameAr: string;
  }>;
  isCurrentUser: boolean;
};

export type ManagerHalaqaItem = {
  id: string;
  code: string;
  nameAr: string;
  status: ManagedHalaqaStatus;
  notes: string | null;
  stage: {
    id: string;
    nameAr: string;
  } | null;
  primaryTeacher: {
    id: string;
    displayName: string;
  } | null;
  weekdays: WeekdayCode[];
  activeStudentsCount: number;
};

export type ManagerDashboardData = {
  stages: ManagerStageOption[];
  users: ManagerUserItem[];
  halaqat: ManagerHalaqaItem[];
  students: ManagerStudentItem[];
  studentHalaqat: StudentHalaqaOption[];
  stats: {
    activeHalaqat: number;
    activeTeachers: number;
    totalUsers: number;
    activeStudents: number;
    totalStudents: number;
  };
};
