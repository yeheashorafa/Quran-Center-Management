"use client";

import { useMemo, useState } from "react";
import ExcelJS from "exceljs";
import type { OfficialExamListItem } from "@/lib/official-exams/types";

const EXAM_TYPE_LABELS: Record<string, string> = {
  MONTHLY_EXAM: "اختبار شهري",
  FINAL_EXAM: "اختبار نهائي",
  SARD_SESSION: "سرد رسمي",
  OTHER: "اختبار آخر",
};

export function TeacherExamsPanel({
  exams = [],
}: {
  exams: OfficialExamListItem[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExamType, setSelectedExamType] = useState("");
  const [selectedResult, setSelectedResult] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [busyFormat, setBusyFormat] = useState<string | null>(null);

  const isClientOffline = typeof navigator !== "undefined" && !navigator.onLine;

  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesName = exam.student.displayName.toLowerCase().includes(query);
        if (!matchesName) return false;
      }

      if (selectedExamType && exam.examType !== selectedExamType) return false;
      if (selectedResult && !exam.resultLabel?.includes(selectedResult)) return false;
      if (dateFrom && exam.examDate < dateFrom) return false;
      if (dateTo && exam.examDate > dateTo) return false;

      return true;
    });
  }, [exams, searchQuery, selectedExamType, selectedResult, dateFrom, dateTo]);

  async function handleExportExcel() {
    if (isClientOffline) return;
    setBusyFormat("excel");
    try {
      const workbook = new ExcelJS.Workbook();
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

      const THIN_BORDER: Partial<ExcelJS.Borders> = {
        top: { style: "thin", color: { argb: "FF7F7F7F" } },
        left: { style: "thin", color: { argb: "FF7F7F7F" } },
        bottom: { style: "thin", color: { argb: "FF7F7F7F" } },
        right: { style: "thin", color: { argb: "FF7F7F7F" } },
      };

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
      sheikhCell.value = "تقرير اختبارات حلقة المحفظ";
      sheikhCell.font = { name: "Arial", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
      sheikhCell.alignment = { horizontal: "center", vertical: "middle" };
      sheikhCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };

      sheet.mergeCells("F4:G6");
      const stageCell = sheet.getCell("F4");
      stageCell.value = `إجمالي الاختبارات: ${filteredExams.length}`;
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

      for (const exam of filteredExams) {
        const row = sheet.getRow(currentRowIndex);
        row.height = 22;

        const bgFill: ExcelJS.Fill =
          seq % 2 === 0
            ? { type: "pattern", pattern: "solid", fgColor: { argb: "FFEBF1F5" } }
            : { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };

        row.getCell(1).value = seq++;
        row.getCell(2).value = exam.student.displayName;
        row.getCell(3).value = exam.scopes.map((s) => s.label).join(", ") || "—";
        row.getCell(4).value = exam.examDate;
        row.getCell(5).value = exam.resultLabel || "—";
        row.getCell(6).value = exam.score !== null ? Number(exam.score) : "—";
        row.getCell(7).value = EXAM_TYPE_LABELS[exam.examType] || exam.examType;

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

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `تقرير_الاختبارات_الرسمية_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusyFormat(null);
    }
  }

  function handleExportCsv() {
    if (isClientOffline) return;
    setBusyFormat("csv");
    try {
      const lines: string[] = ["\uFEFF"];
      lines.push(`"مركز سيد الشهداء حمزة"`);
      lines.push(`"تقرير الاختبارات الرسمية"`);
      lines.push("");
      lines.push(`"#","اسم الطالب","الجزء","التاريخ","الدرجة بالكلمات","الدرجة بالأرقام","سرد / اختبار"`);

      filteredExams.forEach((exam, idx) => {
        const scope = exam.scopes.map((s) => s.label).join(", ") || "—";
        const examType = EXAM_TYPE_LABELS[exam.examType] || exam.examType;
        lines.push(
          `"${idx + 1}","${exam.student.displayName.replaceAll('"', '""')}","${scope.replaceAll('"', '""')}","${exam.examDate}","${(exam.resultLabel || "—").replaceAll('"', '""')}","${exam.score !== null ? exam.score : "—"}","${examType.replaceAll('"', '""')}"`
        );
      });

      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `تقرير_الاختبارات_الرسمية_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusyFormat(null);
    }
  }

  async function handleExportPdf() {
    if (isClientOffline) return;
    setBusyFormat("pdf");
    try {
      const monthStr = new Date().toISOString().slice(0, 7);
      const response = await fetch(`/api/reports/monthly?kind=EXAMS&format=pdf&month=${monthStr}`);
      if (!response.ok) {
        throw new Error("تعذر تحميل تقرير PDF.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `تقرير_الاختبارات_الرسمية_${monthStr}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.print();
    } finally {
      setBusyFormat(null);
    }
  }

  return (
    <div className="space-y-5" dir="rtl">
      <section className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 shadow-sm sm:p-5 text-[var(--text-main)] transition-colors duration-200">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-xs font-bold text-[var(--gold)]">اختبارات حلقتك</span>
            <h2 className="text-xl font-black text-[var(--text-main)]">سجل اختبارات طلابك</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              عرض نتائج وسجلات الاختبارات والسرد الرسمي الخاصة بطلاب حلقة المحفظ فقط.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-2xl bg-[var(--card-soft)] border border-[var(--border-color)] px-3 py-1.5 text-xs font-black text-[var(--primary)]">
              {filteredExams.length} اختبار
            </span>
          </div>
        </div>

        {/* Offline warning banner */}
        {isClientOffline ? (
          <div className="mt-4 rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-3 text-xs font-bold text-[var(--status-warning-text)] shadow-xs flex items-center gap-2">
            <span>⚠️</span>
            <span>تصدير الاختبارات يحتاج اتصالاً بالإنترنت.</span>
          </div>
        ) : (
          /* Export Action Buttons */
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--border-color)] pt-4">
            <span className="text-xs font-black text-[var(--text-muted)] ml-2">
              تصدير السجل المفلتر:
            </span>
            <button
              type="button"
              disabled={busyFormat !== null || !filteredExams.length}
              onClick={() => void handleExportExcel()}
              className="rounded-xl bg-emerald-700 dark:bg-emerald-600 px-3.5 py-2 text-xs font-black text-white shadow-xs hover:bg-emerald-800 transition disabled:opacity-50"
            >
              {busyFormat === "excel" ? "جاري التصدير..." : "📊 تنزيل Excel (.xlsx)"}
            </button>
            <button
              type="button"
              disabled={busyFormat !== null || !filteredExams.length}
              onClick={handleExportCsv}
              className="rounded-xl border border-[var(--primary)] bg-[var(--card-soft)] px-3.5 py-2 text-xs font-black text-[var(--primary)] shadow-xs hover:bg-[var(--card-bg)] transition disabled:opacity-50"
            >
              {busyFormat === "csv" ? "جاري التصدير..." : "📄 تنزيل CSV"}
            </button>
            <button
              type="button"
              disabled={busyFormat !== null || !filteredExams.length}
              onClick={() => void handleExportPdf()}
              className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] px-3.5 py-2 text-xs font-black text-[var(--text-main)] shadow-xs hover:border-[var(--primary)] transition disabled:opacity-50"
            >
              {busyFormat === "pdf" ? "جاري التصدير..." : "📑 تنزيل PDF"}
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="form-label" htmlFor="teacher-exam-search">
              البحث باسم الطالب
            </label>
            <input
              id="teacher-exam-search"
              type="text"
              className="form-control font-bold"
              placeholder="اكتب اسم الطالب..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label" htmlFor="teacher-exam-type">
              نوع الاختبار
            </label>
            <select
              id="teacher-exam-type"
              className="form-control font-bold"
              value={selectedExamType}
              onChange={(e) => setSelectedExamType(e.target.value)}
            >
              <option value="">كل الأنواع</option>
              <option value="MONTHLY_EXAM">اختبار شهري</option>
              <option value="FINAL_EXAM">اختبار نهائي</option>
              <option value="SARD_SESSION">سرد رسمي</option>
            </select>
          </div>

          <div>
            <label className="form-label" htmlFor="teacher-exam-result">
              النتيجة
            </label>
            <select
              id="teacher-exam-result"
              className="form-control font-bold"
              value={selectedResult}
              onChange={(e) => setSelectedResult(e.target.value)}
            >
              <option value="">كل النتائج</option>
              <option value="ممتاز">ممتاز</option>
              <option value="جيد جداً">جيد جداً</option>
              <option value="جيد">جيد</option>
              <option value="لم يجتز">لم يجتز</option>
            </select>
          </div>

          <div>
            <label className="form-label" htmlFor="teacher-exam-from">
              من تاريخ
            </label>
            <input
              id="teacher-exam-from"
              type="date"
              className="form-control font-bold"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label" htmlFor="teacher-exam-to">
              إلى تاريخ
            </label>
            <input
              id="teacher-exam-to"
              type="date"
              className="form-control font-bold"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* List */}
      <section className="space-y-3">
        {filteredExams.length ? (
          filteredExams.map((exam) => (
            <article
              key={exam.id}
              className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 shadow-sm sm:p-5 text-[var(--text-main)] transition-colors duration-200"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black text-[var(--text-main)]">
                      {exam.student.displayName}
                    </h3>
                    <span className="rounded-full bg-[var(--card-soft)] border border-[var(--border-color)] px-3 py-0.5 text-xs font-black text-[var(--primary)]">
                      {EXAM_TYPE_LABELS[exam.examType] || exam.examType}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    تاريخ الاختبار: {exam.examDate}
                  </p>
                </div>

                <div className="text-left">
                  <div className="text-2xl font-black text-[var(--primary)]">
                    {exam.score !== null ? `${exam.score} / 100` : "—"}
                  </div>
                  <div className="text-xs font-bold text-[var(--gold)]">
                    {exam.resultLabel ?? "بدون نتيجة"}
                  </div>
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Info label="نطاق الجزء" value={exam.scopes.map((s) => s.label).join(", ") || "—"} />
                <Info label="المختبر" value={exam.examiner?.displayName ?? "—"} />
                <Info label="الحالة" value={exam.status === "ACTIVE" ? "اعتمد" : "ملغى"} />
              </dl>

              {exam.notes ? (
                <div className="mt-3 rounded-2xl bg-[var(--card-soft)] border border-[var(--border-color)] p-3 text-xs text-[var(--text-muted)]">
                  <strong className="text-[var(--text-main)]">ملاحظات: </strong>
                  {exam.notes}
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <div className="rounded-3xl border border-dashed border-[var(--border-color)] bg-[var(--card-bg)] p-8 text-center text-sm font-bold text-[var(--text-muted)]">
            لا تتوفر نتائج اختبارات لطلاب حلتك تطابق الفلاتر المحددة.
          </div>
        )}
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--card-soft)] p-3 border border-[var(--border-color)]">
      <dt className="text-[11px] font-extrabold text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-1 text-xs font-black text-[var(--text-main)]">{value}</dd>
    </div>
  );
}
