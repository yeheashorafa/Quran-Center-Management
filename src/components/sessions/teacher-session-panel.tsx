"use client";

import { useEffect, useMemo, useState } from "react";
import { ParentReportSelector } from "@/components/reports/parent-report-selector";
import { MonthlyReportsPanel } from "@/components/reports/monthly-reports-panel";
import { SessionDetailModal, type SessionDetailData } from "@/components/sessions/session-detail-modal";
import { TeacherStudentsPanel } from "@/components/teacher/teacher-students-panel";
import { QURAN_SURAHS, calculateAyahPageCount } from "@/lib/quran/metadata";
import type {
  SessionActivityCode,
  SessionAttendanceCode,
  SessionStudentValue,
  TeacherSessionDashboardData,
  TeacherSessionEditorData,
} from "@/lib/memorization-sessions/types";

const ACTIVITY_LABELS: Record<
  SessionActivityCode,
  { label: string; icon: string; colorClass: string; bgClass: string; borderClass: string }
> = {
  MEMORIZATION: {
    label: "حفظ جديد",
    icon: "📖",
    colorClass: "text-emerald-900",
    bgClass: "bg-emerald-50",
    borderClass: "border-emerald-300",
  },
  REVIEW: {
    label: "مراجعة",
    icon: "🔄",
    colorClass: "text-blue-900",
    bgClass: "bg-blue-50",
    borderClass: "border-blue-300",
  },
  RECITATION: {
    label: "سرد",
    icon: "🎙️",
    colorClass: "text-purple-900",
    bgClass: "bg-purple-50",
    borderClass: "border-purple-300",
  },
};

async function readApiPayload(response: Response): Promise<{ message?: string; data?: TeacherSessionEditorData }> {
  try {
    return (await response.json()) as { message?: string; data?: TeacherSessionEditorData };
  } catch {
    return {};
  }
}

export function TeacherSessionPanel({
  dashboard,
  initialHalaqaId,
  initialDate,
}: {
  dashboard: TeacherSessionDashboardData;
  initialHalaqaId: string;
  initialDate: string;
}) {
  const [activeTab, setActiveTab] = useState<"recitation" | "students" | "history" | "parent_report" | "monthly_report">("recitation");
  const [halaqaId, setHalaqaId] = useState(initialHalaqaId);
  const [sessionDate, setSessionDate] = useState(initialDate);
  const [editor, setEditor] = useState<TeacherSessionEditorData | null>(null);
  const [students, setStudents] = useState<SessionStudentValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  // History inspection Modal state
  const [selectedHistorySession, setSelectedHistorySession] = useState<SessionDetailData | null>(null);

  const selectedHalaqa = useMemo(
    () => dashboard.halaqat.find((item) => item.id === halaqaId) ?? dashboard.halaqat[0],
    [dashboard.halaqat, halaqaId],
  );

  useEffect(() => {
    if (!halaqaId || !sessionDate) return;

    const controller = new AbortController();
    queueMicrotask(() => {
      setLoading(true);
      setNotice(null);
    });

    fetch(`/api/teacher/sessions/${halaqaId}/${sessionDate}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as TeacherSessionEditorData | { message?: string };
        if (!response.ok) {
          throw new Error("message" in payload ? payload.message || "تعذر تحميل الجلسة." : "تعذر تحميل الجلسة.");
        }
        const data = payload as TeacherSessionEditorData;
        setEditor(data);
        setStudents(data.students);

        // Default first student expanded for mobile
        if (data.students.length > 0) {
          setExpandedStudentId(data.students[0]!.studentId);
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setEditor(null);
        setStudents([]);
        setNotice({
          type: "error",
          text: error instanceof Error ? error.message : "تعذر تحميل الجلسة.",
        });
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

  function updateStudent(studentId: string, update: (student: SessionStudentValue) => SessionStudentValue) {
    setStudents((current) => current.map((student) => (student.studentId === studentId ? update(student) : student)));
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

  function updateActivityText(studentId: string, type: SessionActivityCode, text: string, pageCount: number) {
    updateStudent(studentId, (student) => ({
      ...student,
      activities: student.activities.map((activity) =>
        activity.type === type ? { ...activity, text, pageCount } : activity,
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
        setEditor(payload.data);
        setStudents(payload.data.students);
      }
      setNotice({ type: "success", text: payload.message || "تم حفظ البيانات بنجاح." });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "تعذر حفظ الجلسة." });
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* 6 Organized Dashboard Tabs Navigation Bar */}
      <nav className="flex overflow-x-auto rounded-3xl border border-emerald-100 bg-white p-1.5 shadow-sm scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab("recitation")}
          className={`flex min-h-11 items-center gap-2 whitespace-nowrap rounded-2xl px-5 text-xs font-black transition ${
            activeTab === "recitation"
              ? "bg-emerald-900 text-white shadow-md shadow-emerald-950/20"
              : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-900"
          }`}
        >
          <span>📖 التسميع اليومي</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("students")}
          className={`flex min-h-11 items-center gap-2 whitespace-nowrap rounded-2xl px-5 text-xs font-black transition ${
            activeTab === "students"
              ? "bg-emerald-900 text-white shadow-md shadow-emerald-950/20"
              : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-900"
          }`}
        >
          <span>👥 طلاب الحلقة</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex min-h-11 items-center gap-2 whitespace-nowrap rounded-2xl px-5 text-xs font-black transition ${
            activeTab === "history"
              ? "bg-emerald-900 text-white shadow-md shadow-emerald-950/20"
              : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-900"
          }`}
        >
          <span>📜 الجلسات المسجلة ({dashboard.recentSessions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("parent_report")}
          className={`flex min-h-11 items-center gap-2 whitespace-nowrap rounded-2xl px-5 text-xs font-black transition ${
            activeTab === "parent_report"
              ? "bg-emerald-900 text-white shadow-md shadow-emerald-950/20"
              : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-900"
          }`}
        >
          <span>📄 تقرير ولي الأمر</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("monthly_report")}
          className={`flex min-h-11 items-center gap-2 whitespace-nowrap rounded-2xl px-5 text-xs font-black transition ${
            activeTab === "monthly_report"
              ? "bg-emerald-900 text-white shadow-md shadow-emerald-950/20"
              : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-900"
          }`}
        >
          <span>📊 التقرير الشهري</span>
        </button>
      </nav>

      {notice ? (
        <div
          className={`rounded-2xl border p-4 text-xs font-black ${
            notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      {/* Tab 1: Daily Recitation Tab */}
      {activeTab === "recitation" ? (
        <div className="space-y-6">
          {/* Controls Bar: Single Halaqa Display or Dropdown */}
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="form-label" htmlFor="session-halaqa">الحلقة الدراسية</label>
                {dashboard.halaqat.length > 1 ? (
                  <select
                    id="session-halaqa"
                    className="form-control font-black"
                    value={halaqaId}
                    onChange={(event) => setHalaqaId(event.target.value)}
                  >
                    {dashboard.halaqat.map((halaqa) => (
                      <option key={halaqa.id} value={halaqa.id}>
                        {halaqa.nameAr} ({halaqa.stageName})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="form-control flex items-center bg-emerald-50/60 font-black text-emerald-950 border-emerald-200">
                    🕌 {selectedHalaqa?.nameAr} ({selectedHalaqa?.stageName})
                  </div>
                )}
              </div>

              <div>
                <label className="form-label" htmlFor="session-date">تاريخ التسميع</label>
                <input
                  id="session-date"
                  className="form-control font-black"
                  type="date"
                  max={initialDate}
                  value={sessionDate}
                  onChange={(event) => setSessionDate(event.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Recitation Main Content */}
          {loading ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm">
              <div className="mx-auto size-8 animate-spin rounded-full border-4 border-emerald-700 border-t-transparent" />
              <p className="mt-4 text-sm font-bold">جاري تحميل طلاب الحلقة والجلسة...</p>
            </div>
          ) : editor?.allowed ? (
            <div className="space-y-4">
              {/* Quick Stats Bar */}
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                <StatCard label="الطلاب" value={students.length} color="bg-slate-50 text-slate-900" />
                <StatCard label="حاضر" value={totals.present} color="bg-emerald-50 text-emerald-900" />
                <StatCard label="غائب" value={totals.absent} color="bg-red-50 text-red-900" />
                <StatCard label="عذر" value={totals.excused} color="bg-blue-50 text-blue-900" />
                <StatCard label="لم يسمع" value={totals.notHeard} color="bg-amber-50 text-amber-900" />
                <StatCard label="صفحات" value={totals.pages} color="bg-purple-50 text-purple-900" />
              </div>

              {/* Collapsible Student Recitation Cards (Mobile First Accordion) */}
              <div className="space-y-3">
                {students.map((student) => {
                  const isExpanded = expandedStudentId === student.studentId;
                  return (
                    <article
                      key={student.studentId}
                      className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-200"
                    >
                      {/* Card Collapsible Header */}
                      <div
                        onClick={() => setExpandedStudentId(isExpanded ? null : student.studentId)}
                        className="flex cursor-pointer items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex size-9 items-center justify-center rounded-2xl bg-emerald-50 text-sm font-black text-emerald-900">
                            {student.attendance === "PRESENT"
                              ? "✅"
                              : student.attendance === "ABSENT"
                                ? "❌"
                                : student.attendance === "EXCUSED"
                                  ? "🔵"
                                  : student.attendance === "NOT_HEARD"
                                    ? "⚠️"
                                    : "⏳"}
                          </span>
                          <div>
                            <h3 className="text-base font-black text-slate-950">{student.displayName}</h3>
                            <p className="text-xs font-bold text-slate-500">
                              {student.attendance === "PRESENT"
                                ? "حاضر (اضغط لإدخال السور)"
                                : student.attendance === "ABSENT"
                                  ? "غائب"
                                  : student.attendance === "EXCUSED"
                                    ? "عذر"
                                    : student.attendance === "NOT_HEARD"
                                      ? "حضر ولم يسمّع"
                                      : "لم تسجّل حالته بعد"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-400">
                            {isExpanded ? "▲ إغلاق" : "▼ تسجيل"}
                          </span>
                        </div>
                      </div>

                      {/* Accordion Body */}
                      {isExpanded ? (
                        <div className="mt-4 border-t border-slate-100 pt-4 space-y-4">
                          {/* Attendance Options */}
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <button
                              type="button"
                              onClick={() => setAttendance(student.studentId, "PRESENT")}
                              className={`rounded-2xl p-2.5 text-xs font-black transition ${
                                student.attendance === "PRESENT"
                                  ? "bg-emerald-900 text-white shadow-md"
                                  : "border border-slate-200 bg-white text-slate-700 hover:bg-emerald-50"
                              }`}
                            >
                              حاضر
                            </button>
                            <button
                              type="button"
                              onClick={() => setAttendance(student.studentId, "NOT_HEARD")}
                              className={`rounded-2xl p-2.5 text-xs font-black transition ${
                                student.attendance === "NOT_HEARD"
                                  ? "bg-amber-700 text-white shadow-md"
                                  : "border border-slate-200 bg-white text-slate-700 hover:bg-amber-50"
                              }`}
                            >
                              لم يسمّع
                            </button>
                            <button
                              type="button"
                              onClick={() => setAttendance(student.studentId, "ABSENT")}
                              className={`rounded-2xl p-2.5 text-xs font-black transition ${
                                student.attendance === "ABSENT"
                                  ? "bg-red-700 text-white shadow-md"
                                  : "border border-slate-200 bg-white text-slate-700 hover:bg-red-50"
                              }`}
                            >
                              غائب
                            </button>
                            <button
                              type="button"
                              onClick={() => setAttendance(student.studentId, "EXCUSED")}
                              className={`rounded-2xl p-2.5 text-xs font-black transition ${
                                student.attendance === "EXCUSED"
                                  ? "bg-blue-700 text-white shadow-md"
                                  : "border border-slate-200 bg-white text-slate-700 hover:bg-blue-50"
                              }`}
                            >
                              عذر
                            </button>
                          </div>

                          {/* Recitation Quran Surahs Input Area if PRESENT */}
                          {student.attendance === "PRESENT" ? (
                            <div className="space-y-4 rounded-2xl bg-slate-50 p-4 border border-slate-200">
                              {student.activities.map((activity) => (
                                <ActivityQuranSelector
                                  key={activity.type}
                                  activity={activity}
                                  onChange={(text, pages) =>
                                    updateActivityText(student.studentId, activity.type, text, pages)
                                  }
                                />
                              ))}
                            </div>
                          ) : null}

                          {/* Student Notes */}
                          <div>
                            <label className="form-label text-xs">ملاحظات المحفظ للطالب</label>
                            <input
                              type="text"
                              placeholder="أدخل ملاحظات خاصة إن وجدت..."
                              className="form-control text-xs font-bold"
                              value={student.notes || ""}
                              onChange={(e) =>
                                updateStudent(student.studentId, (s) => ({ ...s, notes: e.target.value }))
                              }
                            />
                          </div>

                          {/* Individual Save Button */}
                          <div className="flex justify-end pt-2">
                            <button
                              type="button"
                              disabled={busyKey === `student-${student.studentId}`}
                              onClick={() => saveStudents([student.studentId], false)}
                              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-black disabled:opacity-50"
                            >
                              {busyKey === `student-${student.studentId}` ? "جاري الحفظ..." : "حفظ بيانات هذا الطالب فقط"}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>

              {/* Complete Session Action Footer */}
              <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-emerald-200 bg-white/95 p-4 shadow-xl backdrop-blur-md">
                <span className="text-xs font-black text-slate-800">
                  تم تسجيل: {totals.present + totals.absent + totals.excused + totals.notHeard} من {students.length} طالب
                </span>
                <button
                  type="button"
                  disabled={busyKey === "complete-session"}
                  onClick={() => saveStudents(students.map((s) => s.studentId), true)}
                  className="min-h-12 rounded-2xl bg-emerald-900 px-6 text-sm font-black text-white shadow-lg transition hover:bg-emerald-950 disabled:opacity-50"
                >
                  {busyKey === "complete-session" ? "جاري اعتماد الجلسة..." : "✅ اعتماد الجلسة بالكامل"}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-center text-sm font-bold text-red-900">
              لا يمكن التسميع في هذا التاريخ لعدم مواءمته لجدول الحلقة.
            </div>
          )}
        </div>
      ) : null}

      {/* Tab 2: Teacher Students Tab */}
      {activeTab === "students" ? (
        <TeacherStudentsPanel
          halaqaId={halaqaId}
          students={students.map((s) => ({
            studentId: s.studentId,
            fullName: s.fullName,
            displayName: s.displayName,
            parentPhone: null,
            gradeLevel: null,
            halaqaName: selectedHalaqa.nameAr,
            stageName: selectedHalaqa.stageName,
            memorizationStartedOn: null,
          }))}
          onRefresh={() => window.location.reload()}
        />
      ) : null}

      {/* Tab 3: Saved History Sessions Tab */}
      {activeTab === "history" ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-lg font-black text-slate-950">سجل الجلسات التسميعية الأخيرة</h2>
          <div className="divide-y divide-slate-100">
            {dashboard.recentSessions.map((session) => (
              <div
                key={session.id}
                onClick={() =>
                  setSelectedHistorySession({
                    sessionId: session.id,
                    halaqaId: session.halaqaId,
                    halaqaName: session.halaqaName,
                    stageName: selectedHalaqa.stageName,
                    teacherName: "",
                    sessionDate: session.sessionDate,
                    weekdayLabel: session.sessionDate,
                    status: session.status,
                    version: 1,
                    items: students.map((item) => ({
                      studentId: item.studentId,
                      displayName: item.displayName,
                      attendance: item.attendance,
                      notes: item.notes,
                      activities: item.activities.map((act) => ({
                        type: act.type,
                        pageCount: act.pageCount,
                        notes: act.text,
                      })),
                    })),
                  })
                }
                className="flex cursor-pointer items-center justify-between py-3 hover:bg-slate-50 rounded-xl px-3 transition"
              >
                <div>
                  <span className="text-xs font-black text-emerald-900">جلسة تاريخ: {session.sessionDate}</span>
                  <p className="text-sm font-bold text-slate-800">{session.halaqaName} ({session.recordedStudents}/{session.totalStudents} طالب)</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-900">
                  استعراض وتعديل الجلسة 🔍
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Tab 4: Parent Report Selector Tab */}
      {activeTab === "parent_report" ? (
        <ParentReportSelector students={students.map((s) => ({ id: s.studentId, displayName: s.displayName }))} />
      ) : null}

      {/* Tab 5: Monthly Reports Tab */}
      {activeTab === "monthly_report" ? (
        <MonthlyReportsPanel
          options={{
            roleCode: "TEACHER",
            defaultKind: "COMPREHENSIVE",
            allowedKinds: ["COMPREHENSIVE"],
            stages: [],
          }}
          initialMonth={initialDate.slice(0, 7)}
        />
      ) : null}

      {/* Modal for History Detail Inspection & Editing */}
      {selectedHistorySession ? (
        <SessionDetailModal
          data={selectedHistorySession}
          onClose={() => setSelectedHistorySession(null)}
          onUpdateSuccess={() => {
            setSelectedHistorySession(null);
            window.location.reload();
          }}
        />
      ) : null}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-2xl p-3 text-center ${color}`}>
      <span className="block text-[11px] font-bold opacity-80">{label}</span>
      <span className="text-lg font-black">{value}</span>
    </div>
  );
}

/**
 * Component for selecting Quran Surah, fromAyah, toAyah with Full Surah button & auto page count
 */
function ActivityQuranSelector({
  activity,
  onChange,
}: {
  activity: { type: SessionActivityCode; text: string; pageCount: number };
  onChange: (text: string, pageCount: number) => void;
}) {
  const meta = ACTIVITY_LABELS[activity.type];
  const [selectedSurahNumber, setSelectedSurahNumber] = useState<number>(1);
  const [fromAyah, setFromAyah] = useState<number>(1);
  const [toAyah, setToAyah] = useState<number>(7);

  const selectedSurah = useMemo(
    () => QURAN_SURAHS.find((s) => s.number === selectedSurahNumber) ?? QURAN_SURAHS[0]!,
    [selectedSurahNumber],
  );

  function handleSurahChange(num: number) {
    setSelectedSurahNumber(num);
    const surah = QURAN_SURAHS.find((s) => s.number === num) ?? QURAN_SURAHS[0]!;
    setFromAyah(1);
    setToAyah(surah.totalAyahs);
    const pages = calculateAyahPageCount(num, 1, surah.totalAyahs);
    onChange(`سورة ${surah.nameAr} (من 1 إلى ${surah.totalAyahs})`, pages);
  }

  function handleFullSurah() {
    setFromAyah(1);
    setToAyah(selectedSurah.totalAyahs);
    const pages = calculateAyahPageCount(selectedSurah.number, 1, selectedSurah.totalAyahs);
    onChange(`سورة ${selectedSurah.nameAr} كاملة`, pages);
  }

  function handleAyahChange(from: number, to: number) {
    const validFrom = Math.max(1, Math.min(from, selectedSurah.totalAyahs));
    const validTo = Math.max(validFrom, Math.min(to, selectedSurah.totalAyahs));
    setFromAyah(validFrom);
    setToAyah(validTo);
    const pages = calculateAyahPageCount(selectedSurah.number, validFrom, validTo);
    onChange(`سورة ${selectedSurah.nameAr} (${validFrom} - ${validTo})`, pages);
  }

  return (
    <div className={`rounded-2xl border p-3.5 space-y-3 ${meta.bgClass} ${meta.borderClass}`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-black flex items-center gap-1.5 ${meta.colorClass}`}>
          <span>{meta.icon}</span>
          <span>{meta.label}</span>
        </span>
        <button
          type="button"
          onClick={handleFullSurah}
          className="rounded-xl bg-white px-2.5 py-1 text-[11px] font-black text-slate-800 border border-slate-200 hover:bg-slate-50"
        >
          🎯 السورة كاملة
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {/* Surah Dropdown */}
        <div>
          <label className="text-[11px] font-bold text-slate-600 block mb-1">اختر السورة:</label>
          <select
            value={selectedSurahNumber}
            onChange={(e) => handleSurahChange(Number(e.target.value))}
            className="form-control text-xs font-black"
          >
            {QURAN_SURAHS.map((s) => (
              <option key={s.number} value={s.number}>
                {s.number}. {s.nameAr} ({s.totalAyahs} آية)
              </option>
            ))}
          </select>
        </div>

        {/* From Ayah */}
        <div>
          <label className="text-[11px] font-bold text-slate-600 block mb-1">من آية:</label>
          <input
            type="number"
            min={1}
            max={selectedSurah.totalAyahs}
            value={fromAyah}
            onChange={(e) => handleAyahChange(Number(e.target.value), toAyah)}
            className="form-control text-xs font-black"
          />
        </div>

        {/* To Ayah */}
        <div>
          <label className="text-[11px] font-bold text-slate-600 block mb-1">إلى آية:</label>
          <input
            type="number"
            min={1}
            max={selectedSurah.totalAyahs}
            value={toAyah}
            onChange={(e) => handleAyahChange(fromAyah, Number(e.target.value))}
            className="form-control text-xs font-black"
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs font-bold pt-1 text-slate-700">
        <span>النص المحسوب: {activity.text || `سورة ${selectedSurah.nameAr}`}</span>
        <span className="rounded-md bg-white px-2 py-0.5 font-black border text-slate-900">
          الصفحات: {activity.pageCount} ص
        </span>
      </div>
    </div>
  );
}
