"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WEEKDAY_CODES, WEEKDAY_LABELS, type WeekdayCode } from "@/lib/halaqat/weekdays";
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

type ScheduleScopeFilter = "all_unrecorded" | "scheduled_today" | "all_active";
type StatusFilter = "ALL" | "NOT_RECORDED" | "DRAFT" | "COMPLETED";

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
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState(initialData);
  const [date, setDate] = useState(initialData.date);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<"excel" | "csv" | null>(null);

  // URL state reading
  const rawFilter = searchParams.get("monitoringFilter");
  const scheduleScopeFilter: ScheduleScopeFilter =
    rawFilter === "scheduled_today" || rawFilter === "all_active"
      ? rawFilter
      : "all_unrecorded";

  const statusFilter: StatusFilter =
    (searchParams.get("monitoringStatus") as StatusFilter) || "ALL";

  const dayFilter = searchParams.get("monitoringDay") || "ALL";
  const stageFilter = searchParams.get("monitoringStage") || "ALL";
  const searchQuery = searchParams.get("monitoringSearch") || "";
  const rawPage = parseInt(searchParams.get("monitoringPage") || "1", 10);
  const pageFromUrl = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;

  function updateUrlParams(updates: Record<string, string | null>, resetPage = true) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "monitoring");

    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "" || value === "ALL") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    if (resetPage && !updates.monitoringPage) {
      params.set("monitoringPage", "1");
    }

    router.replace(`?${params.toString()}`, { scroll: false });
  }

  function downloadExport(format: "excel" | "csv") {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("التقارير والتصدير تحتاج اتصالاً بالإنترنت.");
      return;
    }

    setExportingFormat(format);
    setError(null);

    const url = `/api/manager/monitoring?date=${encodeURIComponent(date)}&format=${format}`;
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `تقرير_متابعة_الحلقات_${date}.${format === "excel" ? "xlsx" : "csv"}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    setTimeout(() => setExportingFormat(null), 1500);
  }

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

  // Available stages for dropdown filter
  const availableStages = useMemo(() => {
    const set = new Set<string>();
    for (const h of data.halaqat) {
      if (h.stageName) set.add(h.stageName);
    }
    return Array.from(set);
  }, [data.halaqat]);

  // Combined Filtering Logic
  const filteredHalaqat = useMemo(() => {
    return data.halaqat.filter((halaqa) => {
      // 1. Schedule Scope Filter
      if (scheduleScopeFilter === "all_unrecorded") {
        if (halaqa.monitoringStatus !== "NOT_RECORDED") return false;
      } else if (scheduleScopeFilter === "scheduled_today") {
        if (!halaqa.isScheduledToday) return false;
      }

      // 2. Status Filter
      if (statusFilter === "NOT_RECORDED" && halaqa.monitoringStatus !== "NOT_RECORDED") return false;
      if (statusFilter === "DRAFT" && halaqa.monitoringStatus !== "DRAFT") return false;
      if (
        statusFilter === "COMPLETED" &&
        halaqa.monitoringStatus !== "COMPLETED" &&
        halaqa.monitoringStatus !== "LOCKED"
      )
        return false;

      // 3. Day Filter
      if (dayFilter !== "ALL") {
        if (!halaqa.weekdays?.includes(dayFilter as WeekdayCode)) return false;
      }

      // 4. Stage Filter
      if (stageFilter !== "ALL") {
        if (halaqa.stageName !== stageFilter) return false;
      }

      // 5. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = halaqa.nameAr.toLowerCase().includes(q);
        const matchTeacher = halaqa.teacher?.displayName.toLowerCase().includes(q) ?? false;
        const matchStage = halaqa.stageName.toLowerCase().includes(q);
        if (!matchName && !matchTeacher && !matchStage) return false;
      }

      return true;
    });
  }, [data.halaqat, scheduleScopeFilter, statusFilter, dayFilter, stageFilter, searchQuery]);

  // Pagination Math
  const ITEMS_PER_PAGE = 5;
  const totalCount = filteredHalaqat.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));
  const currentPage = Math.min(Math.max(1, pageFromUrl), totalPages);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedHalaqat = filteredHalaqat.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const fromDisplay = totalCount === 0 ? 0 : startIndex + 1;
  const toDisplay = Math.min(startIndex + ITEMS_PER_PAGE, totalCount);

  function handlePageChange(newPage: number) {
    if (newPage < 1 || newPage > totalPages) return;
    updateUrlParams({ monitoringPage: String(newPage) }, false);
  }

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

          <div className="flex flex-wrap items-center gap-2">
            <form className="flex w-full gap-2 sm:w-auto" onSubmit={loadDate}>
              <div className="min-w-0 flex-1 sm:w-44">
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

            <button
              type="button"
              className="min-h-12 rounded-2xl bg-[var(--primary)] px-4 text-xs font-black text-white transition hover:bg-[var(--primary-dark)] disabled:opacity-60"
              disabled={exportingFormat !== null}
              onClick={() => downloadExport("excel")}
            >
              {exportingFormat === "excel" ? "جاري التنزيل..." : "📊 Excel المتابعة (.xlsx)"}
            </button>

            <button
              type="button"
              className="min-h-12 rounded-2xl border-2 border-[var(--primary)] bg-[var(--card-soft)] px-4 text-xs font-black text-[var(--primary)] transition hover:opacity-90 disabled:opacity-60"
              disabled={exportingFormat !== null}
              onClick={() => downloadExport("csv")}
            >
              {exportingFormat === "csv" ? "جاري التنزيل..." : "📄 CSV المتابعة (UTF-8)"}
            </button>
          </div>
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

      {/* Unrecorded Scheduled Halaqat Priority Alert Box */}
      {data.summary.notRecordedHalaqat > 0 ? (
        <section className="rounded-3xl border-2 border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-2xl bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] text-lg border border-[var(--status-danger-border)]">
                ⚠️
              </span>
              <div>
                <h3 className="text-base font-black text-[var(--status-danger-text)]">
                  تنبيه: يوجد ({data.summary.notRecordedHalaqat}) حلقة مجدولة اليوم لم تسجّل التسميع بعد!
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

      {/* Metric Cards Summary */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <MetricCard value={data.summary.expectedHalaqat} label="مجدولة اليوم" />
        <MetricCard value={data.summary.recordedHalaqat} label="بدأت التسجيل اليوم" />
        <MetricCard value={data.summary.completedHalaqat} label="جلسة مكتملة اليوم" />
        <MetricCard value={data.summary.notRecordedHalaqat} label="مجدولة ولم تسجّل" danger={data.summary.notRecordedHalaqat > 0} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <MetricCard value={data.summary.totalActiveHalaqat ?? data.halaqat.length} label="إجمالي الحلقات النشطة" />
        <MetricCard value={data.summary.totalUnrecordedActiveHalaqat ?? data.halaqat.filter(h => h.monitoringStatus === "NOT_RECORDED").length} label="إجمالي غير المسجلة" danger />
        <MetricCard value={`${data.summary.recordedStudents}/${data.summary.expectedStudents}`} label="طلاب مسجّلون" />
        <MetricCard value={pages(data.summary.activities.totalPages)} label="إجمالي الصفحات" />
      </div>

      {/* Filtering & Monitoring Controls Section */}
      <section className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-black text-[var(--text-main)]">تصفية وفلترة قائمة الحلقات</h3>
            <p className="text-xs text-[var(--text-muted)]">اختر نطاق العرض والفلترة المطلوبة لمتابعة تسجيل الشيوخ للحلقات.</p>
          </div>

          {/* Schedule Scope Filter Tabs */}
          <div className="flex flex-wrap gap-1.5 rounded-2xl bg-[var(--card-soft)] p-1.5 border border-[var(--border-color)]">
            <button
              type="button"
              onClick={() => updateUrlParams({ monitoringFilter: "all_unrecorded" })}
              className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                scheduleScopeFilter === "all_unrecorded"
                  ? "bg-[var(--primary)] text-white shadow-xs"
                  : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
              }`}
            >
              كل الحلقات غير المسجلة اليوم ({data.summary.totalUnrecordedActiveHalaqat ?? data.halaqat.filter(h => h.monitoringStatus === "NOT_RECORDED").length})
            </button>
            <button
              type="button"
              onClick={() => updateUrlParams({ monitoringFilter: "scheduled_today" })}
              className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                scheduleScopeFilter === "scheduled_today"
                  ? "bg-[var(--primary)] text-white shadow-xs"
                  : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
              }`}
            >
              المجدولة اليوم ({data.summary.expectedHalaqat})
            </button>
            <button
              type="button"
              onClick={() => updateUrlParams({ monitoringFilter: "all_active" })}
              className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                scheduleScopeFilter === "all_active"
                  ? "bg-[var(--primary)] text-white shadow-xs"
                  : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
              }`}
            >
              جميع الحلقات النشطة ({data.halaqat.length})
            </button>
          </div>
        </div>

        {/* Detailed Filters Grid */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 pt-2 border-t border-[var(--border-color)]">
          {/* Day Filter */}
          <div>
            <label className="text-[11px] font-bold text-[var(--text-muted)] mb-1 block">فلتر أيام الحلقة</label>
            <select
              className="form-control text-xs"
              value={dayFilter}
              onChange={(e) => updateUrlParams({ monitoringDay: e.target.value })}
            >
              <option value="ALL">جميع الأيام</option>
              {WEEKDAY_CODES.map((code) => (
                <option key={code} value={code}>
                  {WEEKDAY_LABELS[code]}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="text-[11px] font-bold text-[var(--text-muted)] mb-1 block">حالة الجلسة</label>
            <select
              className="form-control text-xs"
              value={statusFilter}
              onChange={(e) => updateUrlParams({ monitoringStatus: e.target.value })}
            >
              <option value="ALL">جميع الحالات</option>
              <option value="NOT_RECORDED">لم يسجّل</option>
              <option value="DRAFT">مسودة / غير مكتملة</option>
              <option value="COMPLETED">مكتملة / مقفلة</option>
            </select>
          </div>

          {/* Stage Filter */}
          <div>
            <label className="text-[11px] font-bold text-[var(--text-muted)] mb-1 block">المرحلة</label>
            <select
              className="form-control text-xs"
              value={stageFilter}
              onChange={(e) => updateUrlParams({ monitoringStage: e.target.value })}
            >
              <option value="ALL">جميع المراحل</option>
              {availableStages.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </div>

          {/* Search Query */}
          <div>
            <label className="text-[11px] font-bold text-[var(--text-muted)] mb-1 block">بحث بالشيخ أو الحلقة</label>
            <input
              type="search"
              placeholder="ابحث باسم الحلقة أو الشيخ..."
              className="form-control text-xs"
              value={searchQuery}
              onChange={(e) => updateUrlParams({ monitoringSearch: e.target.value })}
            />
          </div>
        </div>
      </section>

      {/* Halaqat Cards Section & Pagination */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-[var(--gold)]">
              {scheduleScopeFilter === "all_unrecorded"
                ? "كل الحلقات غير المسجلة"
                : scheduleScopeFilter === "scheduled_today"
                ? "الحلقات المجدولة اليوم ولم تسجل"
                : "جميع الحلقات النشطة"}
            </p>
            <h2 className="mt-0.5 text-xl font-black text-[var(--text-main)]">
              قائمة المتابعة اليومية
            </h2>
          </div>

          {/* Pagination Counter Info */}
          <div className="rounded-full bg-[var(--card-soft)] border border-[var(--border-color)] px-4 py-1.5 text-xs font-black text-[var(--primary)]">
            عرض {fromDisplay} - {toDisplay} من أصل {totalCount} حلقة
          </div>
        </div>

        {paginatedHalaqat.length ? (
          <div className="space-y-3">
            {paginatedHalaqat.map((halaqa) => (
              <HalaqaMonitoringCard key={halaqa.id} halaqa={halaqa} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-[var(--border-color)] bg-[var(--card-bg)] p-8 text-center text-sm font-bold text-[var(--text-muted)] space-y-2">
            <p className="text-2xl">🔍</p>
            <p>لا توجد حلقات مطابقة للفلاتر المحددة حالياً.</p>
            <p className="text-xs text-[var(--text-muted)]">جرّب تغيير خيارات التصفية أو إلغاء بعض الفلاتر لعرض نتائج أكثر.</p>
          </div>
        )}

        {/* Pagination Toolbar */}
        {totalPages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--border-color)]">
            <div className="text-xs font-bold text-[var(--text-muted)]">
              الصفحة {currentPage} من أصل {totalPages}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="rounded-xl border border-[var(--border-color)] bg-[var(--card-soft)] px-3 py-1.5 text-xs font-black text-[var(--text-main)] transition hover:bg-[var(--card-bg)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                السابق
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => handlePageChange(pageNum)}
                  className={`size-8 rounded-xl text-xs font-black transition ${
                    pageNum === currentPage
                      ? "bg-[var(--primary)] text-white shadow-xs"
                      : "border border-[var(--border-color)] bg-[var(--card-soft)] text-[var(--text-main)] hover:bg-[var(--card-bg)]"
                  }`}
                >
                  {pageNum}
                </button>
              ))}

              <button
                type="button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="rounded-xl border border-[var(--border-color)] bg-[var(--card-soft)] px-3 py-1.5 text-xs font-black text-[var(--text-main)] transition hover:bg-[var(--card-bg)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                التالي
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function HalaqaMonitoringCard({ halaqa }: { halaqa: ManagerDailyHalaqaMonitoringItem }) {
  const progress = halaqa.expectedStudents
    ? Math.round((halaqa.recordedStudents / halaqa.expectedStudents) * 100)
    : 0;

  const formattedWeekdays = halaqa.weekdays && halaqa.weekdays.length > 0
    ? halaqa.weekdays.map((w) => WEEKDAY_LABELS[w] || w).join("، ")
    : "غير محددة";

  return (
    <article className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 shadow-sm sm:p-5 text-[var(--text-main)] transition-colors duration-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-[var(--text-main)]">{halaqa.nameAr}</h3>

            {/* Registration Status Badge */}
            <span className={`rounded-full border px-3 py-1 text-[10px] font-black ${STATUS_STYLES[halaqa.monitoringStatus]}`}>
              {STATUS_LABELS[halaqa.monitoringStatus]}
            </span>

            {/* Scheduled Today vs Not Scheduled Visual Distinction Badge */}
            {halaqa.isScheduledToday ? (
              halaqa.monitoringStatus === "NOT_RECORDED" ? (
                <span className="rounded-full border border-red-300 dark:border-red-800 bg-red-100 dark:bg-red-950/40 px-3 py-1 text-[10px] font-black text-red-700 dark:text-red-300">
                  ⚠️ مطلوبة اليوم
                </span>
              ) : (
                <span className="rounded-full border border-blue-300 dark:border-blue-800 bg-blue-100 dark:bg-blue-950/40 px-3 py-1 text-[10px] font-black text-blue-700 dark:text-blue-300">
                  📅 مجدولة اليوم
                </span>
              )
            ) : (
              <span className="rounded-full border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 py-1 text-[10px] font-black text-slate-600 dark:text-slate-400">
                ☕ غير مجدولة اليوم
              </span>
            )}
          </div>

          <p className="mt-1.5 text-sm text-[var(--text-muted)]">
            المرحلة: <strong className="text-[var(--text-main)]">{halaqa.stageName}</strong> — الشيخ: <strong className="text-[var(--text-main)]">{halaqa.teacher?.displayName ?? "لا يوجد شيخ معيّن"}</strong>
          </p>

          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            أيام الحلقة: <strong className="text-[var(--primary)]">{formattedWeekdays}</strong>
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
        <Info label="المتبقي" value={`${halaqa.remainingStudents} طالب`} danger={halaqa.remainingStudents > 0 && halaqa.isScheduledToday} />
        <Info label="تحديث الخادم" value={formatDateTime(halaqa.session?.updatedAt ?? null)} />
      </dl>

      {/* Last Synced Session Info */}
      {halaqa.lastSyncedSession ? (
        <div className="mt-3 rounded-2xl bg-[var(--card-soft)] p-2.5 text-xs font-bold text-[var(--text-main)] flex flex-wrap justify-between items-center border border-[var(--border-color)]">
          <span>آخر يوم تم تسجيله ووصل للسيرفر: <strong className="text-[var(--primary)]">{halaqa.lastSyncedSession.sessionDate}</strong></span>
          <span className="text-[var(--text-muted)]">وقت المزامنة: {formatDateTime(halaqa.lastSyncedSession.updatedAt)}</span>
        </div>
      ) : (
        <div className="mt-3 rounded-2xl bg-[var(--card-soft)] p-2.5 text-xs font-bold text-[var(--text-muted)] border border-[var(--border-color)]">
          لم يتم تسجيل أي جلسة لهذه الحلقة على الخادم بعد.
        </div>
      )}

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
