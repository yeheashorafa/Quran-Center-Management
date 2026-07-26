import ExcelJS from "exceljs";
import type { ManagerDailyMonitoringData } from "@/lib/manager-monitoring/types";

const STATUS_LABELS: Record<string, string> = {
  NOT_RECORDED: "لم يسجّل",
  DRAFT: "مسودة / غير مكتملة",
  COMPLETED: "مكتملة",
  LOCKED: "مقفلة",
};

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar-PS", {
    timeZone: "Asia/Hebron",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function pages(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export async function renderDailyMonitoringExcel(data: ManagerDailyMonitoringData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "نظام مركز سيد الشهداء حمزة";
  workbook.created = new Date();
  workbook.title = `تقرير_متابعة_الحلقات_${data.date}`;

  const sheet = workbook.addWorksheet("متابعة الحلقات", {
    views: [{ rightToLeft: true }],
  });

  sheet.columns = [
    { key: "col1", width: 6 },  // #
    { key: "col2", width: 20 }, // المرحلة
    { key: "col3", width: 22 }, // الحلقة
    { key: "col4", width: 24 }, // الشيخ
    { key: "col5", width: 18 }, // آخر يوم جلسة وصل للسيرفر
    { key: "col6", width: 22 }, // آخر وقت مزامنة
    { key: "col7", width: 12 }, // عدد الطلاب
    { key: "col8", width: 10 }, // حاضر
    { key: "col9", width: 10 }, // غائب
    { key: "col10", width: 10 }, // عذر
    { key: "col11", width: 14 }, // حضر ولم يسمّع
    { key: "col12", width: 14 }, // عدد من سمّعوا
    { key: "col13", width: 12 }, // صفحات الحفظ
    { key: "col14", width: 14 }, // صفحات المراجعة
    { key: "col15", width: 12 }, // صفحات السرد
    { key: "col16", width: 18 }, // حالة الحلقة
  ];

  // Header Title Row
  sheet.mergeCells("A1:P1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = `تقرير متابعة الحلقات اليومية — ${data.weekdayLabel} ${data.date}`;
  titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF064E3B" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 36;

  // Metadata Row
  sheet.mergeCells("A2:P2");
  const metaCell = sheet.getCell("A2");
  metaCell.value = `مركز سيد الشهداء حمزة | الحلقات المطلوبة: ${data.summary.expectedHalaqat} | الحلقات المكتملة: ${data.summary.completedHalaqat} | الحلقات لم تسجل: ${data.summary.notRecordedHalaqat}`;
  metaCell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF064E3B" } };
  metaCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F4EA" } };
  metaCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(2).height = 24;

  // Blank row
  sheet.getRow(3).height = 10;

  // Table Headers (Row 4)
  const headers = [
    "#",
    "المرحلة",
    "الحلقة",
    "الشيخ",
    "آخر يوم جلسة وصل للسيرفر",
    "آخر وقت مزامنة",
    "عدد الطلاب",
    "حاضر",
    "غائب",
    "عذر",
    "حضر ولم يسمّع",
    "عدد من سمّعوا",
    "صفحات الحفظ",
    "صفحات المراجعة",
    "صفحات السرد",
    "حالة الحلقة",
  ];

  const headerRow = sheet.getRow(4);
  headerRow.height = 26;
  headers.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF047857" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "FF064E3B" } },
      bottom: { style: "thin", color: { argb: "FF064E3B" } },
      left: { style: "thin", color: { argb: "FF064E3B" } },
      right: { style: "thin", color: { argb: "FF064E3B" } },
    };
  });

  // Table Rows
  let rowIndex = 5;
  data.halaqat.forEach((halaqa, idx) => {
    const row = sheet.getRow(rowIndex);
    row.height = 22;

    const values = [
      idx + 1,
      halaqa.stageName,
      halaqa.nameAr,
      halaqa.teacher?.displayName ?? "—",
      halaqa.lastSyncedSession?.sessionDate ?? "—",
      formatDateTime(halaqa.lastSyncedSession?.updatedAt ?? null),
      halaqa.expectedStudents,
      halaqa.attendance.present,
      halaqa.attendance.absent,
      halaqa.attendance.excused,
      halaqa.attendance.notHeard,
      halaqa.recordedStudents,
      pages(halaqa.activities.memorizationPages),
      pages(halaqa.activities.reviewPages),
      pages(halaqa.activities.recitationPages),
      STATUS_LABELS[halaqa.monitoringStatus] ?? halaqa.monitoringStatus,
    ];

    const isEven = idx % 2 === 1;

    values.forEach((v, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      cell.value = v;
      cell.font = { name: "Calibri", size: 11 };
      cell.alignment = { horizontal: cIdx === 1 || cIdx === 2 || cIdx === 3 ? "right" : "center", vertical: "middle" };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isEven ? "FFF9FAFB" : "FFFFFFFF" },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    });

    rowIndex++;
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export function renderDailyMonitoringCsv(data: ManagerDailyMonitoringData): string {
  const headers = [
    "#",
    "المرحلة",
    "الحلقة",
    "الشيخ",
    "آخر يوم جلسة وصل للسيرفر",
    "آخر وقت مزامنة",
    "عدد الطلاب",
    "حاضر",
    "غائب",
    "عذر",
    "حضر ولم يسمّع",
    "عدد من سمّعوا",
    "صفحات الحفظ",
    "صفحات المراجعة",
    "صفحات السرد",
    "حالة الحلقة",
  ];

  const escapeCsv = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;

  const rows = data.halaqat.map((halaqa, idx) => [
    idx + 1,
    halaqa.stageName,
    halaqa.nameAr,
    halaqa.teacher?.displayName ?? "—",
    halaqa.lastSyncedSession?.sessionDate ?? "—",
    formatDateTime(halaqa.lastSyncedSession?.updatedAt ?? null),
    halaqa.expectedStudents,
    halaqa.attendance.present,
    halaqa.attendance.absent,
    halaqa.attendance.excused,
    halaqa.attendance.notHeard,
    halaqa.recordedStudents,
    pages(halaqa.activities.memorizationPages),
    pages(halaqa.activities.reviewPages),
    pages(halaqa.activities.recitationPages),
    STATUS_LABELS[halaqa.monitoringStatus] ?? halaqa.monitoringStatus,
  ]);

  const csvLines = [
    `"تقرير متابعة الحلقات اليومية — ${data.weekdayLabel} ${data.date}"`,
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ];

  // UTF-8 BOM header
  return "\uFEFF" + csvLines.join("\r\n");
}
