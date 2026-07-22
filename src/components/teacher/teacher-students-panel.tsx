"use client";

import { useState, type FormEvent } from "react";
import { ParentReportModal } from "@/components/reports/parent-report-modal";
import type { ParentReportData } from "@/lib/reports/parent-report-types";

export type TeacherStudentItem = {
  studentId: string;
  fullName: string;
  displayName: string;
  parentPhone: string | null;
  gradeLevel: string | null;
  halaqaName: string;
  stageName: string;
  memorizationStartedOn: string | null;
};

export function TeacherStudentsPanel({
  halaqaId,
  students,
  onRefresh,
}: {
  halaqaId: string;
  students: TeacherStudentItem[];
  onRefresh: () => void;
}) {
  const [query, setQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<TeacherStudentItem | null>(null);
  const [activeReport, setActiveReport] = useState<ParentReportData | null>(null);
  const [fetchingReportId, setFetchingReportId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const filteredStudents = students.filter(
    (s) =>
      s.displayName.includes(query) ||
      s.fullName.includes(query) ||
      (s.parentPhone && s.parentPhone.includes(query)),
  );

  async function handleAddStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);

    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/teacher/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          halaqaId,
          fullName: formData.get("fullName"),
          displayName: formData.get("displayName"),
          parentPhone: formData.get("parentPhone"),
          gradeLevel: formData.get("gradeLevel"),
          memorizationStartedOn: formData.get("memorizationStartedOn"),
        }),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json.message || "تعذر إضافة الطالب للحلقة.");
      }

      setNotice({ type: "success", text: "تمت إضافة الطالب للحلقة بنجاح." });
      setShowAddModal(false);
      onRefresh();
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "حدث خطأ أثناء الإضافة." });
    } finally {
      setBusy(false);
    }
  }

  async function handleEditStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingStudent) return;
    setBusy(true);
    setNotice(null);

    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/teacher/students", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: editingStudent.studentId,
          fullName: formData.get("fullName"),
          displayName: formData.get("displayName"),
          parentPhone: formData.get("parentPhone"),
          gradeLevel: formData.get("gradeLevel"),
          memorizationStartedOn: formData.get("memorizationStartedOn"),
        }),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json.message || "تعذر تحديث بيانات الطالب.");
      }

      setNotice({ type: "success", text: "تم تحديث بيانات الطالب بنجاح." });
      setEditingStudent(null);
      onRefresh();
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "حدث خطأ أثناء التحديث." });
    } finally {
      setBusy(false);
    }
  }

  async function openReport(studentId: string) {
    setFetchingReportId(studentId);
    try {
      const response = await fetch(`/api/reports/parent?studentId=${studentId}`);
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message || "تعذر استخراج التقرير.");
      setActiveReport(json.data as ParentReportData);
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "حدث خطأ أثناء تحميل التقرير." });
    } finally {
      setFetchingReportId(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header & Actions */}
      <section className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-800">إدارة طلاب الحلقة</span>
            <h2 className="mt-1 text-xl font-black text-slate-950">قائمة الطلاب المباشرة</h2>
            <p className="mt-1 text-sm text-slate-500">
              يمكنك إضافة طلاب جديدين، وتعديل كافة بياناتهم، واستخراج تقارير ولي الأمر.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="min-h-12 rounded-2xl bg-emerald-900 px-5 text-sm font-black text-white shadow-md transition hover:bg-emerald-950"
          >
            ➕ إضافة طالب جديد للحلقة
          </button>
        </div>

        {/* Search Bar */}
        <div className="mt-5">
          <input
            type="text"
            placeholder="🔍 ابحث باسم الطالب أو رقم هاتف ولي الأمر..."
            className="form-control font-bold"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {notice ? (
          <div
            className={`mt-4 rounded-2xl border px-4 py-3 text-xs font-extrabold ${
              notice.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {notice.text}
          </div>
        ) : null}
      </section>

      {/* Student List */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredStudents.length ? (
          filteredStudents.map((student) => (
            <article key={student.studentId} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-black text-slate-950">{student.displayName}</h3>
                    <p className="text-xs font-bold text-slate-500 mt-0.5">{student.fullName}</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black text-emerald-900">
                    {student.stageName}
                  </span>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-slate-600 font-bold">
                  <div className="flex justify-between">
                    <span>الصف الدراسي:</span>
                    <span className="text-slate-900">{student.gradeLevel || "غير مسجل"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>هاتف ولي الأمر:</span>
                    <span className="text-slate-900" dir="ltr">{student.parentPhone || "غير مسجل"}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 border-t border-slate-100 pt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingStudent(student)}
                  className="min-h-10 rounded-xl bg-slate-100 text-slate-800 font-bold text-xs border border-slate-200 px-3 hover:bg-slate-200"
                >
                  ✏️ تعديل
                </button>
                <button
                  type="button"
                  disabled={fetchingReportId === student.studentId}
                  onClick={() => openReport(student.studentId)}
                  className="flex-1 min-h-10 rounded-xl bg-emerald-50 text-emerald-950 font-black text-xs border border-emerald-200 transition hover:bg-emerald-100 disabled:opacity-50"
                >
                  {fetchingReportId === student.studentId ? "جاري الاستخراج..." : "📜 تقرير ولي الأمر"}
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="col-span-full rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-500">
            لا يوجد طلاب مطبقين للبحث.
          </div>
        )}
      </section>

      {/* Add Student Modal */}
      {showAddModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900">إضافة طالب جديد للحلقة</h3>
            <p className="mt-1 text-xs font-bold text-slate-500">
              سينضاف الطالب مباشرة وحصرياً لحلقتك الحالية.
            </p>

            <form className="mt-5 space-y-4" onSubmit={handleAddStudent}>
              <div>
                <label className="form-label">الاسم الكامل للطالب</label>
                <input name="fullName" required placeholder="مثال: عبد الله أحمد محمود" className="form-control font-bold" />
              </div>
              <div>
                <label className="form-label">اسم العرض (المختصر)</label>
                <input name="displayName" required placeholder="مثال: عبد الله أحمد" className="form-control font-bold" />
              </div>
              <div>
                <label className="form-label">رقم هاتف ولي الأمر</label>
                <input name="parentPhone" placeholder="0599000000" className="form-control font-bold" dir="ltr" />
              </div>
              <div>
                <label className="form-label">الصف الدراسي</label>
                <input name="gradeLevel" placeholder="مثال: الصف السادس" className="form-control font-bold" />
              </div>
              <div>
                <label className="form-label">تاريخ بداية الحفظ</label>
                <input type="date" name="memorizationStartedOn" className="form-control font-bold" />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setShowAddModal(false)}
                  className="min-h-11 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-11 rounded-xl bg-emerald-900 px-5 text-xs font-black text-white hover:bg-emerald-950 disabled:opacity-50"
                >
                  {busy ? "جاري الإضافة..." : "حفظ وإضافة الطالب"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Edit Student Modal */}
      {editingStudent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900">تعديل بيانات الطالب</h3>
            <p className="mt-1 text-xs font-bold text-slate-500">
              تعديل بيانات الطالب المعروضة بالمركز.
            </p>

            <form className="mt-5 space-y-4" onSubmit={handleEditStudent}>
              <div>
                <label className="form-label">الاسم الكامل للطالب</label>
                <input
                  name="fullName"
                  required
                  defaultValue={editingStudent.fullName}
                  className="form-control font-bold"
                />
              </div>
              <div>
                <label className="form-label">اسم العرض (المختصر)</label>
                <input
                  name="displayName"
                  required
                  defaultValue={editingStudent.displayName}
                  className="form-control font-bold"
                />
              </div>
              <div>
                <label className="form-label">رقم هاتف ولي الأمر</label>
                <input
                  name="parentPhone"
                  defaultValue={editingStudent.parentPhone || ""}
                  placeholder="0599000000"
                  className="form-control font-bold"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="form-label">الصف الدراسي</label>
                <input
                  name="gradeLevel"
                  defaultValue={editingStudent.gradeLevel || ""}
                  placeholder="مثال: الصف السادس"
                  className="form-control font-bold"
                />
              </div>
              <div>
                <label className="form-label">تاريخ بداية الحفظ</label>
                <input
                  type="date"
                  name="memorizationStartedOn"
                  defaultValue={editingStudent.memorizationStartedOn ? editingStudent.memorizationStartedOn.slice(0, 10) : ""}
                  className="form-control font-bold"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEditingStudent(null)}
                  className="min-h-11 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-11 rounded-xl bg-emerald-900 px-5 text-xs font-black text-white hover:bg-emerald-950 disabled:opacity-50"
                >
                  {busy ? "جاري التحديث..." : "حفظ التعديلات"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {activeReport ? <ParentReportModal data={activeReport} onClose={() => setActiveReport(null)} /> : null}
    </div>
  );
}
