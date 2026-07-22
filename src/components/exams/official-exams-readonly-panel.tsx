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
    <section className="mt-6 rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-sky-700">الاختبارات الرسمية</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
        </div>
        <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-black text-sky-900">{exams.length}</span>
      </div>

      <div className="mt-4 space-y-2">
        {exams.length ? (
          exams.map((exam) => (
            <article key={exam.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-slate-950">{exam.student.displayName}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {exam.enrollment?.stageName ?? "—"} — {exam.enrollment?.halaqaName ?? "—"} — {exam.examDate}
                  </p>
                  <p className="mt-2 text-sm font-bold text-slate-700">
                    {exam.scopes.map((scope) => scope.label).join("، ") || "بدون نطاق"}
                  </p>
                </div>
                <div className="shrink-0 text-center">
                  <div className="text-2xl font-black text-sky-900">{exam.score ?? "—"}</div>
                  <div className="text-[11px] font-black text-slate-500">{exam.resultLabel ?? "—"}</div>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm font-bold text-slate-500">
            لا توجد اختبارات رسمية حتى الآن.
          </div>
        )}
      </div>
    </section>
  );
}
