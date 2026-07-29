"use client";

import { useState, type FormEvent } from "react";
import { ParentReportModal } from "@/components/reports/parent-report-modal";
import type { ParentReportData } from "@/lib/reports/parent-report-types";
import { addOfflineStudentToTeacherCache } from "@/lib/offline/teacher-cache";
import { enqueueSyncItem } from "@/lib/offline/sync-queue";
import type { SessionStudentValue } from "@/lib/memorization-sessions/types";

export type TeacherStudentItem = {
  studentId: string;
  fullName: string;
  displayName: string;
  parentPhone: string | null;
  gradeLevel: string | null;
  halaqaName: string;
  stageName: string;
  memorizationStartedOn: string | null;
  notes?: string | null;
  isActive?: boolean;
  isPendingSync?: boolean;
};

const ARABIC_REGEX = /^[\u0600-\u06FF\s]+$/;
const PHONE_REGEX = /^[0-9]{7,15}$/;

export function TeacherStudentsPanel({
  halaqaId,
  students,
  onRefresh,
  isOffline = false,
  teacherId = "teacher",
}: {
  halaqaId: string;
  students: TeacherStudentItem[];
  onRefresh: () => void;
  isOffline?: boolean;
  teacherId?: string;
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

    const form = event.currentTarget;
    const formData = new FormData(form);

    const fullName = String(formData.get("fullName") || "").trim();
    const displayName = String(formData.get("displayName") || "").trim();
    const parentPhone = String(formData.get("parentPhone") || "").trim() || null;
    const gradeLevel = String(formData.get("gradeLevel") || "").trim() || null;
    const memorizationStartedOn = String(formData.get("memorizationStartedOn") || "").trim() || null;

    if (fullName.length < 3 || !ARABIC_REGEX.test(fullName)) {
      setNotice({ type: "error", text: "يجب أن يكون الاسم الكامل 3 أحرف على الأقل باللغة العربية فقط." });
      setBusy(false);
      return;
    }
    if (displayName.length < 2 || !ARABIC_REGEX.test(displayName)) {
      setNotice({ type: "error", text: "يجب أن يكون اسم العرض حرفين على الأقل باللغة العربية فقط." });
      setBusy(false);
      return;
    }
    if (parentPhone && !PHONE_REGEX.test(parentPhone)) {
      setNotice({ type: "error", text: "رقم الهاتف يجب أن يحتوي على أرقام فقط (من 7 إلى 15 رقم)." });
      setBusy(false);
      return;
    }

    if (isOffline || (typeof navigator !== "undefined" && !navigator.onLine)) {
      try {
        const tempStudentId = `temp_student_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const tempEnrollmentId = `temp_enrollment_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const idempotencyKey = `create_student_${tempStudentId}_${Date.now()}`;

        const newStudent: SessionStudentValue = {
          studentId: tempStudentId,
          enrollmentId: tempEnrollmentId,
          displayName,
          fullName,
          attendance: "PENDING",
          notes: "",
          itemId: null,
          version: null,
          activities: [],
          isPendingSync: true,
          tempId: tempStudentId,
        };

        await addOfflineStudentToTeacherCache(teacherId, halaqaId, newStudent);

        await enqueueSyncItem({
          type: "create_student",
          endpoint: "/api/teacher/students",
          method: "POST",
          payload: {
            tempStudentId,
            halaqaId,
            fullName,
            displayName,
            parentPhone,
            gradeLevel,
            memorizationStartedOn,
            idempotencyKey,
          },
          teacherId,
          halaqaId,
        });

        setNotice({
          type: "success",
          text: "تم حفظ الطالب محلياً (بانتظار المزامنة). ظهر في القائمة ويمكنك تسجيل تسميع له الآن.",
        });
        setShowAddModal(false);
        onRefresh();
      } catch {
        setNotice({ type: "error", text: "تعذر حفظ مسودة الطالب محلياً." });
      } finally {
        setBusy(false);
      }
      return;
    }

    try {
      const response = await fetch("/api/teacher/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          halaqaId,
          fullName,
          displayName,
          parentPhone,
          gradeLevel,
          memorizationStartedOn,
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
      const text = err instanceof Error && !err.message.toLowerCase().includes("fetch") ? err.message : "تعذر الاتصال بالسيرفر. يرجى التأكد من الاتصال بالإنترنت.";
      setNotice({ type: "error", text });
    } finally {
      setBusy(false);
    }
  }

  async function handleEditStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingStudent) return;

    if (isOffline || (typeof navigator !== "undefined" && !navigator.onLine)) {
      setNotice({ type: "error", text: "تعديل بيانات الطلاب يحتاج اتصالاً بالإنترنت." });
      return;
    }

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
          notes: formData.get("notes"),
          isActive: formData.get("isActive") === "true",
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
      const text = err instanceof Error && !err.message.toLowerCase().includes("fetch") ? err.message : "تعذر الاتصال بالسيرفر. يرجى التأكد من الاتصال بالإنترنت.";
      setNotice({ type: "error", text });
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveFromHalaqa(studentId: string, displayName: string) {
    if (isOffline || (typeof navigator !== "undefined" && !navigator.onLine)) {
      setNotice({ type: "error", text: "إزالة الطالب من الحلقة تحتاج اتصالاً بالإنترنت." });
      return;
    }

    if (!confirm(`هل أنت متأكد من إزالة الطالب (${displayName}) من الحلقة؟ سيتم إنهاء تسجيله الحالي مع الحفاظ على سجلاته التاريخية.`)) {
      return;
    }

    setBusy(true);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/teacher/students?studentId=${studentId}&halaqaId=${halaqaId}&action=remove`,
        { method: "DELETE" },
      );
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json.message || "تعذر إزالة الطالب من الحلقة.");
      }

      setNotice({ type: "success", text: json.message || "تمت إزالة الطالب من الحلقة بنجاح." });
      onRefresh();
    } catch (err) {
      const text = err instanceof Error && !err.message.toLowerCase().includes("fetch") ? err.message : "تعذر الاتصال بالسيرفر. يرجى التأكد من الاتصال بالإنترنت.";
      setNotice({ type: "error", text });
    } finally {
      setBusy(false);
    }
  }

  async function openReport(studentId: string) {
    if (isOffline || (typeof navigator !== "undefined" && !navigator.onLine)) {
      setNotice({ type: "error", text: "استخراج تقرير ولي الأمر يحتاج اتصالاً بالإنترنت." });
      return;
    }

    setFetchingReportId(studentId);
    try {
      const response = await fetch(`/api/reports/parent?studentId=${studentId}`);
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message || "تعذر استخراج التقرير.");
      setActiveReport(json.data as ParentReportData);
    } catch (err) {
      const text = err instanceof Error && !err.message.toLowerCase().includes("fetch") ? err.message : "تعذر الاتصال بالسيرفر. يرجى التأكد من الاتصال بالإنترنت.";
      setNotice({ type: "error", text });
    } finally {
      setFetchingReportId(null);
    }
  }

  function handleOpenAddModal() {
    if (isOffline || (typeof navigator !== "undefined" && !navigator.onLine)) {
      setNotice({ type: "error", text: "إضافة الطلاب تحتاج اتصالاً بالإنترنت." });
      return;
    }
    setShowAddModal(true);
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
              يمكنك إضافة طلاب جديدين، وتعديل كافة بياناتهم، وإزالتهم من الحلقة، واستخراج تقارير ولي الأمر.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenAddModal}
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
                  <div className="flex items-center gap-2 shrink-0">
                    {student.isPendingSync || student.studentId.startsWith("temp_student") ? (
                      <span className="rounded-xl border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300">
                        ⏳ بانتظار المزامنة
                      </span>
                    ) : null}
                    <span className="rounded-xl bg-[var(--card-soft)] border border-[var(--border-color)] px-2.5 py-1 text-[11px] font-black text-[var(--primary)] shrink-0">
                      {student.stageName}
                    </span>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-[var(--text-muted)] font-bold">
                  {student.parentPhone ? (
                    <p>📱 ولي الأمر: <span className="font-black text-[var(--text-main)]" dir="ltr">{student.parentPhone}</span></p>
                  ) : null}
                  {student.gradeLevel ? (
                    <p>🎓 الصف الدراسي: <span className="font-black text-[var(--text-main)]">{student.gradeLevel}</span></p>
                  ) : null}
                  {student.memorizationStartedOn ? (
                    <p>📅 بداية التحفيظ: <span className="font-black text-[var(--text-main)]">{student.memorizationStartedOn}</span></p>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2 pt-3 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => void openReport(student.studentId)}
                  disabled={fetchingReportId === student.studentId}
                  className="rounded-xl border border-[var(--border-color)] bg-[var(--card-soft)] px-3 py-1.5 text-xs font-black text-[var(--primary)] hover:bg-[var(--card-bg)] disabled:opacity-50"
                >
                  {fetchingReportId === student.studentId ? "جاري التحميل..." : "📄 تقرير ولي الأمر"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (isOffline || (typeof navigator !== "undefined" && !navigator.onLine)) {
                      setNotice({ type: "error", text: "تعديل بيانات الطلاب يحتاج اتصالاً بالإنترنت." });
                      return;
                    }
                    setEditingStudent(student);
                  }}
                  className="rounded-xl border border-[var(--border-color)] bg-[var(--card-soft)] px-3 py-1.5 text-xs font-black text-[var(--text-main)] hover:bg-[var(--card-bg)]"
                >
                  ✏️ تعديل
                </button>

                <button
                  type="button"
                  onClick={() => void handleRemoveFromHalaqa(student.studentId, student.displayName)}
                  disabled={busy}
                  className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-1.5 text-xs font-black text-[var(--status-danger-text)] hover:opacity-80 disabled:opacity-50"
                >
                  إزالة من الحلقة
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="sm:col-span-2 lg:col-span-3 rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-8 text-center text-xs font-bold text-[var(--text-muted)]">
            لا يوجد طلاب مطبقين للبحث.
          </div>
        )}
      </section>

      {/* Add Student Modal */}
      {showAddModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs" dir="rtl">
          <div className="w-full max-w-lg rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6 shadow-2xl space-y-4 text-[var(--text-main)]">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <h3 className="text-lg font-black text-[var(--text-main)]">➕ إضافة طالب جديد للحلقة</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-xl bg-[var(--card-soft)] p-2 text-xs font-black text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => void handleAddStudent(e)} className="space-y-4">
              <div>
                <label className="form-label">الاسم الكامل للطالب *</label>
                <input
                  type="text"
                  name="fullName"
                  required
                  placeholder="مثال: عبد الرحمن محمد الشرفا"
                  className="form-control font-bold"
                  pattern="^[\u0600-\u06FF\s]+$"
                  title="اكتب الاسم باللغة العربية فقط."
                />
                <p className="mt-1 text-[11px] font-bold text-[var(--text-muted)]">
                  اكتب الاسم باللغة العربية فقط، مثال: عبد الرحمن محمد الشرفا
                </p>
              </div>

              <div>
                <label className="form-label">اسم الشهرة / العرض *</label>
                <input
                  type="text"
                  name="displayName"
                  required
                  placeholder="مثال: عبد الرحمن الشرفا"
                  className="form-control font-bold"
                  pattern="^[\u0600-\u06FF\s]+$"
                  title="اكتب الاسم المختصر باللغة العربية فقط."
                />
                <p className="mt-1 text-[11px] font-bold text-[var(--text-muted)]">
                  اكتب الاسم المختصر باللغة العربية فقط الذي سيظهر في القوائم.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="form-label">رقم هاتف ولي الأمر</label>
                  <input
                    type="text"
                    name="parentPhone"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="059xxxxxxx"
                    className="form-control font-bold"
                    onChange={(e) => {
                      e.target.value = e.target.value.replace(/\D/g, "");
                    }}
                  />
                  <p className="mt-1 text-[11px] font-bold text-[var(--text-muted)]">
                    رقم الهاتف يجب أن يحتوي على أرقام فقط.
                  </p>
                </div>
                <div>
                  <label className="form-label">الصف الدراسي</label>
                  <input type="text" name="gradeLevel" placeholder="مثال: الصف الخامس" className="form-control font-bold" />
                </div>
              </div>

              <div>
                <label className="form-label">تاريخ بدء التحفيظ</label>
                <input type="date" name="memorizationStartedOn" className="form-control font-bold" />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-soft)] px-5 py-2.5 text-xs font-black text-[var(--text-main)]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-2xl bg-[var(--primary)] px-6 py-2.5 text-xs font-black text-white shadow-md hover:bg-[var(--primary-dark)] disabled:opacity-50"
                >
                  {busy ? "جاري الإضافة..." : "حفظ إضافة الطالب"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Edit Student Modal */}
      {editingStudent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs" dir="rtl">
          <div className="w-full max-w-lg rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6 shadow-2xl space-y-4 text-[var(--text-main)]">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <h3 className="text-lg font-black text-[var(--text-main)]">✏️ تعديل بيانات الطالب</h3>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="rounded-xl bg-[var(--card-soft)] p-2 text-xs font-black text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => void handleEditStudent(e)} className="space-y-4">
              <div>
                <label className="form-label">الاسم الكامل *</label>
                <input
                  type="text"
                  name="fullName"
                  defaultValue={editingStudent.fullName}
                  required
                  className="form-control font-bold"
                  pattern="^[\u0600-\u06FF\s]+$"
                  title="اكتب الاسم باللغة العربية فقط."
                />
                <p className="mt-1 text-[11px] font-bold text-[var(--text-muted)]">
                  اكتب الاسم باللغة العربية فقط، مثال: عبد الرحمن محمد الشرفا
                </p>
              </div>

              <div>
                <label className="form-label">اسم الشهرة / العرض *</label>
                <input
                  type="text"
                  name="displayName"
                  defaultValue={editingStudent.displayName}
                  required
                  className="form-control font-bold"
                  pattern="^[\u0600-\u06FF\s]+$"
                  title="اكتب الاسم المختصر باللغة العربية فقط."
                />
                <p className="mt-1 text-[11px] font-bold text-[var(--text-muted)]">
                  اكتب الاسم المختصر باللغة العربية فقط الذي سيظهر في القوائم.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="form-label">رقم هاتف ولي الأمر</label>
                  <input
                    type="text"
                    name="parentPhone"
                    defaultValue={editingStudent.parentPhone || ""}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="form-control font-bold"
                    onChange={(e) => {
                      e.target.value = e.target.value.replace(/\D/g, "");
                    }}
                  />
                  <p className="mt-1 text-[11px] font-bold text-[var(--text-muted)]">
                    رقم الهاتف يجب أن يحتوي على أرقام فقط.
                  </p>
                </div>
                <div>
                  <label className="form-label">الصف الدراسي</label>
                  <input type="text" name="gradeLevel" defaultValue={editingStudent.gradeLevel || ""} className="form-control font-bold" />
                </div>
              </div>

              <div>
                <label className="form-label">تاريخ بدء التحفيظ</label>
                <input type="date" name="memorizationStartedOn" defaultValue={editingStudent.memorizationStartedOn || ""} className="form-control font-bold" />
              </div>

              <div>
                <label className="form-label">ملاحظات عامة</label>
                <input type="text" name="notes" defaultValue={editingStudent.notes || ""} placeholder="ملاحظات إضافية..." className="form-control font-bold" />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-soft)] px-5 py-2.5 text-xs font-black text-[var(--text-main)]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-2xl bg-[var(--primary)] px-6 py-2.5 text-xs font-black text-white shadow-md hover:bg-[var(--primary-dark)] disabled:opacity-50"
                >
                  {busy ? "جاري التحديث..." : "حفظ التعديلات"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Parent Report Modal */}
      {activeReport ? (
        <ParentReportModal data={activeReport} onClose={() => setActiveReport(null)} />
      ) : null}
    </div>
  );
}
