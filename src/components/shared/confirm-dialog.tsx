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
    danger: "bg-[var(--status-danger-text)] hover:opacity-90 text-white focus:ring-red-500",
    warning: "bg-[var(--status-warning-text)] hover:opacity-90 text-white focus:ring-amber-500",
    info: "bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white focus:ring-emerald-500",
  }[variant];

  return (
    <div
      aria-modal="true"
      role="dialog"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-200"
      dir="rtl"
    >
      <div className="w-full max-w-md rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6 shadow-2xl transition-all sm:p-7 text-[var(--text-main)]">
        <div className="flex items-start gap-4">
          <div
            className={`flex size-12 shrink-0 items-center justify-center rounded-2xl border ${
              variant === "danger"
                ? "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
                : variant === "warning"
                  ? "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]"
                  : "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
            }`}
          >
            <span className="text-xl">{variant === "danger" ? "⚠️" : variant === "warning" ? "🔒" : "ℹ️"}</span>
          </div>
          <div>
            <h3 id="confirm-dialog-title" className="text-lg font-black text-[var(--text-main)]">
              {title}
            </h3>
            <p id="confirm-dialog-description" className="mt-2 text-sm leading-6 font-bold text-[var(--text-muted)]">
              {description}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-[var(--border-color)] pt-4">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="min-h-11 rounded-xl border border-[var(--border-color)] bg-[var(--card-soft)] px-4 text-sm font-bold text-[var(--text-main)] transition hover:border-[var(--primary)] disabled:opacity-50"
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
