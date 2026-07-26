"use client";

import { useMemo, useState } from "react";
import type { OfficialExamListItem } from "@/lib/official-exams/types";
import type { ManagerStageOption } from "@/lib/manager/types";
import type { StudentHalaqaOption } from "@/lib/students/types";

const EXAM_TYPE_LABELS: Record<string, string> = {
  MONTHLY_EXAM: "اختبار شهري",
  FINAL_EXAM: "اختبار نهائي",
  SARD_SESSION: "سرد رسمي",
  OTHER: "اختبار آخر",
};

export function ManagerExamsPanel({
  initialExams = [],
  stages = [],
  halaqat = [],
}: {
  initialExams: OfficialExamListItem[];
  stages?: ManagerStageOption[];
  halaqat?: StudentHalaqaOption[];
}) {
  const [exams] = useState<OfficialExamListItem[]>(initialExams);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStageId, setSelectedStageId] = useState("");
  const [selectedHalaqaId, setSelectedHalaqaId] = useState("");
  const [selectedExamType, setSelectedExamType] = useState("");
  const [selectedResult, setSelectedResult] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filteredHalaqat = useMemo(() => {
    if (!selectedStageId) return halaqat;
    const stageName = stages.find((s) => s.id === selectedStageId)?.nameAr;
    return halaqat.filter((h) => h.stageName === stageName);
  }, [halaqat, selectedStageId, stages]);

  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesName = exam.student.displayName.toLowerCase().includes(query);
        if (!matchesName) return false;
      }

      if (selectedStageId) {
        const stageName = stages.find((s) => s.id === selectedStageId)?.nameAr;
        if (exam.enrollment?.stageName !== stageName && exam.enrollment?.stageId !== selectedStageId) {
          return false;
        }
      }

      if (selectedHalaqaId) {
        if (exam.enrollment?.halaqaId !== selectedHalaqaId) return false;
      }

      if (selectedExamType) {
        if (exam.examType !== selectedExamType) return false;
      }

      if (selectedResult) {
        if (!exam.resultLabel?.includes(selectedResult)) return false;
      }

      if (dateFrom && exam.examDate < dateFrom) return false;
      if (dateTo && exam.examDate > dateTo) return false;

      return true;
    });
  }, [exams, searchQuery, selectedStageId, selectedHalaqaId, selectedExamType, selectedResult, dateFrom, dateTo, stages]);

  return (
    <div className="space-y-5" dir="rtl">
      <section className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 shadow-sm sm:p-5 text-[var(--text-main)] transition-colors duration-200">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-xs font-bold text-[var(--gold)]">السجل الرسمي</span>
            <h2 className="text-xl font-black text-[var(--text-main)]">سجل اختبارات الطلاب</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              عرض والبحث في نتائج الاختبارات والسرد الرسمي لجميع الطلاب في المركز.
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--card-soft)] border border-[var(--border-color)] px-4 py-2 text-xs font-black text-[var(--primary)]">
            إجمالي المسجّل: {filteredExams.length} اختبار
          </div>
        </div>

        {/* Filters Grid */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Search by student name */}
          <div>
            <label className="form-label" htmlFor="exam-search-student">
              البحث باسم الطالب
            </label>
            <input
              id="exam-search-student"
              className="form-control font-bold"
              type="text"
              placeholder="اكتب اسم الطالب..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Stage */}
          <div>
            <label className="form-label" htmlFor="exam-filter-stage">
              المرحلة
            </label>
            <select
              id="exam-filter-stage"
              className="form-control font-bold"
              value={selectedStageId}
              onChange={(e) => {
                setSelectedStageId(e.target.value);
                setSelectedHalaqaId("");
              }}
            >
              <option value="">كل المراحل</option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.nameAr}
                </option>
              ))}
            </select>
          </div>

          {/* Halaqa / Sheikh */}
          <div>
            <label className="form-label" htmlFor="exam-filter-halaqa">
              الحلقة / الشيخ
            </label>
            <select
              id="exam-filter-halaqa"
              className="form-control font-bold"
              value={selectedHalaqaId}
              onChange={(e) => setSelectedHalaqaId(e.target.value)}
            >
              <option value="">كل الحلقات</option>
              {filteredHalaqat.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.nameAr}{h.teacherName ? ` — ${h.teacherName}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Exam Type */}
          <div>
            <label className="form-label" htmlFor="exam-filter-type">
              نوع الاختبار
            </label>
            <select
              id="exam-filter-type"
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

          {/* Result Filter */}
          <div>
            <label className="form-label" htmlFor="exam-filter-result">
              النتيجة
            </label>
            <select
              id="exam-filter-result"
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

          {/* Date From */}
          <div>
            <label className="form-label" htmlFor="exam-filter-from">
              من تاريخ
            </label>
            <input
              id="exam-filter-from"
              type="date"
              className="form-control font-bold"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          {/* Date To */}
          <div>
            <label className="form-label" htmlFor="exam-filter-to">
              إلى تاريخ
            </label>
            <input
              id="exam-filter-to"
              type="date"
              className="form-control font-bold"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          {/* Reset Filters */}
          <div className="flex items-end">
            <button
              type="button"
              className="min-h-11 w-full rounded-2xl border border-[var(--border-color)] bg-[var(--card-soft)] text-xs font-black text-[var(--text-muted)] transition hover:text-[var(--text-main)]"
              onClick={() => {
                setSearchQuery("");
                setSelectedStageId("");
                setSelectedHalaqaId("");
                setSelectedExamType("");
                setSelectedResult("");
                setDateFrom("");
                setDateTo("");
              }}
            >
              إعادة ضبط الفلاتر
            </button>
          </div>
        </div>
      </section>

      {/* Exam Cards Grid */}
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
                    المرحلة: {exam.enrollment?.stageName ?? "—"} | الحلقة: {exam.enrollment?.halaqaName ?? "—"}
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

              <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Info label="تاريخ الاختبار" value={exam.examDate} />
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
            لا تتوفر اختبارات تنطبق عليها خيارات البحث والفلاتر الحالية.
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
