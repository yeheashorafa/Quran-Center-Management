"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { ManagerAlertsData, ManagerAlertSeverity } from "@/lib/manager-alerts/types";

const SEVERITY_LABELS: Record<ManagerAlertSeverity, string> = {
  CRITICAL: "عاجل",
  WARNING: "تنبيه",
  INFO: "معلومة",
};

const SEVERITY_STYLES: Record<ManagerAlertSeverity, string> = {
  CRITICAL: "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
  WARNING: "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]",
  INFO: "border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-text)]",
};

export function ManagerAlertsPanel({ initialDate }: { initialDate: string }) {
  const [date, setDate] = useState(initialDate);
  const [lookbackDays, setLookbackDays] = useState(7);
  const [data, setData] = useState<ManagerAlertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ date, lookbackDays: String(lookbackDays) });
      const response = await fetch(`/api/manager/alerts?${params.toString()}`);
      const payload = (await response.json().catch(() => ({}))) as { data?: ManagerAlertsData; message?: string };
      if (!response.ok || !payload.data) throw new Error(payload.message || "تعذر تحميل التنبيهات.");
      setData(payload.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر تحميل التنبيهات.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
    // Initial load only; form controls apply subsequent changes explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5" dir="rtl">
      <section className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 shadow-sm sm:p-5 text-[var(--text-main)] transition-colors duration-200">
        <p className="text-xs font-bold text-[var(--gold)]">تنبيهات تشغيلية مباشرة</p>
        <h2 className="mt-1 text-xl font-black text-[var(--text-main)]">ما الذي يحتاج تدخل المدير؟</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">التنبيهات تُحسب من البيانات الحالية ولا تُخزن كنسخة منفصلة، لذلك تختفي تلقائياً بعد معالجة السبب.</p>
        <form className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={load}>
          <div className="sm:w-56">
            <label className="form-label" htmlFor="alerts-date">تاريخ المتابعة</label>
            <input id="alerts-date" className="form-control font-bold" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </div>
          <div className="sm:w-52">
            <label className="form-label" htmlFor="alerts-lookback">فحص المسودات القديمة</label>
            <select id="alerts-lookback" className="form-control font-bold" value={lookbackDays} onChange={(event) => setLookbackDays(Number(event.target.value))}>
              <option value={3}>آخر 3 أيام</option>
              <option value={7}>آخر 7 أيام</option>
              <option value={14}>آخر 14 يوماً</option>
              <option value={30}>آخر 30 يوماً</option>
            </select>
          </div>
          <button className="min-h-12 rounded-2xl bg-[var(--primary)] px-6 text-sm font-black text-white hover:bg-[var(--primary-dark)] transition disabled:opacity-60" disabled={loading}>{loading ? "جاري الفحص..." : "تحديث التنبيهات"}</button>
        </form>
        {error ? <div className="mt-3 rounded-2xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-3 text-sm font-bold text-[var(--status-danger-text)]">{error}</div> : null}
      </section>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric value={data?.summary.total ?? 0} label="كل التنبيهات" />
        <Metric value={data?.summary.critical ?? 0} label="عاجل" danger />
        <Metric value={data?.summary.warning ?? 0} label="تنبيه" warning />
        <Metric value={data?.summary.info ?? 0} label="معلومات" />
      </div>

      <section className="space-y-3">
        {loading && !data ? (
          <div className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-8 text-center text-sm font-bold text-[var(--text-muted)]">جاري فحص النظام...</div>
        ) : data?.alerts.length ? data.alerts.map((alert) => (
          <article key={alert.id} className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 shadow-sm sm:p-5 text-[var(--text-main)] transition-colors duration-200">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-3 py-1 text-[10px] font-black ${SEVERITY_STYLES[alert.severity]}`}>{SEVERITY_LABELS[alert.severity]}</span>
                  <span className="rounded-full bg-[var(--card-soft)] border border-[var(--border-color)] px-3 py-1 text-[10px] font-black text-[var(--primary)]">{alert.category}</span>
                </div>
                <h3 className="mt-3 text-lg font-black text-[var(--text-main)]">{alert.title}</h3>
                <p className="mt-1 text-sm leading-7 text-[var(--text-muted)]">{alert.description}</p>
              </div>
              {alert.date ? <time className="text-xs font-bold text-[var(--text-muted)]">{alert.date}</time> : null}
            </div>
            {alert.href ? <a href={alert.href} className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-[var(--card-soft)] border border-[var(--border-color)] px-4 text-sm font-black text-[var(--primary)] hover:border-[var(--primary)] transition">فتح القسم المرتبط</a> : null}
          </article>
        )) : (
          <div className="rounded-3xl border border-dashed border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-8 text-center text-sm font-black text-[var(--status-success-text)]">لا توجد تنبيهات حالية ضمن النطاق المحدد.</div>
        )}
      </section>
    </div>
  );
}

function Metric({ value, label, danger, warning }: { value: number; label: string; danger?: boolean; warning?: boolean }) {
  return (
    <article className={`rounded-2xl border p-4 text-center shadow-sm ${danger ? "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]" : warning ? "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]" : "border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-main)]"}`}>
      <div className={`text-2xl font-black ${danger ? "text-[var(--status-danger-text)]" : warning ? "text-[var(--status-warning-text)]" : "text-[var(--primary)]"}`}>{value}</div>
      <div className="mt-1 text-xs font-bold opacity-80">{label}</div>
    </article>
  );
}
