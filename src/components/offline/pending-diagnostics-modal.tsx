"use client";

import { useState } from "react";
import { idbPut, STORES } from "@/lib/offline/indexed-db";
import {
  deleteSyncItem,
  exportOfflineBackupData,
  downloadBackupJsonFile,
  fixLegacySyncItems,
  type SyncQueueItem,
  type SessionSyncPayload,
  type StudentCreateSyncPayload,
  type OfficialExamSyncPayload,
} from "@/lib/offline/sync-queue";

export function PendingDiagnosticsModal({
  items,
  onClose,
  onRefresh,
}: {
  items: SyncQueueItem[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [busyQueueId, setBusyQueueId] = useState<string | null>(null);
  const [isFixing, setIsFixing] = useState(false);

  const handleExportBackup = async () => {
    try {
      const backup = await exportOfflineBackupData();
      downloadBackupJsonFile(backup);
      setNotice({
        type: "success",
        text: "تمت طباعة وتنزيل النسخة الاحتياطية (JSON) بنجاح على جهازك.",
      });
    } catch {
      setNotice({ type: "error", text: "تعذر إنشاء النسخة الاحتياطية." });
    }
  };

  const handleFixLegacy = async () => {
    if (
      !confirm(
        "سيقوم هذا بتشخيص ودمج العمليات المكررة، وحفظ أحدث البيانات. يُفضل تصدير نسخة احتياطية أولاً. هل تريد المتابعة؟",
      )
    ) {
      return;
    }

    setIsFixing(true);
    setNotice(null);
    try {
      const result = await fixLegacySyncItems();
      onRefresh();
      setNotice({
        type: "success",
        text: `تم فحص وإصلاح العمليات بنجاح!\n• العدد السابق: ${result.totalBefore}\n• دُمج مكرر: ${result.mergedCount}\n• تعارضات محددة: ${result.conflictCount}\n• المتبقي حالياً: ${result.totalAfter}`,
      });
    } catch {
      setNotice({ type: "error", text: "حدث خطأ أثناء إصلاح العمليات القديمة." });
    } finally {
      setIsFixing(false);
    }
  };

  const handleRetryItem = async (item: SyncQueueItem) => {
    setBusyQueueId(item.queueId);
    try {
      item.status = "pending";
      item.errorMessage = null;
      item.updatedAt = Date.now();
      await idbPut(STORES.SYNC_QUEUE, item);
      onRefresh();
      setNotice({ type: "success", text: "تمت إعادة العملية إلى حالة الانتظار للمزامنة." });
    } catch {
      setNotice({ type: "error", text: "تعذر إتاحة العملية للإعادة." });
    } finally {
      setBusyQueueId(null);
    }
  };

  const handleDeleteItem = async (queueId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه العملية المعلقة؟ لن يتم رفع بياناتها للسيرفر.")) {
      return;
    }
    setBusyQueueId(queueId);
    try {
      await deleteSyncItem(queueId);
      onRefresh();
      setNotice({ type: "success", text: "تم حذف العملية بنجاح." });
    } catch {
      setNotice({ type: "error", text: "تعذر حذف العملية." });
    } finally {
      setBusyQueueId(null);
    }
  };

  const handleExportSingleJson = (item: SyncQueueItem) => {
    const jsonStr = JSON.stringify(item, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `operation_diagnostic_${item.queueId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      dir="rtl"
    >
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6 shadow-2xl space-y-4 text-[var(--text-main)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4 shrink-0">
          <div>
            <h3 className="text-xl font-black text-[var(--text-main)] flex items-center gap-2">
              <span>🔍 فحص وتدقيق العمليات المعلقة ({items.length})</span>
            </h3>
            <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">
              استعراض تفاصيل البيانات المحفوظة محلياً، تشخيص أسباب التعارض، وتأمين نسخ احتياطية قبل أي تعديل.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[var(--card-soft)] p-2 text-xs font-black text-[var(--text-muted)] hover:text-[var(--text-main)]"
          >
            ✕
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--card-soft)] p-3 border border-[var(--border-color)] shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleExportBackup()}
              className="rounded-xl bg-emerald-700 dark:bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-xs hover:bg-emerald-800"
            >
              📥 تصدير نسخة احتياطية من العمليات (JSON Backup)
            </button>
            <button
              type="button"
              disabled={isFixing}
              onClick={() => void handleFixLegacy()}
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs font-black text-amber-800 dark:text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
            >
              {isFixing ? "جاري الإصلاح..." : "🛠️ إصلاح العمليات القديمة (دمج التكرارات)"}
            </button>
          </div>
          <span className="text-[11px] font-bold text-[var(--text-muted)]">
            ملاحظة: زر الإصلاح يدمج التكرارات بأمان دون حذف بيانات حقيقية.
          </span>
        </div>

        {/* Notice Banner */}
        {notice ? (
          <div
            className={`rounded-2xl border p-3 text-xs font-black shrink-0 ${
              notice.type === "success"
                ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
                : notice.type === "error"
                  ? "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
                  : "border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-text)]"
            }`}
          >
            <pre className="whitespace-pre-wrap font-sans">{notice.text}</pre>
          </div>
        ) : null}

        {/* Items List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
          {items.map((item, index) => {
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

            const formattedDate = new Date(item.createdAt).toLocaleString("ar-EG", {
              hour: "2-digit",
              minute: "2-digit",
              year: "numeric",
              month: "numeric",
              day: "numeric",
            });

            let studentIdsStr = "";
            let hasTempStudent = false;

            if (item.type === "save_session" || item.type === "save_student") {
              const sPayload = item.payload as SessionSyncPayload;
              studentIdsStr = sPayload.items?.map((i) => i.studentId).join(", ") || "";
              hasTempStudent = sPayload.items?.some((i) => i.studentId.startsWith("temp_student_")) || false;
            } else if (item.type === "create_student") {
              const p = item.payload as StudentCreateSyncPayload;
              studentIdsStr = p.tempStudentId;
              hasTempStudent = true;
            } else if (item.type === "save_official_exam") {
              const p = item.payload as OfficialExamSyncPayload;
              studentIdsStr = p.studentId;
              hasTempStudent = p.studentId.startsWith("temp_student_");
            }

            return (
              <article
                key={item.queueId}
                className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-soft)] p-4 shadow-2xs space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-color)] pb-3">
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 items-center justify-center rounded-2xl bg-[var(--card-bg)] text-base font-black text-[var(--primary)] border border-[var(--border-color)]">
                      {icon}
                    </span>
                    <div>
                      <h4 className="text-sm font-black text-[var(--text-main)] flex items-center gap-2">
                        <span>#{(index + 1).toString().padStart(2, "0")} — {opLabel}</span>
                        {hasTempStudent ? (
                          <span className="rounded-xl border border-amber-300 bg-amber-100 dark:bg-amber-950 dark:border-amber-700 px-2 py-0.5 text-[10px] font-black text-amber-900 dark:text-amber-300">
                            ⚠️ طالب مؤقت
                          </span>
                        ) : null}
                      </h4>
                      <p className="text-xs font-bold text-[var(--text-muted)] mt-0.5">
                        التاريخ: <strong className="font-black text-[var(--primary)]">{item.sessionDate || (item.payload as { examDate?: string }).examDate || "غير محدد"}</strong> | الوقت: {formattedDate}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
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
                        ⚠️ تعارض في البيانات (409/conflict)
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

                {/* Details Grid */}
                <div className="grid gap-2 sm:grid-cols-2 text-xs text-[var(--text-muted)] font-bold bg-[var(--card-bg)] p-3 rounded-xl border border-[var(--border-color)]">
                  <div>
                    <span className="opacity-80">معرف الحلقة (Halaqa ID):</span>
                    <p className="font-mono text-[11px] font-bold text-[var(--text-main)] truncate" dir="ltr">
                      {item.halaqaId || "غير محدد"}
                    </p>
                  </div>

                  <div>
                    <span className="opacity-80">عدد الطلاب / معرفات الطلاب:</span>
                    <p className="font-mono text-[11px] font-bold text-[var(--text-main)] truncate" dir="ltr">
                      {studentCount} طالب ({studentIdsStr || "لا يوجد"})
                    </p>
                  </div>

                  <div className="sm:col-span-2">
                    <span className="opacity-80">مفتاح المطابقة (Idempotency Key):</span>
                    <p className="font-mono text-[11px] font-bold text-[var(--primary)] truncate" dir="ltr">
                      {item.queueId}
                    </p>
                  </div>
                </div>

                {/* Error Message Display */}
                {item.errorMessage ? (
                  <div className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-3 text-xs font-bold text-[var(--status-danger-text)] space-y-1">
                    <span className="font-black">سبب الفشل / التعارض:</span>
                    <p className="opacity-95 leading-relaxed">{item.errorMessage}</p>
                  </div>
                ) : null}

                {/* Item Actions */}
                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleExportSingleJson(item)}
                    className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] px-3 py-1.5 text-xs font-black text-[var(--text-main)] hover:bg-[var(--card-soft)]"
                  >
                    📄 تصدير تشخيص JSON
                  </button>

                  <button
                    type="button"
                    disabled={busyQueueId === item.queueId}
                    onClick={() => void handleRetryItem(item)}
                    className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-black text-amber-800 dark:text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
                  >
                    🔁 إعادة محاولة المزامنة
                  </button>

                  <button
                    type="button"
                    disabled={busyQueueId === item.queueId}
                    onClick={() => void handleDeleteItem(item.queueId)}
                    className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-1.5 text-xs font-black text-[var(--status-danger-text)] hover:opacity-80 disabled:opacity-50"
                  >
                    🗑️ حذف العملية
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-[var(--border-color)] pt-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-soft)] px-6 py-2.5 text-xs font-black text-[var(--text-main)]"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
