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
    <div className="space-y-5" dir="rtl">
      {/* Header & Actions */}
      <section className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 shadow-sm sm:p-5 text-[var(--text-main)] transition-colors duration-200">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-xs font-bold text-[var(--gold)]">إدارة طلاب الحلقة</span>
            <h2 className="mt-1 text-xl font-black text-[var(--text-main)]">قائمة الطلاب المباشرة</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              يمكنك إضافة طلاب جديدين، وتعديل كافة بياناتهم، واستخراج تقارير ولي الأمر.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="min-h-12 rounded-2xl bg-[var(--primary)] px-5 text-sm font-black text-white shadow-md transition hover:bg-[var(--primary-dark)]"
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
                ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
                : "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
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
            <article key={student.studentId} className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 shadow-sm flex flex-col justify-between text-[var(--text-main)] transition-colors duration-200">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-black text-[var(--text-main)]">{student.displayName}</h3>
                    <p className="text-xs font-bold text-[var(--text-muted)] mt-0.5">{student.fullName}</p>
                  </div>
                  <span className="rounded-full bg-[var(--card-soft)] border border-[var(--border-color)] px-2.5 py-1 text-[10px] font-black text-[var(--primary)]">
                    {student.stageName}
                  </span>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-[var(--text-muted)] font-bold">
                  <div className="flex justify-between">
                    <span>الصف الدراسي:</span>
                    <span className="text-[var(--text-main)]">{student.gradeLevel || "غير مسجل"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>هاتف ولي الأمر:</span>
                    <span className="text-[var(--text-main)]" dir="ltr">{student.parentPhone || "غير مسجل"}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 border-t border-[var(--border-color)] pt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingStudent(student)}
                  className="min-h-10 rounded-xl bg-[var(--card-soft)] text-[var(--text-main)] font-bold text-xs border border-[var(--border-color)] px-3 hover:border-[var(--primary)] transition"
                >
                  ✏️ تعديل
                </button>
                <button
                  type="button"
                  disabled={fetchingReportId === student.studentId}
                  onClick={() => openReport(student.studentId)}
                  className="flex-1 min-h-10 rounded-xl bg-[var(--card-soft)] text-[var(--primary)] font-black text-xs border border-[var(--border-color)] transition hover:bg-[var(--primary)] hover:text-white disabled:opacity-50"
                >
                  {fetchingReportId === student.studentId ? "جاري الاستخراج..." : "📜 تقرير ولي الأمر"}
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="col-span-full rounded-3xl border border-dashed border-[var(--border-color)] bg-[var(--card-bg)] p-8 text-center text-sm font-bold text-[var(--text-muted)]">
            لا يوجد طلاب مطبقين للبحث.
          </div>
        )}
      </section>

      {/* Add Student Modal */}
      {showAddModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6 shadow-2xl text-[var(--text-main)]">
            <h3 className="text-lg font-black text-[var(--text-main)]">إضافة طالب جديد للحلقة</h3>
            <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">
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

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-[var(--border-color)] pt-4">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setShowAddModal(false)}
                  className="min-h-11 rounded-xl border border-[var(--border-color)] bg-[var(--card-soft)] px-4 text-xs font-bold text-[var(--text-main)] hover:border-[var(--primary)]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-11 rounded-xl bg-[var(--primary)] px-5 text-xs font-black text-white hover:bg-[var(--primary-dark)] disabled:opacity-50"
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
          <div className="w-full max-w-md rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6 shadow-2xl text-[var(--text-main)]">
            <h3 className="text-lg font-black text-[var(--text-main)]">تعديل بيانات الطالب</h3>
            <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">
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

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-[var(--border-color)] pt-4">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEditingStudent(null)}
                  className="min-h-11 rounded-xl border border-[var(--border-color)] bg-[var(--card-soft)] px-4 text-xs font-bold text-[var(--text-main)] hover:border-[var(--primary)]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-11 rounded-xl bg-[var(--primary)] px-5 text-xs font-black text-white hover:bg-[var(--primary-dark)] disabled:opacity-50"
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
