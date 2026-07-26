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
  // UTF-8 BOM prefix (\uFEFF) ensures Excel reads Arabic characters properly
  const lines: string[] = ["\uFEFF"];

  if (report.kind === "EXAMS") {
    // Official Exams CSV
    lines.push(csvRow(["مركز سيد الشهداء حمزة"]));
    lines.push(csvRow(["تقرير الاختبارات الرسمية", report.monthLabel]));
    lines.push(csvRow(["النطاق / الشيخ", report.scopeLabel]));
    lines.push("");
    lines.push(
      csvRow([
        "#",
        "اسم الطالب",
        "الجزء",
        "التاريخ",
        "الدرجة بالكلمات",
        "الدرجة بالأرقام",
        "سرد / اختبار",
      ]),
    );

    let seq = 1;
    for (const exam of report.exams) {
      lines.push(
        csvRow([
          seq++,
          exam.studentName,
          exam.scopeLabel,
          exam.date,
          exam.resultLabel || "—",
          exam.score !== null ? Number(exam.score) : "—",
          exam.examType,
        ]),
      );
    }
  } else {
    // Monthly Achievement CSV (strictly NO exam columns)
    const teachers = report.halaqat.flatMap((h) => h.teacherNames).filter(Boolean);
    const teacherText = [...new Set(teachers)].join("، ") || "—";

    lines.push(csvRow(["اسم المحفظ", teacherText]));
    lines.push(csvRow(["تقرير الإنجاز الشهري", report.monthLabel]));
    lines.push(csvRow(["النطاق / الحلقة", report.scopeLabel]));
    lines.push("");
    lines.push(
      csvRow([
        "#",
        "الاسم رباعي",
        "بداية الحفظ (السورة)",
        "بداية الحفظ (الآية)",
        "نهاية الحفظ (السورة)",
        "نهاية الحفظ (الآية)",
        "عدد صفحات الحفظ",
        "عدد صفحات المراجعة",
        "عدد أجزاء السرد",
        "ملاحظات",
      ]),
    );

    let seq = 1;
    for (const halaqa of report.halaqat) {
      for (const student of halaqa.students) {
        lines.push(
          csvRow([
            seq++,
            student.displayName,
            student.startSurah || "—",
            student.startAyah ?? "—",
            student.endSurah || "—",
            student.endAyah ?? "—",
            Math.round(student.memorizationPages),
            Math.round(student.reviewPages),
            Math.round(student.sardJuzCount),
            student.notes || "",
          ]),
        );
      }
    }
  }

  return Buffer.from(lines.join("\n"), "utf8");
}
