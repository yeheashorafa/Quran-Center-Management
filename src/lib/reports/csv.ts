import "server-only";

import type { MonthlyReportData } from "@/lib/reports/types";

function csvCell(value: unknown): string {
  const str = String(value ?? "");
  return `"${str.replaceAll('"', '""')}"`;
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}

export function renderMonthlyReportCsv(report: MonthlyReportData): Buffer {
  const lines: string[] = [
    // UTF-8 BOM marker for Excel Arabic compatibility
    "\uFEFF",
  ];

  // Title & Metadata
  lines.push(csvRow(["عنوان التقرير", report.title]));
  lines.push(csvRow(["الشهر", report.monthLabel]));
  lines.push(csvRow(["النطاق", report.scopeLabel]));
  lines.push(csvRow(["تاريخ الإصدار", report.generatedAt]));
  lines.push(csvRow(["أُنشئ بواسطة", report.generatedBy]));
  lines.push("");

  // Summary Metrics
  lines.push(csvRow(["ملخص الإحصائيات"]));
  lines.push(csvRow(["البيان", "القيمة"]));
  lines.push(csvRow(["عدد الحلقات", report.summary.halaqatCount]));
  lines.push(csvRow(["عدد الطلاب", report.summary.studentsCount]));
  lines.push(csvRow(["الجلسات المتوقعة", report.summary.expectedSessions]));
  lines.push(csvRow(["الجلسات المسجلة", report.summary.recordedSessions]));
  lines.push(csvRow(["حاضر", report.summary.present]));
  lines.push(csvRow(["غائب", report.summary.absent]));
  lines.push(csvRow(["عذر", report.summary.excused]));
  lines.push(csvRow(["لم يسمع", report.summary.notHeard]));
  lines.push(csvRow(["نسبة الحضور", `${report.summary.attendanceRate}%`]));
  lines.push(csvRow(["صفحات الحفظ", report.summary.memorizationPages]));
  lines.push(csvRow(["صفحات المراجعة", report.summary.reviewPages]));
  lines.push(csvRow(["صفحات السرد", report.summary.recitationPages]));
  lines.push(csvRow(["مجموع الصفحات", report.summary.totalPages]));
  lines.push(csvRow(["الاختبارات الفعالة", report.summary.examCount]));
  lines.push("");

  // Detailed Students Table
  if (report.kind === "COMPREHENSIVE") {
    lines.push(csvRow(["سجل الطلاب التفصيلي"]));
    lines.push(
      csvRow([
        "المرحلة",
        "الحلقة",
        "اسم الطالب",
        "حاضر",
        "غائب",
        "عذر",
        "لم يسمع",
        "حفظ (صفحات)",
        "مراجعة (صفحات)",
        "سرد (صفحات)",
        "إجمالي الصفحات",
        "عدد الاختبارات",
        "متوسط الاختبارات",
      ]),
    );

    for (const halaqa of report.halaqat) {
      for (const student of halaqa.students) {
        lines.push(
          csvRow([
            halaqa.stageName,
            halaqa.nameAr,
            student.displayName,
            student.present,
            student.absent,
            student.excused,
            student.notHeard,
            student.memorizationPages,
            student.reviewPages,
            student.recitationPages,
            student.totalPages,
            student.examCount,
            student.examAverage ?? "—",
          ]),
        );
      }
    }
    lines.push("");
  }

  // Official Exams Section
  if (report.exams.length) {
    lines.push(csvRow(["سجل الاختبارات الرسمية"]));
    lines.push(
      csvRow([
        "التاريخ",
        "الطالب",
        "المرحلة",
        "الحلقة",
        "المختبر",
        "نوع الاختبار",
        "النطاق",
        "الدرجة (%)",
        "النتيجة",
        "الحالة",
        "ملاحظات",
      ]),
    );

    for (const exam of report.exams) {
      lines.push(
        csvRow([
          exam.date,
          exam.studentName,
          exam.stageName,
          exam.halaqaName,
          exam.examinerName,
          exam.examType,
          exam.scopeLabel,
          exam.score ?? "—",
          exam.resultLabel,
          exam.status,
          exam.notes,
        ]),
      );
    }
  }

  return Buffer.from(lines.join("\n"), "utf8");
}
