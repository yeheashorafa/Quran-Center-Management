"use client";

import { useEffect, useState } from "react";
import { ManagementPanel } from "@/components/manager/management-panel";
import { clearManagerDataCache, getManagerDataCache, type ManagerCacheRecord } from "@/lib/offline/manager-cache";

export default function OfflineManagerPage() {
  const [cache, setCache] = useState<ManagerCacheRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [lastCacheTimeStr, setLastCacheTimeStr] = useState<string>("");

  useEffect(() => {
    async function loadData() {
      try {
        const c = await getManagerDataCache();
        setCache(c);
        if (c?.cachedAt) {
          const dateStr =
            new Date(c.cachedAt).toLocaleTimeString("ar-EG", {
              hour: "2-digit",
              minute: "2-digit",
            }) +
            " - " +
            new Date(c.cachedAt).toLocaleDateString("ar-EG");
          setLastCacheTimeStr(dateStr);
        }
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, []);

  async function handleConfirmClearCache() {
    await clearManagerDataCache();
    setCache(null);
    setShowClearConfirm(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--bg-app)] text-[var(--text-main)] p-4" dir="rtl">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
          <p className="text-sm font-bold text-[var(--text-muted)]">جاري تحميل بيانات المدير المحفوظة محلياً...</p>
        </div>
      </div>
    );
  }

  if (!cache || !cache.data) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--bg-app)] text-[var(--text-main)] p-4" dir="rtl">
        <div className="max-w-md w-full rounded-3xl border border-[var(--status-danger-border)] bg-[var(--card-bg)] p-6 text-center space-y-4 shadow-xl">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-lg font-black text-[var(--status-danger-text)]">لا توجد نسخة محفوظة أوفلاين لمدير المركز</h1>
          <p className="text-xs font-bold leading-relaxed text-[var(--text-muted)]">
            لم يتم العثور على بيانات مؤقتة محفوظة للوحة المدير. الرجاء الاتصال بالإنترنت وفتح لوحة المدير مرة واحدة أولاً لتخزين الإحصائيات والحلقات والطلاب للعرض أوفلاين.
          </p>
          <a
            href="/offline-shell.html"
            className="inline-block w-full rounded-2xl bg-[var(--primary)] px-5 py-3 text-xs font-black text-white shadow-md transition hover:bg-[var(--primary-dark)]"
          >
            العودة لشاشة الحسابات المحفوظة
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5" dir="rtl">
      {/* Offline Warning & Clear Cache Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-4 text-xs font-bold text-[var(--status-warning-text)] shadow-xs">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-[var(--gold)] animate-pulse" />
          <span>
            أنت تعرض آخر نسخة محفوظة بتاريخ: <strong className="font-black">{lastCacheTimeStr || "غير محدد"}</strong> (وضع القراءة فقط أوفلاين)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--card-bg)] px-3 py-1.5 text-xs font-black text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg)]"
          >
            🗑️ مسح بيانات المدير المحفوظة من هذا الجهاز
          </button>
          <a href="/offline-shell.html" className="underline hover:opacity-80 text-xs font-black">
            تغيير الحساب
          </a>
        </div>
      </div>

      {/* Confirmation Modal for Clearing Manager Cache */}
      {showClearConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs" dir="rtl">
          <div className="w-full max-w-md rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6 shadow-2xl space-y-4 text-[var(--text-main)]">
            <div className="flex items-center gap-3 text-[var(--status-danger-text)]">
              <span className="text-3xl">⚠️</span>
              <h3 className="text-lg font-black">تأكيد مسح نسخة المدير</h3>
            </div>
            <p className="text-xs font-bold leading-relaxed text-[var(--text-muted)]">
              سيتم حذف نسخة المدير المحفوظة محلياً، ولن تتمكن من عرض لوحة المدير بدون إنترنت حتى تفتحها مرة أخرى بالإنترنت. هل أنت متأكد؟
            </p>
            <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border-color)]">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-soft)] px-5 py-2.5 text-xs font-black text-[var(--text-main)]"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmClearCache()}
                className="rounded-2xl bg-red-600 px-6 py-2.5 text-xs font-black text-white shadow-md hover:bg-red-700"
              >
                نعم، مسح البيانات المحفوظة
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ManagementPanel
        data={cache.data}
        monitoringData={cache.monitoringData}
        officialExams={cache.officialExams}
        reportOptions={cache.reportOptions}
        isOffline={true}
      />
    </div>
  );
}
