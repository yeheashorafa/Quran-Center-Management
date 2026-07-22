import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { importMigrationPlan } from "../lib/legacy-migration/importer";
import type { MigrationPlan } from "../lib/legacy-migration/types";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  if (!process.argv.includes("--apply")) {
    throw new Error("Import is blocked by default. Add --apply after reviewing migration-output/review-required.csv.");
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");

  const planPath = path.resolve(option("--plan") ?? "migration-output/migration-plan.json");
  const plan = JSON.parse(await readFile(planPath, "utf8")) as MigrationPlan;
  if (plan.version !== 1) throw new Error(`Unsupported migration plan version: ${String(plan.version)}`);

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const result = await importMigrationPlan(prisma, plan, {
      allowErrors: process.argv.includes("--allow-errors"),
    });
    console.log(result.alreadyImported ? "This exact source fingerprint was already imported." : "Legacy import completed.");
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
