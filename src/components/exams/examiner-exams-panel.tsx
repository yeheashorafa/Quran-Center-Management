"use client";

import { useMemo, useState, type FormEvent } from "react";
import type {
  OfficialExamListItem,
  OfficialExamOptionsData,
  OfficialExamType,
} from "@/lib/official-exams/types";

type Notice = { type: "success" | "error"; text: string } | null;
type ExamFormState = {
  stageId: string;
  halaqaId: string;
  studentId: string;
  examDate: string;
  examType: "INDIVIDUAL" | "COLLECTIVE";
  juzFrom: string;
  juzTo: string;
  score: string;
  notes: string;
};

type FilterState = {
  stageId: string;
  halaqaId: string;
  studentId: string;
  from: string;
  to: string;
  status: "ACTIVE" | "VOIDED" | "ALL";
};

function operationKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `exam-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function apiMessage(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => ({}))) as { message?: string };
  return payload.message || (response.ok ? "تمت العملية بنجاح." : "تعذر تنفيذ العملية.");
}

function examTypeLabel(value: OfficialExamType): string {
  if (value === "INDIVIDUAL") return "منفرد";
  if (value === "COLLECTIVE") return "مجتمع";
  return "مخصص";
}

function resultStyle(label: string | null): string {
  if (!label) return "bg-slate-100 text-slate-700";
  if (label === "امتياز") return "bg-emerald-100 text-emerald-900";
  if (label === "ممتاز") return "bg-sky-100 text-sky-900";
  if (label === "جيد جداً") return "bg-amber-100 text-amber-900";
  return "bg-red-100 text-red-800";
}

export function ExaminerExamsPanel({
  options,
  initialExams,
  initialDate,
}: {
  options: OfficialExamOptionsData;
  initialExams: OfficialExamListItem[];
  initialDate: string;
}) {
  const firstStage = options.stages[0];
  const firstHalaqa = firstStage?.halaqat[0];
  const firstStudent = firstHalaqa?.students[0];

  const [form, setForm] = useState<ExamFormState>({
    stageId: firstStage?.id ?? "",
    halaqaId: firstHalaqa?.id ?? "",
    studentId: firstStudent?.id ?? "",
    examDate: initialDate,
    examType: "COLLECTIVE",
    juzFrom: "1",
    juzTo: "1",
    score: "",
    notes: "",
  });
  const [filters, setFilters] = useState<FilterState>({
    stageId: "",
    halaqaId: "",
    studentId: "",
    from: "",
    to: "",
    status: "ALL",
  });
  const [exams, setExams] = useState(initialExams);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [createKey, setCreateKey] = useState(operationKey);
  const [editing, setEditing] = useState<OfficialExamListItem | null>(null);

  const selectedStage = useMemo(
    () => options.stages.find((stage) => stage.id === form.stageId) ?? null,
    [form.stageId, options.stages],
  );
  const formHalaqat = selectedStage?.halaqat ?? [];
  const selectedHalaqa = formHalaqat.find((halaqa) => halaqa.id === form.halaqaId) ?? null;
  const formStudents = selectedHalaqa?.students ?? [];

  const filterStage = options.stages.find((stage) => stage.id === filters.stageId) ?? null;
  const filterHalaqat = filterStage?.halaqat ?? options.stages.flatMap((stage) => stage.halaqat);
  const filterHalaqa = filterHalaqat.find((halaqa) => halaqa.id === filters.halaqaId) ?? null;
  const filterStudents = filterHalaqa?.students ?? [];

  function showNotice(type: "success" | "error", text: string) {
    setNotice({ type, text });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function changeFormStage(stageId: string) {
    const stage = options.stages.find((item) => item.id === stageId);
    const halaqa = stage?.halaqat[0];
    setForm((current) => ({
      ...current,
      stageId,
      halaqaId: halaqa?.id ?? "",
      studentId: halaqa?.students[0]?.id ?? "",
    }));
  }

  function changeFormHalaqa(halaqaId: string) {
    const halaqa = formHalaqat.find((item) => item.id === halaqaId);
    setForm((current) => ({
      ...current,
      halaqaId,
      studentId: halaqa?.students[0]?.id ?? "",
    }));
  }

  function changeExamType(examType: "INDIVIDUAL" | "COLLECTIVE") {
    setForm((current) => ({
      ...current,
      examType,
      juzTo: examType === "INDIVIDUAL" ? current.juzFrom : current.juzTo,
    }));
  }

  async function loadExams(nextFilters: FilterState = filters, preserveNotice = false) {
    setBusy("load");
    if (!preserveNotice) setNotice(null);
    try {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(nextFilters)) {
        if (value) query.set(key, value);
      }
      query.set("limit", "150");
      const response = await fetch(`/api/examiner/exams?${query.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        data?: OfficialExamListItem[];
      };
      if (!response.ok) throw new Error(payload.message || "تعذر تحميل الاختبارات.");
      setExams(payload.data ?? []);
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "تعذر تحميل الاختبارات.");
    } finally {
      setBusy(null);
    }
  }

  async function createExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("create");
    setNotice(null);

    try {
      const response = await fetch("/api/examiner/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: form.studentId,
          examDate: form.examDate,
          examType: form.examType,
          juzFrom: Number(form.juzFrom),
          juzTo: Number(form.examType === "INDIVIDUAL" ? form.juzFrom : form.juzTo),
          score: Number(form.score),
          notes: form.notes,
          idempotencyKey: createKey,
        }),
      });
      const message = await apiMessage(response);
      if (!response.ok) throw new Error(message);

      setCreateKey(operationKey());
      setForm((current) => ({ ...current, score: "", notes: "" }));
      showNotice("success", message);
      await loadExams(filters, true);
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "تعذر حفظ الاختبار.");
    } finally {
      setBusy(null);
    }
  }

  function beginEdit(exam: OfficialExamListItem) {
    if (exam.status !== "ACTIVE") return;
    if (exam.examType === "CUSTOM") {
      showNotice("error", "تعديل النطاق المخصص غير متاح في هذا النموذج حالياً.");
      return;
    }
    const scope = exam.scopes[0];
    setEditing(exam);
    setForm({
      stageId: exam.enrollment?.stageId ?? "",
      halaqaId: exam.enrollment?.halaqaId ?? "",
      studentId: exam.student.id,
      examDate: exam.examDate,
      examType: exam.examType === "INDIVIDUAL" ? "INDIVIDUAL" : "COLLECTIVE",
      juzFrom: String(scope?.juzFrom ?? 1),
      juzTo: String(scope?.juzTo ?? scope?.juzFrom ?? 1),
      score: String(exam.score ?? ""),
      notes: exam.notes ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditing(null);
    const stage = options.stages[0];
    const halaqa = stage?.halaqat[0];
    setForm({
      stageId: stage?.id ?? "",
      halaqaId: halaqa?.id ?? "",
      studentId: halaqa?.students[0]?.id ?? "",
      examDate: initialDate,
      examType: "COLLECTIVE",
      juzFrom: "1",
      juzTo: "1",
      score: "",
      notes: "",
    });
  }

  async function updateExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setBusy("edit");
    setNotice(null);

    try {
      const response = await fetch(`/api/examiner/exams/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: form.studentId,
          examDate: form.examDate,
          examType: form.examType,
          juzFrom: Number(form.juzFrom),
          juzTo: Number(form.examType === "INDIVIDUAL" ? form.juzFrom : form.juzTo),
          score: Number(form.score),
          notes: form.notes,
          version: editing.version,
        }),
      });
      const message = await apiMessage(response);
      if (!response.ok) throw new Error(message);
      cancelEdit();
      showNotice("success", message);
      await loadExams(filters, true);
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "تعذر تحديث الاختبار.");
    } finally {
      setBusy(null);
    }
  }

  async function voidExam(exam: OfficialExamListItem) {
    const reason = window.prompt(`اكتب سبب إلغاء اختبار ${exam.student.displayName}:`);
    if (!reason) return;
    if (!window.confirm("سيبقى الاختبار محفوظاً في السجل بحالة ملغى. هل تريد المتابعة؟")) return;

    setBusy(`void-${exam.id}`);
    setNotice(null);
    try {
      const response = await fetch(`/api/examiner/exams/${exam.id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: exam.version, reason }),
      });
      const message = await apiMessage(response);
      if (!response.ok) throw new Error(message);
      showNotice("success", message);
      await loadExams(filters, true);
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "تعذر إلغاء الاختبار.");
    } finally {
      setBusy(null);
    }
  }

  const formSubmit = editing ? updateExam : createExam;

  return (
    <div className="space-y-5">
      {notice ? (
        <div
          role="status"
          className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
            notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      <section className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-sky-700">{editing ? "تعديل اختبار" : "اختبار رسمي جديد"}</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">
              {editing ? `تعديل اختبار ${editing.student.displayName}` : "تسجيل نتيجة الطالب"}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              التقدير يُحسب من الخادم حسب المرحلة، وتُحفظ الحلقة التي كان الطالب مسجلاً فيها بتاريخ الاختبار.
            </p>
          </div>
          {editing ? (
            <button
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700"
              type="button"
              onClick={cancelEdit}
            >
              إلغاء التعديل
            </button>
          ) : null}
        </div>

        <form className="mt-5 space-y-4" onSubmit={formSubmit}>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="form-label" htmlFor="exam-stage">المرحلة</label>
              <select
                className="form-control"
                id="exam-stage"
                value={form.stageId}
                onChange={(event) => changeFormStage(event.target.value)}
                required
              >
                {options.stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>{stage.nameAr}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label" htmlFor="exam-halaqa">الحلقة</label>
              <select
                className="form-control"
                id="exam-halaqa"
                value={form.halaqaId}
                onChange={(event) => changeFormHalaqa(event.target.value)}
                required
              >
                {editing?.enrollment && !formHalaqat.some((halaqa) => halaqa.id === editing.enrollment?.halaqaId) ? (
                  <option value={editing.enrollment.halaqaId}>{editing.enrollment.halaqaName}</option>
                ) : null}
                {formHalaqat.map((halaqa) => (
                  <option key={halaqa.id} value={halaqa.id}>
                    {halaqa.nameAr}{halaqa.teacherName ? ` — ${halaqa.teacherName}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label" htmlFor="exam-student">الطالب</label>
              <select
                className="form-control"
                id="exam-student"
                value={form.studentId}
                onChange={(event) => setForm((current) => ({ ...current, studentId: event.target.value }))}
                required
              >
                {editing && !formStudents.some((student) => student.id === editing.student.id) ? (
                  <option value={editing.student.id}>{editing.student.displayName}</option>
                ) : null}
                {formStudents.map((student) => (
                  <option key={student.id} value={student.id}>{student.displayName}</option>
                ))}
              </select>
            </div>
          </div>

          {!formStudents.length ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
              لا يوجد طلاب نشطون في الحلقة المختارة.
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="form-label" htmlFor="exam-date">التاريخ</label>
              <input
                className="form-control"
                id="exam-date"
                type="date"
                max={initialDate}
                value={form.examDate}
                onChange={(event) => setForm((current) => ({ ...current, examDate: event.target.value }))}
                required
              />
            </div>
            <div>
              <label className="form-label" htmlFor="exam-type">نوع الاختبار</label>
              <select
                className="form-control"
                id="exam-type"
                value={form.examType}
                onChange={(event) => changeExamType(event.target.value as "INDIVIDUAL" | "COLLECTIVE")}
              >
                <option value="COLLECTIVE">مجتمع</option>
                <option value="INDIVIDUAL">منفرد</option>
              </select>
            </div>
            <div>
              <label className="form-label" htmlFor="exam-from-juz">
                {form.examType === "INDIVIDUAL" ? "الجزء" : "من الجزء"}
              </label>
              <select
                className="form-control"
                id="exam-from-juz"
                value={form.juzFrom}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    juzFrom: event.target.value,
                    juzTo: current.examType === "INDIVIDUAL" ? event.target.value : current.juzTo,
                  }))
                }
              >
                {Array.from({ length: 30 }, (_, index) => index + 1).map((juz) => (
                  <option key={juz} value={juz}>{juz}</option>
                ))}
              </select>
            </div>
            {form.examType === "COLLECTIVE" ? (
              <div>
                <label className="form-label" htmlFor="exam-to-juz">إلى الجزء</label>
                <select
                  className="form-control"
                  id="exam-to-juz"
                  value={form.juzTo}
                  onChange={(event) => setForm((current) => ({ ...current, juzTo: event.target.value }))}
                >
                  {Array.from({ length: 30 }, (_, index) => index + 1).map((juz) => (
                    <option key={juz} value={juz}>{juz}</option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
            <div>
              <label className="form-label" htmlFor="exam-score">الدرجة من 100</label>
              <input
                className="form-control text-center text-xl font-black"
                id="exam-score"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.score}
                onChange={(event) => setForm((current) => ({ ...current, score: event.target.value }))}
                required
              />
            </div>
            <div>
              <label className="form-label" htmlFor="exam-notes">ملاحظات</label>
              <textarea
                className="form-control min-h-24"
                id="exam-notes"
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </div>
          </div>

          <button
            className="min-h-12 w-full rounded-2xl bg-sky-800 px-5 text-sm font-black text-white transition hover:bg-sky-900 disabled:opacity-60"
            disabled={busy === "create" || busy === "edit" || !form.studentId}
          >
            {busy === "create" || busy === "edit"
              ? "جاري الحفظ..."
              : editing
                ? "حفظ التعديلات"
                : "حفظ الاختبار الرسمي"}
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <div>
          <p className="text-xs font-bold text-sky-700">البحث والتصفية</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">سجل الاختبارات الرسمية</h2>
        </div>

        <form
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
          onSubmit={(event) => {
            event.preventDefault();
            void loadExams();
          }}
        >
          <select
            className="form-control"
            aria-label="المرحلة"
            value={filters.stageId}
            onChange={(event) => {
              const stageId = event.target.value;
              setFilters((current) => ({ ...current, stageId, halaqaId: "", studentId: "" }));
            }}
          >
            <option value="">كل المراحل</option>
            {options.stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.nameAr}</option>)}
          </select>
          <select
            className="form-control"
            aria-label="الحلقة"
            value={filters.halaqaId}
            onChange={(event) => setFilters((current) => ({ ...current, halaqaId: event.target.value, studentId: "" }))}
          >
            <option value="">كل الحلقات</option>
            {filterHalaqat.map((halaqa) => <option key={halaqa.id} value={halaqa.id}>{halaqa.nameAr}</option>)}
          </select>
          <select
            className="form-control"
            aria-label="الطالب"
            value={filters.studentId}
            onChange={(event) => setFilters((current) => ({ ...current, studentId: event.target.value }))}
            disabled={!filters.halaqaId}
          >
            <option value="">كل الطلاب</option>
            {filterStudents.map((student) => <option key={student.id} value={student.id}>{student.displayName}</option>)}
          </select>
          <input
            className="form-control"
            type="date"
            aria-label="من تاريخ"
            value={filters.from}
            onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
          />
          <input
            className="form-control"
            type="date"
            aria-label="إلى تاريخ"
            value={filters.to}
            onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
          />
          <div className="flex gap-2">
            <select
              className="form-control min-w-0"
              aria-label="الحالة"
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as FilterState["status"] }))}
            >
              <option value="ALL">الكل</option>
              <option value="ACTIVE">فعال</option>
              <option value="VOIDED">ملغى</option>
            </select>
            <button className="rounded-xl bg-sky-800 px-4 text-sm font-black text-white" disabled={busy === "load"}>
              عرض
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-black text-slate-950">النتائج</h2>
          <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-black text-sky-900">{exams.length}</span>
        </div>

        {exams.length ? (
          exams.map((exam) => (
            <article
              key={exam.id}
              className={`rounded-3xl border bg-white p-4 shadow-sm sm:p-5 ${exam.status === "VOIDED" ? "border-red-100 opacity-75" : "border-sky-100"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black text-slate-950">{exam.student.displayName}</h3>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-black ${resultStyle(exam.resultLabel)}`}>
                      {exam.resultLabel ?? "بدون تقدير"}
                    </span>
                    {exam.status === "VOIDED" ? (
                      <span className="rounded-full bg-red-100 px-3 py-1 text-[11px] font-black text-red-800">ملغى</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {exam.enrollment?.stageName ?? "—"} — {exam.enrollment?.halaqaName ?? "بدون حلقة مرتبطة"}
                  </p>
                  <p className="mt-2 text-sm font-bold text-slate-800">
                    {examTypeLabel(exam.examType)} — {exam.scopes.map((scope) => scope.label).join("، ") || "بدون نطاق"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {exam.examDate} — المختبر: {exam.examiner.displayName}
                  </p>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-black text-sky-900">{exam.score ?? "—"}</div>
                  <div className="text-xs font-bold text-slate-500">من 100</div>
                </div>
              </div>

              {exam.notes ? <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{exam.notes}</p> : null}
              {exam.status === "VOIDED" && exam.voidReason ? (
                <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-800">سبب الإلغاء: {exam.voidReason}</p>
              ) : null}

              {exam.status === "ACTIVE" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="rounded-xl border border-sky-200 px-4 py-2 text-sm font-black text-sky-900"
                    type="button"
                    onClick={() => beginEdit(exam)}
                  >
                    تعديل
                  </button>
                  <button
                    className="rounded-xl border border-red-200 px-4 py-2 text-sm font-black text-red-700 disabled:opacity-60"
                    type="button"
                    disabled={busy === `void-${exam.id}`}
                    onClick={() => void voidExam(exam)}
                  >
                    {busy === `void-${exam.id}` ? "جاري الإلغاء..." : "إلغاء الاختبار"}
                  </button>
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500">
            لا توجد اختبارات مطابقة للتصفية الحالية.
          </div>
        )}
      </section>
    </div>
  );
}
