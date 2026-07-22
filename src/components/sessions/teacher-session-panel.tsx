"use client";

import { useEffect, useMemo, useState } from "react";
import { WEEKDAY_LABELS } from "@/lib/halaqat/weekdays";
import type {
  SessionActivityCode,
  SessionAttendanceCode,
  SessionStatusCode,
  SessionStudentValue,
  TeacherSessionDashboardData,
  TeacherSessionEditorData,
} from "@/lib/memorization-sessions/types";

const ATTENDANCE_OPTIONS: Array<{
  code: SessionAttendanceCode;
  label: string;
  activeClass: string;
}> = [
  { code: "PRESENT", label: "حاضر", activeClass: "border-emerald-600 bg-emerald-50 text-emerald-900" },
  { code: "ABSENT", label: "غائب", activeClass: "border-red-500 bg-red-50 text-red-800" },
  { code: "EXCUSED", label: "عذر", activeClass: "border-blue-500 bg-blue-50 text-blue-800" },
  { code: "NOT_HEARD", label: "لم يسمع", activeClass: "border-amber-500 bg-amber-50 text-amber-900" },
];

const ACTIVITY_LABELS: Record<SessionActivityCode, string> = {
  MEMORIZATION: "حفظ جديد",
  REVIEW: "مراجعة",
  RECITATION: "سرد",
};

type ApiPayload = {
  message?: string;
  data?: TeacherSessionEditorData | null;
};

function formatArabicDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("ar-PS", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(`${value}T12:00:00Z`));
  } catch {
    return value;
  }
}

function sessionStatusLabel(status: SessionStatusCode): string {
  if (status === "COMPLETED") return "مكتملة";
  if (status === "LOCKED") return "مقفلة";
  return "مسودة";
}

async function readApiPayload(response: Response): Promise<ApiPayload> {
  return (await response.json().catch(() => ({}))) as ApiPayload;
}

export function TeacherSessionPanel({
  dashboard,
  initialDate,
}: {
  dashboard: TeacherSessionDashboardData;
  initialDate: string;
}) {
  const [halaqaId, setHalaqaId] = useState(dashboard.halaqat[0]?.id ?? "");
  const [sessionDate, setSessionDate] = useState(initialDate);
  const [editor, setEditor] = useState<TeacherSessionEditorData | null>(null);
  const [students, setStudents] = useState<SessionStudentValue[]>([]);
  const [dirtyStudentIds, setDirtyStudentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const selectedHalaqa = dashboard.halaqat.find((halaqa) => halaqa.id === halaqaId) ?? null;

  useEffect(() => {
    if (!halaqaId || !sessionDate) return;

    const controller = new AbortController();

    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setNotice(null);
    });

    fetch(`/api/teacher/sessions/${halaqaId}/${sessionDate}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as
          | TeacherSessionEditorData
          | { message?: string };
        if (!response.ok) {
          throw new Error("message" in payload ? payload.message || "تعذر تحميل الجلسة." : "تعذر تحميل الجلسة.");
        }
        const data = payload as TeacherSessionEditorData;
        setEditor(data);
        setStudents(data.students);
        setDirtyStudentIds(new Set());
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setEditor(null);
        setStudents([]);
        setNotice({ type: "error", text: error instanceof Error ? error.message : "تعذر تحميل الجلسة." });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [halaqaId, sessionDate]);

  const totals = useMemo(() => {
    let present = 0;
    let absent = 0;
    let excused = 0;
    let notHeard = 0;
    let pending = 0;
    let pages = 0;

    for (const student of students) {
      if (student.attendance === "PRESENT") present += 1;
      else if (student.attendance === "ABSENT") absent += 1;
      else if (student.attendance === "EXCUSED") excused += 1;
      else if (student.attendance === "NOT_HEARD") notHeard += 1;
      else pending += 1;

      pages += student.activities.reduce((sum, activity) => sum + Number(activity.pageCount || 0), 0);
    }

    return { present, absent, excused, notHeard, pending, pages };
  }, [students]);

  function markDirty(studentId: string) {
    setDirtyStudentIds((current) => new Set(current).add(studentId));
  }

  function updateStudent(studentId: string, update: (student: SessionStudentValue) => SessionStudentValue) {
    setStudents((current) =>
      current.map((student) => (student.studentId === studentId ? update(student) : student)),
    );
    markDirty(studentId);
  }

  function setAttendance(studentId: string, attendance: SessionAttendanceCode) {
    updateStudent(studentId, (student) => ({
      ...student,
      attendance,
      activities:
        attendance === "PRESENT"
          ? student.activities
          : student.activities.map((activity) => ({ ...activity, text: "", pageCount: 0 })),
    }));
  }

  function updateActivity(
    studentId: string,
    type: SessionActivityCode,
    field: "text" | "pageCount",
    value: string,
  ) {
    updateStudent(studentId, (student) => ({
      ...student,
      activities: student.activities.map((activity) =>
        activity.type === type
          ? {
              ...activity,
              [field]: field === "pageCount" ? Math.max(0, Number(value || 0)) : value,
            }
          : activity,
      ),
    }));
  }

  async function saveStudents(studentIds: string[], complete: boolean) {
    if (!editor?.allowed || !halaqaId || !sessionDate) return;

    const items = students
      .filter((student) => studentIds.includes(student.studentId))
      .map((student) => ({
        studentId: student.studentId,
        enrollmentId: student.enrollmentId,
        attendance: student.attendance,
        notes: student.notes,
        baseVersion: student.version,
        activities: student.activities,
      }));

    if (!items.length) {
      setNotice({ type: "error", text: "لا توجد تعديلات للحفظ." });
      return;
    }

    if (complete && students.some((student) => student.attendance === "PENDING")) {
      setNotice({ type: "error", text: "سجّل حالة جميع الطلاب قبل اعتماد الجلسة." });
      return;
    }

    const key = complete ? "complete-session" : studentIds.length === 1 ? `student-${studentIds[0]}` : "save-all";
    setBusyKey(key);
    setNotice(null);

    try {
      const response = await fetch(`/api/teacher/sessions/${halaqaId}/${sessionDate}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: sessionDate, complete, items }),
      });
      const payload = await readApiPayload(response);
      if (!response.ok) throw new Error(payload.message || "تعذر حفظ الجلسة.");
      if (payload.data) {
        const savedStudentIds = new Set(studentIds);
        const unsavedStudentIds = new Set(
          [...dirtyStudentIds].filter((studentId) => !savedStudentIds.has(studentId)),
        );
        const localByStudentId = new Map(
          students
            .filter((student) => unsavedStudentIds.has(student.studentId))
            .map((student) => [student.studentId, student]),
        );

        setEditor(payload.data);
        setStudents(
          payload.data.students.map(
            (student) => localByStudentId.get(student.studentId) ?? student,
          ),
        );
        setDirtyStudentIds(unsavedStudentIds);
      }
      setNotice({ type: "success", text: payload.message || "تم الحفظ بنجاح." });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "تعذر حفظ الجلسة." });
    } finally {
      setBusyKey(null);
    }
  }

  function openRecentSession(halaqa: string, date: string) {
    setHalaqaId(halaqa);
    setSessionDate(date);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!dashboard.halaqat.length) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
        <h1 className="text-lg font-black">لا توجد حلقة معيّنة على حسابك</h1>
        <p className="mt-2 text-sm leading-7">اطلب من مدير المركز ربط حسابك بحلقة نشطة قبل تسجيل التسميع.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-gradient-to-l from-emerald-950 via-emerald-800 to-emerald-700 p-5 text-white shadow-lg shadow-emerald-950/10 sm:p-6">
        <p className="text-sm font-bold text-emerald-100">تسجيل التسميع اليومي</p>
        <h1 className="mt-1 text-2xl font-black">جلسة الحلقة</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-emerald-50">
          اختر التاريخ فقط؛ اليوم يُستخرج تلقائياً، ويمنع الخادم الحفظ إذا لم يوافق جدول الحلقة.
        </p>
      </section>

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

      <section className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="form-label" htmlFor="session-halaqa">الحلقة</label>
            <select
              id="session-halaqa"
              className="form-control"
              value={halaqaId}
              onChange={(event) => setHalaqaId(event.target.value)}
            >
              {dashboard.halaqat.map((halaqa) => (
                <option key={halaqa.id} value={halaqa.id}>
                  {halaqa.nameAr} — {halaqa.stageName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="session-date">التاريخ</label>
            <input
              id="session-date"
              className="form-control"
              type="date"
              max={initialDate}
              value={sessionDate}
              onChange={(event) => setSessionDate(event.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-slate-100 px-3 py-1.5 font-bold text-slate-700">
            {formatArabicDate(sessionDate)}
          </span>
          {editor ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 font-black text-emerald-800">
              {editor.weekdayLabel}
            </span>
          ) : null}
          {selectedHalaqa?.weekdays.map((weekday) => (
            <span key={weekday} className="rounded-full border border-emerald-100 px-3 py-1 text-xs font-bold text-slate-600">
              {WEEKDAY_LABELS[weekday]}
            </span>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500 shadow-sm">
          جاري تحميل الطلاب والجلسة...
        </div>
      ) : null}

      {!loading && editor && !editor.allowed ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-900 shadow-sm">
          <h2 className="font-black">لا يمكن التسجيل في هذا التاريخ</h2>
          <p className="mt-2 text-sm leading-7">{editor.reason}</p>
          <p className="mt-2 text-xs font-bold text-red-700">لن يقبل الخادم أي محاولة حفظ لهذا اليوم.</p>
        </div>
      ) : null}

      {!loading && editor?.allowed ? (
        <>
          <section className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            <StatCard label="الطلاب" value={students.length} />
            <StatCard label="حاضر" value={totals.present} />
            <StatCard label="غائب" value={totals.absent} />
            <StatCard label="عذر" value={totals.excused} />
            <StatCard label="لم يسمع" value={totals.notHeard} />
            <StatCard label="الصفحات" value={Number(totals.pages.toFixed(2))} />
          </section>

          <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm">
            <div>
              <p className="text-sm font-black text-slate-900">
                {editor.halaqa.nameAr} — {editor.weekdayLabel}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {editor.session
                  ? `حالة الجلسة: ${sessionStatusLabel(editor.session.status)} · إصدار ${editor.session.version}`
                  : "جلسة جديدة لم تُحفظ بعد"}
              </p>
            </div>
            {editor.session?.status === "COMPLETED" ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-900">
                جلسة معتمدة — التعديل مسموح ومسجل
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-900">
                {totals.pending} طالب غير مسجل
              </span>
            )}
          </section>

          {students.length ? (
            <div className="space-y-3">
              {students.map((student, index) => (
                <StudentSessionCard
                  key={student.studentId}
                  index={index}
                  student={student}
                  dirty={dirtyStudentIds.has(student.studentId)}
                  busy={busyKey === `student-${student.studentId}`}
                  disabled={Boolean(busyKey) || editor.session?.status === "LOCKED"}
                  onAttendance={(attendance) => setAttendance(student.studentId, attendance)}
                  onNotes={(notes) =>
                    updateStudent(student.studentId, (current) => ({ ...current, notes }))
                  }
                  onActivity={(type, field, value) =>
                    updateActivity(student.studentId, type, field, value)
                  }
                  onSave={() => saveStudents([student.studentId], false)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-center text-sm font-bold text-amber-900">
              لا يوجد طلاب مسجلون في الحلقة في هذا التاريخ.
            </div>
          )}

          {students.length ? (
            <div className="sticky bottom-3 z-10 grid gap-2 rounded-3xl border border-emerald-200 bg-white/95 p-3 shadow-xl backdrop-blur sm:grid-cols-2">
              <button
                type="button"
                disabled={Boolean(busyKey) || dirtyStudentIds.size === 0}
                onClick={() => saveStudents([...dirtyStudentIds], false)}
                className="min-h-12 rounded-2xl border border-emerald-700 px-4 font-black text-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {busyKey === "save-all" ? "جاري الحفظ..." : `حفظ التعديلات (${dirtyStudentIds.size})`}
              </button>
              <button
                type="button"
                disabled={Boolean(busyKey) || editor.session?.status === "LOCKED"}
                onClick={() => saveStudents(students.map((student) => student.studentId), true)}
                className="min-h-12 rounded-2xl bg-emerald-800 px-4 font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-45"
              >
                {busyKey === "complete-session" ? "جاري الاعتماد..." : "حفظ الكل واعتماد الجلسة"}
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      <section className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-black text-slate-900">آخر الجلسات</h2>
        <p className="mt-1 text-sm text-slate-500">افتح أي جلسة سابقة لتعديلها أو استكمالها.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {dashboard.recentSessions.length ? (
            dashboard.recentSessions.map((recent) => (
              <button
                key={recent.id}
                type="button"
                onClick={() => openRecentSession(recent.halaqaId, recent.sessionDate)}
                className="rounded-2xl border border-slate-200 p-3 text-right transition hover:border-emerald-300 hover:bg-emerald-50"
              >
                <span className="block font-black text-slate-900">{recent.halaqaName}</span>
                <span className="mt-1 block text-xs text-slate-500">{formatArabicDate(recent.sessionDate)}</span>
                <span className="mt-2 flex items-center justify-between gap-2 text-xs font-bold">
                  <span className={recent.status === "COMPLETED" ? "text-emerald-700" : "text-amber-700"}>
                    {sessionStatusLabel(recent.status)}
                  </span>
                  <span className="text-slate-600">{recent.recordedStudents}/{recent.totalStudents} طالب</span>
                </span>
              </button>
            ))
          ) : (
            <p className="text-sm text-slate-500">لا توجد جلسات محفوظة بعد.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function StudentSessionCard({
  index,
  student,
  dirty,
  busy,
  disabled,
  onAttendance,
  onNotes,
  onActivity,
  onSave,
}: {
  index: number;
  student: SessionStudentValue;
  dirty: boolean;
  busy: boolean;
  disabled: boolean;
  onAttendance: (attendance: SessionAttendanceCode) => void;
  onNotes: (notes: string) => void;
  onActivity: (
    type: SessionActivityCode,
    field: "text" | "pageCount",
    value: string,
  ) => void;
  onSave: () => void;
}) {
  const studentPages = student.activities.reduce(
    (sum, activity) => sum + Number(activity.pageCount || 0),
    0,
  );

  return (
    <article className={`rounded-3xl border bg-white p-4 shadow-sm ${dirty ? "border-amber-300" : "border-emerald-100"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-800 text-sm font-black text-white">
            {index + 1}
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-black text-slate-900">{student.displayName}</h3>
            {student.fullName !== student.displayName ? (
              <p className="truncate text-xs text-slate-500">{student.fullName}</p>
            ) : null}
          </div>
        </div>
        <div className="text-left">
          <span className="block text-sm font-black text-emerald-800">{Number(studentPages.toFixed(2))}</span>
          <span className="text-[11px] text-slate-500">صفحة</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ATTENDANCE_OPTIONS.map((option) => {
          const selected = student.attendance === option.code;
          return (
            <button
              key={option.code}
              type="button"
              disabled={disabled}
              onClick={() => onAttendance(option.code)}
              className={`min-h-11 rounded-2xl border-2 px-3 text-sm font-black transition disabled:opacity-50 ${
                selected ? option.activeClass : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {student.attendance === "PRESENT" ? (
        <div className="mt-4 space-y-3">
          {student.activities.map((activity) => (
            <div key={activity.type} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-sm font-black text-slate-800">{ACTIVITY_LABELS[activity.type]}</p>
              <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
                <input
                  className="form-control min-h-11 bg-white"
                  value={activity.text}
                  disabled={disabled}
                  onChange={(event) => onActivity(activity.type, "text", event.target.value)}
                  placeholder="السورة أو الصفحات أو وصف الإنجاز"
                />
                <div>
                  <label className="sr-only" htmlFor={`${student.studentId}-${activity.type}-pages`}>
                    عدد الصفحات
                  </label>
                  <input
                    id={`${student.studentId}-${activity.type}-pages`}
                    className="form-control min-h-11 bg-white text-center"
                    type="number"
                    min="0"
                    max="604"
                    step="0.25"
                    inputMode="decimal"
                    value={activity.pageCount || ""}
                    disabled={disabled}
                    onChange={(event) => onActivity(activity.type, "pageCount", event.target.value)}
                    placeholder="صفحات"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4">
        <label className="form-label" htmlFor={`${student.studentId}-notes`}>ملاحظة</label>
        <input
          id={`${student.studentId}-notes`}
          className="form-control"
          value={student.notes}
          disabled={disabled}
          onChange={(event) => onNotes(event.target.value)}
          placeholder="ملاحظة اختيارية عن الطالب"
        />
      </div>

      <button
        type="button"
        disabled={disabled || !dirty}
        onClick={onSave}
        className="mt-3 min-h-11 w-full rounded-2xl bg-slate-900 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "جاري حفظ الطالب..." : dirty ? "حفظ هذا الطالب" : "تم حفظ بيانات الطالب"}
      </button>
    </article>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-2xl border border-emerald-100 bg-white p-3 text-center shadow-sm">
      <p className="text-xl font-black text-emerald-800">{value}</p>
      <p className="mt-1 text-[11px] font-bold text-slate-500">{label}</p>
    </article>
  );
}
