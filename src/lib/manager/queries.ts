import "server-only";

import { prisma } from "@/lib/db/prisma";
import { isAppRoleCode } from "@/lib/auth/constants";
import { sortWeekdays, type WeekdayCode } from "@/lib/halaqat/weekdays";
import type { ManagerDashboardData } from "@/lib/manager/types";
import { getManagerStudentsData } from "@/lib/students/queries";

export async function getManagerDashboardData(currentUserId: string): Promise<ManagerDashboardData> {
  const [stages, users, halaqat, studentData] = await Promise.all([
    prisma.stage.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { nameAr: "asc" }],
      select: {
        id: true,
        code: true,
        nameAr: true,
        defaultSchedules: { select: { weekday: true } },
      },
    }),
    prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: [{ status: "asc" }, { displayName: "asc" }],
      select: {
        id: true,
        username: true,
        displayName: true,
        status: true,
        roles: {
          select: { role: { select: { code: true, nameAr: true } } },
        },
        staffAssignments: {
          where: {
            deletedAt: null,
            endsOn: null,
            halaqa: { deletedAt: null },
          },
          select: { halaqa: { select: { id: true, nameAr: true } } },
        },
      },
    }),
    prisma.halaqa.findMany({
      where: { deletedAt: null, program: { code: "BASE_PROGRAM" } },
      orderBy: [{ status: "asc" }, { nameAr: "asc" }],
      select: {
        id: true,
        code: true,
        nameAr: true,
        status: true,
        notes: true,
        stage: { select: { id: true, nameAr: true } },
        schedules: {
          where: { effectiveTo: null },
          select: { weekday: true },
        },
        staffAssignments: {
          where: {
            role: "PRIMARY_TEACHER",
            endsOn: null,
            deletedAt: null,
          },
          take: 1,
          select: { user: { select: { id: true, displayName: true } } },
        },
        _count: {
          select: {
            enrollments: {
              where: { status: "ACTIVE", endedOn: null, deletedAt: null },
            },
          },
        },
      },
    }),
    getManagerStudentsData(),
  ]);

  const mappedUsers = users.map((user) => ({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    status: user.status,
    roles: user.roles
      .map(({ role }) => role)
      .filter((role): role is { code: "TEACHER" | "CENTER_MANAGER" | "EXAMINER"; nameAr: string } =>
        isAppRoleCode(role.code),
      ),
    activeHalaqat: user.staffAssignments.map(({ halaqa }) => halaqa),
    isCurrentUser: user.id === currentUserId,
  }));

  const mappedHalaqat = halaqat.map((halaqa) => ({
    id: halaqa.id,
    code: halaqa.code,
    nameAr: halaqa.nameAr,
    status: halaqa.status,
    notes: halaqa.notes,
    stage: halaqa.stage,
    primaryTeacher: halaqa.staffAssignments[0]?.user ?? null,
    weekdays: sortWeekdays(halaqa.schedules.map(({ weekday }) => weekday as WeekdayCode)),
    activeStudentsCount: halaqa._count.enrollments,
  }));

  const activeTeachers = mappedUsers.filter(
    (user) => user.status === "ACTIVE" && user.roles.some((role) => role.code === "TEACHER"),
  ).length;

  return {
    stages: stages.map((stage) => ({
      id: stage.id,
      code: stage.code,
      nameAr: stage.nameAr,
      defaultWeekdays: sortWeekdays(
        stage.defaultSchedules.map(({ weekday }) => weekday as WeekdayCode),
      ),
    })),
    users: mappedUsers,
    halaqat: mappedHalaqat,
    students: studentData.students,
    studentHalaqat: studentData.activeHalaqat,
    stats: {
      activeHalaqat: mappedHalaqat.filter((halaqa) => halaqa.status === "ACTIVE").length,
      activeTeachers,
      totalUsers: mappedUsers.length,
      activeStudents: studentData.students.filter((student) => student.isActive).length,
      totalStudents: studentData.students.length,
    },
  };
}
