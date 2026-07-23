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
  NOT_RECORDED: "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
  DRAFT: "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]",
  COMPLETED: "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]",
  LOCKED: "border-[var(--border-color)] bg-[var(--card-soft)] text-[var(--text-muted)]",
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
    <div className="space-y-5" dir="rtl">
      <section className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 shadow-sm sm:p-5 text-[var(--text-main)] transition-colors duration-200">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold text-[var(--gold)]">متابعة الحلقات حسب التاريخ (بيانات الخادم الحية)</p>
            <h2 className="mt-1 text-xl font-black text-[var(--text-main)]">من سجّل ومَكّن البيانات على السيرفر؟</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
              تظهر فقط البيانات المحفوظة والمزامنة فعلياً في قاعدة البيانات على الخادم. البيانات المخزنة أوفلاين لدى الشيوخ لا تظهر حتى تتم المزامنة.
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
              className="min-h-12 shrink-0 rounded-2xl bg-[var(--primary)] px-5 text-sm font-black text-white transition hover:bg-[var(--primary-dark)] disabled:opacity-60"
              disabled={loading}
            >
              {loading ? "جاري التحميل..." : "عرض"}
            </button>
          </form>
        </div>

        <div className="mt-4 rounded-2xl bg-[var(--card-soft)] border border-[var(--border-color)] px-4 py-3 text-sm font-bold text-[var(--primary)]">
          {data.weekdayLabel} — {data.date}
        </div>

        {error ? (
          <div className="mt-3 rounded-2xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-4 py-3 text-sm font-bold text-[var(--status-danger-text)]">
            {error}
          </div>
        ) : null}
      </section>

      {/* Stale Unsynced Halaqat Warning Box */}
      {data.staleHalaqatAlerts && data.staleHalaqatAlerts.length > 0 ? (
        <section className="rounded-3xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-4 shadow-sm space-y-2">
          <h3 className="text-sm font-black text-[var(--status-warning-text)] flex items-center gap-2">
            <span>📡 تنبيه المزامنة: لم تصل بيانات حديثة من الحلقات التالية منذ أيام</span>
          </h3>
          <div className="space-y-1.5 text-xs font-bold text-[var(--status-warning-text)]">
            {data.staleHalaqatAlerts.map((alert) => (
              <p key={alert.halaqaId} className="flex items-center gap-1.5">
                <span>•</span>
                <span>
                  لم تصل بيانات حديثة من حلقة <strong>{alert.halaqaName}</strong> ({alert.teacherName})
                  {alert.lastSessionDate ? ` منذ ${alert.daysAgo} أيام (آخر جلسة وصلت السيرفر: ${alert.lastSessionDate})` : " ولم تصل أي جلسات بعد"}.
                </span>
              </p>
            ))}
          </div>
        </section>
      ) : null}

      {/* Unrecorded Halaqat Priority Alert Box */}
      {data.summary.notRecordedHalaqat > 0 ? (
        <section className="rounded-3xl border-2 border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-2xl bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] text-lg border border-[var(--status-danger-border)]">
                ⚠️
              </span>
              <div>
                <h3 className="text-base font-black text-[var(--status-danger-text)]">
                  تنبيه: يوجد ({data.summary.notRecordedHalaqat}) حلقة لم تسجّل التسميع لهذا اليوم!
                </h3>
                <p className="mt-0.5 text-xs font-bold text-[var(--text-muted)]">
                  نرجو التواصل مع الشيوخ المسؤولين لتسجيل الجلسة ومزامنتها مع الخادم.
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-2xl bg-[var(--status-success-bg)] text-[var(--status-success-text)] text-lg border border-[var(--status-success-border)]">
              🎉
            </span>
            <div>
              <h3 className="text-base font-black text-[var(--status-success-text)]">
                ممتاز! جميع الحلقات المجدولة اليوم قامت بالتسجيل والمزامنة المكتملة.
              </h3>
              <p className="mt-0.5 text-xs font-bold text-[var(--text-muted)]">
                نسبة التغطية والتسجيل اليومية بلغت 100%.
              </p>
            </div>
          </div>
        </section>
      )}

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
            <p className="text-xs font-bold text-[var(--gold)]">تفاصيل اليوم</p>
            <h2 className="mt-1 text-xl font-black text-[var(--text-main)]">الحلقات المجدولة</h2>
          </div>
          <span className="rounded-full bg-[var(--card-soft)] border border-[var(--border-color)] px-3 py-1 text-xs font-black text-[var(--primary)]">
            {data.halaqat.length}
          </span>
        </div>

        {data.halaqat.length ? (
          data.halaqat.map((halaqa) => <HalaqaMonitoringCard key={halaqa.id} halaqa={halaqa} />)
        ) : (
          <div className="rounded-3xl border border-dashed border-[var(--border-color)] bg-[var(--card-bg)] p-8 text-center text-sm font-bold text-[var(--text-muted)]">
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
    <article className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 shadow-sm sm:p-5 text-[var(--text-main)] transition-colors duration-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-[var(--text-main)]">{halaqa.nameAr}</h3>
            <span className={`rounded-full border px-3 py-1 text-[10px] font-black ${STATUS_STYLES[halaqa.monitoringStatus]}`}>
              {STATUS_LABELS[halaqa.monitoringStatus]}
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {halaqa.stageName} — الشيخ: {halaqa.teacher?.displayName ?? "لا يوجد شيخ معيّن"}
          </p>
          {halaqa.teacher && halaqa.teacher.status !== "ACTIVE" ? (
            <p className="mt-1 text-xs font-bold text-[var(--status-danger-text)]">حساب الشيخ غير نشط حالياً.</p>
          ) : null}
        </div>
        <div className="text-left">
          <div className="text-2xl font-black text-[var(--primary)]">{progress}%</div>
          <div className="text-[11px] font-bold text-[var(--text-muted)]">اكتمال التسجيل</div>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--card-soft)]">
        <div className="h-full rounded-full bg-[var(--primary)] transition-all" style={{ width: `${progress}%` }} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Info label="المطلوب" value={`${halaqa.expectedStudents} طالب`} />
        <Info label="تم تسجيلهم" value={`${halaqa.recordedStudents} طالب`} />
        <Info label="المتبقي" value={`${halaqa.remainingStudents} طالب`} danger={halaqa.remainingStudents > 0} />
        <Info label="تحديث الخادم" value={formatDateTime(halaqa.session?.updatedAt ?? null)} />
      </dl>

      {/* Last Synced Session Info Header */}
      {halaqa.lastSyncedSession ? (
        <div className="mt-3 rounded-2xl bg-[var(--card-soft)] p-2.5 text-xs font-bold text-[var(--text-main)] flex flex-wrap justify-between items-center border border-[var(--border-color)]">
          <span>آخر يوم تم تسجيله ووصل للسيرفر: <strong className="text-[var(--primary)]">{halaqa.lastSyncedSession.sessionDate}</strong></span>
          <span className="text-[var(--text-muted)]">وقت المزامنة: {formatDateTime(halaqa.lastSyncedSession.updatedAt)}</span>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl bg-[var(--card-soft)] p-3 border border-[var(--border-color)]">
          <p className="text-xs font-black text-[var(--text-muted)]">الحضور</p>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            <SmallMetric value={halaqa.attendance.present} label="حاضر" />
            <SmallMetric value={halaqa.attendance.absent} label="غائب" danger />
            <SmallMetric value={halaqa.attendance.excused} label="عذر" />
            <SmallMetric value={halaqa.attendance.notHeard} label="لم يسمع" />
          </div>
        </div>

        <div className="rounded-2xl bg-[var(--card-soft)] p-3 border border-[var(--border-color)]">
          <p className="text-xs font-black text-[var(--text-muted)]">الإنجاز بالصفحات</p>
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
    <article className={`rounded-2xl border bg-[var(--card-bg)] p-3 text-center shadow-sm sm:p-4 ${danger ? "border-[var(--status-danger-border)]" : "border-[var(--border-color)]"}`}>
      <div className={`text-2xl font-black sm:text-3xl ${danger ? "text-[var(--status-danger-text)]" : "text-[var(--primary)]"}`}>{value}</div>
      <div className="mt-1 text-[11px] font-bold text-[var(--text-muted)] sm:text-xs">{label}</div>
    </article>
  );
}

function Info({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={`rounded-2xl p-3 border border-[var(--border-color)] ${danger ? "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]" : "bg-[var(--card-soft)] text-[var(--text-main)]"}`}>
      <dt className="text-[11px] font-extrabold text-[var(--text-muted)]">{label}</dt>
      <dd className={`mt-1 text-sm font-black ${danger ? "text-[var(--status-danger-text)]" : "text-[var(--text-main)]"}`}>{value}</dd>
    </div>
  );
}

function SmallMetric({ value, label, danger = false }: { value: number | string; label: string; danger?: boolean }) {
  return (
    <div>
      <div className={`text-lg font-black ${danger ? "text-[var(--status-danger-text)]" : "text-[var(--text-main)]"}`}>{value}</div>
      <div className="mt-0.5 text-[10px] font-bold text-[var(--text-muted)]">{label}</div>
    </div>
  );
}
