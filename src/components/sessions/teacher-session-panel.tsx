"use client";

import { useEffect, useMemo, useState } from "react";
import { ParentReportSelector } from "@/components/reports/parent-report-selector";
import { MonthlyReportsPanel } from "@/components/reports/monthly-reports-panel";
import { SessionDetailModal, type SessionDetailData } from "@/components/sessions/session-detail-modal";
import { TeacherStudentsPanel } from "@/components/teacher/teacher-students-panel";
import { QURAN_SURAHS, calculateAyahPageCount } from "@/lib/quran/metadata";
import { NetworkStatusBar } from "@/components/offline/network-status-bar";
import { getSessionDraft, removeSessionDraft, saveSessionDraft, type SessionDraftRecord } from "@/lib/offline/session-drafts";
import { enqueueSyncItem, getAllSyncItems, type SyncQueueItem } from "@/lib/offline/sync-queue";
import { getTeacherDataCache, saveTeacherDataCache } from "@/lib/offline/teacher-cache";
import { getOfflineTeacherProfile, saveOfflineTeacherProfile } from "@/lib/offline/offline-profile";
import { PendingSessionsList } from "@/components/offline/pending-sessions-list";
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

  // Offline status & cache metadata
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [lastCacheTime, setLastCacheTime] = useState<string | null>(null);

  // Local Draft & Queue state
  const [pendingDraft, setPendingDraft] = useState<SessionDraftRecord | null>(null);
  const [offlineSyncItems, setOfflineSyncItems] = useState<SyncQueueItem[]>([]);

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
      setPendingDraft(null);
    });

    // Check IndexedDB draft & queue items
    void getSessionDraft("teacher", halaqaId, sessionDate).then((draft) => {
      if (draft && draft.students.length > 0) {
        setPendingDraft(draft);
      }
    });

    void getAllSyncItems().then(setOfflineSyncItems);

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
        setIsOfflineMode(false);

        const nowStr = new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) + " - " + new Date().toLocaleDateString("ar-EG");
        setLastCacheTime(nowStr);

        // Cache online data to IndexedDB for offline use
        void saveTeacherDataCache("teacher", halaqaId, dashboard, data.students, data);
        void saveOfflineTeacherProfile({
          teacherId: "teacher",
          halaqaId,
          teacherName: "الشيخ",
          halaqaName: data.halaqa.nameAr,
          cachedAt: Date.now(),
          lastOnlineLoginAt: Date.now(),
        });

        // Default first student expanded for mobile
        if (data.students.length > 0) {
          setExpandedStudentId(data.students[0]!.studentId);
        }
      })
      .catch(async (error) => {
        if (controller.signal.aborted) return;

        // Fallback to local IndexedDB cache when offline or fetch fails
        const cache = await getTeacherDataCache("teacher", halaqaId);
        const profile = await getOfflineTeacherProfile();

        if (cache && cache.students.length > 0) {
          setStudents(cache.students);
          setEditor(
            cache.editor || {
              allowed: true,
              reason: null,
              date: sessionDate,
              weekday: "SUNDAY",
              weekdayLabel: "الأحد",
              halaqa: {
                id: halaqaId,
                nameAr: profile?.halaqaName || selectedHalaqa?.nameAr || "الحلقة",
                stageName: selectedHalaqa?.stageName || "",
                weekdays: selectedHalaqa?.weekdays || [],
              },
              session: null,
              students: cache.students,
            },
          );
          setIsOfflineMode(true);
          const cacheDateStr = new Date(cache.cachedAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) + " - " + new Date(cache.cachedAt).toLocaleDateString("ar-EG");
          setLastCacheTime(cacheDateStr);

          if (cache.students.length > 0) {
            setExpandedStudentId(cache.students[0]!.studentId);
          }
        } else {
          setEditor(null);
          setStudents([]);
          setIsOfflineMode(true);
          setNotice({
            type: "error",
            text: error instanceof Error ? error.message : "تعذر الاتصال بالشبكة ولم يتم العثور على بيانات طلاب محفوظة لهذه الحلقة.",
          });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [halaqaId, sessionDate, dashboard, selectedHalaqa]);

  // Auto-save draft locally whenever student recitation data is modified
  function handleStudentsUpdate(newStudents: SessionStudentValue[]) {
    setStudents(newStudents);
    if (halaqaId && sessionDate) {
      void saveSessionDraft("teacher", halaqaId, sessionDate, newStudents);
    }
  }

  function restoreLocalDraft() {
    if (pendingDraft) {
      setStudents(pendingDraft.students);
      setPendingDraft(null);
      setNotice({ type: "success", text: "تم استرجاع المسودة المحلية المحفوظة على جهازك بنجاح." });
    }
  }

  function discardLocalDraft() {
    if (pendingDraft) {
      void removeSessionDraft("teacher", halaqaId, sessionDate);
      setPendingDraft(null);
      setNotice({ type: "success", text: "تم تجاهل المسودة المحلية." });
    }
  }

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
    const updated = students.map((student) => (student.studentId === studentId ? update(student) : student));
    handleStudentsUpdate(updated);
  }

  function setAttendance(studentId: string, attendance: SessionAttendanceCode) {
    updateStudent(studentId, (student) => ({
      ...student,
      attendance,
      activities:
        attendance === "NOT_HEARD" || attendance === "ABSENT" || attendance === "EXCUSED"
          ? []
          : student.activities,
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
    if (!halaqaId || !sessionDate) return;

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

    const payloadData = { date: sessionDate, complete, items };
    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

    if (isOffline || isOfflineMode) {
      await enqueueSyncItem({
        teacherId: "teacher",
        halaqaId,
        sessionDate,
        type: complete ? "save_session" : "save_student",
        endpoint: `/api/teacher/sessions/${halaqaId}/${sessionDate}`,
        method: "PUT",
        payload: payloadData,
      });
      void getAllSyncItems().then(setOfflineSyncItems);
      setNotice({
        type: "success",
        text: "تم حفظ الجلسة محلياً، وسيتم رفعها ومزامنتها تلقائياً عند عودة الإنترنت.",
      });
      setBusyKey(null);
      return;
    }

    try {
      const response = await fetch(`/api/teacher/sessions/${halaqaId}/${sessionDate}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadData),
      });
      const payload = await readApiPayload(response);
      if (!response.ok) throw new Error(payload.message || "تعذر حفظ الجلسة.");
      if (payload.data) {
        setEditor(payload.data);
        setStudents(payload.data.students);
        void removeSessionDraft("teacher", halaqaId, sessionDate);
        void saveTeacherDataCache("teacher", halaqaId, dashboard, payload.data.students, payload.data);
      }
      setNotice({ type: "success", text: payload.message || "تم حفظ البيانات بنجاح." });
    } catch {
      // Fallback to offline queue if network fetch failed
      await enqueueSyncItem({
        teacherId: "teacher",
        halaqaId,
        sessionDate,
        type: complete ? "save_session" : "save_student",
        endpoint: `/api/teacher/sessions/${halaqaId}/${sessionDate}`,
        method: "PUT",
        payload: payloadData,
      });
      void getAllSyncItems().then(setOfflineSyncItems);
      setNotice({
        type: "success",
        text: "تعذر الاتصال بالخادم. تم حفظ الجلسة محلياً بانتظار المزامنة عند عودة الإنترنت.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Network Status & Offline Queue Monitoring */}
      <NetworkStatusBar onSyncCompleted={() => void getAllSyncItems().then(setOfflineSyncItems)} />

      {/* Offline Mode Last Cache Timestamp Banner (Requirement 5) */}
      {isOfflineMode || (typeof navigator !== "undefined" && !navigator.onLine) ? (
        <aside aria-label="شريط وضع الأوفلاين" className="rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-xs font-bold text-amber-950 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-amber-500 animate-pulse" />
            <span>
              أنت تعمل بدون إنترنت — آخر تحديث لبيانات الطلاب كان:{" "}
              <strong className="font-black text-amber-900">{lastCacheTime || "غير محدد"}</strong>
            </span>
          </div>
          <span className="rounded-lg bg-amber-200/80 px-2.5 py-1 text-[11px] font-black text-amber-900">
            PWA Offline Mode
          </span>
        </aside>
      ) : null}

      {/* Local Draft Recovery Prompt Banner */}
      {pendingDraft ? (
        <aside aria-label="استرجاع المسودة المحلية" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs font-bold text-amber-950 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="font-black text-amber-900 text-sm">⚠️ يوجد تسميع محفوظ محلياً لهذه الجلسة لم يتم رفعه بعد!</p>
              <p className="mt-1 text-amber-800">
                عُثر على مسودة تسميع مخزنة محلياً على جهازك لم ترفع بعد. هل ترغب باسترجاعها أم إهمالها؟
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={restoreLocalDraft}
                className="rounded-xl bg-amber-900 px-4 py-2 text-xs font-black text-white shadow-xs hover:bg-amber-950"
              >
                📥 استرجاع المسودة
              </button>
              <button
                type="button"
                onClick={discardLocalDraft}
                className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"
              >
                تجاهل
              </button>
            </div>
          </div>
        </aside>
      ) : null}

      {/* 5 Dashboard Tabs Navigation Bar */}
      <nav className="flex overflow-x-auto rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-1.5 shadow-sm scrollbar-none transition-colors duration-200">
        <button
          type="button"
          onClick={() => setActiveTab("recitation")}
          className={`flex min-h-11 items-center gap-2 whitespace-nowrap rounded-2xl px-5 text-xs font-black transition ${
            activeTab === "recitation"
              ? "bg-[var(--primary)] text-white shadow-md"
              : "text-[var(--text-muted)] hover:bg-[var(--card-soft)] hover:text-[var(--primary)]"
          }`}
        >
          <span>📖 التسميع اليومي</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("students")}
          className={`flex min-h-11 items-center gap-2 whitespace-nowrap rounded-2xl px-5 text-xs font-black transition ${
            activeTab === "students"
              ? "bg-[var(--primary)] text-white shadow-md"
              : "text-[var(--text-muted)] hover:bg-[var(--card-soft)] hover:text-[var(--primary)]"
          }`}
        >
          <span>👥 طلاب الحلقة</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex min-h-11 items-center gap-2 whitespace-nowrap rounded-2xl px-5 text-xs font-black transition ${
            activeTab === "history"
              ? "bg-[var(--primary)] text-white shadow-md"
              : "text-[var(--text-muted)] hover:bg-[var(--card-soft)] hover:text-[var(--primary)]"
          }`}
        >
          <span>📜 الجلسات المسجلة ({dashboard.recentSessions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("parent_report")}
          className={`flex min-h-11 items-center gap-2 whitespace-nowrap rounded-2xl px-5 text-xs font-black transition ${
            activeTab === "parent_report"
              ? "bg-[var(--primary)] text-white shadow-md"
              : "text-[var(--text-muted)] hover:bg-[var(--card-soft)] hover:text-[var(--primary)]"
          }`}
        >
          <span>📄 تقرير ولي الأمر</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("monthly_report")}
          className={`flex min-h-11 items-center gap-2 whitespace-nowrap rounded-2xl px-5 text-xs font-black transition ${
            activeTab === "monthly_report"
              ? "bg-[var(--primary)] text-white shadow-md"
              : "text-[var(--text-muted)] hover:bg-[var(--card-soft)] hover:text-[var(--primary)]"
          }`}
        >
          <span>📊 التقرير الشهري</span>
        </button>
      </nav>

      {notice ? (
        <div
          className={`rounded-2xl border p-4 text-xs font-black ${
            notice.type === "success"
              ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
              : "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      {/* Tab 1: Daily Recitation Tab */}
      {activeTab === "recitation" ? (
        <div className="space-y-6">
          {/* Pending Sessions Queue Component (Requirement 6 & 7) */}
          <PendingSessionsList
            items={offlineSyncItems}
            onRefresh={() => void getAllSyncItems().then(setOfflineSyncItems)}
          />

          {/* Controls Bar: Single Halaqa Display or Dropdown */}
          <section className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 shadow-sm sm:p-5 text-[var(--text-main)] transition-colors duration-200">
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
                  <div className="form-control flex items-center bg-[var(--card-soft)] font-black text-[var(--primary)] border-[var(--border-color)]">
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
            <div className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-12 text-center text-[var(--text-muted)] shadow-sm">
              <div className="mx-auto size-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
              <p className="mt-4 text-sm font-bold">جاري تحميل طلاب الحلقة والجلسة...</p>
            </div>
          ) : editor?.allowed || isOfflineMode ? (
            <div className="space-y-4">
              {/* Quick Stats Bar */}
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                <StatCard label="الطلاب" value={students.length} color="bg-[var(--card-soft)] text-[var(--text-main)] border border-[var(--border-color)]" />
                <StatCard label="حاضر" value={totals.present} color="bg-[var(--status-success-bg)] text-[var(--status-success-text)] border border-[var(--status-success-border)]" />
                <StatCard label="غائب" value={totals.absent} color="bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border border-[var(--status-danger-border)]" />
                <StatCard label="عذر" value={totals.excused} color="bg-[var(--status-info-bg)] text-[var(--status-info-text)] border border-[var(--status-info-border)]" />
                <StatCard label="لم يسمع" value={totals.notHeard} color="bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border border-[var(--status-warning-border)]" />
                <StatCard label="صفحات" value={totals.pages} color="bg-[var(--card-soft)] text-[var(--gold)] border border-[var(--border-color)]" />
              </div>

              {/* Collapsible Student Recitation Cards */}
              <div className="space-y-3">
                {students.map((student) => {
                  const isExpanded = expandedStudentId === student.studentId;
                  return (
                    <article
                      key={student.studentId}
                      className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 shadow-sm transition hover:border-[var(--primary)] text-[var(--text-main)]"
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
                              onClick={() => void saveStudents([student.studentId], false)}
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
                  onClick={() => void saveStudents(students.map((s) => s.studentId), true)}
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
            halaqaName: selectedHalaqa?.nameAr || "الحلقة",
            stageName: selectedHalaqa?.stageName || "",
            memorizationStartedOn: null,
          }))}
          onRefresh={() => window.location.reload()}
        />
      ) : null}

      {/* Tab 3: Saved History Sessions Tab */}
      {activeTab === "history" ? (
        <section className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5 shadow-sm space-y-4 text-[var(--text-main)] transition-colors duration-200">
          <h2 className="text-lg font-black text-[var(--text-main)]">سجل الجلسات التسميعية الأخيرة</h2>

          {/* Pending Offline Sessions Queue Section (Requirement 7) */}
          <PendingSessionsList
            items={offlineSyncItems}
            onRefresh={() => void getAllSyncItems().then(setOfflineSyncItems)}
          />

          <div className="divide-y divide-[var(--border-color)]">
            {dashboard.recentSessions.map((session) => (
              <div
                key={session.id}
                onClick={() =>
                  setSelectedHistorySession({
                    sessionId: session.id,
                    halaqaId: session.halaqaId,
                    halaqaName: session.halaqaName,
                    stageName: selectedHalaqa?.stageName || "",
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
                className="flex cursor-pointer items-center justify-between py-3 hover:bg-[var(--card-soft)] rounded-xl px-3 transition"
              >
                <div>
                  <span className="text-xs font-black text-[var(--primary)]">جلسة تاريخ: {session.sessionDate}</span>
                  <p className="text-sm font-bold text-[var(--text-main)]">{session.halaqaName} ({session.recordedStudents}/{session.totalStudents} طالب)</p>
                </div>
                <span className="rounded-full bg-[var(--card-soft)] border border-[var(--border-color)] px-3 py-1 text-xs font-black text-[var(--primary)]">
                  استعراض وتعديل الجلسة 🔍
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Tab 4: Parent Report Selector Tab */}
      {activeTab === "parent_report" ? (
        isOfflineMode || (typeof navigator !== "undefined" && !navigator.onLine) ? (
          <aside className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-center text-xs font-bold text-amber-950 space-y-2">
            <span className="text-3xl block">📄</span>
            <h3 className="text-sm font-black text-amber-900">تقرير ولي الأمر يحتاج إلى اتّصال بالإنترنت</h3>
            <p className="text-amber-800">
              استخراج وتوليد تقرير ولي الأمر يتطلب التواصل المباشر مع السيرفر. المتاح حالياً بدون نت هو شاشة التسميع اليومية.
            </p>
          </aside>
        ) : (
          <ParentReportSelector students={students.map((s) => ({ id: s.studentId, displayName: s.displayName }))} />
        )
      ) : null}

      {/* Tab 5: Monthly Reports Tab */}
      {activeTab === "monthly_report" ? (
        isOfflineMode || (typeof navigator !== "undefined" && !navigator.onLine) ? (
          <aside className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-center text-xs font-bold text-amber-950 space-y-2">
            <span className="text-3xl block">📊</span>
            <h3 className="text-sm font-black text-amber-900">التقرير الشهري يحتاج إلى اتّصال بالإنترنت</h3>
            <p className="text-amber-800">
              استخراج وتوليد التقارير الشهيرة ورسوم البيانات يتطلب الاتصال بالسيرفر. المتاح حالياً بدون نت هو شاشة التسميع اليومية.
            </p>
          </aside>
        ) : (
          <MonthlyReportsPanel
            options={{
              roleCode: "TEACHER",
              defaultKind: "COMPREHENSIVE",
              allowedKinds: ["COMPREHENSIVE"],
              stages: [],
            }}
            initialMonth={initialDate.slice(0, 7)}
          />
        )
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
          className="rounded-xl bg-[var(--card-bg)] px-2.5 py-1 text-[11px] font-black text-[var(--text-main)] border border-[var(--border-color)] hover:bg-[var(--card-soft)] transition"
        >
          🎯 السورة كاملة
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {/* Surah Dropdown */}
        <div>
          <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">اختر السورة:</label>
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
          <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">من آية:</label>
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
          <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">إلى آية:</label>
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

      <div className="flex items-center justify-between text-xs font-bold pt-1 text-[var(--text-main)]">
        <span>النص المحسوب: {activity.text || `سورة ${selectedSurah.nameAr}`}</span>
        <span className="rounded-md bg-[var(--card-bg)] px-2 py-0.5 font-black border border-[var(--border-color)] text-[var(--text-main)]">
          الصفحات: {activity.pageCount} ص
        </span>
      </div>
    </div>
  );
}
