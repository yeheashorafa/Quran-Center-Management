"use client";

import { useMemo, useState } from "react";
import type { OfficialExamListItem } from "@/lib/official-exams/types";

const EXAM_TYPE_LABELS: Record<string, string> = {
  MONTHLY_EXAM: "اختبار شهري",
  FINAL_EXAM: "اختبار نهائي",
  SARD_SESSION: "سرد رسمي",
  OTHER: "اختبار آخر",
};

export function TeacherExamsPanel({
  exams = [],
}: {
  exams: OfficialExamListItem[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExamType, setSelectedExamType] = useState("");
  const [selectedResult, setSelectedResult] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesName = exam.student.displayName.toLowerCase().includes(query);
        if (!matchesName) return false;
      }

      if (selectedExamType && exam.examType !== selectedExamType) return false;
      if (selectedResult && !exam.resultLabel?.includes(selectedResult)) return false;
      if (dateFrom && exam.examDate < dateFrom) return false;
      if (dateTo && exam.examDate > dateTo) return false;

      return true;
    });
  }, [exams, searchQuery, selectedExamType, selectedResult, dateFrom, dateTo]);

  return (
    <div className="space-y-5" dir="rtl">
      <section className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 shadow-sm sm:p-5 text-[var(--text-main)] transition-colors duration-200">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-xs font-bold text-[var(--gold)]">اختبارات حلتك</span>
            <h2 className="text-xl font-black text-[var(--text-main)]">سجل اختبارات طلابك</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              عرض نتائج وسجلات الاختبارات والسرد الرسمي الخاصة بطلاب حلقة المحفظ فقط.
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--card-soft)] border border-[var(--border-color)] px-4 py-2 text-xs font-black text-[var(--primary)]">
            {filteredExams.length} اختبار
          </div>
        </div>

        {/* Filters */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="form-label" htmlFor="teacher-exam-search">
              البحث باسم الطالب
            </label>
            <input
              id="teacher-exam-search"
              type="text"
              className="form-control font-bold"
              placeholder="اكتب اسم الطالب..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label" htmlFor="teacher-exam-type">
              نوع الاختبار
            </label>
            <select
              id="teacher-exam-type"
              className="form-control font-bold"
              value={selectedExamType}
              onChange={(e) => setSelectedExamType(e.target.value)}
            >
              <option value="">كل الأنواع</option>
              <option value="MONTHLY_EXAM">اختبار شهري</option>
              <option value="FINAL_EXAM">اختبار نهائي</option>
              <option value="SARD_SESSION">سرد رسمي</option>
            </select>
          </div>

          <div>
            <label className="form-label" htmlFor="teacher-exam-result">
              النتيجة
            </label>
            <select
              id="teacher-exam-result"
              className="form-control font-bold"
              value={selectedResult}
              onChange={(e) => setSelectedResult(e.target.value)}
            >
              <option value="">كل النتائج</option>
              <option value="ممتاز">ممتاز</option>
              <option value="جيد جداً">جيد جداً</option>
              <option value="جيد">جيد</option>
              <option value="لم يجتز">لم يجتز</option>
            </select>
          </div>

          <div>
            <label className="form-label" htmlFor="teacher-exam-from">
              من تاريخ
            </label>
            <input
              id="teacher-exam-from"
              type="date"
              className="form-control font-bold"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label" htmlFor="teacher-exam-to">
              إلى تاريخ
            </label>
            <input
              id="teacher-exam-to"
              type="date"
              className="form-control font-bold"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* List */}
      <section className="space-y-3">
        {filteredExams.length ? (
          filteredExams.map((exam) => (
            <article
              key={exam.id}
              className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 shadow-sm sm:p-5 text-[var(--text-main)] transition-colors duration-200"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black text-[var(--text-main)]">
                      {exam.student.displayName}
                    </h3>
                    <span className="rounded-full bg-[var(--card-soft)] border border-[var(--border-color)] px-3 py-0.5 text-xs font-black text-[var(--primary)]">
                      {EXAM_TYPE_LABELS[exam.examType] || exam.examType}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    تاريخ الاختبار: {exam.examDate}
                  </p>
                </div>

                <div className="text-left">
                  <div className="text-2xl font-black text-[var(--primary)]">
                    {exam.score !== null ? `${exam.score} / 100` : "—"}
                  </div>
                  <div className="text-xs font-bold text-[var(--gold)]">
                    {exam.resultLabel ?? "بدون نتيجة"}
                  </div>
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Info label="نطاق الجزء" value={exam.scopes.map((s) => s.label).join(", ") || "—"} />
                <Info label="المختبر" value={exam.examiner?.displayName ?? "—"} />
                <Info label="الحالة" value={exam.status === "ACTIVE" ? "اعتمد" : "ملغى"} />
              </dl>

              {exam.notes ? (
                <div className="mt-3 rounded-2xl bg-[var(--card-soft)] border border-[var(--border-color)] p-3 text-xs text-[var(--text-muted)]">
                  <strong className="text-[var(--text-main)]">ملاحظات: </strong>
                  {exam.notes}
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <div className="rounded-3xl border border-dashed border-[var(--border-color)] bg-[var(--card-bg)] p-8 text-center text-sm font-bold text-[var(--text-muted)]">
            لا تتوفر نتائج اختبارات لطلاب حلتك تطابق الفلاتر المحددة.
          </div>
        )}
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--card-soft)] p-3 border border-[var(--border-color)]">
      <dt className="text-[11px] font-extrabold text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-1 text-xs font-black text-[var(--text-main)]">{value}</dd>
    </div>
  );
}
