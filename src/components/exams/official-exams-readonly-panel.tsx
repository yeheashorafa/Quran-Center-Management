import type { OfficialExamListItem } from "@/lib/official-exams/types";

export function OfficialExamsReadonlyPanel({
  title,
  description,
  exams,
}: {
  title: string;
  description: string;
  exams: OfficialExamListItem[];
}) {
  return (
    <section className="mt-6 rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 shadow-sm sm:p-5 text-[var(--text-main)] transition-colors duration-200" dir="rtl">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-[var(--gold)]">الاختبارات الرسمية</p>
          <h2 className="mt-1 text-xl font-black text-[var(--text-main)]">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{description}</p>
        </div>
        <span className="rounded-full bg-[var(--card-soft)] border border-[var(--border-color)] px-3 py-1 text-xs font-black text-[var(--primary)]">{exams.length}</span>
      </div>

      <div className="mt-4 space-y-2">
        {exams.length ? (
          exams.map((exam) => (
            <article key={exam.id} className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-soft)] p-3 sm:p-4 text-[var(--text-main)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-[var(--text-main)]">{exam.student.displayName}</h3>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {exam.enrollment?.stageName ?? "—"} — {exam.enrollment?.halaqaName ?? "—"} — {exam.examDate}
                  </p>
                  <p className="mt-2 text-sm font-bold text-[var(--text-main)]">
                    {exam.scopes.map((scope) => scope.label).join("، ") || "بدون نطاق"}
                  </p>
                </div>
                <div className="shrink-0 text-center">
                  <div className="text-2xl font-black text-[var(--primary)]">{exam.score ?? "—"}</div>
                  <div className="text-[11px] font-black text-[var(--text-muted)]">{exam.resultLabel ?? "—"}</div>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--card-bg)] p-6 text-center text-sm font-bold text-[var(--text-muted)]">
            لا توجد اختبارات رسمية حتى الآن.
          </div>
        )}
      </div>
    </section>
  );
}
