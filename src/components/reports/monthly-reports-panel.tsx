"use client";

import { useMemo, useState } from "react";
import type {
  MonthlyReportOptions,
  ReportFormat,
  ReportKind,
} from "@/lib/reports/types";

type ApiMessage = { message?: string };

function filenameFromHeader(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const encoded = header.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      return fallback;
    }
  }
  const plain = header.match(/filename="?([^";]+)"?/i)?.[1];
  return plain || fallback;
}

async function apiError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => ({}))) as ApiMessage;
  return data.message || "تعذر إنشاء التقرير.";
}

export function MonthlyReportsPanel({
  options,
  initialMonth,
}: {
  options: MonthlyReportOptions;
  initialMonth: string;
}) {
  const [achieveMonth, setAchieveMonth] = useState(initialMonth);
  const [achieveStageId, setAchieveStageId] = useState("");
  const [achieveHalaqaId, setAchieveHalaqaId] = useState("");

  const [examMonth, setExamMonth] = useState(initialMonth);
  const [examStageId, setExamStageId] = useState("");
  const [examHalaqaId, setExamHalaqaId] = useState("");
  const [includeVoided, setIncludeVoided] = useState(false);

  const [busy, setBusy] = useState<{ kind: ReportKind; format: ReportFormat } | null>(null);
  const [notice, setNotice] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const achieveHalaqat = useMemo(() => {
    const stages = achieveStageId
      ? options.stages.filter((s) => s.id === achieveStageId)
      : options.stages;
    return stages.flatMap((s) => s.halaqat);
  }, [options.stages, achieveStageId]);

  const examHalaqat = useMemo(() => {
    const stages = examStageId
      ? options.stages.filter((s) => s.id === examStageId)
      : options.stages;
    return stages.flatMap((s) => s.halaqat);
  }, [options.stages, examStageId]);

  async function downloadReport(kind: ReportKind, format: ReportFormat) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setNotice({ type: "error", text: "التقارير والتصدير تحتاج اتصالاً بالإنترنت." });
      return;
    }

    const month = kind === "COMPREHENSIVE" ? achieveMonth : examMonth;
    const stageId = kind === "COMPREHENSIVE" ? achieveStageId : examStageId;
    const halaqaId = kind === "COMPREHENSIVE" ? achieveHalaqaId : examHalaqaId;

    if (!month) {
      setNotice({ type: "error", text: "اختر الشهر أولاً." });
      return;
    }

    setBusy({ kind, format });
    setNotice(null);

    try {
      const params = new URLSearchParams({
        month,
        kind,
        format,
        includeVoided: includeVoided ? "true" : "false",
      });
      if (stageId && stageId !== "unassigned") params.set("stageId", stageId);
      if (halaqaId) params.set("halaqaId", halaqaId);

      const response = await fetch(`/api/reports/monthly?${params.toString()}`, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });

      if (!response.ok) throw new Error(await apiError(response));

      const blob = await response.blob();
      const ext = format === "pdf" ? "pdf" : format === "csv" ? "csv" : "xlsx";
      const fallback = `${kind === "COMPREHENSIVE" ? "تقرير_الإنجاز" : "تقرير_الاختبارات"}_${month}.${ext}`;
      const filename = filenameFromHeader(response.headers.get("content-disposition"), fallback);

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setNotice({ type: "success", text: "تم تجهيز التقرير وتنزيله بنجاح." });
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "تعذر إنشاء التقرير.",
      });
    } finally {
      setBusy(null);
    }
  }

  const allowAchievement = options.allowedKinds.includes("COMPREHENSIVE");
  const allowExams = options.allowedKinds.includes("EXAMS");

  return (
    <div className="space-y-6" dir="rtl">
      {notice ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
            notice.type === "success"
              ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
              : "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      {/* Section A: Monthly Achievement Report */}
      {allowAchievement ? (
        <section className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5 shadow-sm text-[var(--text-main)] transition-colors duration-200">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="text-xs font-bold text-[var(--gold)]">أ. التقرير الأساسي</span>
              <h2 className="text-xl font-black text-[var(--text-main)]">تقرير الإنجاز الشهري</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                تصدير إنجاز حفظ ومراجعة وسرد الطلاب مع تفاصيل سور وآيات الحفظ فقط (بدون بيانات الاختبارات).
              </p>
            </div>
            <div className="rounded-2xl bg-[var(--card-soft)] border border-[var(--border-color)] px-3 py-1.5 text-xs font-bold text-[var(--primary)]">
              إنجاز الحفظ فقط
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="form-label" htmlFor="achieve-month">الشهر</label>
              <input
                id="achieve-month"
                className="form-control font-bold"
                type="month"
                value={achieveMonth}
                onChange={(e) => setAchieveMonth(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label" htmlFor="achieve-stage">المرحلة</label>
              <select
                id="achieve-stage"
                className="form-control font-bold"
                value={achieveStageId}
                onChange={(e) => {
                  setAchieveStageId(e.target.value);
                  setAchieveHalaqaId("");
                }}
              >
                <option value="">كل المراحل</option>
                {options.stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>{stage.nameAr}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label" htmlFor="achieve-halaqa">الحلقة / الشيخ</label>
              <select
                id="achieve-halaqa"
                className="form-control font-bold"
                value={achieveHalaqaId}
                onChange={(e) => setAchieveHalaqaId(e.target.value)}
              >
                <option value="">كل الحلقات</option>
                {achieveHalaqat.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.nameAr}{h.teacherName ? ` — ${h.teacherName}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              className="rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-black text-white transition hover:bg-[var(--primary-dark)] disabled:opacity-60"
              disabled={busy !== null}
              onClick={() => downloadReport("COMPREHENSIVE", "excel")}
            >
              {busy?.kind === "COMPREHENSIVE" && busy?.format === "excel"
                ? "جاري تجهيز Excel..."
                : "📊 تنزيل Excel الإنجاز (.xlsx)"}
            </button>

            <button
              type="button"
              className="rounded-2xl border-2 border-[var(--primary)] bg-[var(--card-soft)] px-4 py-3 text-sm font-black text-[var(--primary)] transition hover:opacity-90 disabled:opacity-60"
              disabled={busy !== null}
              onClick={() => downloadReport("COMPREHENSIVE", "csv")}
            >
              {busy?.kind === "COMPREHENSIVE" && busy?.format === "csv"
                ? "جاري تجهيز CSV..."
                : "📄 تنزيل CSV الإنجاز (UTF-8)"}
            </button>

            <button
              type="button"
              className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] px-4 py-3 text-sm font-black text-[var(--text-main)] transition hover:border-[var(--primary)] disabled:opacity-60"
              disabled={busy !== null}
              onClick={() => downloadReport("COMPREHENSIVE", "pdf")}
            >
              {busy?.kind === "COMPREHENSIVE" && busy?.format === "pdf"
                ? "جاري تجهيز PDF..."
                : "🖨️ تنزيل PDF الإنجاز"}
            </button>
          </div>
        </section>
      ) : null}

      {/* Section B: Official Tests Report */}
      {allowExams ? (
        <section className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5 shadow-sm text-[var(--text-main)] transition-colors duration-200">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="text-xs font-bold text-[var(--gold)]">ب. تقرير الاختبارات</span>
              <h2 className="text-xl font-black text-[var(--text-main)]">تقرير الاختبارات الرسمية</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                تصدير سجل الاختبارات والسرد الرسمي بشكل منفصل تماماً عن متابعة الحفظ اليومية.
              </p>
            </div>
            <div className="rounded-2xl bg-[var(--card-soft)] border border-[var(--border-color)] px-3 py-1.5 text-xs font-bold text-[var(--primary)]">
              تقرير الاختبارات مستقل
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="form-label" htmlFor="exam-month">الشهر</label>
              <input
                id="exam-month"
                className="form-control font-bold"
                type="month"
                value={examMonth}
                onChange={(e) => setExamMonth(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label" htmlFor="exam-stage">المرحلة</label>
              <select
                id="exam-stage"
                className="form-control font-bold"
                value={examStageId}
                onChange={(e) => {
                  setExamStageId(e.target.value);
                  setExamHalaqaId("");
                }}
              >
                <option value="">كل المراحل</option>
                {options.stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>{stage.nameAr}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label" htmlFor="exam-halaqa">الحلقة / الشيخ</label>
              <select
                id="exam-halaqa"
                className="form-control font-bold"
                value={examHalaqaId}
                onChange={(e) => setExamHalaqaId(e.target.value)}
              >
                <option value="">كل الحلقات والمختبرين</option>
                {examHalaqat.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.nameAr}{h.teacherName ? ` — ${h.teacherName}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {options.roleCode !== "TEACHER" ? (
            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm font-bold text-[var(--text-main)]">
              <input
                type="checkbox"
                checked={includeVoided}
                onChange={(e) => setIncludeVoided(e.target.checked)}
              />
              تضمين الاختبارات الملغاة في التقرير
            </label>
          ) : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              className="rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-black text-white transition hover:bg-[var(--primary-dark)] disabled:opacity-60"
              disabled={busy !== null}
              onClick={() => downloadReport("EXAMS", "excel")}
            >
              {busy?.kind === "EXAMS" && busy?.format === "excel"
                ? "جاري تجهيز Excel..."
                : "📊 تنزيل Excel الاختبارات (.xlsx)"}
            </button>

            <button
              type="button"
              className="rounded-2xl border-2 border-[var(--primary)] bg-[var(--card-soft)] px-4 py-3 text-sm font-black text-[var(--primary)] transition hover:opacity-90 disabled:opacity-60"
              disabled={busy !== null}
              onClick={() => downloadReport("EXAMS", "csv")}
            >
              {busy?.kind === "EXAMS" && busy?.format === "csv"
                ? "جاري تجهيز CSV..."
                : "📄 تنزيل CSV الاختبارات (UTF-8)"}
            </button>

            <button
              type="button"
              className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] px-4 py-3 text-sm font-black text-[var(--text-main)] transition hover:border-[var(--primary)] disabled:opacity-60"
              disabled={busy !== null}
              onClick={() => downloadReport("EXAMS", "pdf")}
            >
              {busy?.kind === "EXAMS" && busy?.format === "pdf"
                ? "جاري تجهيز PDF..."
                : "🖨️ تنزيل PDF الاختبارات"}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
