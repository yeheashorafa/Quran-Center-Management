"use client";

import Link from "next/link";
import { BrandMark } from "@/components/shared/brand-mark";

export function OfflineFallback({
  title = "هذه الصفحة تتطلب اتصالاً بالإنترنت",
  description = "لوحة التحكم الحالية غير متاحة بدون إنترنت. تتاح خدمة العمل بدون إنترنت حصرياً لشاشتي التسميع اليومية والاختبارات الرسمية.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center" dir="rtl">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-8 shadow-xl text-[var(--text-main)] transition-colors duration-200">
        <div className="flex justify-center">
          <BrandMark />
        </div>

        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-3xl">
          📡
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-black text-[var(--text-main)]">{title}</h2>
          <p className="text-xs font-bold leading-relaxed text-[var(--text-muted)]">
            {description}
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2">
          <Link
            href="/teacher"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[var(--primary)] px-6 text-sm font-black text-white shadow-lg transition hover:bg-[var(--primary-dark)]"
          >
            📖 الانتقال إلى شاشة التسميع (Offline Mode)
          </Link>
          <Link
            href="/examiner"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--card-soft)] px-6 text-sm font-black text-[var(--text-main)] shadow-sm transition hover:border-[var(--primary)]"
          >
            📝 الانتقال إلى شاشة الاختبارات (Offline Mode)
          </Link>
        </div>
      </div>
    </div>
  );
}
