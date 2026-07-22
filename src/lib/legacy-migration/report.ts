import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { toCsv } from "./csv";
import type { MigrationPlan } from "./types";

export async function writeMigrationReports(plan: MigrationPlan, outputDir: string): Promise<void> {
  await mkdir(outputDir, { recursive: true });

  await writeFile(path.join(outputDir, "migration-plan.json"), `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  await writeFile(
    path.join(outputDir, "analysis-summary.json"),
    `${JSON.stringify({
      sourceSystem: plan.sourceSystem,
      sourceFingerprint: plan.sourceFingerprint,
      generatedAt: plan.generatedAt,
      inputManifest: plan.inputManifest,
      dateRange: plan.dateRange,
      statistics: plan.statistics,
    }, null, 2)}\n`,
    "utf8",
  );

  const warningRows = plan.warnings.map((warning) => ({
    severity: warning.severity,
    code: warning.code,
    message: warning.message,
    sourceFile: warning.sourceFile ?? "",
    legacyId: warning.legacyId ?? "",
    details: warning.details ? JSON.stringify(warning.details) : "",
  }));
  await writeFile(path.join(outputDir, "review-required.csv"), toCsv(warningRows), "utf8");

  const identityRows = plan.warnings
    .filter((warning) => ["AMBIGUOUS_DUPLICATE_STUDENT_NAME", "MERGED_BASE_AND_CAMP_STUDENT", "SYNTHETIC_STUDENT"].includes(warning.code))
    .map((warning) => ({
      code: warning.code,
      severity: warning.severity,
      message: warning.message,
      legacyId: warning.legacyId ?? "",
      details: warning.details ? JSON.stringify(warning.details) : "",
    }));
  await writeFile(path.join(outputDir, "student-identity-review.csv"), toCsv(identityRows), "utf8");

  const dayMismatchRows = plan.warnings
    .filter((warning) => warning.code === "SESSION_DAY_DATE_MISMATCH")
    .map((warning) => ({
      legacyId: warning.legacyId ?? "",
      sessionDate: warning.details?.sessionDate ?? "",
      suppliedDay: warning.details?.suppliedDay ?? "",
      calculatedDay: warning.details?.calculatedDay ?? "",
      decision: "اعتماد اليوم المحسوب من التاريخ",
    }));
  await writeFile(path.join(outputDir, "day-date-mismatches.csv"), toCsv(dayMismatchRows), "utf8");

  const mappingRows = plan.legacyMaps.map((mapping) => ({
    entityType: mapping.entityType,
    legacyId: mapping.legacyId,
    plannedNewId: mapping.plannedNewId,
    canonicalKey: mapping.canonicalKey ?? "",
    metadata: mapping.metadata ? JSON.stringify(mapping.metadata) : "",
  }));
  await writeFile(path.join(outputDir, "legacy-id-map.csv"), toCsv(mappingRows), "utf8");

  const teacherRows = plan.users.map((user) => ({
    displayName: user.displayName,
    username: user.username,
    roles: user.roleCodes.join("|"),
    importedStatus: user.status,
    actionRequired: "تعيين كلمة مرور جديدة ثم تفعيل الحساب",
    legacyIds: user.legacyIds.map((item) => `${item.entityType}:${item.legacyId}`).join("|"),
  }));
  await writeFile(path.join(outputDir, "migrated-users-review.csv"), toCsv(teacherRows), "utf8");

  const readme = `# تقرير تحليل ترحيل البيانات القديمة\n\n` +
    `- بصمة المصدر: \`${plan.sourceFingerprint}\`\n` +
    `- الفترة: ${plan.dateRange.from ?? "غير معروفة"} إلى ${plan.dateRange.to ?? "غير معروفة"}\n` +
    `- الطلاب المخطط ترحيلهم: ${plan.statistics.plannedStudents ?? 0}\n` +
    `- الجلسات: ${plan.statistics.plannedSessions ?? 0}\n` +
    `- سجلات الطلاب داخل الجلسات: ${plan.statistics.plannedSessionItems ?? 0}\n` +
    `- الاختبارات: ${plan.statistics.plannedExams ?? 0}\n` +
    `- أخطاء تحتاج مراجعة: ${plan.statistics.errorCount ?? 0}\n` +
    `- تحذيرات: ${plan.statistics.warningCount ?? 0}\n\n` +
    `لم تُنسخ كلمات المرور القديمة إلى أي تقرير أو خطة. الحسابات القديمة تُنشأ متوقفة وبكلمات مرور عشوائية غير معروفة.\n`;
  await writeFile(path.join(outputDir, "README.md"), readme, "utf8");
}
