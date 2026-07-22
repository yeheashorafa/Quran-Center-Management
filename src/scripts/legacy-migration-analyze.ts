import "dotenv/config";
import path from "node:path";
import { loadLegacySources } from "../lib/legacy-migration/source";
import { buildMigrationPlan } from "../lib/legacy-migration/planner";
import { writeMigrationReports } from "../lib/legacy-migration/report";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const inputDir = path.resolve(option("--input") ?? process.env.LEGACY_DATA_DIR ?? "legacy-data");
  const outputDir = path.resolve(option("--output") ?? process.env.LEGACY_MIGRATION_OUTPUT_DIR ?? "migration-output");
  const sourceSystem = option("--source") ?? process.env.LEGACY_MIGRATION_SOURCE_SYSTEM ?? "hifz-center-v19";

  const sources = await loadLegacySources(inputDir);
  const plan = buildMigrationPlan(sources, sourceSystem);
  await writeMigrationReports(plan, outputDir);

  console.log(`Legacy analysis completed.`);
  console.log(`Input: ${inputDir}`);
  console.log(`Output: ${outputDir}`);
  console.log(`Fingerprint: ${plan.sourceFingerprint}`);
  console.log(JSON.stringify(plan.statistics, null, 2));

  if ((plan.statistics.errorCount ?? 0) > 0) {
    console.log("Review migration-output/review-required.csv before applying the import.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
