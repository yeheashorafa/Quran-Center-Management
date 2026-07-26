import "server-only";

import ExcelJS from "exceljs";
import type { MonthlyReportData } from "@/lib/reports/types";

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF7F7F7F" } },
  left: { style: "thin", color: { argb: "FF7F7F7F" } },
  bottom: { style: "thin", color: { argb: "FF7F7F7F" } },
  right: { style: "thin", color: { argb: "FF7F7F7F" } },
};

export async function renderMonthlyAchievementExcel(report: MonthlyReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = report.generatedBy;
  workbook.title = report.title;

  const sheet = workbook.addWorksheet("إنجاز الحفظ", {
    views: [{ rightToLeft: true }],
  });

  sheet.columns = [
    { key: "seq", width: 6 },
    { key: "displayName", width: 28 },
    { key: "startSurah", width: 16 },
    { key: "startAyah", width: 10 },
    { key: "endSurah", width: 16 },
    { key: "endAyah", width: 10 },
    { key: "memorizationPages", width: 22 },
    { key: "reviewPages", width: 22 },
    { key: "sardJuzCount", width: 20 },
    { key: "notes", width: 24 },
  ];

  const teachers = report.halaqat.flatMap((h) => h.teacherNames).filter(Boolean);
  const teacherText = [...new Set(teachers)].join("، ") || "—";

  sheet.mergeCells("A1:B1");
  const teacherLabelCell = sheet.getCell("A1");
  teacherLabelCell.value = `اسم المحفظ: ${teacherText}`;
  teacherLabelCell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF000000" } };
  teacherLabelCell.alignment = { horizontal: "center", vertical: "middle" };
  teacherLabelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC6D9A8" } };
  sheet.getCell("B1").border = THIN_BORDER;
  teacherLabelCell.border = THIN_BORDER;

  sheet.mergeCells("C1:J1");
  const titleCell = sheet.getCell("C1");
  titleCell.value = `تقرير الإنجاز الشهري ${report.scopeLabel} - ${report.monthLabel}`;
  titleCell.font = { name: "Arial", size: 12, bold: true, color: { argb: "FF000000" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC6D9A8" } };

  for (let c = 3; c <= 10; c++) {
    sheet.getCell(1, c).border = THIN_BORDER;
    sheet.getCell(1, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC6D9A8" } };
  }

  sheet.mergeCells("A2:A4");
  sheet.getCell("A2").value = "#";

  sheet.mergeCells("B2:B4");
  sheet.getCell("B2").value = "الاسم رباعي";

  sheet.mergeCells("C2:F2");
  sheet.getCell("C2").value = "الحفظ";

  sheet.mergeCells("C3:D3");
  sheet.getCell("C3").value = "بداية الحفظ";

  sheet.getCell("C4").value = "السورة";
  sheet.getCell("D4").value = "الآية";

  sheet.mergeCells("E3:F3");
  sheet.getCell("E3").value = "نهاية الحفظ";

  sheet.getCell("E4").value = "السورة";
  sheet.getCell("F4").value = "الآية";

  sheet.mergeCells("G2:G4");
  sheet.getCell("G2").value = "عدد صفحات حفظ الطالب من بداية التحفيظ";

  sheet.mergeCells("H2:H4");
  sheet.getCell("H2").value = "عدد صفحات مراجعة الطالب من بداية التحفيظ";

  sheet.mergeCells("I2:I4");
  sheet.getCell("I2").value = "عدد الأجزاء التي تم سردها";

  sheet.mergeCells("J2:J4");
  sheet.getCell("J2").value = "ملاحظات";

  const headerFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC6D9A8" } };
  for (let r = 2; r <= 4; r++) {
    const row = sheet.getRow(r);
    row.height = 24;
    for (let c = 1; c <= 10; c++) {
      const cell = row.getCell(c);
      cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF000000" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.fill = headerFill;
      cell.border = THIN_BORDER;
    }
  }

  let seq = 1;
  let currentRowIndex = 5;

  for (const halaqa of report.halaqat) {
    for (const student of halaqa.students) {
      const row = sheet.getRow(currentRowIndex);
      row.height = 22;

      row.getCell(1).value = seq++;
      row.getCell(2).value = student.displayName;
      row.getCell(3).value = student.startSurah || "—";
      row.getCell(4).value = student.startAyah ?? "—";
      row.getCell(5).value = student.endSurah || "—";
      row.getCell(6).value = student.endAyah ?? "—";
      row.getCell(7).value = Math.round(student.memorizationPages);
      row.getCell(8).value = Math.round(student.reviewPages);
      row.getCell(9).value = Math.round(student.sardJuzCount);
      row.getCell(10).value = student.notes || "";

      for (let c = 1; c <= 10; c++) {
        const cell = row.getCell(c);
        cell.font = { name: "Arial", size: 10, color: { argb: "FF000000" } };
        cell.border = THIN_BORDER;
        if (c === 2 || c === 10) {
          cell.alignment = { horizontal: "right", vertical: "middle" };
        } else {
          cell.alignment = { horizontal: "center", vertical: "middle" };
        }
      }

      currentRowIndex++;
    }
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export async function renderOfficialExamsExcel(report: MonthlyReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = report.generatedBy;
  workbook.title = report.title;

  const sheet = workbook.addWorksheet("الاختبارات", {
    views: [{ rightToLeft: true }],
  });

  sheet.columns = [
    { key: "seq", width: 6 },
    { key: "studentName", width: 28 },
    { key: "scope", width: 34 },
    { key: "date", width: 14 },
    { key: "scoreWords", width: 18 },
    { key: "scoreNumber", width: 16 },
    { key: "examType", width: 16 },
  ];

  sheet.mergeCells("A1:G3");
  const titleBanner = sheet.getCell("A1");
  titleBanner.value = "الاختبارات";
  titleBanner.font = { name: "Arial", size: 20, bold: true, color: { argb: "FFFFFFFF" } };
  titleBanner.alignment = { horizontal: "center", vertical: "middle" };
  titleBanner.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };

  for (let r = 1; r <= 3; r++) {
    for (let c = 1; c <= 7; c++) {
      sheet.getCell(r, c).border = THIN_BORDER;
    }
  }

  sheet.mergeCells("A4:B6");
  const centerCell = sheet.getCell("A4");
  centerCell.value = "مركز سيد الشهداء حمزة";
  centerCell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF1F4E78" } };
  centerCell.alignment = { horizontal: "center", vertical: "middle" };
  centerCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };

  sheet.mergeCells("C4:E6");
  const sheikhCell = sheet.getCell("C4");
  sheikhCell.value = `اسم الشيخ: ${report.scopeLabel}`;
  sheikhCell.font = { name: "Arial", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
  sheikhCell.alignment = { horizontal: "center", vertical: "middle" };
  sheikhCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };

  sheet.mergeCells("F4:G6");
  const stageCell = sheet.getCell("F4");
  stageCell.value = `المرحلة: ${report.halaqat[0]?.stageName ?? "براعم / أشبال / ناشئين"}\n${report.monthLabel}`;
  stageCell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF1F4E78" } };
  stageCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  stageCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };

  for (let r = 4; r <= 6; r++) {
    for (let c = 1; c <= 7; c++) {
      sheet.getCell(r, c).border = THIN_BORDER;
    }
  }

  sheet.mergeCells("A7:A8");
  sheet.getCell("A7").value = "#";

  sheet.mergeCells("B7:B8");
  sheet.getCell("B7").value = "اسم الطالب";

  sheet.mergeCells("C7:C8");
  sheet.getCell("C7").value = "الجزء";

  sheet.mergeCells("D7:D8");
  sheet.getCell("D7").value = "التاريخ";

  sheet.mergeCells("E7:E8");
  sheet.getCell("E7").value = "الدرجة بالكلمات";

  sheet.mergeCells("F7:F8");
  sheet.getCell("F7").value = "الدرجة بالأرقام";

  sheet.mergeCells("G7:G8");
  sheet.getCell("G7").value = "سرد / اختبار";

  for (let r = 7; r <= 8; r++) {
    const row = sheet.getRow(r);
    row.height = 20;
    for (let c = 1; c <= 7; c++) {
      const cell = row.getCell(c);
      cell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF1F4E78" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF8EA9DB" } };
      cell.border = THIN_BORDER;
    }
  }

  let seq = 1;
  let currentRowIndex = 9;

  for (const exam of report.exams) {
    const row = sheet.getRow(currentRowIndex);
    row.height = 22;

    const bgFill: ExcelJS.Fill =
      seq % 2 === 0
        ? { type: "pattern", pattern: "solid", fgColor: { argb: "FFEBF1F5" } }
        : { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };

    row.getCell(1).value = seq++;
    row.getCell(2).value = exam.studentName;
    row.getCell(3).value = exam.scopeLabel;
    row.getCell(4).value = exam.date;
    row.getCell(5).value = exam.resultLabel || "—";
    row.getCell(6).value = exam.score !== null ? Number(exam.score) : "—";
    row.getCell(7).value = exam.examType;

    for (let c = 1; c <= 7; c++) {
      const cell = row.getCell(c);
      cell.font = { name: "Arial", size: 10, color: { argb: "FF000000" } };
      cell.fill = bgFill;
      cell.border = THIN_BORDER;
      if (c === 2 || c === 3) {
        cell.alignment = { horizontal: "right", vertical: "middle" };
      } else {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      }
    }

    currentRowIndex++;
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export async function renderMonthlyReportExcel(report: MonthlyReportData): Promise<Buffer> {
  if (report.kind === "EXAMS") {
    return renderOfficialExamsExcel(report);
  }
  return renderMonthlyAchievementExcel(report);
}
