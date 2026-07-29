"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearAllSyncItems,
  clearFailedSyncItems,
  retryFailedSyncItems,
  deleteSyncItem,
  processSyncQueue,
  type SyncQueueItem,
} from "@/lib/offline/sync-queue";

export function PendingSessionsList({
  items,
  onRefresh,
}: {
  items: SyncQueueItem[];
  onRefresh?: () => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setIsOffline(typeof navigator !== "undefined" && !navigator.onLine);
    });
    function handleOnline() {
      if (active) setIsOffline(false);
    }
    function handleOffline() {
      if (active) setIsOffline(true);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

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

    if (res.message) {
      setNotice(`⚠️ ${res.message}`);
    } else if (res.success > 0) {
      setNotice(`✅ تم بنجاح مزامنة ${res.success} عملية مع الخادم.`);
    } else if (res.failed > 0) {
      setNotice(`⚠️ تعذر مزامنة ${res.failed} عملية. راجع أسباب الفشل أدناه.`);
    } else {
      setNotice("لا توجد عمليات معلقة للمزامنة.");
    }
  }, [onRefresh]);

  async function handleDeleteSingle(queueId: string) {
    if (confirm("هل أنت متأكد من حذف هذه العملية المعلقة؟ لن يتم رفع بياناتها للسيرفر.")) {
      await deleteSyncItem(queueId);
      onRefresh?.();
    }
  }

  async function handleClearFailed() {
    await clearFailedSyncItems();
    setShowClearModal(false);
    onRefresh?.();
  }

  async function handleRetryFailed() {
    await retryFailedSyncItems();
    onRefresh?.();
    void handleManualSync();
  }

  async function handleClearAll() {
    await clearAllSyncItems();
    setShowClearModal(false);
    onRefresh?.();
  }

  if (items.length === 0) {
    return null;
  }

  const hasFailedOrConflict = items.some((i) => i.status === "failed" || i.status === "conflict");

  return (
    <section
      className="rounded-3xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-5 shadow-sm space-y-4"
      dir="rtl"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--status-warning-border)] pb-3">
        <div>
          <h3 className="text-base font-black text-[var(--status-warning-text)] flex items-center gap-2">
            <span>⏳ عمليات بانتظار المزامنة ({items.length})</span>
          </h3>
          <p className="mt-0.5 text-xs font-bold text-[var(--text-muted)]">
            تم حفظ هذه الجلسات والعمليات محلياً على هذا الجهاز لعدم وجود إنترنت.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={syncing || isOffline}
            onClick={() => void handleManualSync()}
            className="rounded-2xl bg-[var(--primary)] px-5 py-2 text-xs font-black text-white shadow-sm transition hover:bg-[var(--primary-dark)] disabled:opacity-50"
          >
            {syncing ? "جاري المزامنة..." : "🔄 مزامنة الآن"}
          </button>

          {hasFailedOrConflict ? (
            <button
              type="button"
              disabled={syncing || isOffline}
              onClick={() => void handleRetryFailed()}
              className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-black text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
            >
              🔁 إعادة المحاولة
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setShowClearModal(true)}
            className="rounded-2xl border border-[var(--status-danger-border)] bg-[var(--card-bg)] px-4 py-2 text-xs font-black text-[var(--status-danger-text)] transition hover:bg-[var(--status-danger-bg)]"
          >
            🗑️ مسح العمليات
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Clearing Pending Operations */}
      {showClearModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs" dir="rtl">
          <div className="w-full max-w-md rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6 shadow-2xl space-y-4 text-[var(--text-main)]">
            <div className="flex items-center gap-3 text-[var(--status-danger-text)]">
              <span className="text-3xl">⚠️</span>
              <h3 className="text-lg font-black">تحذير: مسح العمليات المعلقة</h3>
            </div>

            <p className="text-xs font-bold leading-relaxed text-[var(--text-muted)]">
              هذه العمليات لم تتم مزامنتها بعد. إذا حذفتها ستفقد البيانات المحفوظة محلياً ولن يتم رفعها للسيرفر. هل أنت متأكد؟
            </p>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => void handleClearFailed()}
                className="w-full rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs font-black text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
              >
                مسح العمليات الفاشلة فقط (Failed / Conflict)
              </button>
              <button
                type="button"
                onClick={() => void handleClearAll()}
                className="w-full rounded-2xl bg-red-600 px-4 py-2.5 text-xs font-black text-white shadow-md hover:bg-red-700"
              >
                نعم، مسح جميع العمليات المعلقة
              </button>
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="w-full rounded-2xl border border-[var(--border-color)] bg-[var(--card-soft)] px-4 py-2 text-xs font-black text-[var(--text-main)]"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
          const opLabel =
            item.type === "save_session"
              ? "اعتماد جلسة كاملة"
              : item.type === "save_official_exam"
                ? "تسجيل اختبار رسمي"
                : item.type === "create_student"
                  ? "إضافة طالب جديد"
                  : item.type === "create_user"
                    ? "إضافة مسودة مستخدم"
                    : item.type === "create_halaqa"
                      ? "إضافة مسودة حلقة"
                      : "حفظ طالب";
          const icon =
            item.type === "save_session"
              ? "📋"
              : item.type === "save_official_exam"
                ? "📝"
                : item.type === "create_user"
                  ? "👤"
                  : item.type === "create_halaqa"
                    ? "🕌"
                    : "👨‍🎓";
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
                    {icon}
                  </span>
                  <div>
                    <h4 className="text-sm font-black text-[var(--text-main)]">
                      التاريخ: <span className="text-[var(--primary)]">{item.sessionDate || (item.payload as { examDate?: string }).examDate}</span>
                    </h4>
                    <p className="text-xs font-bold text-[var(--text-muted)]">
                      نوع العملية: <span className="text-[var(--text-main)]">{opLabel}</span> | عدد الطلاب:{" "}
                      <span className="text-[var(--text-main)]">{studentCount} طالب</span> | الوقت: {formattedDate}
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

                  <button
                    type="button"
                    onClick={() => void handleDeleteSingle(item.queueId)}
                    title="حذف هذه العملية"
                    className="rounded-xl border border-[var(--border-color)] bg-[var(--card-soft)] p-1.5 text-xs text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg)]"
                  >
                    🗑️
                  </button>
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

