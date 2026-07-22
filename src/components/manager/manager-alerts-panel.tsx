"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { ManagerAlertsData, ManagerAlertSeverity } from "@/lib/manager-alerts/types";

const SEVERITY_LABELS: Record<ManagerAlertSeverity, string> = {
  CRITICAL: "عاجل",
  WARNING: "تنبيه",
  INFO: "معلومة",
};

const SEVERITY_STYLES: Record<ManagerAlertSeverity, string> = {
  CRITICAL: "border-red-200 bg-red-50 text-red-800",
  WARNING: "border-amber-200 bg-amber-50 text-amber-900",
  INFO: "border-blue-200 bg-blue-50 text-blue-800",
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
    <div className="space-y-5">
      <section className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-xs font-bold text-emerald-700">تنبيهات تشغيلية مباشرة</p>
        <h2 className="mt-1 text-xl font-black text-slate-950">ما الذي يحتاج تدخل المدير؟</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">التنبيهات تُحسب من البيانات الحالية ولا تُخزن كنسخة منفصلة، لذلك تختفي تلقائياً بعد معالجة السبب.</p>
        <form className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={load}>
          <div className="sm:w-56">
            <label className="form-label" htmlFor="alerts-date">تاريخ المتابعة</label>
            <input id="alerts-date" className="form-control" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </div>
          <div className="sm:w-52">
            <label className="form-label" htmlFor="alerts-lookback">فحص المسودات القديمة</label>
            <select id="alerts-lookback" className="form-control" value={lookbackDays} onChange={(event) => setLookbackDays(Number(event.target.value))}>
              <option value={3}>آخر 3 أيام</option>
              <option value={7}>آخر 7 أيام</option>
              <option value={14}>آخر 14 يوماً</option>
              <option value={30}>آخر 30 يوماً</option>
            </select>
          </div>
          <button className="min-h-12 rounded-2xl bg-emerald-800 px-6 text-sm font-black text-white hover:bg-emerald-900 disabled:opacity-60" disabled={loading}>{loading ? "جاري الفحص..." : "تحديث التنبيهات"}</button>
        </form>
        {error ? <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</div> : null}
      </section>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric value={data?.summary.total ?? 0} label="كل التنبيهات" />
        <Metric value={data?.summary.critical ?? 0} label="عاجل" danger />
        <Metric value={data?.summary.warning ?? 0} label="تنبيه" warning />
        <Metric value={data?.summary.info ?? 0} label="معلومات" />
      </div>

      <section className="space-y-3">
        {loading && !data ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500">جاري فحص النظام...</div>
        ) : data?.alerts.length ? data.alerts.map((alert) => (
          <article key={alert.id} className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-3 py-1 text-[10px] font-black ${SEVERITY_STYLES[alert.severity]}`}>{SEVERITY_LABELS[alert.severity]}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-700">{alert.category}</span>
                </div>
                <h3 className="mt-3 text-lg font-black text-slate-950">{alert.title}</h3>
                <p className="mt-1 text-sm leading-7 text-slate-600">{alert.description}</p>
              </div>
              {alert.date ? <time className="text-xs font-bold text-slate-500">{alert.date}</time> : null}
            </div>
            {alert.href ? <a href={alert.href} className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-emerald-50 px-4 text-sm font-black text-emerald-900 hover:bg-emerald-100">فتح القسم المرتبط</a> : null}
          </article>
        )) : (
          <div className="rounded-3xl border border-dashed border-emerald-300 bg-emerald-50 p-8 text-center text-sm font-black text-emerald-900">لا توجد تنبيهات حالية ضمن النطاق المحدد.</div>
        )}
      </section>
    </div>
  );
}

function Metric({ value, label, danger, warning }: { value: number; label: string; danger?: boolean; warning?: boolean }) {
  return <article className={`rounded-2xl border p-4 text-center shadow-sm ${danger ? "border-red-200 bg-red-50" : warning ? "border-amber-200 bg-amber-50" : "border-emerald-100 bg-white"}`}><div className={`text-2xl font-black ${danger ? "text-red-800" : warning ? "text-amber-900" : "text-emerald-900"}`}>{value}</div><div className="mt-1 text-xs font-bold text-slate-500">{label}</div></article>;
}
