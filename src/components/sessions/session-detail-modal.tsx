"use client";

import { useState } from "react";
import { QURAN_SURAHS } from "@/lib/quran/metadata";

export type SessionDetailItem = {
  studentId: string;
  displayName: string;
  attendance: "PRESENT" | "NOT_HEARD" | "ABSENT" | "EXCUSED" | "PENDING";
  notes: string | null;
  activities: Array<{
    type: "MEMORIZATION" | "REVIEW" | "RECITATION";
    surahName?: string | null;
    fromAyah?: number | null;
    toAyah?: number | null;
    pageCount: number;
    notes?: string | null;
  }>;
};

export type SessionDetailData = {
  sessionId: string;
  halaqaId: string;
  halaqaName: string;
  stageName: string;
  teacherName: string;
  sessionDate: string;
  weekdayLabel: string;
  status: "DRAFT" | "COMPLETED" | "LOCKED";
  version: number;
  items: SessionDetailItem[];
};

export function SessionDetailModal({
  data,
  onClose,
  onUpdateSuccess,
}: {
  data: SessionDetailData;
  onClose: () => void;
  onUpdateSuccess: () => void;
}) {
  const [items, setItems] = useState<SessionDetailItem[]>(data.items);
  const [busy, setBusy] = useState(false);
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function updateAttendance(index: number, attendance: SessionDetailItem["attendance"]) {
    setItems((prev) => {
      const copy = [...prev];
      const target = { ...copy[index]! };
      target.attendance = attendance;
      if (attendance === "NOT_HEARD" || attendance === "ABSENT" || attendance === "EXCUSED") {
        target.activities = [];
      }
      copy[index] = target;
      return copy;
    });
  }

  function updateStudentNotes(index: number, notes: string) {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index]!, notes };
      return copy;
    });
  }

  function addActivity(index: number, type: "MEMORIZATION" | "REVIEW" | "RECITATION") {
    setItems((prev) => {
      const copy = [...prev];
      const target = { ...copy[index]! };
      const defaultSurah = QURAN_SURAHS[0]!;
      target.activities = [
        ...target.activities,
        {
          type,
          surahName: defaultSurah.nameAr,
          fromAyah: 1,
          toAyah: defaultSurah.totalAyahs,
          pageCount: defaultSurah.endPage - defaultSurah.startPage + 1,
          notes: `سورة ${defaultSurah.nameAr}`,
        },
      ];
      copy[index] = target;
      return copy;
    });
  }

  function removeActivity(studentIndex: number, actIndex: number) {
    setItems((prev) => {
      const copy = [...prev];
      const target = { ...copy[studentIndex]! };
      target.activities = target.activities.filter((_, i) => i !== actIndex);
      copy[studentIndex] = target;
      return copy;
    });
  }

  async function handleSaveChanges() {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setNotice({ type: "error", text: "تحديث الجلسة يتطلب اتصالاً بالإنترنت." });
      return;
    }

    setBusy(true);
    setNotice(null);

    try {
      const response = await fetch(`/api/teacher/sessions/${data.halaqaId}/${data.sessionDate}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: data.sessionDate,
          complete: data.status === "COMPLETED",
          items: items.map((item) => ({
            studentId: item.studentId,
            attendance: item.attendance,
            notes: item.notes || "",
            activities: item.activities.map((act) => ({
              type: act.type,
              pageCount: act.pageCount,
              text: act.notes || (act.surahName ? `سورة ${act.surahName}` : ""),
            })),
          })),
        }),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json.message || "تعذر حفظ تعديلات الجلسة.");
      }

      setNotice({ type: "success", text: "تم حفظ التعديلات على الجلسة بنجاح." });
      onUpdateSuccess();
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "حدث خطأ أثناء الحفظ." });
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteEntireSession() {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setNotice({ type: "error", text: "حذف الجلسة يتطلب اتصالاً بالإنترنت." });
      return;
    }

    const confirmed = window.confirm(
      `هل أنت متأكد من حذف هذه الجلسة بتاريخ (${data.sessionDate}) بالكامل؟ سيتم حذف جميع تسميعات الطلاب داخل هذه الجلسة.`
    );
    if (!confirmed) return;

    setBusy(true);
    setNotice(null);

    try {
      const response = await fetch(`/api/teacher/sessions/${data.halaqaId}/${data.sessionDate}`, {
        method: "DELETE",
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json.message || "تعذر حذف الجلسة.");
      }

      onUpdateSuccess();
      onClose();
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "حدث خطأ أثناء حذف الجلسة." });
      setBusy(false);
    }
  }

  async function handleDeleteStudentRecitation(studentId: string, displayName: string) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setNotice({ type: "error", text: "حذف تسميع الطالب يتطلب اتصالاً بالإنترنت." });
      return;
    }

    const confirmed = window.confirm(
      `هل تريد حذف تسميع الطالب "${displayName}" من هذه الجلسة؟ لن يتم حذف الطالب من الحلقة.`
    );
    if (!confirmed) return;

    setBusyStudentId(studentId);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/teacher/sessions/${data.halaqaId}/${data.sessionDate}/students/${studentId}`,
        { method: "DELETE" }
      );
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json.message || "تعذر حذف تسميع الطالب.");
      }

      setItems((prev) => prev.filter((s) => s.studentId !== studentId));
      setNotice({ type: "success", text: `تم حذف تسميع الطالب ${displayName} بنجاح من الجلسة.` });
      onUpdateSuccess();
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "حدث خطأ أثناء حذف تسميع الطالب." });
    } finally {
      setBusyStudentId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs" dir="rtl">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6 shadow-2xl overflow-hidden sm:p-8 text-[var(--text-main)] transition-colors duration-200">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-color)] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[var(--card-soft)] border border-[var(--border-color)] px-3 py-1 text-xs font-black text-[var(--primary)]">
                {data.weekdayLabel} — {data.sessionDate}
              </span>
              <span className="rounded-full bg-[var(--card-soft)] border border-[var(--border-color)] px-3 py-1 text-xs font-bold text-[var(--text-muted)]">
                {data.halaqaName}
              </span>
            </div>
            <h2 className="mt-2 text-xl font-black text-[var(--text-main)]">تفاصيل الجلسة المسجلة</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-xl border border-[var(--border-color)] bg-[var(--card-soft)] px-4 text-xs font-bold text-[var(--text-main)] hover:border-[var(--primary)] transition"
          >
            إغلاق
          </button>
        </div>

        {notice ? (
          <div
            className={`mt-4 rounded-2xl border px-4 py-3 text-xs font-black ${
              notice.type === "success"
                ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
                : "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
            }`}
          >
            {notice.text}
          </div>
        ) : null}

        {/* Scrollable Content Body */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1">
          {items.map((student, idx) => (
            <article key={student.studentId} className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-soft)] p-4 text-[var(--text-main)] transition-colors duration-200">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-color)] pb-3">
                <span className="font-black text-[var(--text-main)] text-base">{student.displayName}</span>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Attendance Toggle Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateAttendance(idx, "PRESENT")}
                      className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                        student.attendance === "PRESENT"
                          ? "bg-[var(--primary)] text-white shadow-sm"
                          : "bg-[var(--card-bg)] text-[var(--text-main)] border border-[var(--border-color)]"
                      }`}
                    >
                      حاضر
                    </button>
                    <button
                      type="button"
                      onClick={() => updateAttendance(idx, "NOT_HEARD")}
                      className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                        student.attendance === "NOT_HEARD"
                          ? "bg-[var(--gold-dark)] text-white shadow-sm"
                          : "bg-[var(--card-bg)] text-[var(--text-main)] border border-[var(--border-color)]"
                      }`}
                    >
                      لم يسمّع
                    </button>
                    <button
                      type="button"
                      onClick={() => updateAttendance(idx, "ABSENT")}
                      className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                        student.attendance === "ABSENT"
                          ? "bg-red-700 text-white shadow-sm"
                          : "bg-[var(--card-bg)] text-[var(--text-main)] border border-[var(--border-color)]"
                      }`}
                    >
                      غائب
                    </button>
                    <button
                      type="button"
                      onClick={() => updateAttendance(idx, "EXCUSED")}
                      className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                        student.attendance === "EXCUSED"
                          ? "bg-blue-700 text-white shadow-sm"
                          : "bg-[var(--card-bg)] text-[var(--text-main)] border border-[var(--border-color)]"
                      }`}
                    >
                      عذر
                    </button>
                  </div>

                  {/* Delete Single Student Recitation Button */}
                  <button
                    type="button"
                    disabled={busy || busyStudentId === student.studentId}
                    onClick={() => void handleDeleteStudentRecitation(student.studentId, student.displayName)}
                    className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-1.5 text-xs font-black text-[var(--status-danger-text)] transition hover:opacity-90 disabled:opacity-50"
                    title="حذف تسميع هذا الطالب فقط من هذه الجلسة"
                  >
                    {busyStudentId === student.studentId ? "جاري الحذف..." : "🗑️ حذف تسميع الطالب"}
                  </button>
                </div>
              </div>

              {/* Activities Breakdown if Present */}
              {student.attendance === "PRESENT" ? (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--text-muted)]">الأنشطة والتسميع:</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => addActivity(idx, "MEMORIZATION")}
                        className="rounded-lg border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-2.5 py-1 text-[11px] font-black text-[var(--status-success-text)] hover:opacity-90"
                      >
                        + حفظ
                      </button>
                      <button
                        type="button"
                        onClick={() => addActivity(idx, "REVIEW")}
                        className="rounded-lg border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-2.5 py-1 text-[11px] font-black text-[var(--status-info-text)] hover:opacity-90"
                      >
                        + مراجعة
                      </button>
                      <button
                        type="button"
                        onClick={() => addActivity(idx, "RECITATION")}
                        className="rounded-lg border border-purple-300 bg-purple-100 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-300 px-2.5 py-1 text-[11px] font-black text-purple-900 hover:opacity-90"
                      >
                        + سرد
                      </button>
                    </div>
                  </div>

                  {student.activities.map((act, aIdx) => (
                    <div key={aIdx} className="flex items-center justify-between gap-2 rounded-xl bg-[var(--card-bg)] p-2.5 border border-[var(--border-color)] text-xs text-[var(--text-main)]">
                      <span className="font-black text-[var(--primary)]">
                        {act.type === "MEMORIZATION" ? "📖 حفظ" : act.type === "REVIEW" ? "🔄 مراجعة" : "🎙️ سرد"}
                      </span>
                      <span className="font-bold text-[var(--text-main)]">{act.notes || `سورة ${act.surahName}`}</span>
                      <span className="font-black text-[var(--text-main)] bg-[var(--card-soft)] px-2 py-0.5 rounded-md border border-[var(--border-color)]">
                        {act.pageCount} صفحة
                      </span>
                      <button
                        type="button"
                        onClick={() => removeActivity(idx, aIdx)}
                        className="text-[var(--status-danger-text)] font-bold hover:opacity-80"
                      >
                        حذف
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Student Notes Input */}
              <div className="mt-3">
                <input
                  type="text"
                  placeholder="ملاحظات المحفظ للطالب..."
                  className="form-control text-xs font-bold"
                  value={student.notes || ""}
                  onChange={(e) => updateStudentNotes(idx, e.target.value)}
                />
              </div>
            </article>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-color)] pt-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleDeleteEntireSession()}
            className="min-h-11 rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-4 text-xs font-black text-[var(--status-danger-text)] transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "جاري المعالجة..." : "🗑️ حذف الجلسة كاملة"}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="min-h-11 rounded-xl border border-[var(--border-color)] bg-[var(--card-soft)] px-5 text-sm font-bold text-[var(--text-main)] hover:border-[var(--primary)] transition"
            >
              إغلاق
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleSaveChanges}
              className="min-h-11 rounded-xl bg-[var(--primary)] px-6 text-sm font-black text-white shadow-sm hover:bg-[var(--primary-dark)] transition disabled:opacity-50"
            >
              {busy ? "جاري التحديث..." : "حفظ التعديلات على الجلسة"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
