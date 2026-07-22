import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient, ProgramStatus, ProgramType, Weekday } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured.");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

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

  for (const roleData of roles) {
    const role = await prisma.role.upsert({
      where: { code: roleData.code },
      update: { nameAr: roleData.nameAr },
      create: roleData,
    });

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
}

async function seedProgramsAndStages() {
  await prisma.program.upsert({
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
}

async function main() {
  await seedRolesAndPermissions();
  await seedProgramsAndStages();
  console.log("Database seed completed.");
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
