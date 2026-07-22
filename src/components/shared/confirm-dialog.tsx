"use client";

import { useEffect } from "react";

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmText = "تأكيد الإجراء",
  cancelText = "إلغاء",
  variant = "danger",
  loading = false,
  onConfirm,
  onClose,
}: {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen && !loading) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500",
    warning: "bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500",
    info: "bg-emerald-900 hover:bg-emerald-950 text-white focus:ring-emerald-500",
  }[variant];

  return (
    <div
      aria-modal="true"
      role="dialog"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl transition-all sm:p-7">
        <div className="flex items-start gap-4">
          <div
            className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${
              variant === "danger"
                ? "bg-red-100 text-red-700"
                : variant === "warning"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-900"
            }`}
          >
            <span className="text-xl">{variant === "danger" ? "⚠️" : variant === "warning" ? "🔒" : "ℹ️"}</span>
          </div>
          <div>
            <h3 id="confirm-dialog-title" className="text-lg font-black text-slate-900">
              {title}
            </h3>
            <p id="confirm-dialog-description" className="mt-2 text-sm leading-6 font-bold text-slate-600">
              {description}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black shadow-sm transition disabled:opacity-50 ${variantStyles}`}
          >
            {loading ? (
              <>
                <span className="inline-block size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>جاري التنفيذ...</span>
              </>
            ) : (
              <span>{confirmText}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
