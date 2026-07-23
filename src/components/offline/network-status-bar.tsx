"use client";

import { useCallback, useEffect, useState } from "react";
import { getPendingSyncCount, processSyncQueue } from "@/lib/offline/sync-queue";

export function NetworkStatusBar({
  onSyncCompleted,
}: {
  onSyncCompleted?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "synced" | "failed">("idle");
  const [pendingCount, setPendingCount] = useState<number>(0);

  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingSyncCount();
    setPendingCount(count);
    return count;
  }, []);

  const triggerSync = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    setSyncStatus("syncing");
    const res = await processSyncQueue((status, count) => {
      setSyncStatus(status);
      setPendingCount(count);
    });

    if (res.success > 0 && onSyncCompleted) {
      onSyncCompleted();
    }
  }, [onSyncCompleted]);

  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (!active) return;
      setMounted(true);
      if (typeof navigator !== "undefined") {
        setIsOnline(navigator.onLine);
      }
    });

    async function initStatus() {
      const count = await getPendingSyncCount();
      if (active) setPendingCount(count);
    }

    queueMicrotask(() => {
      void initStatus();
    });

    function handleOnline() {
      setIsOnline(true);
      void triggerSync();
    }

    function handleOffline() {
      setIsOnline(false);
      void refreshPendingCount();
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const interval = setInterval(() => {
      void refreshPendingCount();
    }, 4000);

    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [refreshPendingCount, triggerSync]);

  if (!mounted) {
    return (
      <aside
        aria-label="حالة الاتصال والمزامنة"
        className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-3 shadow-xs transition mb-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-bold">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--card-soft)] px-3 py-1.5 text-[var(--text-muted)]">
              <span className="size-2.5 rounded-full bg-[var(--border-color)]" />
              <span>جاري فحص حالة الاتصال...</span>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-label="حالة الاتصال والمزامنة"
      className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-3 shadow-xs transition mb-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-bold">
        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          {!isOnline ? (
            <div className="flex items-center gap-2 rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-1.5 text-[var(--status-warning-text)]">
              <span className="size-2.5 rounded-full bg-[var(--gold)] animate-pulse" />
              <span> غير متصل — يتم حفظ التغييرات محلياً</span>
            </div>
          ) : syncStatus === "syncing" ? (
            <div className="flex items-center gap-2 rounded-xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-3 py-1.5 text-[var(--status-info-text)]">
              <span className="size-2.5 rounded-full bg-blue-600 animate-spin" />
              <span> جاري مزامنة البيانات مع الخادم...</span>
            </div>
          ) : syncStatus === "failed" ? (
            <div className="flex items-center gap-2 rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-1.5 text-[var(--status-danger-text)]">
              <span className="size-2.5 rounded-full bg-red-600" />
              <span> تعذر مزامنة بعض البيانات</span>
            </div>
          ) : syncStatus === "synced" && pendingCount === 0 ? (
            <div className="flex items-center gap-2 rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 py-1.5 text-[var(--status-success-text)]">
              <span className="size-2.5 rounded-full bg-[var(--primary)]" />
              <span> متصل وتمت المزامنة بنجاح</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 py-1.5 text-[var(--status-success-text)]">
              <span className="size-2.5 rounded-full bg-[var(--primary)]" />
              <span> متصل بالإنترنت</span>
            </div>
          )}

          {pendingCount > 0 ? (
            <span className="rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-1.5 font-black text-[var(--status-warning-text)]">
              {pendingCount} {pendingCount === 1 ? "عملية" : "عمليات"} بانتظار المزامنة
            </span>
          ) : null}
        </div>

        {/* Sync Now Button */}
        {pendingCount > 0 || !isOnline || syncStatus === "failed" ? (
          <button
            type="button"
            disabled={!isOnline || syncStatus === "syncing"}
            onClick={() => void triggerSync()}
            className="rounded-xl bg-[var(--primary)] px-4 py-1.5 text-xs font-black text-white shadow-xs transition hover:bg-[var(--primary-dark)] disabled:opacity-50"
          >
            {syncStatus === "syncing" ? "جاري الرفع..." : "🔄 مزامنة الآن"}
          </button>
        ) : null}
      </div>
    </aside>
  );
}
