import "dotenv/config";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { normalizeUsername } from "@/lib/auth/normalize";

async function main() {
  const username = process.env.INITIAL_ADMIN_USERNAME?.trim();
  const displayName = process.env.INITIAL_ADMIN_DISPLAY_NAME?.trim() || "مدير المركز";
  const password = process.env.INITIAL_ADMIN_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "Set INITIAL_ADMIN_USERNAME and INITIAL_ADMIN_PASSWORD in .env before running this command.",
    );
  }

  if (password.length < 8) {
    throw new Error("INITIAL_ADMIN_PASSWORD must contain at least 8 characters.");
  }

  const role = await prisma.role.findUnique({ where: { code: "CENTER_MANAGER" } });
  if (!role) throw new Error("CENTER_MANAGER role is missing. Run npm run db:seed first.");

  const passwordHash = await hashPassword(password);
  const normalizedUsername = normalizeUsername(username);

  const user = await prisma.user.upsert({
    where: { normalizedUsername },
    update: {
      username,
      displayName,
      passwordHash,
      status: "ACTIVE",
      failedLoginCount: 0,
      lockedUntil: null,
      deletedAt: null,
      passwordChangedAt: new Date(),
    },
    create: {
      username,
      normalizedUsername,
      displayName,
      passwordHash,
      passwordChangedAt: new Date(),
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: role.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: role.id,
    },
  });

  console.log(`Initial manager is ready: ${user.displayName} (${user.username})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
