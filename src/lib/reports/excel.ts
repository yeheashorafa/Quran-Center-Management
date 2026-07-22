import "server-only";

import type { MonthlyReportData } from "@/lib/reports/types";

function xmlEscape(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function stringCell(value: unknown, style = "Cell"): string {
  return `<Cell ss:StyleID="${style}"><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;
}

function numberCell(value: number | null | undefined, style = "Number"): string {
  if (value === null || value === undefined) return stringCell("—", style);
  return `<Cell ss:StyleID="${style}"><Data ss:Type="Number">${Number(value)}</Data></Cell>`;
}

function row(cells: string[], styleId?: string): string {
  return `<Row${styleId ? ` ss:StyleID="${styleId}"` : ""}>${cells.join("")}</Row>`;
}

function worksheet(name: string, rows: string[]): string {
  return `<Worksheet ss:Name="${xmlEscape(name.slice(0, 31))}"><Table>${rows.join("")}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><Selected/><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios></WorksheetOptions></Worksheet>`;
}

function summarySheet(report: MonthlyReportData): string {
  const items: Array<[string, string | number]> = [
    ["عنوان التقرير", report.title],
    ["الشهر", report.monthLabel],
    ["النطاق", report.scopeLabel],
    ["أُنشئ بواسطة", report.generatedBy],
    ["عدد الحلقات", report.summary.halaqatCount],
    ["عدد الطلاب", report.summary.studentsCount],
    ["الجلسات المتوقعة", report.summary.expectedSessions],
    ["الجلسات المسجلة", report.summary.recordedSessions],
    ["الجلسات المكتملة", report.summary.completedSessions],
    ["المسودات", report.summary.draftSessions],
    ["حاضر", report.summary.present],
    ["غائب", report.summary.absent],
    ["عذر", report.summary.excused],
    ["لم يسمع", report.summary.notHeard],
    ["نسبة الحضور", `${report.summary.attendanceRate}%`],
    ["صفحات الحفظ", report.summary.memorizationPages],
    ["صفحات المراجعة", report.summary.reviewPages],
    ["صفحات السرد", report.summary.recitationPages],
    ["مجموع الصفحات", report.summary.totalPages],
    ["الاختبارات الفعالة", report.summary.examCount],
    ["متوسط الاختبارات", report.summary.examAverage ?? "—"],
  ];

  return worksheet("الملخص", [
    row([stringCell("البيان", "Header"), stringCell("القيمة", "Header")]),
    ...items.map(([label, value]) =>
      row([
        stringCell(label, "Label"),
        typeof value === "number" ? numberCell(value) : stringCell(value),
      ]),
    ),
  ]);
}

function halaqatSheet(report: MonthlyReportData): string {
  const headers = [
    "المرحلة",
    "الحلقة",
    "الشيخ",
    "الطلاب",
    "الجلسات المتوقعة",
    "الجلسات المسجلة",
    "المكتملة",
    "المسودات",
    "حاضر",
    "غائب",
    "عذر",
    "لم يسمع",
    "نسبة الحضور",
    "حفظ",
    "مراجعة",
    "سرد",
    "إجمالي الصفحات",
    "الاختبارات",
    "متوسط الاختبارات",
  ];

  return worksheet("الحلقات", [
    row(headers.map((header) => stringCell(header, "Header"))),
    ...report.halaqat.map((halaqa) =>
      row([
        stringCell(halaqa.stageName),
        stringCell(halaqa.nameAr),
        stringCell(halaqa.teacherNames.join("، ") || "—"),
        numberCell(halaqa.studentsCount),
        numberCell(halaqa.expectedSessionDates.length),
        numberCell(halaqa.recordedSessions),
        numberCell(halaqa.completedSessions),
        numberCell(halaqa.draftSessions),
        numberCell(halaqa.present),
        numberCell(halaqa.absent),
        numberCell(halaqa.excused),
        numberCell(halaqa.notHeard),
        numberCell(halaqa.attendanceRate),
        numberCell(halaqa.memorizationPages),
        numberCell(halaqa.reviewPages),
        numberCell(halaqa.recitationPages),
        numberCell(halaqa.totalPages),
        numberCell(halaqa.examCount),
        numberCell(halaqa.examAverage),
      ]),
    ),
  ]);
}

function studentsSheet(report: MonthlyReportData): string {
  const headers = [
    "المرحلة",
    "الحلقة",
    "الطالب",
    "حاضر",
    "غائب",
    "عذر",
    "لم يسمع",
    "معلّق",
    "حفظ",
    "مراجعة",
    "سرد",
    "إجمالي الصفحات",
    "عدد الاختبارات",
    "متوسط الاختبارات",
  ];

  const rows = report.halaqat.flatMap((halaqa) =>
    halaqa.students.map((student) =>
      row([
        stringCell(halaqa.stageName),
        stringCell(halaqa.nameAr),
        stringCell(student.displayName),
        numberCell(student.present),
        numberCell(student.absent),
        numberCell(student.excused),
        numberCell(student.notHeard),
        numberCell(student.pending),
        numberCell(student.memorizationPages),
        numberCell(student.reviewPages),
        numberCell(student.recitationPages),
        numberCell(student.totalPages),
        numberCell(student.examCount),
        numberCell(student.examAverage),
      ]),
    ),
  );

  return worksheet("الطلاب", [row(headers.map((header) => stringCell(header, "Header"))), ...rows]);
}

function examsSheet(report: MonthlyReportData): string {
  const headers = [
    "التاريخ",
    "الطالب",
    "المرحلة",
    "الحلقة",
    "المختبر",
    "النوع",
    "النطاق",
    "الدرجة",
    "التقدير",
    "الحالة",
    "ملاحظات",
  ];

  return worksheet("الاختبارات", [
    row(headers.map((header) => stringCell(header, "Header"))),
    ...report.exams.map((exam) =>
      row([
        stringCell(exam.date),
        stringCell(exam.studentName),
        stringCell(exam.stageName),
        stringCell(exam.halaqaName),
        stringCell(exam.examinerName),
        stringCell(exam.examType),
        stringCell(exam.scopeLabel),
        numberCell(exam.score),
        stringCell(exam.resultLabel),
        stringCell(exam.status),
        stringCell(exam.notes),
      ]),
    ),
  ]);
}

export function renderMonthlyReportExcel(report: MonthlyReportData): Buffer {
  const sheets = [summarySheet(report)];
  if (report.kind === "COMPREHENSIVE") {
    sheets.push(halaqatSheet(report), studentsSheet(report));
  }
  sheets.push(examsSheet(report));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office"><Author>${xmlEscape(report.generatedBy)}</Author><Title>${xmlEscape(report.title)}</Title></DocumentProperties>
 <ExcelWorkbook xmlns="urn:schemas-microsoft-com:office:excel"><WindowHeight>12000</WindowHeight><WindowWidth>20000</WindowWidth><ProtectStructure>False</ProtectStructure><ProtectWindows>False</ProtectWindows></ExcelWorkbook>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center" ss:ReadingOrder="RightToLeft"/><Font ss:FontName="Arial" ss:Size="11"/><Borders/><Interior/><NumberFormat/><Protection/></Style>
  <Style ss:ID="Cell"><Alignment ss:Horizontal="Right" ss:Vertical="Center" ss:WrapText="1" ss:ReadingOrder="RightToLeft"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/></Borders></Style>
  <Style ss:ID="Header"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1" ss:ReadingOrder="RightToLeft"/><Font ss:FontName="Arial" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#166534" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
  <Style ss:ID="Label"><Alignment ss:Horizontal="Right" ss:Vertical="Center" ss:ReadingOrder="RightToLeft"/><Font ss:FontName="Arial" ss:Bold="1"/><Interior ss:Color="#ECFDF5" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/></Borders></Style>
  <Style ss:ID="Number"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:ReadingOrder="RightToLeft"/><NumberFormat ss:Format="0.00"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/></Borders></Style>
 </Styles>
 ${sheets.join("\n")}
</Workbook>`;

  return Buffer.from(xml, "utf8");
}
