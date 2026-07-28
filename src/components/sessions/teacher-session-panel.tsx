"use client";

import { useEffect, useMemo, useState } from "react";
import { ParentReportSelector } from "@/components/reports/parent-report-selector";
import { MonthlyReportsPanel } from "@/components/reports/monthly-reports-panel";
import {
  SessionDetailModal,
  type SessionDetailData,
} from "@/components/sessions/session-detail-modal";
import { TeacherStudentsPanel } from "@/components/teacher/teacher-students-panel";
import {
  SurahActivityEditor,
  JuzActivityEditor,
} from "@/components/sessions/quran-activity-editor";
import { NetworkStatusBar } from "@/components/offline/network-status-bar";
import {
  getSessionDraft,
  removeSessionDraft,
  saveSessionDraft,
  type SessionDraftRecord,
} from "@/lib/offline/session-drafts";
import {
  enqueueSyncItem,
  getAllSyncItems,
  type SyncQueueItem,
} from "@/lib/offline/sync-queue";
import {
  getTeacherDataCache,
  saveTeacherDataCache,
} from "@/lib/offline/teacher-cache";
import {
  getOfflineTeacherProfile,
  saveOfflineTeacherProfile,
} from "@/lib/offline/offline-profile";
import { PendingSessionsList } from "@/components/offline/pending-sessions-list";
import { TeacherExamsPanel } from "@/components/teacher/teacher-exams-panel";
import type { OfficialExamListItem } from "@/lib/official-exams/types";
import { WEEKDAY_LABELS } from "@/lib/halaqat/weekdays";
import { weekdayFromDateOnly } from "@/lib/memorization-sessions/date";
import type {
  SessionActivityCode,
  SessionAttendanceCode,
  SessionStudentValue,
  TeacherSessionDashboardData,
  TeacherSessionEditorData,
} from "@/lib/memorization-sessions/types";

async function readApiPayload(
  response: Response,
): Promise<{ message?: string; data?: TeacherSessionEditorData }> {
  try {
    return (await response.json()) as {
      message?: string;
      data?: TeacherSessionEditorData;
    };
  } catch {
    return {};
  }
}

export function TeacherSessionPanel({
  dashboard,
  initialHalaqaId,
  initialDate,
  officialExams = [],
  offlineOnly = false,
}: {
  dashboard: TeacherSessionDashboardData;
  initialHalaqaId: string;
  initialDate: string;
  officialExams?: OfficialExamListItem[];
  offlineOnly?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<
    | "recitation"
    | "students"
    | "history"
    | "exams"
    | "parent_report"
    | "monthly_report"
  >("recitation");
  const [halaqaId, setHalaqaId] = useState(initialHalaqaId);
  const [sessionDate, setSessionDate] = useState(initialDate);
  const [editor, setEditor] = useState<TeacherSessionEditorData | null>(null);
  const [students, setStudents] = useState<SessionStudentValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(
    null,
  );

  // Offline status & cache metadata
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(offlineOnly);
  const [isClientOffline, setIsClientOffline] = useState<boolean>(offlineOnly);
  const [lastCacheTime, setLastCacheTime] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) {
        setIsClientOffline(
          offlineOnly || (typeof navigator !== "undefined" && !navigator.onLine),
        );
      }
    });
    function handleOnline() {
      if (active && !offlineOnly) setIsClientOffline(false);
    }
    function handleOffline() {
      if (active) setIsClientOffline(true);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [offlineOnly]);

  // Local Draft & Queue state
  const [pendingDraft, setPendingDraft] = useState<SessionDraftRecord | null>(
    null,
  );
  const [offlineSyncItems, setOfflineSyncItems] = useState<SyncQueueItem[]>([]);

  // History inspection Modal state
  const [selectedHistorySession, setSelectedHistorySession] =
    useState<SessionDetailData | null>(null);

  const selectedHalaqa = useMemo(
    () =>
      dashboard.halaqat.find((item) => item.id === halaqaId) ??
      dashboard.halaqat[0],
    [dashboard.halaqat, halaqaId],
  );

  const currentWeekday = useMemo(() => {
    try {
      return weekdayFromDateOnly(sessionDate);
    } catch {
      return null;
    }
  }, [sessionDate]);

  const halaqaWeekdays = useMemo(() => {
    return editor?.halaqa?.weekdays?.length
      ? editor.halaqa.weekdays
      : selectedHalaqa?.weekdays || [];
  }, [editor, selectedHalaqa?.weekdays]);

  const scheduledWeekdaysText = useMemo(() => {
    if (!halaqaWeekdays.length) return "غير محددة";
    return halaqaWeekdays.map((w) => WEEKDAY_LABELS[w]).join("، ");
  }, [halaqaWeekdays]);

  const dayNotAllowedReason = useMemo(() => {
    if (editor && editor.allowed === false) {
      return editor.reason;
    }
    if (!halaqaWeekdays || halaqaWeekdays.length === 0) {
      return "لا يمكن التحقق من أيام الحلقة أوفلاين. افتح اللوحة بالإنترنت مرة واحدة لتحديث البيانات.";
    }
    if (currentWeekday && !halaqaWeekdays.includes(currentWeekday)) {
      return `هذا اليوم ليس من أيام تحفيظ هذه الحلقة، ولا يمكنك تسجيل تسميع فيه.\nأيام الحلقة هي: ${scheduledWeekdaysText}.`;
    }
    return null;
  }, [editor, halaqaWeekdays, currentWeekday, scheduledWeekdaysText]);

  const isAllowedSessionDay = !dayNotAllowedReason;

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

    if (offlineOnly || (typeof navigator !== "undefined" && !navigator.onLine)) {
      queueMicrotask(() => {
        setIsOfflineMode(true);
      });
      void getTeacherDataCache("teacher", halaqaId).then((cache) => {
        if (cache && cache.students.length > 0) {
          setStudents(cache.students);
          setEditor(
            cache.editor || {
              allowed: true,
              reason: null,
              date: sessionDate,
              weekday: currentWeekday || "SATURDAY",
              weekdayLabel: currentWeekday ? WEEKDAY_LABELS[currentWeekday] : "السبت",
              halaqa: {
                id: halaqaId,
                nameAr: selectedHalaqa?.nameAr || "الحلقة",
                stageName: selectedHalaqa?.stageName || "",
                weekdays: halaqaWeekdays,
              },
              session: null,
              students: cache.students,
            },
          );
          if (cache.cachedAt) {
            const cacheDateStr =
              new Date(cache.cachedAt).toLocaleTimeString("ar-EG", {
                hour: "2-digit",
                minute: "2-digit",
              }) +
              " - " +
              new Date(cache.cachedAt).toLocaleDateString("ar-EG");
            setLastCacheTime(cacheDateStr);
          }
        }
        setLoading(false);
      });
      return () => controller.abort();
    }

    fetch(`/api/teacher/sessions/${halaqaId}/${sessionDate}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as
          | TeacherSessionEditorData
          | { message?: string };
        if (!response.ok) {
          throw new Error(
            "message" in payload
              ? payload.message || "تعذر تحميل الجلسة."
              : "تعذر تحميل الجلسة.",
          );
        }
        const data = payload as TeacherSessionEditorData;
        setEditor(data);
        setStudents(data.students);
        setIsOfflineMode(false);

        const nowStr =
          new Date().toLocaleTimeString("ar-EG", {
            hour: "2-digit",
            minute: "2-digit",
          }) +
          " - " +
          new Date().toLocaleDateString("ar-EG");
        setLastCacheTime(nowStr);

        // Cache online data to IndexedDB for offline use
        void saveTeacherDataCache(
          "teacher",
          halaqaId,
          dashboard,
          data.students,
          data,
        );
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
                nameAr:
                  profile?.halaqaName || selectedHalaqa?.nameAr || "الحلقة",
                stageName: selectedHalaqa?.stageName || "",
                weekdays: selectedHalaqa?.weekdays || [],
              },
              session: null,
              students: cache.students,
            },
          );
          setIsOfflineMode(true);
          const cacheDateStr =
            new Date(cache.cachedAt).toLocaleTimeString("ar-EG", {
              hour: "2-digit",
              minute: "2-digit",
            }) +
            " - " +
            new Date(cache.cachedAt).toLocaleDateString("ar-EG");
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
            text:
              error instanceof Error
                ? error.message
                : "تعذر الاتصال بالشبكة ولم يتم العثور على بيانات طلاب محفوظة لهذه الحلقة.",
          });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [halaqaId, sessionDate, dashboard, selectedHalaqa, currentWeekday, halaqaWeekdays, offlineOnly]);

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
      setNotice({
        type: "success",
        text: "تم استرجاع المسودة المحلية المحفوظة على جهازك بنجاح.",
      });
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

      pages += student.activities.reduce(
        (sum, activity) => sum + Number(activity.pageCount || 0),
        0,
      );
    }

    return { present, absent, excused, notHeard, pending, pages };
  }, [students]);

  function updateStudent(
    studentId: string,
    update: (student: SessionStudentValue) => SessionStudentValue,
  ) {
    const updated = students.map((student) =>
      student.studentId === studentId ? update(student) : student,
    );
    handleStudentsUpdate(updated);
  }

  function setAttendance(studentId: string, attendance: SessionAttendanceCode) {
    updateStudent(studentId, (student) => {
      let activities = student.activities;
      if (attendance === "PRESENT") {
        if (!activities || activities.length === 0) {
          activities = [
            { type: "MEMORIZATION", text: "", pageCount: 0 },
            { type: "REVIEW", text: "", pageCount: 0 },
            { type: "RECITATION", text: "", pageCount: 0 },
          ];
        }
      } else {
        activities = [];
      }

      return {
        ...student,
        attendance,
        activities,
      };
    });
  }

  function updateActivityText(
    studentId: string,
    type: SessionActivityCode,
    text: string,
    pageCount: number,
  ) {
    updateStudent(studentId, (student) => ({
      ...student,
      activities: student.activities.map((activity) =>
        activity.type === type ? { ...activity, text, pageCount } : activity,
      ),
    }));
  }

  async function saveStudents(studentIds: string[], complete: boolean) {
    if (!halaqaId || !sessionDate) return;

    if (!isAllowedSessionDay) {
      setNotice({
        type: "error",
        text: "لا يمكن تسجيل تسميع في يوم غير مخصص لهذه الحلقة.",
      });
      return;
    }

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

    if (
      complete &&
      students.some((student) => student.attendance === "PENDING")
    ) {
      setNotice({
        type: "error",
        text: "سجّل حالة جميع الطلاب قبل اعتماد الجلسة.",
      });
      return;
    }

    const key = complete
      ? "complete-session"
      : studentIds.length === 1
        ? `student-${studentIds[0]}`
        : "save-all";
    setBusyKey(key);
    setNotice(null);

    const payloadData = { date: sessionDate, complete, items };
    const isOffline = isOfflineMode || isClientOffline;

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
      const response = await fetch(
        `/api/teacher/sessions/${halaqaId}/${sessionDate}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadData),
        },
      );
      const payload = await readApiPayload(response);
      if (!response.ok) throw new Error(payload.message || "تعذر حفظ الجلسة.");
      if (payload.data) {
        setEditor(payload.data);
        setStudents(payload.data.students);
        void removeSessionDraft("teacher", halaqaId, sessionDate);
        void saveTeacherDataCache(
          "teacher",
          halaqaId,
          dashboard,
          payload.data.students,
          payload.data,
        );
      }
      setNotice({
        type: "success",
        text: payload.message || "تم حفظ البيانات بنجاح.",
      });
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
      {/* Teacher Welcome Banner Card */}
      <section className="rounded-3xl bg-gradient-to-l from-emerald-950 to-emerald-700 p-5 text-white shadow-lg shadow-emerald-950/10 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-100">
              لوحة المحفظ والشيخ
            </p>
            <h1 className="mt-1 text-2xl font-black sm:text-3xl">
              مرحباً، شيخنا الفاضل
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50">
              تابع تسميع طلاب حلقتك، وسجّل الحضور والإنجازات اليومية، ويمكنك
              العمل بدون إنترنت ثم مزامنة البيانات عند عودة الاتصال.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-3 text-xs font-bold text-emerald-900 min-w-48 text-center sm:text-right shrink-0">
            <p className="text-[13px] font-black text-emerald-900/80">
              حالة الاتصال والمزامنة:
            </p>
            {/* Network Status & Offline Queue Monitoring */}
            <NetworkStatusBar
              onSyncCompleted={() =>
                void getAllSyncItems().then(setOfflineSyncItems)
              }
            />
          </div>
        </div>
      </section>

      {/* Offline Mode Last Cache Timestamp Banner (Requirement 5) */}
      {isOfflineMode || isClientOffline ? (
        <aside
          aria-label="شريط وضع الأوفلاين"
          className="rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-3.5 text-xs font-bold text-[var(--status-warning-text)] shadow-xs flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-[var(--warning)] animate-pulse" />
            <span>
              أنت تعمل بدون إنترنت — آخر تحديث لبيانات الطلاب كان:{" "}
              <strong className="font-black text-[var(--status-warning-text)]">
                {lastCacheTime || "غير محدد"}
              </strong>
            </span>
          </div>
          <span className="rounded-lg border border-[var(--status-warning-border)] bg-[var(--card-bg)] px-2.5 py-1 text-[11px] font-black text-[var(--status-warning-text)]">
            PWA Offline Mode
          </span>
        </aside>
      ) : null}

      {/* Local Draft Recovery Prompt Banner */}
      {pendingDraft ? (
        <aside
          aria-label="استرجاع المسودة المحلية"
          className="rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-4 text-xs font-bold text-[var(--status-warning-text)] shadow-xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="font-black text-[var(--status-warning-text)] text-sm">
                ⚠️ يوجد تسميع محفوظ محلياً لهذه الجلسة لم يتم رفعه بعد!
              </p>
              <p className="mt-1 text-[var(--status-warning-text)] opacity-90">
                عُثر على مسودة تسميع مخزنة محلياً على جهازك لم ترفع بعد. هل ترغب
                باسترجاعها أم إهمالها؟
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={restoreLocalDraft}
                className="rounded-xl bg-amber-700 dark:bg-amber-600 px-4 py-2 text-xs font-black text-white shadow-xs hover:bg-amber-800"
              >
                📥 استرجاع المسودة
              </button>
              <button
                type="button"
                onClick={discardLocalDraft}
                className="rounded-xl border border-[var(--status-warning-border)] bg-[var(--card-bg)] px-3 py-2 text-xs font-bold text-[var(--status-warning-text)] hover:bg-[var(--card-soft)]"
              >
                تجاهل
              </button>
            </div>
          </div>
        </aside>
      ) : null}

      {/* 6 Dashboard Tabs Navigation Bar with Horizontal Scroll */}
      <nav className="flex overflow-x-auto whitespace-nowrap rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-1.5 shadow-sm scrollbar-thin transition-colors duration-200 gap-1">
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
          onClick={() => setActiveTab("exams")}
          className={`flex min-h-11 items-center gap-2 whitespace-nowrap rounded-2xl px-5 text-xs font-black transition ${
            activeTab === "exams"
              ? "bg-[var(--primary)] text-white shadow-md"
              : "text-[var(--text-muted)] hover:bg-[var(--card-soft)] hover:text-[var(--primary)]"
          }`}
        >
          <span>📝 الاختبارات</span>
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
                <label className="form-label" htmlFor="session-halaqa">
                  الحلقة الدراسية
                </label>
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
                <label className="form-label" htmlFor="session-date">
                  تاريخ التسميع
                </label>
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
              <p className="mt-4 text-sm font-bold">
                جاري تحميل طلاب الحلقة والجلسة...
              </p>
            </div>
          ) : !isAllowedSessionDay ? (
            <section className="rounded-3xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-6 sm:p-8 text-center text-[var(--status-danger-text)] shadow-sm space-y-4">
              <span className="text-4xl block">🛑</span>
              <h3 className="text-lg font-black leading-relaxed">
                هذا اليوم ليس من أيام تحفيظ هذه الحلقة، ولا يمكنك تسجيل تسميع فيه.
              </h3>
              <p className="text-sm font-bold opacity-90 max-w-xl mx-auto">
                أيام الحلقة هي: <strong className="font-black text-red-700 dark:text-red-300">{scheduledWeekdaysText}</strong>.
              </p>
              <div className="pt-2">
                <span className="inline-block rounded-2xl bg-[var(--card-bg)] border border-[var(--status-danger-border)] px-5 py-2.5 text-xs font-black text-[var(--text-main)] shadow-xs">
                  💡 اختر يوماً من أيام الحلقة لتسجيل التسميع.
                </span>
              </div>
            </section>
          ) : (
            <div className="space-y-4">

              {/* Quick Stats Bar */}
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                <StatCard
                  label="الطلاب"
                  value={students.length}
                  color="bg-[var(--card-soft)] text-[var(--text-main)] border border-[var(--border-color)]"
                />
                <StatCard
                  label="حاضر"
                  value={totals.present}
                  color="bg-[var(--status-success-bg)] text-[var(--status-success-text)] border border-[var(--status-success-border)]"
                />
                <StatCard
                  label="غائب"
                  value={totals.absent}
                  color="bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border border-[var(--status-danger-border)]"
                />
                <StatCard
                  label="عذر"
                  value={totals.excused}
                  color="bg-[var(--status-info-bg)] text-[var(--status-info-text)] border border-[var(--status-info-border)]"
                />
                <StatCard
                  label="لم يسمع"
                  value={totals.notHeard}
                  color="bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border border-[var(--status-warning-border)]"
                />
                <StatCard
                  label="صفحات"
                  value={totals.pages}
                  color="bg-[var(--card-soft)] text-[var(--gold)] border border-[var(--border-color)]"
                />
              </div>

              {/* Collapsible Student Recitation Cards */}
              <div className="space-y-3">
                {students.map((student) => {
                  const isExpanded = expandedStudentId === student.studentId;
                  return (
                    <article
                      key={student.studentId}
                      className={`rounded-3xl border bg-[var(--card-bg)] p-4 shadow-sm sm:p-5 transition-all duration-200 ${
                        student.attendance === "PRESENT"
                          ? "border-[var(--status-success-border)]"
                          : student.attendance === "ABSENT"
                            ? "border-[var(--status-danger-border)]"
                            : student.attendance === "EXCUSED"
                              ? "border-[var(--status-info-border)]"
                              : student.attendance === "NOT_HEARD"
                                ? "border-[var(--status-warning-border)]"
                                : "border-[var(--border-color)]"
                      }`}
                    >
                      {/* Card Collapsible Header */}
                      <div
                        onClick={() =>
                          setExpandedStudentId(
                            isExpanded ? null : student.studentId,
                          )
                        }
                        className="flex cursor-pointer items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex size-9 items-center justify-center rounded-2xl text-xs font-black shadow-xs ${
                              student.attendance === "PRESENT"
                                ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)] border border-[var(--status-success-border)]"
                                : student.attendance === "ABSENT"
                                  ? "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border border-[var(--status-danger-border)]"
                                  : student.attendance === "EXCUSED"
                                    ? "bg-[var(--status-info-bg)] text-[var(--status-info-text)] border border-[var(--status-info-border)]"
                                    : student.attendance === "NOT_HEARD"
                                      ? "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border border-[var(--status-warning-border)]"
                                      : "bg-[var(--card-soft)] text-[var(--text-muted)] border border-[var(--border-color)]"
                            }`}
                          >
                            {student.attendance === "PRESENT"
                              ? "✓"
                              : student.attendance === "ABSENT"
                                ? "✗"
                                : student.attendance === "EXCUSED"
                                  ? "ع"
                                  : student.attendance === "NOT_HEARD"
                                    ? "!"
                                    : "⏳"}
                          </span>
                          <div>
                            <h3 className="text-base font-black text-[var(--text-main)]">
                              {student.displayName}
                            </h3>
                            <p className="text-xs font-bold text-[var(--text-muted)]">
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
                          <span className="text-xs font-black text-[var(--text-muted)]">
                            {isExpanded ? "▲ إغلاق" : "▼ تسجيل"}
                          </span>
                        </div>
                      </div>

                      {/* Accordion Body */}
                      {isExpanded ? (
                        <div className="mt-4 border-t border-[var(--border-color)] pt-4 space-y-4">
                          {/* 2-Level Attendance Options */}
                          <div className="space-y-3">
                            {/* Level 1: Present vs Absent */}
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (
                                    student.attendance !== "PRESENT" &&
                                    student.attendance !== "NOT_HEARD"
                                  ) {
                                    setAttendance(student.studentId, "PRESENT");
                                  }
                                }}
                                className={`flex-1 rounded-2xl py-3 text-xs font-black transition ${
                                  student.attendance === "PRESENT" ||
                                  student.attendance === "NOT_HEARD"
                                    ? "bg-emerald-600 text-white shadow-md"
                                    : "border border-[var(--border-color)] bg-[var(--card-soft)] text-[var(--text-main)] hover:bg-emerald-500/10"
                                }`}
                              >
                                ✅ حاضر
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  if (
                                    student.attendance !== "ABSENT" &&
                                    student.attendance !== "EXCUSED"
                                  ) {
                                    setAttendance(student.studentId, "ABSENT");
                                  }
                                }}
                                className={`flex-1 rounded-2xl py-3 text-xs font-black transition ${
                                  student.attendance === "ABSENT" ||
                                  student.attendance === "EXCUSED"
                                    ? "bg-red-600 text-white shadow-md"
                                    : "border border-[var(--border-color)] bg-[var(--card-soft)] text-[var(--text-main)] hover:bg-red-500/10"
                                }`}
                              >
                                ❌ غائب
                              </button>
                            </div>

                            {/* Level 2 for Present: Recited vs Not Recited */}
                            {student.attendance === "PRESENT" ||
                            student.attendance === "NOT_HEARD" ? (
                              <div className="flex gap-2 bg-[var(--card-soft)] p-2 rounded-2xl border border-[var(--border-color)]">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setAttendance(student.studentId, "PRESENT")
                                  }
                                  className={`flex-1 rounded-xl py-2 text-xs font-black transition ${
                                    student.attendance === "PRESENT"
                                      ? "bg-[var(--primary)] text-white shadow-sm"
                                      : "bg-transparent text-[var(--text-main)] hover:bg-[var(--card-bg)]"
                                  }`}
                                >
                                  📖 سمّع (إدخال الحفظ والمراجعة)
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setAttendance(
                                      student.studentId,
                                      "NOT_HEARD",
                                    )
                                  }
                                  className={`flex-1 rounded-xl py-2 text-xs font-black transition ${
                                    student.attendance === "NOT_HEARD"
                                      ? "bg-amber-600 text-white shadow-sm"
                                      : "bg-transparent text-[var(--text-main)] hover:bg-[var(--card-bg)]"
                                  }`}
                                >
                                  ⚠️ لم يسمّع
                                </button>
                              </div>
                            ) : null}

                            {/* Level 2 for Absent: Excused vs Unexcused */}
                            {student.attendance === "ABSENT" ||
                            student.attendance === "EXCUSED" ? (
                              <div className="flex gap-2 bg-[var(--card-soft)] p-2 rounded-2xl border border-[var(--border-color)]">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setAttendance(student.studentId, "EXCUSED")
                                  }
                                  className={`flex-1 rounded-xl py-2 text-xs font-black transition ${
                                    student.attendance === "EXCUSED"
                                      ? "bg-blue-600 text-white shadow-sm"
                                      : "bg-transparent text-[var(--text-main)] hover:bg-[var(--card-bg)]"
                                  }`}
                                >
                                  🔵 بعذر
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setAttendance(student.studentId, "ABSENT")
                                  }
                                  className={`flex-1 rounded-xl py-2 text-xs font-black transition ${
                                    student.attendance === "ABSENT"
                                      ? "bg-red-700 text-white shadow-sm"
                                      : "bg-transparent text-[var(--text-main)] hover:bg-[var(--card-bg)]"
                                  }`}
                                >
                                  ❌ بدون عذر
                                </button>
                              </div>
                            ) : null}
                          </div>

                          {/* Recitation Quran Surahs Input Area if PRESENT */}
                          {student.attendance === "PRESENT" ? (
                            <div className="space-y-4 rounded-2xl bg-[var(--card-soft)] p-4 border border-[var(--border-color)]">
                              {student.activities.map((activity) =>
                                activity.type === "RECITATION" ? (
                                  <JuzActivityEditor
                                    key={activity.type}
                                    activity={activity}
                                    onChange={(text, pages) =>
                                      updateActivityText(
                                        student.studentId,
                                        activity.type,
                                        text,
                                        pages,
                                      )
                                    }
                                  />
                                ) : (
                                  <SurahActivityEditor
                                    key={activity.type}
                                    activity={activity}
                                    onChange={(text, pages) =>
                                      updateActivityText(
                                        student.studentId,
                                        activity.type,
                                        text,
                                        pages,
                                      )
                                    }
                                  />
                                ),
                              )}
                            </div>
                          ) : null}

                          {/* Student Notes */}
                          <div>
                            <label className="form-label text-xs">
                              {student.attendance === "NOT_HEARD"
                                ? "ملاحظة / سبب عدم التسميع"
                                : student.attendance === "EXCUSED"
                                  ? "سبب العذر"
                                  : "ملاحظات المحفظ للطالب"}
                            </label>
                            <input
                              type="text"
                              placeholder={
                                student.attendance === "NOT_HEARD"
                                  ? "أدخل سبب عدم التسميع..."
                                  : student.attendance === "EXCUSED"
                                    ? "أدخل سبب عذر الطالب..."
                                    : "أدخل ملاحظات خاصة إن وجدت..."
                              }
                              className="form-control font-bold"
                              value={student.notes || ""}
                              onChange={(e) =>
                                updateStudent(student.studentId, (s) => ({
                                  ...s,
                                  notes: e.target.value,
                                }))
                              }
                            />
                          </div>

                          {/* Individual Save Button */}
                          <div className="flex justify-end pt-2">
                            <button
                              type="button"
                              disabled={busyKey === `student-${student.studentId}`}
                              onClick={() =>
                                void saveStudents([student.studentId], false)
                              }
                              className="rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-black text-white hover:bg-[var(--primary-dark)] disabled:opacity-50"
                            >
                              {busyKey === `student-${student.studentId}`
                                ? "جاري الحفظ..."
                                : "حفظ بيانات هذا الطالب فقط"}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>

              {/* Complete Session Action Footer */}
              <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)]/95 p-4 shadow-xl backdrop-blur-md transition-colors duration-200">
                <span className="text-xs font-black text-[var(--text-main)]">
                  تم تسجيل:{" "}
                  {totals.present +
                    totals.absent +
                    totals.excused +
                    totals.notHeard}{" "}
                  من {students.length} طالب
                </span>
                <button
                  type="button"
                  disabled={busyKey === "complete-session"}
                  onClick={() =>
                    void saveStudents(
                      students.map((s) => s.studentId),
                      true,
                    )
                  }
                  className="min-h-12 rounded-2xl bg-emerald-700 dark:bg-emerald-600 px-6 text-sm font-black text-white shadow-lg transition hover:bg-emerald-800 disabled:opacity-50"
                >
                  {busyKey === "complete-session"
                    ? "جاري اعتماد الجلسة..."
                    : "✅ اعتماد الجلسة بالكامل"}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Tab 2: Teacher Students Tab */}
      {activeTab === "students" ? (
        <TeacherStudentsPanel
          halaqaId={halaqaId}
          isOffline={offlineOnly || isOfflineMode || isClientOffline}
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
          onRefresh={() => {
            if (!offlineOnly && typeof navigator !== "undefined" && navigator.onLine) {
              window.location.reload();
            }
          }}
        />
      ) : null}

      {/* Tab 3: Saved History Sessions Tab */}
      {activeTab === "history" ? (
        <section className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5 shadow-sm space-y-4 text-[var(--text-main)] transition-colors duration-200">
          <h2 className="text-lg font-black text-[var(--text-main)]">
            سجل الجلسات التسميعية الأخيرة
          </h2>

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
                  <span className="text-xs font-black text-[var(--primary)]">
                    جلسة تاريخ: {session.sessionDate}
                  </span>
                  <p className="text-sm font-bold text-[var(--text-main)]">
                    {session.halaqaName} ({session.recordedStudents}/
                    {session.totalStudents} طالب)
                  </p>
                </div>
                <span className="rounded-full bg-[var(--card-soft)] border border-[var(--border-color)] px-3 py-1 text-xs font-black text-[var(--primary)]">
                  استعراض وتعديل الجلسة 🔍
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Tab 4: Teacher Exams Tab */}
      {activeTab === "exams" ? (
        <TeacherExamsPanel exams={officialExams} />
      ) : null}

      {/* Tab 5: Parent Report Selector Tab */}
      {activeTab === "parent_report" ? (
        isOfflineMode || isClientOffline ? (
          <aside className="rounded-3xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-6 text-center text-xs font-bold text-[var(--status-warning-text)] space-y-2">
            <span className="text-3xl block">📄</span>
            <h3 className="text-sm font-black text-[var(--status-warning-text)]">
              تقرير ولي الأمر يحتاج إلى اتّصال بالإنترنت
            </h3>
            <p className="opacity-90">
              استخراج وتوليد تقرير ولي الأمر يتطلب التواصل المباشر مع السيرفر.
              المتاح حالياً بدون نت هو شاشة التسميع اليومية.
            </p>
          </aside>
        ) : (
          <ParentReportSelector
            students={students.map((s) => ({
              id: s.studentId,
              displayName: s.displayName,
            }))}
            hideStageFilter={true}
            hideTeacherFilter={true}
          />
        )
      ) : null}

      {/* Tab 5: Monthly Reports Tab */}
      {activeTab === "monthly_report" ? (
        isOfflineMode || isClientOffline ? (
          <aside className="rounded-3xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-6 text-center text-xs font-bold text-[var(--status-warning-text)] space-y-2">
            <span className="text-3xl block">📊</span>
            <h3 className="text-sm font-black text-[var(--status-warning-text)]">
              التقرير الشهري يحتاج إلى اتّصال بالإنترنت
            </h3>
            <p className="opacity-90">
              استخراج وتوليد التقارير الشهيرة ورسوم البيانات يتطلب الاتصال
              بالسيرفر. المتاح حالياً بدون نت هو شاشة التسميع اليومية.
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

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={`rounded-2xl p-3 text-center ${color}`}>
      <span className="block text-[11px] font-bold opacity-80">{label}</span>
      <span className="text-lg font-black">{value}</span>
    </div>
  );
}


