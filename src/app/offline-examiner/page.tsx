"use client";

import { useEffect, useState } from "react";
import { ExaminerExamsPanel } from "@/components/exams/examiner-exams-panel";
import { getOfflineExaminerProfile, type OfflineExaminerProfile } from "@/lib/offline/offline-profile";
import { getExaminerDataCache, type ExaminerCacheRecord } from "@/lib/offline/examiner-cache";
import { todayInPalestine } from "@/lib/memorization-sessions/date";

export default function OfflineExaminerPage() {
  const [profile, setProfile] = useState<OfflineExaminerProfile | null>(null);
  const [cache, setCache] = useState<ExaminerCacheRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const p = await getOfflineExaminerProfile();
        setProfile(p);
        const c = await getExaminerDataCache(p?.examinerId || "examiner");
        setCache(c);
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--bg-app)] text-[var(--text-main)] p-4" dir="rtl">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
          <p className="text-sm font-bold text-[var(--text-muted)]">جاري تحميل بيانات المختبر المحفوظة محلياً...</p>
        </div>
      </div>
    );
  }

  if (!cache || !cache.options) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--bg-app)] text-[var(--text-main)] p-4" dir="rtl">
        <div className="max-w-md w-full rounded-3xl border border-[var(--status-danger-border)] bg-[var(--card-bg)] p-6 text-center space-y-4 shadow-xl">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-lg font-black text-[var(--status-danger-text)]">لا توجد بيانات مسجلة أوفلاين لهذا المختبر</h1>
          <p className="text-xs font-bold leading-relaxed text-[var(--text-muted)]">
            لم يتم العثور على ذاكرة مؤقتة محفوظة لحساب المختبر ({profile?.examinerName || "المختبر"}). الرجاء الاتصال بالإنترنت وفتح لوحة المختبر مرة واحدة أولاً لتخزين نماذج الطلاب والاختبارات.
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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4" dir="rtl">
      <div className="flex items-center justify-between rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-3 text-xs font-bold text-[var(--status-warning-text)] shadow-xs">
        <span className="flex items-center gap-2 font-black">
          <span>📝</span>
          <span>وضع المختبر (أوفلاين — الاختبارات الرسمية) | {profile?.examinerName || "المختبر"}</span>
        </span>
        <a href="/offline-shell.html" className="underline hover:opacity-80 text-xs font-black">
          تغيير الحساب
        </a>
      </div>
      <ExaminerExamsPanel
        options={cache.options}
        initialExams={cache.exams || []}
        initialDate={todayInPalestine()}
      />
    </div>
  );
}
