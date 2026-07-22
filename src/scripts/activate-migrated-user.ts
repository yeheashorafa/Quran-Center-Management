import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { hashPassword } from "../lib/auth/password";
import { normalizeArabicName } from "../lib/legacy-migration/normalize";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const displayName = process.env.MIGRATED_USER_DISPLAY_NAME?.trim();
  const newPassword = process.env.MIGRATED_USER_NEW_PASSWORD;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");
  if (!displayName || !newPassword || newPassword.length < 10) {
    throw new Error("Set MIGRATED_USER_DISPLAY_NAME and MIGRATED_USER_NEW_PASSWORD (at least 10 characters).");
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      select: { id: true, displayName: true, status: true },
    });
    const matches = users.filter((user) => normalizeArabicName(user.displayName) === normalizeArabicName(displayName));
    if (matches.length !== 1) throw new Error(`Expected exactly one matching user, found ${matches.length}.`);
    const user = matches[0]!;
    const passwordHash = await hashPassword(newPassword);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, status: "ACTIVE", passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null },
      }),
      prisma.authSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
      prisma.auditLog.create({
        data: {
          action: "MIGRATED_USER_PASSWORD_SET",
          entityType: "user",
          entityId: user.id,
          metadata: { previousStatus: user.status, activated: true },
        },
      }),
    ]);
    console.log(`Password set and user activated: ${user.displayName}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
