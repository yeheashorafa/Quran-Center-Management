import "server-only";

import type { MonthlyReportData } from "@/lib/reports/types";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function value(value: number | null | undefined, suffix = ""): string {
  return value === null || value === undefined ? "—" : `${value}${suffix}`;
}

function summaryCards(report: MonthlyReportData): string {
  const cards =
    report.kind === "EXAMS"
      ? [
          ["الاختبارات الفعالة", report.summary.examCount],
          ["متوسط الدرجات", value(report.summary.examAverage)],
          ["عدد الطلاب", report.summary.studentsCount],
          ["عدد الحلقات", report.summary.halaqatCount],
        ]
      : [
          ["الحلقات", report.summary.halaqatCount],
          ["الطلاب", report.summary.studentsCount],
          ["الجلسات المسجلة", report.summary.recordedSessions],
          ["نسبة الحضور", value(report.summary.attendanceRate, "%")],
          ["صفحات الحفظ", report.summary.memorizationPages],
          ["صفحات المراجعة", report.summary.reviewPages],
          ["صفحات السرد", report.summary.recitationPages],
          ["الاختبارات", report.summary.examCount],
        ];

  return `<div class="cards">${cards
    .map(
      ([label, cardValue]) =>
        `<div class="card"><div class="card-value">${escapeHtml(cardValue)}</div><div class="card-label">${escapeHtml(label)}</div></div>`,
    )
    .join("")}</div>`;
}

function halaqaSections(report: MonthlyReportData): string {
  return report.halaqat
    .map(
      (halaqa) => `<section class="halaqa-section">
      <div class="halaqa-heading">
        <div><h2>${escapeHtml(halaqa.nameAr)}</h2><p>${escapeHtml(halaqa.stageName)} — الشيخ: ${escapeHtml(halaqa.teacherNames.join("، ") || "—")}</p></div>
        <div class="pill">حضور ${escapeHtml(halaqa.attendanceRate)}%</div>
      </div>
      <div class="mini-grid">
        <span>الطلاب: <strong>${halaqa.studentsCount}</strong></span>
        <span>المتوقعة: <strong>${halaqa.expectedSessionDates.length}</strong></span>
        <span>المسجلة: <strong>${halaqa.recordedSessions}</strong></span>
        <span>المكتملة: <strong>${halaqa.completedSessions}</strong></span>
        <span>حاضر: <strong>${halaqa.present}</strong></span>
        <span>غائب: <strong>${halaqa.absent}</strong></span>
        <span>عذر: <strong>${halaqa.excused}</strong></span>
        <span>لم يسمع: <strong>${halaqa.notHeard}</strong></span>
        <span>حفظ: <strong>${halaqa.memorizationPages}</strong></span>
        <span>مراجعة: <strong>${halaqa.reviewPages}</strong></span>
        <span>سرد: <strong>${halaqa.recitationPages}</strong></span>
        <span>اختبارات: <strong>${halaqa.examCount}</strong></span>
      </div>
      <table>
       <thead><tr><th>الطالب</th><th>حاضر</th><th>غائب</th><th>عذر</th><th>لم يسمع</th><th>حفظ</th><th>مراجعة</th><th>سرد</th><th>المجموع</th><th>الاختبارات</th><th>المتوسط</th></tr></thead>
       <tbody>${halaqa.students
         .map(
           (student) => `<tr><td class="name">${escapeHtml(student.displayName)}</td><td>${student.present}</td><td>${student.absent}</td><td>${student.excused}</td><td>${student.notHeard}</td><td>${student.memorizationPages}</td><td>${student.reviewPages}</td><td>${student.recitationPages}</td><td>${student.totalPages}</td><td>${student.examCount}</td><td>${value(student.examAverage)}</td></tr>`,
         )
         .join("")}</tbody>
      </table>
    </section>`,
    )
    .join("");
}

function examsSection(report: MonthlyReportData): string {
  return `<section class="exam-section">
    <h2>الاختبارات الرسمية</h2>
    ${
      report.exams.length
        ? `<table><thead><tr><th>التاريخ</th><th>الطالب</th><th>المرحلة</th><th>الحلقة</th><th>المختبر</th><th>النوع</th><th>النطاق</th><th>الدرجة</th><th>التقدير</th><th>الحالة</th></tr></thead><tbody>${report.exams
            .map(
              (exam) => `<tr><td>${escapeHtml(exam.date)}</td><td class="name">${escapeHtml(exam.studentName)}</td><td>${escapeHtml(exam.stageName)}</td><td>${escapeHtml(exam.halaqaName)}</td><td>${escapeHtml(exam.examinerName)}</td><td>${escapeHtml(exam.examType)}</td><td>${escapeHtml(exam.scopeLabel)}</td><td>${value(exam.score)}</td><td>${escapeHtml(exam.resultLabel)}</td><td>${escapeHtml(exam.status)}</td></tr>`,
            )
            .join("")}</tbody></table>`
        : `<p class="empty">لا توجد اختبارات ضمن الفترة والنطاق المحددين.</p>`
    }
  </section>`;
}

export function renderMonthlyReportHtml(report: MonthlyReportData): string {
  const generatedAt = new Intl.DateTimeFormat("ar", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Hebron",
  }).format(new Date(report.generatedAt));

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(report.title)}</title>
<style>
@page { size: A4 landscape; margin: 10mm; }
* { box-sizing: border-box; }
body { margin: 0; color: #17221b; background: #fff; font-family: Arial, "DejaVu Sans", "Noto Sans Arabic", sans-serif; font-size: 10px; direction: rtl; }
.report-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; border-bottom: 3px solid #166534; padding-bottom: 10px; margin-bottom: 12px; }
h1 { margin: 0; color: #14532d; font-size: 23px; }
.report-header p { margin: 4px 0 0; color: #526056; font-size: 11px; }
.meta { text-align: left; line-height: 1.8; color: #526056; min-width: 190px; }
.cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; margin-bottom: 12px; }
.card { border: 1px solid #bbd7c3; background: #f0fdf4; border-radius: 8px; padding: 8px; text-align: center; }
.card-value { color: #14532d; font-weight: 800; font-size: 17px; }
.card-label { margin-top: 2px; color: #526056; }
.halaqa-section, .exam-section { break-inside: avoid; page-break-inside: avoid; margin-bottom: 14px; }
.halaqa-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: #166534; color: #fff; padding: 7px 10px; border-radius: 7px 7px 0 0; }
.halaqa-heading h2, .exam-section h2 { margin: 0; font-size: 15px; }
.halaqa-heading p { margin: 2px 0 0; color: #dcfce7; }
.pill { border: 1px solid #86efac; border-radius: 999px; padding: 3px 8px; white-space: nowrap; }
.mini-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 1px; background: #cbd5cf; border: 1px solid #cbd5cf; }
.mini-grid span { background: #f7fbf8; padding: 5px 6px; text-align: center; }
table { width: 100%; border-collapse: collapse; table-layout: auto; }
th { background: #e8f5eb; color: #14532d; font-weight: 800; }
th, td { border: 1px solid #cfd8d2; padding: 4px 5px; text-align: center; vertical-align: middle; }
td.name { text-align: right; font-weight: 700; min-width: 105px; }
tbody tr:nth-child(even) td { background: #fbfdfb; }
.exam-section h2 { background: #0c4a6e; color: #fff; padding: 8px 10px; border-radius: 7px 7px 0 0; }
.empty { border: 1px solid #cfd8d2; padding: 14px; text-align: center; color: #647067; margin: 0; }
.footer { margin-top: 12px; border-top: 1px solid #d6ded8; padding-top: 6px; color: #66736a; text-align: center; }
</style>
</head>
<body>
<header class="report-header">
  <div style="display: flex; align-items: center; gap: 12px;">
    <img src="/brand/logo.png" alt="شعار المركز" style="height: 50px; width: auto; object-fit: contain;" />
    <div>
      <h1>${escapeHtml(report.title)}</h1>
      <p>${escapeHtml(report.monthLabel)} — ${escapeHtml(report.scopeLabel)}</p>
    </div>
  </div>
  <div class="meta">مركز سيد الشهداء حمزة<br/>أُنشئ بواسطة: ${escapeHtml(report.generatedBy)}<br/>وقت الإنشاء: ${escapeHtml(generatedAt)}</div>
</header>
${summaryCards(report)}
${report.kind === "COMPREHENSIVE" ? halaqaSections(report) : ""}
${examsSection(report)}
<div class="footer">تقرير مولّد من نظام إدارة مركز التحفيظ — يحتفظ النظام بالبيانات الأصلية وسجل التعديلات.</div>
</body></html>`;
}
