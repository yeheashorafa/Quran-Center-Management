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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-3xl bg-white p-6 shadow-2xl overflow-hidden sm:p-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-900">
                {data.weekdayLabel} — {data.sessionDate}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                {data.halaqaName}
              </span>
            </div>
            <h2 className="mt-2 text-xl font-black text-slate-950">تفاصيل الجلسة المسجلة</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            إغلاق
          </button>
        </div>

        {notice ? (
          <div
            className={`mt-4 rounded-2xl border px-4 py-3 text-xs font-black ${
              notice.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {notice.text}
          </div>
        ) : null}

        {/* Scrollable Content Body */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1">
          {items.map((student, idx) => (
            <article key={student.studentId} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/60 pb-3">
                <span className="font-black text-slate-950 text-base">{student.displayName}</span>

                {/* Attendance Toggle Buttons */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => updateAttendance(idx, "PRESENT")}
                    className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                      student.attendance === "PRESENT"
                        ? "bg-emerald-900 text-white shadow-sm"
                        : "bg-white text-slate-700 border border-slate-200"
                    }`}
                  >
                    حاضر
                  </button>
                  <button
                    type="button"
                    onClick={() => updateAttendance(idx, "NOT_HEARD")}
                    className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                      student.attendance === "NOT_HEARD"
                        ? "bg-amber-700 text-white shadow-sm"
                        : "bg-white text-slate-700 border border-slate-200"
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
                        : "bg-white text-slate-700 border border-slate-200"
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
                        : "bg-white text-slate-700 border border-slate-200"
                    }`}
                  >
                    عذر
                  </button>
                </div>
              </div>

              {/* Activities Breakdown if Present */}
              {student.attendance === "PRESENT" ? (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">الأنشطة والتسميع:</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => addActivity(idx, "MEMORIZATION")}
                        className="rounded-lg bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-950 hover:bg-emerald-200"
                      >
                        + حفظ
                      </button>
                      <button
                        type="button"
                        onClick={() => addActivity(idx, "REVIEW")}
                        className="rounded-lg bg-blue-100 px-2.5 py-1 text-[11px] font-black text-blue-950 hover:bg-blue-200"
                      >
                        + مراجعة
                      </button>
                      <button
                        type="button"
                        onClick={() => addActivity(idx, "RECITATION")}
                        className="rounded-lg bg-purple-100 px-2.5 py-1 text-[11px] font-black text-purple-950 hover:bg-purple-200"
                      >
                        + سرد
                      </button>
                    </div>
                  </div>

                  {student.activities.map((act, aIdx) => (
                    <div key={aIdx} className="flex items-center justify-between gap-2 rounded-xl bg-white p-2.5 border border-slate-200 text-xs">
                      <span className="font-black text-emerald-900">
                        {act.type === "MEMORIZATION" ? "📖 حفظ" : act.type === "REVIEW" ? "🔄 مراجعة" : "🎙️ سرد"}
                      </span>
                      <span className="font-bold text-slate-700">{act.notes || `سورة ${act.surahName}`}</span>
                      <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                        {act.pageCount} صفحة
                      </span>
                      <button
                        type="button"
                        onClick={() => removeActivity(idx, aIdx)}
                        className="text-red-600 font-bold hover:text-red-800"
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
        <div className="mt-4 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="min-h-11 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleSaveChanges}
            className="min-h-11 rounded-xl bg-emerald-900 px-6 text-sm font-black text-white shadow-sm hover:bg-emerald-950 disabled:opacity-50"
          >
            {busy ? "جاري التحديث..." : "حفظ التعديلات على الجلسة"}
          </button>
        </div>
      </div>
    </div>
  );
}
