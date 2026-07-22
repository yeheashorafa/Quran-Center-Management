import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import argon2 from "argon2";
import { Pool } from "pg";
import { PrismaClient, ProgramStatus, ProgramType, Weekday } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured.");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

const permissions = [
  ["dashboard.teacher", "الدخول إلى لوحة الشيخ"],
  ["dashboard.manager", "الدخول إلى لوحة المدير"],
  ["dashboard.examiner", "الدخول إلى لوحة المختبر"],
  ["halaqat.read", "عرض الحلقات"],
  ["halaqat.manage", "إدارة الحلقات وجداولها"],
  ["users.manage", "إدارة المستخدمين والصلاحيات"],
  ["students.read.own", "عرض طلاب الحلقات المعيّن عليها"],
  ["students.read.all", "عرض جميع الطلاب"],
  ["students.manage", "إضافة الطلاب وتعديل ملفاتهم"],
  ["sessions.read.own", "عرض جلسات الحلقات المعيّن عليها"],
  ["sessions.manage.own", "تسجيل وتعديل جلسات الحلقات المعيّن عليها"],
  ["sessions.read.all", "عرض جميع جلسات التسميع"],
  ["sessions.manage.all", "تعديل جميع جلسات التسميع"],
  ["exams.read.own", "عرض اختبارات طلاب الحلقات المعيّن عليها"],
  ["exams.read.all", "عرض جميع الاختبارات الرسمية"],
  ["exams.manage", "إضافة الاختبارات الرسمية وتعديلها"],
  ["transfers.manage", "نقل الطلاب بين الحلقات"],
  ["reports.export.own", "تصدير تقارير الحلقات المعيّن عليها"],
  ["reports.export.all", "تصدير تقارير المركز"],
  ["audit.read", "عرض سجل التعديلات"],
] as const;

const rolePermissions: Record<string, string[]> = {
  TEACHER: [
    "dashboard.teacher",
    "halaqat.read",
    "students.read.own",
    "sessions.read.own",
    "sessions.manage.own",
    "exams.read.own",
    "reports.export.own",
  ],
  CENTER_MANAGER: permissions
    .map(([code]) => code)
    .filter((code) => !["dashboard.teacher", "dashboard.examiner"].includes(code)),
  EXAMINER: [
    "dashboard.examiner",
    "halaqat.read",
    "students.read.all",
    "exams.read.all",
    "exams.manage",
    "reports.export.all",
  ],
};

async function seedRolesAndPermissions() {
  const permissionByCode = new Map<string, string>();

  for (const [code, nameAr] of permissions) {
    const permission = await prisma.permission.upsert({
      where: { code },
      update: { nameAr },
      create: { code, nameAr },
    });

    permissionByCode.set(code, permission.id);
  }

  const roles = [
    { code: "TEACHER", nameAr: "الشيخ / المحفّظ" },
    { code: "CENTER_MANAGER", nameAr: "مدير المركز" },
    { code: "EXAMINER", nameAr: "المختبر / الممتحن" },
  ];

  const roleMap = new Map<string, string>();

  for (const roleData of roles) {
    const role = await prisma.role.upsert({
      where: { code: roleData.code },
      update: { nameAr: roleData.nameAr },
      create: roleData,
    });
    roleMap.set(roleData.code, role.id);

    const permissionCodes = rolePermissions[roleData.code] ?? [];

    for (const permissionCode of permissionCodes) {
      const permissionId = permissionByCode.get(permissionCode);
      if (!permissionId) continue;

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId,
        },
      });
    }
  }

  return roleMap;
}

async function seedProgramsAndStages() {
  const baseProgram = await prisma.program.upsert({
    where: { code: "BASE_PROGRAM" },
    update: {
      nameAr: "البرنامج الأساسي",
      type: ProgramType.BASE,
      status: ProgramStatus.ACTIVE,
    },
    create: {
      code: "BASE_PROGRAM",
      nameAr: "البرنامج الأساسي",
      type: ProgramType.BASE,
      status: ProgramStatus.ACTIVE,
    },
  });

  const stages = [
    {
      code: "BRAAIM",
      nameAr: "البراعم",
      sortOrder: 1,
      weekdays: [Weekday.SUNDAY, Weekday.TUESDAY, Weekday.THURSDAY],
    },
    {
      code: "ASHBAL",
      nameAr: "الأشبال",
      sortOrder: 2,
      weekdays: [Weekday.SATURDAY, Weekday.MONDAY, Weekday.WEDNESDAY],
    },
    {
      code: "NASHIEEN",
      nameAr: "الناشئين",
      sortOrder: 3,
      weekdays: [Weekday.SATURDAY, Weekday.MONDAY, Weekday.WEDNESDAY],
    },
  ];

  const stageMap = new Map<string, string>();

  for (const stageData of stages) {
    const stage = await prisma.stage.upsert({
      where: { code: stageData.code },
      update: {
        nameAr: stageData.nameAr,
        sortOrder: stageData.sortOrder,
        isActive: true,
      },
      create: {
        code: stageData.code,
        nameAr: stageData.nameAr,
        sortOrder: stageData.sortOrder,
      },
    });
    stageMap.set(stageData.code, stage.id);

    await prisma.stageDefaultSchedule.deleteMany({
      where: { stageId: stage.id },
    });

    await prisma.stageDefaultSchedule.createMany({
      data: stageData.weekdays.map((weekday) => ({
        stageId: stage.id,
        weekday,
      })),
      skipDuplicates: true,
    });
  }

  return { baseProgram, stageMap };
}

async function seedInitialUsers(roleMap: Map<string, string>) {
  const managerRoleId = roleMap.get("CENTER_MANAGER")!;
  const teacherRoleId = roleMap.get("TEACHER")!;
  const examinerRoleId = roleMap.get("EXAMINER")!;

  // 1. First Manager (admin / Manager@123456)
  const managerPass = await hashPassword("Manager@123456");
  const managerUser = await prisma.user.upsert({
    where: { normalizedUsername: "admin" },
    update: { displayName: "مدير المركز الرئيسي", status: "ACTIVE" },
    create: {
      username: "admin",
      normalizedUsername: "admin",
      displayName: "مدير المركز الرئيسي",
      passwordHash: managerPass,
      status: "ACTIVE",
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: managerUser.id, roleId: managerRoleId } },
    update: {},
    create: { userId: managerUser.id, roleId: managerRoleId },
  });

  // 2. Demo Teacher (teacher1 / Teacher@123456)
  const teacherPass = await hashPassword("Teacher@123456");
  const teacherUser = await prisma.user.upsert({
    where: { normalizedUsername: "teacher1" },
    update: { displayName: "الشيخ أحمد الحافظ", status: "ACTIVE" },
    create: {
      username: "teacher1",
      normalizedUsername: "teacher1",
      displayName: "الشيخ أحمد الحافظ",
      passwordHash: teacherPass,
      status: "ACTIVE",
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: teacherUser.id, roleId: teacherRoleId } },
    update: {},
    create: { userId: teacherUser.id, roleId: teacherRoleId },
  });

  // 3. Demo Examiner (examiner1 / Examiner@123456)
  const examinerPass = await hashPassword("Examiner@123456");
  const examinerUser = await prisma.user.upsert({
    where: { normalizedUsername: "examiner1" },
    update: { displayName: "المختبر الشيخ محمود", status: "ACTIVE" },
    create: {
      username: "examiner1",
      normalizedUsername: "examiner1",
      displayName: "المختبر الشيخ محمود",
      passwordHash: examinerPass,
      status: "ACTIVE",
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: examinerUser.id, roleId: examinerRoleId } },
    update: {},
    create: { userId: examinerUser.id, roleId: examinerRoleId },
  });

  return { managerUser, teacherUser, examinerUser };
}

async function seedHalaqaAndStudents(
  baseProgramId: string,
  stageId: string,
  teacherUserId: string,
) {
  const startDate = new Date("2026-01-01T00:00:00.000Z");

  // Create Demo Halaqa
  const existingHalaqa = await prisma.halaqa.findFirst({
    where: { code: "HALAQA_FAJR_ASHBAL", deletedAt: null },
  });

  const halaqa = existingHalaqa
    ? existingHalaqa
    : await prisma.halaqa.create({
        data: {
          code: "HALAQA_FAJR_ASHBAL",
          nameAr: "حلقة الفجر - الأشبال",
          programId: baseProgramId,
          stageId,
          status: "ACTIVE",
          schedules: {
            createMany: {
              data: [
                { weekday: Weekday.SATURDAY, effectiveFrom: startDate },
                { weekday: Weekday.MONDAY, effectiveFrom: startDate },
                { weekday: Weekday.WEDNESDAY, effectiveFrom: startDate },
              ],
            },
          },
        },
      });

  // Staff Assignment for teacher
  const existingAssignment = await prisma.halaqaStaffAssignment.findFirst({
    where: { halaqaId: halaqa.id, userId: teacherUserId, role: "PRIMARY_TEACHER", deletedAt: null },
  });
  if (!existingAssignment) {
    await prisma.halaqaStaffAssignment.create({
      data: {
        halaqaId: halaqa.id,
        userId: teacherUserId,
        role: "PRIMARY_TEACHER",
        startsOn: startDate,
      },
    });
  }

  // 3 Demo Students
  const demoStudents = [
    { fullName: "عبد الرحمن محمد أحمد", displayName: "عبد الرحمن محمد", parentPhone: "0599112233", gradeLevel: "الصف السادس" },
    { fullName: "عمر خالد محمود", displayName: "عمر خالد", parentPhone: "0599445566", gradeLevel: "الصف السابع" },
    { fullName: "يوسف إبراهيم خليل", displayName: "يوسف إبراهيم", parentPhone: "0599778899", gradeLevel: "الصف الثامن" },
  ];

  for (const sData of demoStudents) {
    const normName = normalize(sData.fullName);
    let student = await prisma.student.findFirst({
      where: { normalizedFullName: normName, deletedAt: null },
    });

    if (!student) {
      student = await prisma.student.create({
        data: {
          fullName: sData.fullName,
          normalizedFullName: normName,
          displayName: sData.displayName,
          parentPhone: sData.parentPhone,
          gradeLevel: sData.gradeLevel,
          memorizationStartedOn: startDate,
          isActive: true,
        },
      });
    }

    const existingEnrollment = await prisma.studentEnrollment.findFirst({
      where: { studentId: student.id, halaqaId: halaqa.id, deletedAt: null },
    });

    if (!existingEnrollment) {
      await prisma.studentEnrollment.create({
        data: {
          studentId: student.id,
          programId: baseProgramId,
          halaqaId: halaqa.id,
          status: "ACTIVE",
          startedOn: startDate,
        },
      });
    }
  }
}

async function main() {
  const roleMap = await seedRolesAndPermissions();
  const { baseProgram, stageMap } = await seedProgramsAndStages();
  const { teacherUser } = await seedInitialUsers(roleMap);

  const ashbalStageId = stageMap.get("ASHBAL");
  if (ashbalStageId) {
    await seedHalaqaAndStudents(baseProgram.id, ashbalStageId, teacherUser.id);
  }

  console.log("=========================================");
  console.log("✅ Database Seed Completed Successfully!");
  console.log("=========================================");
  console.log("Initial Logins Configured:");
  console.log("1. Manager  -> Username: admin     / Password: Manager@123456");
  console.log("2. Teacher  -> Username: teacher1  / Password: Teacher@123456");
  console.log("3. Examiner -> Username: examiner1 / Password: Examiner@123456");
  console.log("=========================================");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
