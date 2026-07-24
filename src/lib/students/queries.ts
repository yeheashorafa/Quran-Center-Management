import "server-only";

import { prisma } from "@/lib/db/prisma";
import type {
  ManagerStudentItem,
  StudentHalaqaOption,
  StudentProfileData,
  StudentProfileEnrollment,
} from "@/lib/students/types";

function dateInputValue(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function mapHalaqaOption(halaqa: {
  id: string;
  nameAr: string;
  stage: { nameAr: string } | null;
  staffAssignments: Array<{ user: { displayName: string } }>;
}): StudentHalaqaOption {
  return {
    id: halaqa.id,
    nameAr: halaqa.nameAr,
    stageName: halaqa.stage?.nameAr ?? "غير محددة",
    teacherName: halaqa.staffAssignments[0]?.user.displayName ?? null,
  };
}

export async function getManagerStudentsData(): Promise<{
  students: ManagerStudentItem[];
  activeHalaqat: StudentHalaqaOption[];
}> {
  const [students, halaqat] = await Promise.all([
    prisma.student.findMany({
      where: { deletedAt: null },
      orderBy: [{ isActive: "desc" }, { displayName: "asc" }],
      select: {
        id: true,
        fullName: true,
        displayName: true,
        parentPhone: true,
        gradeLevel: true,
        memorizationStartedOn: true,
        notes: true,
        isActive: true,
        enrollments: {
          where: { status: "ACTIVE", endedOn: null, deletedAt: null },
          orderBy: { startedOn: "desc" },
          take: 1,
          select: {
            id: true,
            startedOn: true,
            halaqa: {
              select: {
                id: true,
                nameAr: true,
                stage: { select: { nameAr: true } },
                staffAssignments: {
                  where: { role: "PRIMARY_TEACHER", endsOn: null, deletedAt: null },
                  take: 1,
                  select: { user: { select: { displayName: true } } },
                },
              },
            },
          },
        },
        _count: { select: { enrollments: true } },
      },
    }),
    prisma.halaqa.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        program: { code: "BASE_PROGRAM", status: "ACTIVE", deletedAt: null },
      },
      orderBy: [{ stage: { sortOrder: "asc" } }, { nameAr: "asc" }],
      select: {
        id: true,
        nameAr: true,
        stage: { select: { nameAr: true } },
        staffAssignments: {
          where: { role: "PRIMARY_TEACHER", endsOn: null, deletedAt: null },
          take: 1,
          select: { user: { select: { displayName: true } } },
        },
      },
    }),
  ]);

  return {
    students: students.map((student) => {
      const enrollment = student.enrollments[0];
      return {
        id: student.id,
        fullName: student.fullName,
        displayName: student.displayName,
        parentPhone: student.parentPhone,
        gradeLevel: student.gradeLevel,
        memorizationStartedOn: dateInputValue(student.memorizationStartedOn),
        notes: student.notes,
        isActive: student.isActive,
        activeEnrollment: enrollment
          ? {
              id: enrollment.id,
              startedOn: dateInputValue(enrollment.startedOn)!,
              halaqa: {
                id: enrollment.halaqa.id,
                nameAr: enrollment.halaqa.nameAr,
                stageName: enrollment.halaqa.stage?.nameAr ?? "غير محددة",
                teacherName:
                  enrollment.halaqa.staffAssignments[0]?.user.displayName ?? null,
              },
            }
          : null,
        enrollmentsCount: student._count.enrollments,
      } satisfies ManagerStudentItem;
    }),
    activeHalaqat: halaqat.map(mapHalaqaOption),
  };
}

function mapEnrollment(enrollment: {
  id: string;
  status: "ACTIVE" | "COMPLETED" | "TRANSFERRED" | "WITHDRAWN" | "INACTIVE";
  startedOn: Date;
  endedOn: Date | null;
  endReason: string | null;
  halaqa: {
    id: string;
    nameAr: string;
    stage: { nameAr: string } | null;
    staffAssignments: Array<{ user: { displayName: string } }>;
  };
}): StudentProfileEnrollment {
  return {
    id: enrollment.id,
    status: enrollment.status,
    startedOn: dateInputValue(enrollment.startedOn)!,
    endedOn: dateInputValue(enrollment.endedOn),
    endReason: enrollment.endReason,
    halaqa: {
      id: enrollment.halaqa.id,
      nameAr: enrollment.halaqa.nameAr,
      stageName: enrollment.halaqa.stage?.nameAr ?? "غير محددة",
      teacherName: enrollment.halaqa.staffAssignments[0]?.user.displayName ?? null,
    },
  };
}

export async function getStudentProfileData(studentId: string): Promise<StudentProfileData | null> {
  const [student, availableHalaqat] = await Promise.all([
    prisma.student.findFirst({
      where: { id: studentId, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        displayName: true,
        parentPhone: true,
        gradeLevel: true,
        memorizationStartedOn: true,
        notes: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        enrollments: {
          where: { deletedAt: null },
          orderBy: [{ startedOn: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            status: true,
            startedOn: true,
            endedOn: true,
            endReason: true,
            halaqa: {
              select: {
                id: true,
                nameAr: true,
                stage: { select: { nameAr: true } },
                staffAssignments: {
                  where: { role: "PRIMARY_TEACHER", endsOn: null, deletedAt: null },
                  take: 1,
                  select: { user: { select: { displayName: true } } },
                },
              },
            },
          },
        },
        transfers: {
          orderBy: [{ transferDate: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            transferDate: true,
            note: true,
            createdAt: true,
            transferredByUser: { select: { displayName: true } },
            fromEnrollment: {
              select: {
                id: true,
                startedOn: true,
                endedOn: true,
                halaqa: {
                  select: {
                    id: true,
                    nameAr: true,
                    stage: { select: { nameAr: true } },
                  },
                },
              },
            },
            toEnrollment: {
              select: {
                id: true,
                startedOn: true,
                endedOn: true,
                halaqa: {
                  select: {
                    id: true,
                    nameAr: true,
                    stage: { select: { nameAr: true } },
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            sessionItems: true,
            officialExams: true,
            transfers: true,
          },
        },
      },
    }),
    prisma.halaqa.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        program: { code: "BASE_PROGRAM", status: "ACTIVE", deletedAt: null },
      },
      orderBy: [{ stage: { sortOrder: "asc" } }, { nameAr: "asc" }],
      select: {
        id: true,
        nameAr: true,
        stage: { select: { nameAr: true } },
        staffAssignments: {
          where: { role: "PRIMARY_TEACHER", endsOn: null, deletedAt: null },
          take: 1,
          select: { user: { select: { displayName: true } } },
        },
      },
    }),
  ]);

  if (!student) return null;

  const enrollmentHistory = student.enrollments.map(mapEnrollment);

  return {
    student: {
      id: student.id,
      fullName: student.fullName,
      displayName: student.displayName,
      parentPhone: student.parentPhone,
      gradeLevel: student.gradeLevel,
      memorizationStartedOn: dateInputValue(student.memorizationStartedOn),
      notes: student.notes,
      isActive: student.isActive,
      createdAt: student.createdAt.toISOString(),
      updatedAt: student.updatedAt.toISOString(),
    },
    activeEnrollment:
      enrollmentHistory.find((item) => item.status === "ACTIVE" && !item.endedOn) ?? null,
    enrollmentHistory,
    summary: {
      attendanceRecords: student._count.sessionItems,
      officialExams: student._count.officialExams,
      transfers: student._count.transfers,
    },
    availableHalaqat: availableHalaqat.map(mapHalaqaOption),
    transferHistory: student.transfers.map((transfer) => ({
      id: transfer.id,
      transferDate: dateInputValue(transfer.transferDate)!,
      note: transfer.note,
      createdAt: transfer.createdAt.toISOString(),
      transferredByName: transfer.transferredByUser?.displayName ?? null,
      fromEnrollment: {
        id: transfer.fromEnrollment.id,
        startedOn: dateInputValue(transfer.fromEnrollment.startedOn)!,
        endedOn: dateInputValue(transfer.fromEnrollment.endedOn),
        halaqa: {
          id: transfer.fromEnrollment.halaqa.id,
          nameAr: transfer.fromEnrollment.halaqa.nameAr,
          stageName: transfer.fromEnrollment.halaqa.stage?.nameAr ?? "غير محددة",
        },
      },
      toEnrollment: {
        id: transfer.toEnrollment.id,
        startedOn: dateInputValue(transfer.toEnrollment.startedOn)!,
        endedOn: dateInputValue(transfer.toEnrollment.endedOn),
        halaqa: {
          id: transfer.toEnrollment.halaqa.id,
          nameAr: transfer.toEnrollment.halaqa.nameAr,
          stageName: transfer.toEnrollment.halaqa.stage?.nameAr ?? "غير محددة",
        },
      },
    })),
  };
}
