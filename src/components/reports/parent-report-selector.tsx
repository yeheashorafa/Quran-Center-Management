"use client";

import { useState } from "react";
import { todayInPalestine } from "@/lib/memorization-sessions/date";
import type { ParentReportData } from "@/lib/reports/parent-report-types";
import { ParentReportModal } from "./parent-report-modal";

export type StudentOption = {
  id: string;
  displayName: string;
  halaqaName?: string;
  stageName?: string;
};

export function ParentReportSelector({
  students,
  title = "تقرير ولي الأمر",
  description = "اختر الطالب والشهر لاستخراج تقرير متابعة مخصص للطباعة وتسليمه لولي الأمر.",
  defaultStudentId,
}: {
  students: StudentOption[];
  title?: string;
  description?: string;
  defaultStudentId?: string;
}) {
  const [selectedStudentId, setSelectedStudentId] = useState(defaultStudentId || students[0]?.id || "");
  const [selectedMonth, setSelectedMonth] = useState(todayInPalestine().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<ParentReportData | null>(null);

  async function fetchReport() {
    if (!selectedStudentId) {
      setError("اختر الطالب أولاً.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/reports/parent?studentId=${selectedStudentId}&month=${selectedMonth}`,
        { cache: "no-store" },
      );
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json.message || "تعذر استخراج تقرير ولي الأمر.");
      }
      setReportData(json.data as ParentReportData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء تحميل التقرير.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold text-emerald-800">تقارير المتابعة</span>
          <h2 className="text-xl font-black text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-800">
          ⚠️ {error}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="form-label" htmlFor="parent-report-student">
            اختر الطالب
          </label>
          <select
            id="parent-report-student"
            className="form-control font-bold"
            value={selectedStudentId}
            onChange={(event) => setSelectedStudentId(event.target.value)}
          >
            <option value="">-- اختر الطالب --</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.displayName}
                {student.halaqaName ? ` (${student.halaqaName})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="form-label" htmlFor="parent-report-month">
            الشهر
          </label>
          <input
            id="parent-report-month"
            type="month"
            className="form-control font-bold"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
          />
        </div>
      </div>

      <div className="mt-4">
        <button
          type="button"
          disabled={loading || !selectedStudentId}
          onClick={fetchReport}
          className="min-h-12 w-full rounded-2xl bg-emerald-900 px-5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-950 disabled:opacity-40"
        >
          {loading ? "جاري تجهيز تقرير ولي الأمر..." : "📜 عرض وتوليد تقرير ولي الأمر"}
        </button>
      </div>

      {reportData ? (
        <ParentReportModal data={reportData} onClose={() => setReportData(null)} />
      ) : null}
    </section>
  );
}
