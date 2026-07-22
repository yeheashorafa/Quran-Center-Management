"use client";

import { useState, type FormEvent } from "react";
import type {
  ManagerDailyHalaqaMonitoringItem,
  ManagerDailyMonitoringData,
  MonitoringSessionStatus,
} from "@/lib/manager-monitoring/types";

const STATUS_LABELS: Record<MonitoringSessionStatus, string> = {
  NOT_RECORDED: "لم يسجّل",
  DRAFT: "مسودة / غير مكتملة",
  COMPLETED: "مكتملة",
  LOCKED: "مقفلة",
};

const STATUS_STYLES: Record<MonitoringSessionStatus, string> = {
  NOT_RECORDED: "border-red-200 bg-red-50 text-red-800",
  DRAFT: "border-amber-200 bg-amber-50 text-amber-900",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-900",
  LOCKED: "border-slate-300 bg-slate-100 text-slate-800",
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

export function DailyMonitoringPanel({
  initialData,
}: {
  initialData: ManagerDailyMonitoringData;
}) {
  const [data, setData] = useState(initialData);
  const [date, setDate] = useState(initialData.date);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadDate(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/manager/monitoring?date=${encodeURIComponent(date)}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json().catch(() => ({}))) as {
        data?: ManagerDailyMonitoringData;
        message?: string;
      };

      if (!response.ok || !payload.data) {
        throw new Error(payload.message || "تعذر تحميل متابعة الحلقات.");
      }

      setData(payload.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر تحميل متابعة الحلقات.");
    } finally {
      setLoading(false);
    }
  }

  const attendanceTotal =
    data.summary.attendance.present +
    data.summary.attendance.absent +
    data.summary.attendance.excused +
    data.summary.attendance.notHeard;
  const attendanceRate = attendanceTotal
    ? Math.round((data.summary.attendance.present / attendanceTotal) * 100)
    : 0;

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-700">متابعة الحلقات حسب التاريخ</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">من سجّل ومن لم يسجّل؟</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              تظهر فقط الحلقات التي يوافق جدولها اليوم المستخرج تلقائياً من التاريخ.
            </p>
          </div>

          <form className="flex w-full gap-2 sm:w-auto" onSubmit={loadDate}>
            <div className="min-w-0 flex-1 sm:w-52">
              <label className="sr-only" htmlFor="monitoring-date">التاريخ</label>
              <input
                className="form-control"
                id="monitoring-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </div>
            <button
              className="min-h-12 shrink-0 rounded-2xl bg-emerald-800 px-5 text-sm font-black text-white transition hover:bg-emerald-900 disabled:opacity-60"
              disabled={loading}
            >
              {loading ? "جاري التحميل..." : "عرض"}
            </button>
          </form>
        </div>

        <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-950">
          {data.weekdayLabel} — {data.date}
        </div>

        {error ? (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
            {error}
          </div>
        ) : null}
      </section>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <MetricCard value={data.summary.expectedHalaqat} label="حلقة مطلوبة" />
        <MetricCard value={data.summary.recordedHalaqat} label="بدأت التسجيل" />
        <MetricCard value={data.summary.completedHalaqat} label="جلسة مكتملة" />
        <MetricCard value={data.summary.notRecordedHalaqat} label="لم تسجّل" danger />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <MetricCard value={`${data.summary.recordedStudents}/${data.summary.expectedStudents}`} label="طلاب مسجّلون" />
        <MetricCard value={`${attendanceRate}%`} label="نسبة الحضور" />
        <MetricCard value={data.summary.attendance.absent} label="غياب" danger />
        <MetricCard value={pages(data.summary.activities.totalPages)} label="إجمالي الصفحات" />
      </div>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-emerald-700">تفاصيل اليوم</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">الحلقات المجدولة</h2>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-900">
            {data.halaqat.length}
          </span>
        </div>

        {data.halaqat.length ? (
          data.halaqat.map((halaqa) => <HalaqaMonitoringCard key={halaqa.id} halaqa={halaqa} />)
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500">
            لا توجد حلقات مجدولة في هذا اليوم حسب الجداول الحالية.
          </div>
        )}
      </section>
    </div>
  );
}

function HalaqaMonitoringCard({ halaqa }: { halaqa: ManagerDailyHalaqaMonitoringItem }) {
  const progress = halaqa.expectedStudents
    ? Math.round((halaqa.recordedStudents / halaqa.expectedStudents) * 100)
    : 0;

  return (
    <article className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-slate-950">{halaqa.nameAr}</h3>
            <span className={`rounded-full border px-3 py-1 text-[10px] font-black ${STATUS_STYLES[halaqa.monitoringStatus]}`}>
              {STATUS_LABELS[halaqa.monitoringStatus]}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {halaqa.stageName} — {halaqa.teacher?.displayName ?? "لا يوجد شيخ معيّن"}
          </p>
          {halaqa.teacher && halaqa.teacher.status !== "ACTIVE" ? (
            <p className="mt-1 text-xs font-bold text-red-700">حساب الشيخ غير نشط حالياً.</p>
          ) : null}
        </div>
        <div className="text-left">
          <div className="text-2xl font-black text-emerald-900">{progress}%</div>
          <div className="text-[11px] font-bold text-slate-500">اكتمال التسجيل</div>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-emerald-700 transition-all" style={{ width: `${progress}%` }} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Info label="المطلوب" value={`${halaqa.expectedStudents} طالب`} />
        <Info label="تم تسجيلهم" value={`${halaqa.recordedStudents} طالب`} />
        <Info label="المتبقي" value={`${halaqa.remainingStudents} طالب`} danger={halaqa.remainingStudents > 0} />
        <Info label="آخر تحديث" value={formatDateTime(halaqa.session?.updatedAt ?? null)} />
      </dl>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-xs font-black text-slate-500">الحضور</p>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            <SmallMetric value={halaqa.attendance.present} label="حاضر" />
            <SmallMetric value={halaqa.attendance.absent} label="غائب" danger />
            <SmallMetric value={halaqa.attendance.excused} label="عذر" />
            <SmallMetric value={halaqa.attendance.notHeard} label="لم يسمع" />
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-xs font-black text-slate-500">الإنجاز بالصفحات</p>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            <SmallMetric value={pages(halaqa.activities.memorizationPages)} label="حفظ" />
            <SmallMetric value={pages(halaqa.activities.reviewPages)} label="مراجعة" />
            <SmallMetric value={pages(halaqa.activities.recitationPages)} label="سرد" />
            <SmallMetric value={pages(halaqa.activities.totalPages)} label="المجموع" />
          </div>
        </div>
      </div>
    </article>
  );
}

function MetricCard({
  value,
  label,
  danger = false,
}: {
  value: number | string;
  label: string;
  danger?: boolean;
}) {
  return (
    <article className={`rounded-2xl border bg-white p-3 text-center shadow-sm sm:p-4 ${danger ? "border-red-100" : "border-emerald-100"}`}>
      <div className={`text-2xl font-black sm:text-3xl ${danger ? "text-red-700" : "text-emerald-900"}`}>{value}</div>
      <div className="mt-1 text-[11px] font-bold text-slate-500 sm:text-xs">{label}</div>
    </article>
  );
}

function Info({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={`rounded-2xl p-3 ${danger ? "bg-red-50" : "bg-slate-50"}`}>
      <dt className="text-[11px] font-extrabold text-slate-500">{label}</dt>
      <dd className={`mt-1 text-sm font-black ${danger ? "text-red-700" : "text-slate-800"}`}>{value}</dd>
    </div>
  );
}

function SmallMetric({ value, label, danger = false }: { value: number | string; label: string; danger?: boolean }) {
  return (
    <div>
      <div className={`text-lg font-black ${danger ? "text-red-700" : "text-slate-900"}`}>{value}</div>
      <div className="mt-0.5 text-[10px] font-bold text-slate-500">{label}</div>
    </div>
  );
}
