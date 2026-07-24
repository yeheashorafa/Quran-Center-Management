"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { ManagerStudentItem, StudentHalaqaOption } from "@/lib/students/types";

type ApiMessage = { message?: string };

type Notice = { type: "success" | "error"; text: string } | null;

type StudentDeleteModalState = {
  isOpen: boolean;
  studentId: string;
  studentName: string;
  counts: {
    enrollments: number;
    sessions: number;
    exams: number;
  };
  hasLinkedData: boolean;
  typedName: string;
  loading: boolean;
};

function todayInputValue(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function readApiMessage(response: Response): Promise<string> {
  const data = (await response.json().catch(() => ({}))) as ApiMessage;
  return data.message || (response.ok ? "تمت العملية بنجاح." : "تعذر تنفيذ العملية.");
}

export function StudentManagementPanel({
  students,
  halaqat,
}: {
  students: ManagerStudentItem[];
  halaqat: StudentHalaqaOption[];
}) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [query, setQuery] = useState("");
  const [halaqaFilter, setHalaqaFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  const [editingStudent, setEditingStudent] = useState<ManagerStudentItem | null>(null);
  const [studentDeleteModal, setStudentDeleteModal] = useState<StudentDeleteModalState | null>(null);

  const filteredStudents = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ar");
    return students.filter((student) => {
      const matchesQuery =
        !normalizedQuery ||
        student.fullName.toLocaleLowerCase("ar").includes(normalizedQuery) ||
        student.displayName.toLocaleLowerCase("ar").includes(normalizedQuery) ||
        (student.parentPhone || "").includes(normalizedQuery);
      const matchesHalaqa =
        !halaqaFilter || student.activeEnrollment?.halaqa.id === halaqaFilter;
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" ? student.isActive : !student.isActive);
      return matchesQuery && matchesHalaqa && matchesStatus;
    });
  }, [halaqaFilter, query, statusFilter, students]);

  function showResult(type: "success" | "error", text: string) {
    setNotice({ type, text });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function createStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setBusyKey("create-student");
    setNotice(null);

    try {
      const response = await fetch("/api/manager/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.get("fullName"),
          displayName: formData.get("displayName"),
          parentPhone: formData.get("parentPhone"),
          gradeLevel: formData.get("gradeLevel"),
          memorizationStartedOn: formData.get("memorizationStartedOn"),
          notes: formData.get("notes"),
          halaqaId: formData.get("halaqaId"),
          startedOn: formData.get("startedOn"),
        }),
      });

      const message = await readApiMessage(response);
      if (!response.ok) throw new Error(message);

      form.reset();
      showResult("success", message);
      router.refresh();
    } catch (error) {
      showResult("error", error instanceof Error ? error.message : "تعذر إنشاء ملف الطالب.");
    } finally {
      setBusyKey(null);
    }
  }

  async function updateStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingStudent) return;

    setBusyKey(`edit-student-${editingStudent.id}`);
    setNotice(null);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch(`/api/manager/students/${editingStudent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.get("fullName"),
          displayName: formData.get("displayName"),
          parentPhone: formData.get("parentPhone"),
          gradeLevel: formData.get("gradeLevel"),
          memorizationStartedOn: formData.get("memorizationStartedOn"),
          notes: formData.get("notes"),
        }),
      });

      const message = await readApiMessage(response);
      if (!response.ok) throw new Error(message);

      showResult("success", message);
      setEditingStudent(null);
      router.refresh();
    } catch (error) {
      showResult("error", error instanceof Error ? error.message : "تعذر تحديث ملف الطالب.");
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleStudentStatus(studentId: string, currentIsActive: boolean) {
    setBusyKey(`status-student-${studentId}`);
    setNotice(null);

    try {
      const response = await fetch(`/api/manager/students/${studentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isActive: !currentIsActive,
          effectiveOn: todayInputValue(),
        }),
      });

      const message = await readApiMessage(response);
      if (!response.ok) throw new Error(message);

      showResult("success", message);
      router.refresh();
    } catch (error) {
      showResult("error", error instanceof Error ? error.message : "تعذر تغيير حالة الطالب.");
    } finally {
      setBusyKey(null);
    }
  }

  async function removeStudentFromHalaqa(studentId: string, halaqaName: string) {
    if (!confirm(`هل أنت متأكد من إزالة الطالب من (${halaqaName})؟ سيتم إنهاء تسجيله الحالي مع الاحتفاظ بكافة سجلاته التاريخية.`)) {
      return;
    }

    setBusyKey(`remove-student-${studentId}`);
    setNotice(null);

    try {
      const response = await fetch(`/api/manager/students/${studentId}/enrollments`, {
        method: "DELETE",
      });

      const message = await readApiMessage(response);
      if (!response.ok) throw new Error(message);

      showResult("success", message);
      router.refresh();
    } catch (error) {
      showResult("error", error instanceof Error ? error.message : "تعذر إزالة الطالب من الحلقة.");
    } finally {
      setBusyKey(null);
    }
  }

  async function requestStudentPermanentDelete(studentId: string, studentName: string) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      showResult("error", "حذف الطالب يحتاج اتصالاً بالإنترنت.");
      return;
    }

    setBusyKey(`delete-student-${studentId}`);
    setNotice(null);

    try {
      const response = await fetch(`/api/manager/students/${studentId}`);
      const apiData = (await response.json().catch(() => ({}))) as {
        message?: string;
        counts?: { enrollments: number; sessions: number; exams: number };
        hasLinkedData?: boolean;
      };

      if (!response.ok) throw new Error(apiData.message || "تعذر جلب بيانات الطالب.");

      const counts = apiData.counts || { enrollments: 0, sessions: 0, exams: 0 };
      const hasLinkedData = Boolean(apiData.hasLinkedData);

      setStudentDeleteModal({
        isOpen: true,
        studentId,
        studentName,
        counts,
        hasLinkedData,
        typedName: "",
        loading: false,
      });
    } catch (error) {
      showResult("error", error instanceof Error ? error.message : "تعذر إتمام الطلب.");
    } finally {
      setBusyKey(null);
    }
  }

  async function executeStudentPermanentDelete(studentId: string) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      showResult("error", "حذف الطالب يحتاج اتصالاً بالإنترنت.");
      return;
    }

    setBusyKey(`delete-student-${studentId}`);
    try {
      const response = await fetch(`/api/manager/students/${studentId}?force=true`, {
        method: "DELETE",
      });

      const message = await readApiMessage(response);
      if (!response.ok) throw new Error(message);

      showResult("success", message);
      setStudentDeleteModal(null);
      router.refresh();
    } catch (error) {
      showResult("error", error instanceof Error ? error.message : "تعذر حذف الطالب.");
    } finally {
      setBusyKey(null);
    }
  }

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

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.45fr)]">
        <section className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-xs font-bold text-emerald-700">ملفات الطلاب</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">إضافة طالب وتسجيله</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            ينشأ ملف واحد ثابت للطالب، ثم يرتبط بالحَلَقة من خلال تسجيل مستقل.
          </p>

          {!halaqat.length ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
              يجب إنشاء حلقة نشطة أولاً قبل تسجيل الطلاب.
            </div>
          ) : null}

          <form className="mt-5 space-y-4" onSubmit={createStudent}>
            <div>
              <label className="form-label" htmlFor="student-full-name">الاسم الكامل</label>
              <input
                className="form-control"
                id="student-full-name"
                name="fullName"
                placeholder="الاسم الرباعي أو الكامل"
                required
              />
            </div>

            <div>
              <label className="form-label" htmlFor="student-display-name">اسم العرض</label>
              <input
                className="form-control"
                id="student-display-name"
                name="displayName"
                placeholder="اختياري، يستخدم الاسم الكامل تلقائياً"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="form-label" htmlFor="student-parent-phone">هاتف ولي الأمر</label>
                <input
                  className="form-control"
                  id="student-parent-phone"
                  name="parentPhone"
                  inputMode="tel"
                  placeholder="اختياري"
                />
              </div>
              <div>
                <label className="form-label" htmlFor="student-grade-level">الصف الدراسي</label>
                <input
                  className="form-control"
                  id="student-grade-level"
                  name="gradeLevel"
                  placeholder="مثال: الصف السادس"
                />
              </div>
            </div>

            <div>
              <label className="form-label" htmlFor="student-started-memorization">تاريخ بداية الحفظ</label>
              <input
                className="form-control"
                id="student-started-memorization"
                name="memorizationStartedOn"
                type="date"
              />
            </div>

            <div>
              <label className="form-label" htmlFor="student-halaqa">الحلقة</label>
              <select
                className="form-control"
                id="student-halaqa"
                name="halaqaId"
                required
                disabled={!halaqat.length}
                defaultValue=""
              >
                <option value="">-- اختر الحلقة --</option>
                {halaqat.map((halaqa) => (
                  <option key={halaqa.id} value={halaqa.id}>
                    {halaqa.stageName} — {halaqa.nameAr}
                    {halaqa.teacherName ? ` — ${halaqa.teacherName}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label" htmlFor="student-enrollment-start">تاريخ التسجيل في الحلقة</label>
              <input
                className="form-control"
                id="student-enrollment-start"
                name="startedOn"
                type="date"
                defaultValue={todayInputValue()}
                required
              />
            </div>

            <div>
              <label className="form-label" htmlFor="student-notes">ملاحظات</label>
              <textarea
                className="form-control min-h-24 resize-y"
                id="student-notes"
                name="notes"
                placeholder="اختياري"
              />
            </div>

            <button
              className="min-h-12 w-full rounded-2xl bg-emerald-800 px-4 font-black text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busyKey !== null || !halaqat.length}
            >
              {busyKey === "create-student" ? "جاري الحفظ..." : "إنشاء ملف الطالب وتسجيله"}
            </button>
          </form>
        </section>

        <section className="space-y-4">
          <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-emerald-700">الطلاب المسجلون</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">قائمة الطلاب</h2>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-900">
                {filteredStudents.length} من {students.length}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <input
                className="form-control sm:col-span-1"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="بحث بالاسم أو الهاتف"
                aria-label="بحث عن طالب"
              />
              <select
                className="form-control"
                value={halaqaFilter}
                onChange={(event) => setHalaqaFilter(event.target.value)}
                aria-label="تصفية حسب الحلقة"
              >
                <option value="">كل الحلقات</option>
                {halaqat.map((halaqa) => (
                  <option key={halaqa.id} value={halaqa.id}>{halaqa.nameAr}</option>
                ))}
              </select>
              <select
                className="form-control"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                aria-label="تصفية حسب الحالة"
              >
                <option value="ALL">كل الحالات</option>
                <option value="ACTIVE">نشط</option>
                <option value="INACTIVE">غير نشط</option>
              </select>
            </div>
          </div>

          {filteredStudents.length ? (
            filteredStudents.map((student) => (
              <article
                key={student.id}
                className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black text-slate-950">{student.displayName}</h3>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                          student.isActive
                            ? "bg-emerald-100 text-emerald-900"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {student.isActive ? "نشط" : "غير نشط"}
                      </span>
                    </div>
                    {student.fullName !== student.displayName ? (
                      <p className="mt-1 text-sm text-slate-500">{student.fullName}</p>
                    ) : null}
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-2 text-center">
                    <div className="text-lg font-black text-slate-900">{student.enrollmentsCount}</div>
                    <div className="text-[10px] font-bold text-slate-500">تسجيل تاريخي</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <InfoItem label="الحلقة الحالية" value={student.activeEnrollment?.halaqa.nameAr || "غير مسجل"} />
                  <InfoItem label="المرحلة" value={student.activeEnrollment?.halaqa.stageName || "—"} />
                  <InfoItem label="الشيخ" value={student.activeEnrollment?.halaqa.teacherName || "—"} />
                  <InfoItem label="هاتف ولي الأمر" value={student.parentPhone || "غير مسجل"} />
                </div>

                <div className="mt-4 border-t border-slate-100 pt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      className="flex min-h-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-black text-emerald-900 transition hover:bg-emerald-100"
                      href={`/manager/students/${student.id}`}
                    >
                      📁 فتح الملف
                    </Link>

                    <button
                      type="button"
                      onClick={() => setEditingStudent(student)}
                      className="min-h-10 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 hover:bg-slate-100"
                    >
                      ✏️ تعديل
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      disabled={busyKey !== null}
                      onClick={() => toggleStudentStatus(student.id, student.isActive)}
                      className={`min-h-9 rounded-xl border text-[11px] font-bold transition disabled:opacity-50 ${
                        student.isActive
                          ? "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
                          : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                      }`}
                    >
                      {student.isActive ? "⏸️ تعطيل" : "▶️ تفعيل"}
                    </button>

                    {student.activeEnrollment ? (
                      <button
                        type="button"
                        disabled={busyKey !== null}
                        onClick={() => removeStudentFromHalaqa(student.id, student.activeEnrollment?.halaqa.nameAr || "")}
                        className="min-h-9 rounded-xl border border-orange-200 bg-orange-50 text-orange-900 text-[11px] font-bold hover:bg-orange-100 disabled:opacity-50"
                      >
                        🚫 إزالة من الحلقة
                      </button>
                    ) : (
                      <div />
                    )}

                    <button
                      type="button"
                      disabled={busyKey !== null}
                      onClick={() => requestStudentPermanentDelete(student.id, student.displayName)}
                      className="min-h-9 rounded-xl border border-red-200 bg-red-50 text-red-700 text-[11px] font-black hover:bg-red-100 disabled:opacity-50"
                    >
                      🗑️ حذف نهائي
                    </button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500">
              لا توجد نتائج مطابقة.
            </div>
          )}
        </section>
      </div>

      {/* Edit Student Modal for Manager */}
      {editingStudent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs" dir="rtl">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-slate-950">تعديل بيانات الطالب (المدير)</h3>
            <p className="text-xs font-bold text-slate-500">تحديث البيانات الأساسية لملف الطالب.</p>

            <form onSubmit={updateStudent} className="space-y-3">
              <div>
                <label className="form-label">الاسم الكامل للطالب</label>
                <input
                  name="fullName"
                  required
                  defaultValue={editingStudent.fullName}
                  className="form-control text-sm font-bold"
                />
              </div>

              <div>
                <label className="form-label">اسم العرض (المختصر)</label>
                <input
                  name="displayName"
                  required
                  defaultValue={editingStudent.displayName}
                  className="form-control text-sm font-bold"
                />
              </div>

              <div>
                <label className="form-label">هاتف ولي الأمر</label>
                <input
                  name="parentPhone"
                  defaultValue={editingStudent.parentPhone || ""}
                  placeholder="0599000000"
                  className="form-control text-sm font-bold"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="form-label">الصف الدراسي</label>
                <input
                  name="gradeLevel"
                  defaultValue={editingStudent.gradeLevel || ""}
                  placeholder="مثال: الصف السادس"
                  className="form-control text-sm font-bold"
                />
              </div>

              <div>
                <label className="form-label">تاريخ بداية الحفظ</label>
                <input
                  type="date"
                  name="memorizationStartedOn"
                  defaultValue={editingStudent.memorizationStartedOn ? editingStudent.memorizationStartedOn.slice(0, 10) : ""}
                  className="form-control text-sm font-bold"
                />
              </div>

              <div>
                <label className="form-label">ملاحظات الطالب</label>
                <textarea
                  name="notes"
                  defaultValue={editingStudent.notes || ""}
                  placeholder="ملاحظات اختيارية"
                  className="form-control min-h-20 text-sm font-bold"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-xs font-bold text-slate-700 hover:bg-slate-100"
                  disabled={busyKey !== null}
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  className="min-h-11 rounded-xl bg-emerald-800 px-5 text-xs font-black text-white hover:bg-emerald-900 disabled:opacity-50"
                  disabled={busyKey !== null}
                >
                  {busyKey === `edit-student-${editingStudent.id}` ? "جاري الحفظ..." : "حفظ التعديلات"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Student Permanent Delete Danger Modal for Manager */}
      {studentDeleteModal && studentDeleteModal.isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs" dir="rtl">
          <div className="w-full max-w-lg space-y-4 rounded-3xl border border-red-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-700">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-red-100 text-xl font-black">⚠️</div>
              <h3 className="text-lg font-black text-slate-950">
                {studentDeleteModal.hasLinkedData ? "تأكيد الحذف النهائي لطالب لديه بيانات" : "حذف الطالب نهائياً"}
              </h3>
            </div>

            {studentDeleteModal.hasLinkedData ? (
              <div className="space-y-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-bold leading-6 text-red-900">
                <p className="text-sm font-black text-red-950">هذا الطالب لديه بيانات مرتبطة. حذفه نهائياً سيؤدي إلى حذف:</p>
                <ul className="list-inside list-disc space-y-1">
                  <li>تسجيلاته في الحلقات ({studentDeleteModal.counts.enrollments} تسجيل)</li>
                  <li>جلسات التسميع الخاصة به ({studentDeleteModal.counts.sessions} جلسة)</li>
                  <li>الحفظ والمراجعة والسرد التابع لهذه الجلسات</li>
                  <li>الاختبارات الرسمية المرتبطة ({studentDeleteModal.counts.exams} اختبار)</li>
                  <li>التقارير وسجلات المتابعة المرتبطة به</li>
                  <li>أي بيانات تشغيلية خاصة به</li>
                </ul>
                <p className="pt-1 font-black text-red-700">لا يمكن التراجع عن هذه العملية.</p>
              </div>
            ) : (
              <p className="text-sm font-bold text-slate-600">
                هل أنت متأكد من حذف الطالب ({studentDeleteModal.studentName}) نهائياً؟ لا يملك الطالب أي سجلات مرتبطة.
              </p>
            )}

            {studentDeleteModal.hasLinkedData ? (
              <div className="space-y-2">
                <label className="block text-xs font-extrabold text-slate-700" htmlFor="student-confirm-input">
                  اكتب اسم الطالب لتأكيد الحذف النهائي: <span className="font-black text-red-700">({studentDeleteModal.studentName})</span>
                </label>
                <input
                  id="student-confirm-input"
                  className="form-control border-red-300 text-sm font-bold focus:border-red-600 focus:ring-red-200"
                  placeholder="اكتب اسم الطالب هنا للتأكيد..."
                  value={studentDeleteModal.typedName}
                  onChange={(e) =>
                    setStudentDeleteModal((prev) => (prev ? { ...prev, typedName: e.target.value } : null))
                  }
                />
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 hover:bg-slate-100"
                onClick={() => setStudentDeleteModal(null)}
                disabled={studentDeleteModal.loading}
              >
                إلغاء
              </button>

              <button
                type="button"
                className="min-h-11 rounded-xl bg-red-700 px-5 text-sm font-black text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  studentDeleteModal.loading ||
                  (studentDeleteModal.hasLinkedData &&
                    studentDeleteModal.typedName.trim() !== studentDeleteModal.studentName.trim())
                }
                onClick={async () => {
                  setStudentDeleteModal((prev) => (prev ? { ...prev, loading: true } : null));
                  await executeStudentPermanentDelete(studentDeleteModal.studentId);
                }}
              >
                {studentDeleteModal.loading ? "جاري الحذف..." : "حذف نهائي للطالب والبيانات"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <div className="text-[11px] font-extrabold text-slate-500">{label}</div>
      <div className="mt-1 font-black text-slate-800">{value}</div>
    </div>
  );
}
