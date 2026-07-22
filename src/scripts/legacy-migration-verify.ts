import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { verifyMigrationPlan } from "../lib/legacy-migration/verifier";
import type { MigrationPlan } from "../lib/legacy-migration/types";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");
  const planPath = path.resolve(option("--plan") ?? "migration-output/migration-plan.json");
  const outputPath = path.resolve(option("--output") ?? "migration-output/verification-result.json");
  const plan = JSON.parse(await readFile(planPath, "utf8")) as MigrationPlan;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const result = await verifyMigrationPlan(prisma, plan);
    await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
