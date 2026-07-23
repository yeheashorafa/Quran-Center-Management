"use client";

import { useCallback, useState } from "react";
import { processSyncQueue, type SyncQueueItem } from "@/lib/offline/sync-queue";

export function PendingSessionsList({
  items,
  onRefresh,
}: {
  items: SyncQueueItem[];
  onRefresh?: () => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleManualSync = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setNotice("⚠️ أنت غير متصل بالإنترنت حالياً. يرجى الاتصال بالإنترنت أولاً للمزامنة.");
      return;
    }

    setSyncing(true);
    setNotice(null);

    const res = await processSyncQueue();
    setSyncing(false);
    onRefresh?.();

    if (res.success > 0) {
      setNotice(`✅ تم بنجاح مزامنة ${res.success} عملية مع الخادم.`);
    } else if (res.failed > 0) {
      setNotice(`⚠️ تعذر مزامنة ${res.failed} عملية. راجع أسباب الفشل أدناه.`);
    } else {
      setNotice("لا توجد عمليات معلقة للمزامنة.");
    }
  }, [onRefresh]);

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-5 shadow-sm space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--status-warning-border)] pb-3">
        <div>
          <h3 className="text-base font-black text-[var(--status-warning-text)] flex items-center gap-2">
            <span>⏳ جلسات بانتظار المزامنة ({items.length})</span>
          </h3>
          <p className="mt-0.5 text-xs font-bold text-[var(--text-muted)]">
            تم حفظ هذه الجلسات والعمليات محلياً على هذا الجهاز لعدم وجود إنترنت.
          </p>
        </div>

        <button
          type="button"
          disabled={syncing || (typeof navigator !== "undefined" && !navigator.onLine)}
          onClick={() => void handleManualSync()}
          className="rounded-2xl bg-[var(--primary)] px-5 py-2 text-xs font-black text-white shadow-sm transition hover:bg-[var(--primary-dark)] disabled:opacity-50"
        >
          {syncing ? "جاري المزامنة..." : "🔄 مزامنة الآن"}
        </button>
      </div>

      {notice ? (
        <div className="rounded-2xl bg-[var(--card-bg)] p-3 text-xs font-black text-[var(--text-main)] border border-[var(--border-color)]">
          {notice}
        </div>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => {
          const studentCount =
          "items" in item.payload && Array.isArray(item.payload.items)
            ? item.payload.items.length
            : 1;
          const opLabel = item.type === "save_session" ? "اعتماد جلسة كاملة" : "حفظ طالب";
          const formattedDate = new Date(item.createdAt).toLocaleTimeString("ar-EG", {
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <div
              key={item.queueId}
              className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 shadow-2xs space-y-2 text-[var(--text-main)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-[var(--card-soft)] text-sm font-black text-[var(--primary)]">
                    {item.type === "save_session" ? "📋" : "👤"}
                  </span>
                  <div>
                    <h4 className="text-sm font-black text-[var(--text-main)]">
                      جلسة تاريخ: <span className="text-[var(--primary)]">{item.sessionDate}</span>
                    </h4>
                    <p className="text-xs font-bold text-[var(--text-muted)]">
                      نوع العملية: <span className="text-[var(--text-main)]">{opLabel}</span> | عدد الطلاب:{" "}
                      <span className="text-[var(--text-main)]">{studentCount} طالب</span> | الوصل: {formattedDate}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {item.status === "pending" ? (
                    <span className="rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-1 text-xs font-extrabold text-[var(--status-warning-text)]">
                      🟠 بانتظار المزامنة
                    </span>
                  ) : item.status === "syncing" ? (
                    <span className="rounded-xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-3 py-1 text-xs font-extrabold text-[var(--status-info-text)]">
                      🔵 جاري المزامنة...
                    </span>
                  ) : item.status === "conflict" ? (
                    <span className="rounded-xl border border-purple-300 bg-purple-100 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-300 px-3 py-1 text-xs font-extrabold text-purple-900">
                      ⚠️ تعارض في البيانات (409)
                    </span>
                  ) : item.status === "failed" ? (
                    <span className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-1 text-xs font-extrabold text-[var(--status-danger-text)]">
                      🔴 فشلت المزامنة
                    </span>
                  ) : (
                    <span className="rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 py-1 text-xs font-extrabold text-[var(--status-success-text)]">
                      ✅ تمت المزامنة
                    </span>
                  )}
                </div>
              </div>

              {/* Error Reason Display if failed or conflict */}
              {item.errorMessage ? (
                <div className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-2.5 text-xs font-bold text-[var(--status-danger-text)]">
                  <span className="font-black">سبب عدم الإكمال:</span> {item.errorMessage}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
