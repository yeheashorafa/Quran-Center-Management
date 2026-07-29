"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  OfficialExamListItem,
  OfficialExamOptionsData,
  OfficialExamType,
} from "@/lib/official-exams/types";
import { NetworkStatusBar } from "@/components/offline/network-status-bar";
import { saveOfflineExaminerProfile } from "@/lib/offline/offline-profile";
import { getExaminerDataCache, saveExaminerDataCache } from "@/lib/offline/examiner-cache";
import { enqueueSyncItem, getAllSyncItems, processSyncQueue, type SyncQueueItem } from "@/lib/offline/sync-queue";
import { QURAN_JUZS, getJuzLabel } from "@/lib/quran/juz-metadata";

import { minimumPassingScore, officialExamResultLabel } from "@/lib/official-exams/grading";

type Notice = { type: "success" | "error"; text: string } | null;
type ExamFormState = {
  stageId: string;
  halaqaId: string;
  studentId: string;
  examDate: string;
  examType: "INDIVIDUAL" | "COLLECTIVE";
  juzFrom: string;
  juzTo: string;
  isNotPassed: boolean;
  score: string;
  notes: string;
};

type FilterState = {
  stageId: string;
  halaqaId: string;
  studentId: string;
  from: string;
  to: string;
  status: "ACTIVE" | "VOIDED" | "ALL";
};

function operationKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `exam-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function apiMessage(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => ({}))) as { message?: string };
  return payload.message || (response.ok ? "تمت العملية بنجاح." : "تعذر تنفيذ العملية.");
}

function examTypeLabel(value: OfficialExamType): string {
  if (value === "INDIVIDUAL") return "منفرد";
  if (value === "COLLECTIVE") return "مجتمع";
  return "مخصص";
}

function resultStyle(label: string | null): string {
  if (!label) return "border border-[var(--border-color)] bg-[var(--card-soft)] text-[var(--text-muted)]";
  if (label === "امتياز") return "border border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]";
  if (label === "ممتاز") return "border border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-text)]";
  if (label === "جيد جداً") return "border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]";
  return "border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]";
}

export function ExaminerExamsPanel({
  options: initialOptions,
  initialExams,
  initialDate,
}: {
  options: OfficialExamOptionsData;
  initialExams: OfficialExamListItem[];
  initialDate: string;
}) {
  const [options, setOptions] = useState<OfficialExamOptionsData>(initialOptions);
  const firstStage = options.stages[0];
  const firstHalaqa = firstStage?.halaqat[0];
  const firstStudent = firstHalaqa?.students[0];

  const [form, setForm] = useState<ExamFormState>({
    stageId: firstStage?.id ?? "",
    halaqaId: firstHalaqa?.id ?? "",
    studentId: firstStudent?.id ?? "",
    examDate: initialDate,
    examType: "COLLECTIVE",
    juzFrom: "1",
    juzTo: "1",
    isNotPassed: false,
    score: "",
    notes: "",
  });
  const [filters, setFilters] = useState<FilterState>({
    stageId: "",
    halaqaId: "",
    studentId: "",
    from: "",
    to: "",
    status: "ALL",
  });
  const [exams, setExams] = useState(initialExams);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [createKey, setCreateKey] = useState(operationKey);
  const [editing, setEditing] = useState<OfficialExamListItem | null>(null);
  const [deletingExam, setDeletingExam] = useState<OfficialExamListItem | null>(null);

  // Offline examiner status
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isClientOffline, setIsClientOffline] = useState(false);
  const [lastCacheTime, setLastCacheTime] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setIsClientOffline(typeof navigator !== "undefined" && !navigator.onLine);
    });
    function handleOnline() { if (active) setIsClientOffline(false); }
    function handleOffline() { if (active) setIsClientOffline(true); }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
  const [pendingSyncItems, setPendingSyncItems] = useState<SyncQueueItem[]>([]);

  const refreshPendingExams = useCallback(async () => {
    const all = await getAllSyncItems();
    const examItems = all.filter((i) => i.type === "save_official_exam");
    setPendingSyncItems(examItems);
  }, []);

  useEffect(() => {
    let active = true;

    async function initOfflineState() {
      const all = await getAllSyncItems();
      const examItems = all.filter((i) => i.type === "save_official_exam");
      if (active) setPendingSyncItems(examItems);

      if (typeof navigator !== "undefined" && navigator.onLine) {
        const examinerName = initialExams[0]?.examiner?.displayName || "المختبر";
        await saveExaminerDataCache("examiner", initialOptions, initialExams);
        await saveOfflineExaminerProfile({
          examinerId: "examiner",
          examinerName,
          cachedAt: Date.now(),
          lastOnlineLoginAt: Date.now(),
        });
        if (active) {
          setNotice({
            type: "success",
            text: "تم حفظ بيانات المختبر لهذا الجهاز للعمل بدون إنترنت.",
          });
        }
        const nowStr = new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) + " - " + new Date().toLocaleDateString("ar-EG");
        if (active) setLastCacheTime(nowStr);
      } else {
        if (active) setIsOfflineMode(true);
        const cache = await getExaminerDataCache("examiner");
        if (cache && active) {
          setOptions(cache.options);
          if (cache.exams.length > 0) setExams(cache.exams);
          const cacheDateStr = new Date(cache.cachedAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) + " - " + new Date(cache.cachedAt).toLocaleDateString("ar-EG");
          setLastCacheTime(cacheDateStr);
        }
      }
    }

    void initOfflineState();

    return () => {
      active = false;
    };
  }, [initialOptions, initialExams]);

  const selectedStage = useMemo(
    () => options.stages.find((stage) => stage.id === form.stageId) ?? null,
    [form.stageId, options.stages],
  );
  const formHalaqat = selectedStage?.halaqat ?? [];
  const selectedHalaqa = formHalaqat.find((halaqa) => halaqa.id === form.halaqaId) ?? null;
  const formStudents = selectedHalaqa?.students ?? [];

  const filterStage = options.stages.find((stage) => stage.id === filters.stageId) ?? null;
  const filterHalaqat = filterStage?.halaqat ?? options.stages.flatMap((stage) => stage.halaqat);
  const filterHalaqa = filterHalaqat.find((halaqa) => halaqa.id === filters.halaqaId) ?? null;
  const filterStudents = filterHalaqa?.students ?? [];

  function showNotice(type: "success" | "error", text: string) {
    setNotice({ type, text });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function changeFormStage(stageId: string) {
    const stage = options.stages.find((item) => item.id === stageId);
    const halaqa = stage?.halaqat[0];
    setForm((current) => ({
      ...current,
      stageId,
      halaqaId: halaqa?.id ?? "",
      studentId: halaqa?.students[0]?.id ?? "",
    }));
  }

  function changeFormHalaqa(halaqaId: string) {
    const halaqa = formHalaqat.find((item) => item.id === halaqaId);
    setForm((current) => ({
      ...current,
      halaqaId,
      studentId: halaqa?.students[0]?.id ?? "",
    }));
  }

  function changeExamType(examType: "INDIVIDUAL" | "COLLECTIVE") {
    setForm((current) => ({
      ...current,
      examType,
      juzTo: examType === "INDIVIDUAL" ? current.juzFrom : current.juzTo,
    }));
  }

  async function loadExams(nextFilters: FilterState = filters, preserveNotice = false) {
    setBusy("load");
    if (!preserveNotice) setNotice(null);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const cache = await getExaminerDataCache("examiner");
      if (cache) {
        setExams(cache.exams);
        setIsOfflineMode(true);
      }
      setBusy(null);
      return;
    }

    try {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(nextFilters)) {
        if (value) query.set(key, value);
      }
      query.set("limit", "150");
      const response = await fetch(`/api/examiner/exams?${query.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        data?: OfficialExamListItem[];
      };
      if (!response.ok) throw new Error(payload.message || "تعذر تحميل الاختبارات.");
      const list = payload.data ?? [];
      setExams(list);
      setIsOfflineMode(false);
      void saveExaminerDataCache("examiner", options, list);
    } catch (error) {
      const cache = await getExaminerDataCache("examiner");
      if (cache) setExams(cache.exams);
      setIsOfflineMode(true);
      showNotice("error", error instanceof Error ? error.message : "تعذر تحميل الاختبارات (تم استخدام البيانات المحفوظة).");
    } finally {
      setBusy(null);
    }
  }

  async function createExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("create");
    setNotice(null);

    const minScore = minimumPassingScore(selectedStage?.code);
    const isNotPassed = form.isNotPassed;

    if (!isNotPassed) {
      const scoreVal = Number(form.score);
      if (!form.score || Number.isNaN(scoreVal)) {
        showNotice("error", "أدخل الدرجة الرقمية أو اختر غير مجاز.");
        setBusy(null);
        return;
      }
      if (scoreVal < minScore) {
        showNotice("error", "هذه العلامة أقل من الحد الأدنى للإجازة لهذه المرحلة.");
        setBusy(null);
        return;
      }
    }

    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

    const juzFromNum = Number(form.juzFrom);
    const juzToNum = Number(form.examType === "INDIVIDUAL" ? form.juzFrom : form.juzTo);
    const scoreNum = isNotPassed ? null : Number(form.score);
    const student = formStudents.find((s) => s.id === form.studentId);
    const uniqueId = operationKey();

    const payloadData = {
      studentId: form.studentId,
      examDate: form.examDate,
      examType: form.examType,
      juzFrom: juzFromNum,
      juzTo: juzToNum,
      isNotPassed,
      score: scoreNum,
      notes: form.notes,
      idempotencyKey: createKey,
      studentName: student?.displayName || "طالب",
      halaqaName: selectedHalaqa?.nameAr || "الحلقة",
    };

    if (isOffline || isOfflineMode) {
      await enqueueSyncItem({
        examinerId: "examiner",
        type: "save_official_exam",
        endpoint: "/api/examiner/exams",
        method: "POST",
        payload: payloadData,
      });

      const nowIso = new Date().toISOString();
      const resLabel = officialExamResultLabel(scoreNum, selectedStage?.code, isNotPassed);
      const tempExam: OfficialExamListItem = {
        id: `offline-${uniqueId}`,
        student: { id: form.studentId, displayName: student?.displayName || "طالب" },
        examDate: form.examDate,
        examType: form.examType,
        score: scoreNum,
        resultLabel: resLabel,
        status: "ACTIVE",
        version: 1,
        notes: form.notes ? `[محفوظ أوفلاين] ${form.notes}` : "[محفوظ أوفلاين]",
        voidReason: null,
        voidedAt: null,
        createdAt: nowIso,
        updatedAt: nowIso,
        examiner: { id: "examiner", displayName: "المختبر" },
        enrollment: {
          id: `enrollment-${form.halaqaId}`,
          halaqaId: form.halaqaId,
          halaqaName: selectedHalaqa?.nameAr || "الحلقة",
          stageId: form.stageId,
          stageName: selectedStage?.nameAr || "المرحلة",
        },
        scopes: [{
          id: `scope-${uniqueId}`,
          type: "JUZ",
          juzFrom: juzFromNum,
          juzTo: juzToNum,
          surahName: null,
          ayahFrom: null,
          ayahTo: null,
          pageFrom: null,
          pageTo: null,
          customText: null,
          label: form.examType === "INDIVIDUAL" ? getJuzLabel(juzFromNum) : `من ${getJuzLabel(juzFromNum)} إلى ${getJuzLabel(juzToNum)}`,
        }],
      };

      setExams((current) => {
        const existingIdx = current.findIndex(
          (e) =>
            e.student.id === form.studentId &&
            e.examType === form.examType &&
            e.scopes[0]?.juzFrom === juzFromNum &&
            e.scopes[0]?.juzTo === juzToNum &&
            e.status === "ACTIVE",
        );
        if (existingIdx !== -1) {
          const next = [...current];
          next[existingIdx] = { ...tempExam, id: current[existingIdx].id };
          return next;
        }
        return [tempExam, ...current];
      });

      setCreateKey(operationKey());
      setForm((current) => ({ ...current, score: "", notes: "", isNotPassed: false }));
      await refreshPendingExams();
      showNotice("success", "تم حفظ الاختبار محلياً بانتظار المزامنة عند عودة الإنترنت.");
      setBusy(null);
      return;
    }

    try {
      const response = await fetch("/api/examiner/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadData),
      });
      const message = await apiMessage(response);
      if (!response.ok) throw new Error(message);

      setCreateKey(operationKey());
      setForm((current) => ({ ...current, score: "", notes: "", isNotPassed: false }));
      showNotice("success", message);
      await loadExams(filters, true);
    } catch (error) {
      console.warn("Exam create network error fallback to queue:", error);
      await enqueueSyncItem({
        examinerId: "examiner",
        type: "save_official_exam",
        endpoint: "/api/examiner/exams",
        method: "POST",
        payload: payloadData,
      });
      await refreshPendingExams();
      showNotice("success", "تعذر الاتصال بالخادم. تم حفظ الاختبار محلياً بانتظار المزامنة عند عودة الإنترنت.");
    } finally {
      setBusy(null);
    }
  }

  function beginEdit(exam: OfficialExamListItem) {
    if (exam.examType === "CUSTOM") {
      showNotice("error", "تعديل النطاق المخصص غير متاح في هذا النموذج حالياً.");
      return;
    }
    const scope = exam.scopes[0];
    const isFailed = exam.score === null || exam.resultLabel === "غير مجاز";
    setEditing(exam);
    setForm({
      stageId: exam.enrollment?.stageId ?? "",
      halaqaId: exam.enrollment?.halaqaId ?? "",
      studentId: exam.student.id,
      examDate: exam.examDate,
      examType: exam.examType === "INDIVIDUAL" ? "INDIVIDUAL" : "COLLECTIVE",
      juzFrom: String(scope?.juzFrom ?? 1),
      juzTo: String(scope?.juzTo ?? scope?.juzFrom ?? 1),
      isNotPassed: isFailed,
      score: exam.score !== null ? String(exam.score) : "",
      notes: exam.notes ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditing(null);
    const stage = options.stages[0];
    const halaqa = stage?.halaqat[0];
    setForm({
      stageId: stage?.id ?? "",
      halaqaId: halaqa?.id ?? "",
      studentId: halaqa?.students[0]?.id ?? "",
      examDate: initialDate,
      examType: "COLLECTIVE",
      juzFrom: "1",
      juzTo: "1",
      isNotPassed: false,
      score: "",
      notes: "",
    });
  }

  async function updateExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setBusy("edit");
    setNotice(null);

    const minScore = minimumPassingScore(selectedStage?.code);
    const isNotPassed = form.isNotPassed;

    if (!isNotPassed) {
      const scoreVal = Number(form.score);
      if (!form.score || Number.isNaN(scoreVal)) {
        showNotice("error", "أدخل الدرجة الرقمية أو اختر غير مجاز.");
        setBusy(null);
        return;
      }
      if (scoreVal < minScore) {
        showNotice("error", "هذه العلامة أقل من الحد الأدنى للإجازة لهذه المرحلة.");
        setBusy(null);
        return;
      }
    }

    try {
      const response = await fetch(`/api/examiner/exams/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: form.studentId,
          examDate: form.examDate,
          examType: form.examType,
          juzFrom: Number(form.juzFrom),
          juzTo: Number(form.examType === "INDIVIDUAL" ? form.juzFrom : form.juzTo),
          isNotPassed,
          score: isNotPassed ? null : Number(form.score),
          notes: form.notes,
          version: editing.version,
        }),
      });
      const message = await apiMessage(response);
      if (!response.ok) throw new Error(message);
      cancelEdit();
      showNotice("success", message);
      await loadExams(filters, true);
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "تعذر تحديث الاختبار.");
    } finally {
      setBusy(null);
    }
  }

  async function voidExam(exam: OfficialExamListItem) {
    const reason = window.prompt(`اكتب سبب إلغاء اختبار ${exam.student.displayName}:`);
    if (!reason) return;
    if (!window.confirm("سيبقى الاختبار محفوظاً في السجل بحالة ملغى. هل تريد المتابعة؟")) return;

    setBusy(`void-${exam.id}`);
    setNotice(null);
    try {
      const response = await fetch(`/api/examiner/exams/${exam.id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: exam.version, reason }),
      });
      const message = await apiMessage(response);
      if (!response.ok) throw new Error(message);
      showNotice("success", message);
      await loadExams(filters, true);
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "تعذر إلغاء الاختبار.");
    } finally {
      setBusy(null);
    }
  }

  async function confirmHardDelete() {
    if (!deletingExam) return;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      showNotice("error", "حذف الاختبار يحتاج اتصالاً بالإنترنت.");
      setDeletingExam(null);
      return;
    }

    setBusy(`delete-${deletingExam.id}`);
    setNotice(null);

    try {
      const response = await fetch(`/api/examiner/exams/${deletingExam.id}`, {
        method: "DELETE",
      });
      const message = await apiMessage(response);
      if (!response.ok) throw new Error(message);

      const nextList = exams.filter((item) => item.id !== deletingExam.id);
      setExams(nextList);
      setDeletingExam(null);
      showNotice("success", "تم حذف الاختبار نهائياً.");
      void saveExaminerDataCache("examiner", options, nextList);
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "تعذر حذف الاختبار.");
    } finally {
      setBusy(null);
    }
  }

  async function cancelOfflineExamDraft(exam: OfficialExamListItem) {
    if (!window.confirm("هل تريد إلغاء هذه المسودة المحلية لعدم إرسالها للشبكة؟")) return;
    const nextList = exams.filter((i) => i.id !== exam.id);
    setExams(nextList);
    showNotice("success", "تم إلغاء المسودة المحلية.");
    void saveExaminerDataCache("examiner", options, nextList);
  }

  const formSubmit = editing ? updateExam : createExam;

  return (
    <div className="space-y-5" dir="rtl">
      {/* Network Status Bar */}
      <NetworkStatusBar onSyncCompleted={() => void refreshPendingExams()} />

      {/* Offline Mode Banner for Examiner */}
      {isOfflineMode || isClientOffline ? (
        <aside aria-label="شريط وضع الأوفلاين للمختبر" className="rounded-2xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] p-3.5 text-xs font-bold text-[var(--status-info-text)] shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-[var(--primary)] animate-pulse" />
            <span>
              أنت تعمل بدون إنترنت — آخر تحديث لبيانات الطلاب كان:{" "}
              <strong className="font-black text-[var(--primary)]">{lastCacheTime || "غير محدد"}</strong>
            </span>
          </div>
          <span className="rounded-lg bg-[var(--card-soft)] px-2.5 py-1 text-[11px] font-black text-[var(--primary)] border border-[var(--border-color)]">
            PWA Offline Examiner Mode
          </span>
        </aside>
      ) : null}

      {/* Pending Official Exams Section */}
      {pendingSyncItems.length > 0 ? (
        <PendingExamsList items={pendingSyncItems} onRefresh={() => void refreshPendingExams()} />
      ) : null}

      {notice ? (
        <div
          role="status"
          className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
            notice.type === "success"
              ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
              : "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      <section className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 shadow-sm sm:p-5 text-[var(--text-main)] transition-colors duration-200">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-[var(--gold)]">{editing ? "تعديل اختبار" : "اختبار رسمي جديد"}</p>
            <h2 className="mt-1 text-xl font-black text-[var(--text-main)]">
              {editing ? `تعديل اختبار ${editing.student.displayName}` : "تسجيل نتيجة الطالب"}
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
              التقدير يُحسب من الخادم حسب المرحلة، وتُحفظ الحلقة التي كان الطالب مسجلاً فيها بتاريخ الاختبار.
            </p>
          </div>
          {editing ? (
            <button
              className="rounded-xl border border-[var(--border-color)] bg-[var(--card-soft)] px-4 py-2 text-sm font-black text-[var(--text-main)] hover:border-[var(--primary)] transition"
              type="button"
              onClick={cancelEdit}
            >
              إلغاء التعديل
            </button>
          ) : null}
        </div>

        <form className="mt-5 space-y-4" onSubmit={formSubmit}>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="form-label" htmlFor="exam-stage">المرحلة</label>
              <select
                className="form-control"
                id="exam-stage"
                value={form.stageId}
                onChange={(event) => changeFormStage(event.target.value)}
                required
              >
                {options.stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>{stage.nameAr}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label" htmlFor="exam-halaqa">الحلقة</label>
              <select
                className="form-control"
                id="exam-halaqa"
                value={form.halaqaId}
                onChange={(event) => changeFormHalaqa(event.target.value)}
                required
              >
                {editing?.enrollment && !formHalaqat.some((halaqa) => halaqa.id === editing.enrollment?.halaqaId) ? (
                  <option value={editing.enrollment.halaqaId}>{editing.enrollment.halaqaName}</option>
                ) : null}
                {formHalaqat.map((halaqa) => (
                  <option key={halaqa.id} value={halaqa.id}>
                    {halaqa.nameAr}{halaqa.teacherName ? ` — ${halaqa.teacherName}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label" htmlFor="exam-student">الطالب</label>
              <select
                className="form-control"
                id="exam-student"
                value={form.studentId}
                onChange={(event) => setForm((current) => ({ ...current, studentId: event.target.value }))}
                required
              >
                {editing && !formStudents.some((student) => student.id === editing.student.id) ? (
                  <option value={editing.student.id}>{editing.student.displayName}</option>
                ) : null}
                {formStudents.map((student) => (
                  <option key={student.id} value={student.id}>{student.displayName}</option>
                ))}
              </select>
            </div>
          </div>

          {!formStudents.length ? (
            <div className="rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-4 py-3 text-sm font-bold text-[var(--status-warning-text)]">
              لا يوجد طلاب نشطون في الحلقة المختارة.
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="form-label" htmlFor="exam-date">التاريخ</label>
              <input
                className="form-control"
                id="exam-date"
                type="date"
                max={initialDate}
                value={form.examDate}
                onChange={(event) => setForm((current) => ({ ...current, examDate: event.target.value }))}
                required
              />
            </div>
            <div>
              <label className="form-label" htmlFor="exam-type">نوع الاختبار</label>
              <select
                className="form-control"
                id="exam-type"
                value={form.examType}
                onChange={(event) => changeExamType(event.target.value as "INDIVIDUAL" | "COLLECTIVE")}
              >
                <option value="COLLECTIVE">مجتمع</option>
                <option value="INDIVIDUAL">منفرد</option>
              </select>
            </div>
            <div>
              <label className="form-label" htmlFor="exam-from-juz">
                {form.examType === "INDIVIDUAL" ? "الجزء" : "من الجزء"}
              </label>
              <select
                className="form-control"
                id="exam-from-juz"
                value={form.juzFrom}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    juzFrom: event.target.value,
                    juzTo: current.examType === "INDIVIDUAL" ? event.target.value : current.juzTo,
                  }))
                }
              >
                {QURAN_JUZS.map((juz) => (
                  <option key={juz.number} value={juz.number}>{getJuzLabel(juz.number)}</option>
                ))}
              </select>
            </div>
            {form.examType === "COLLECTIVE" ? (
              <div>
                <label className="form-label" htmlFor="exam-to-juz">إلى الجزء</label>
                <select
                  className="form-control"
                  id="exam-to-juz"
                  value={form.juzTo}
                  onChange={(event) => setForm((current) => ({ ...current, juzTo: event.target.value }))}
                >
                  {QURAN_JUZS.map((juz) => (
                    <option key={juz.number} value={juz.number}>{getJuzLabel(juz.number)}</option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-[240px_minmax(0,1fr)]">
            <div className="space-y-2">
              <label className="form-label" htmlFor="exam-score">الدرجة من 100</label>
              <input
                className={`form-control text-center text-xl font-black ${
                  form.isNotPassed ? "bg-[var(--card-soft)] opacity-50 cursor-not-allowed" : ""
                }`}
                id="exam-score"
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder={form.isNotPassed ? "غير مجاز" : "أدخل العلامة"}
                disabled={form.isNotPassed}
                value={form.isNotPassed ? "" : form.score}
                onChange={(event) => setForm((current) => ({ ...current, score: event.target.value }))}
                required={!form.isNotPassed}
              />
              <p className="text-[11px] font-bold text-[var(--gold)]">
                {selectedStage?.code === "BRAAIM"
                  ? "الحد الأدنى للإجازة في مرحلة البراعم هو 80."
                  : selectedStage?.code === "ASHBAL"
                    ? "الحد الأدنى للإجازة في مرحلة الأشبال هو 85."
                    : selectedStage?.code === "NASHIEEN"
                      ? "الحد الأدنى للإجازة في مرحلة الناشئين هو 85."
                      : `الحد الأدنى للإجازة هو ${minimumPassingScore(selectedStage?.code)}.`}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <input
                  id="exam-is-not-passed"
                  type="checkbox"
                  className="size-4 rounded border-[var(--border-color)] text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
                  checked={form.isNotPassed}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isNotPassed: event.target.checked,
                      score: event.target.checked ? "" : current.score,
                    }))
                  }
                />
                <label
                  htmlFor="exam-is-not-passed"
                  className="text-xs font-black text-[var(--status-danger-text)] cursor-pointer select-none"
                >
                  غير مجاز (لم يجتز)
                </label>
              </div>
            </div>
            <div>
              <label className="form-label" htmlFor="exam-notes">ملاحظات</label>
              <textarea
                className="form-control min-h-28"
                id="exam-notes"
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </div>
          </div>

          <button
            className="min-h-12 w-full rounded-2xl bg-[var(--primary)] px-5 text-sm font-black text-white transition hover:bg-[var(--primary-dark)] disabled:opacity-60"
            disabled={busy === "create" || busy === "edit" || !form.studentId}
          >
            {busy === "create" || busy === "edit"
              ? "جاري الحفظ..."
              : editing
                ? "حفظ التعديلات"
                : "حفظ الاختبار الرسمي"}
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 shadow-sm sm:p-5 text-[var(--text-main)] transition-colors duration-200">
        <div>
          <p className="text-xs font-bold text-[var(--gold)]">البحث والتصفية</p>
          <h2 className="mt-1 text-xl font-black text-[var(--text-main)]">سجل الاختبارات الرسمية</h2>
        </div>

        <form
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
          onSubmit={(event) => {
            event.preventDefault();
            void loadExams();
          }}
        >
          <select
            className="form-control"
            aria-label="المرحلة"
            value={filters.stageId}
            onChange={(event) => {
              const stageId = event.target.value;
              setFilters((current) => ({ ...current, stageId, halaqaId: "", studentId: "" }));
            }}
          >
            <option value="">كل المراحل</option>
            {options.stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.nameAr}</option>)}
          </select>
          <select
            className="form-control"
            aria-label="الحلقة"
            value={filters.halaqaId}
            onChange={(event) => setFilters((current) => ({ ...current, halaqaId: event.target.value, studentId: "" }))}
          >
            <option value="">كل الحلقات</option>
            {filterHalaqat.map((halaqa) => <option key={halaqa.id} value={halaqa.id}>{halaqa.nameAr}</option>)}
          </select>
          <select
            className="form-control"
            aria-label="الطالب"
            value={filters.studentId}
            onChange={(event) => setFilters((current) => ({ ...current, studentId: event.target.value }))}
            disabled={!filters.halaqaId}
          >
            <option value="">كل الطلاب</option>
            {filterStudents.map((student) => <option key={student.id} value={student.id}>{student.displayName}</option>)}
          </select>
          <input
            className="form-control"
            type="date"
            aria-label="من تاريخ"
            value={filters.from}
            onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
          />
          <input
            className="form-control"
            type="date"
            aria-label="إلى تاريخ"
            value={filters.to}
            onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
          />
          <div className="flex gap-2">
            <select
              className="form-control min-w-0"
              aria-label="الحالة"
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as FilterState["status"] }))}
            >
              <option value="ALL">الكل</option>
              <option value="ACTIVE">فعال</option>
              <option value="VOIDED">ملغى</option>
            </select>
            <button className="rounded-xl bg-[var(--primary)] px-4 text-sm font-black text-white hover:bg-[var(--primary-dark)]" disabled={busy === "load"}>
              عرض
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-black text-[var(--text-main)]">النتائج</h2>
          <span className="rounded-full bg-[var(--card-soft)] border border-[var(--border-color)] px-3 py-1 text-xs font-black text-[var(--primary)]">{exams.length}</span>
        </div>

        {exams.length ? (
          exams.map((exam) => (
            <article
              key={exam.id}
              className={`rounded-3xl border bg-[var(--card-bg)] p-4 shadow-sm sm:p-5 transition-colors duration-200 ${exam.status === "VOIDED" ? "border-[var(--status-danger-border)] opacity-75" : "border-[var(--border-color)]"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black text-[var(--text-main)]">{exam.student.displayName}</h3>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-black ${resultStyle(exam.resultLabel)}`}>
                      {exam.resultLabel ?? "بدون تقدير"}
                    </span>
                    {exam.status === "VOIDED" ? (
                      <span className="rounded-full border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-1 text-[11px] font-black text-[var(--status-danger-text)]">ملغى</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {exam.enrollment?.stageName ?? "—"} — {exam.enrollment?.halaqaName ?? "بدون حلقة مرتبطة"}
                  </p>
                  <p className="mt-2 text-sm font-bold text-[var(--text-main)]">
                    {examTypeLabel(exam.examType)} — {exam.scopes.map((scope) => scope.label).join("، ") || "بدون نطاق"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {exam.examDate} — المختبر: {exam.examiner.displayName}
                  </p>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-black text-[var(--primary)]">{exam.score ?? "—"}</div>
                  <div className="text-xs font-bold text-[var(--text-muted)]">{exam.score !== null ? "من 100" : "غير مجاز"}</div>
                </div>
              </div>

              {exam.notes ? <p className="mt-3 rounded-2xl bg-[var(--card-soft)] px-4 py-3 text-sm text-[var(--text-main)] border border-[var(--border-color)]">{exam.notes}</p> : null}
              {exam.status === "VOIDED" && exam.voidReason ? (
                <p className="mt-3 rounded-2xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-4 py-3 text-sm font-bold text-[var(--status-danger-text)]">سبب الإلغاء: {exam.voidReason}</p>
              ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="rounded-xl border border-[var(--border-color)] bg-[var(--card-soft)] px-4 py-2 text-sm font-black text-[var(--text-main)] hover:border-[var(--primary)] transition"
                    type="button"
                    onClick={() => beginEdit(exam)}
                  >
                    تعديل
                  </button>
                  {exam.status === "ACTIVE" ? (
                    <button
                      className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-4 py-2 text-sm font-black text-[var(--status-danger-text)] hover:opacity-90 disabled:opacity-60 transition"
                      type="button"
                      disabled={busy === `void-${exam.id}`}
                      onClick={() => void voidExam(exam)}
                    >
                      {busy === `void-${exam.id}` ? "جاري الإلغاء..." : "إلغاء الاختبار"}
                    </button>
                  ) : null}
                  <button
                    className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-4 py-2 text-sm font-black text-[var(--status-danger-text)] hover:opacity-90 disabled:opacity-50 transition"
                    type="button"
                    disabled={busy === `delete-${exam.id}`}
                    onClick={() => {
                      if (exam.id.startsWith("offline-")) {
                        void cancelOfflineExamDraft(exam);
                        return;
                      }
                      if (isOfflineMode || isClientOffline) {
                        showNotice("error", "حذف الاختبار يحتاج اتصالاً بالإنترنت.");
                        return;
                      }
                      setDeletingExam(exam);
                    }}
                  >
                    {exam.id.startsWith("offline-") ? "إلغاء المسودة" : "حذف نهائي"}
                  </button>
                </div>
            </article>
          ))
        ) : (
          <div className="rounded-3xl border border-dashed border-[var(--border-color)] bg-[var(--card-bg)] p-8 text-center text-sm font-bold text-[var(--text-muted)]">
            لا توجد اختبارات مطابقة للتصفية الحالية.
          </div>
        )}
      </section>

      {deletingExam ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150" dir="rtl">
          <div className="w-full max-w-md rounded-3xl border border-[var(--status-danger-border)] bg-[var(--card-bg)] p-6 shadow-2xl text-[var(--text-main)] space-y-4">
            <div className="flex items-center gap-3 text-[var(--status-danger-text)]">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-[var(--status-danger-bg)] font-black text-lg">
                ⚠️
              </div>
              <h3 className="text-lg font-black">حذف الاختبار نهائياً</h3>
            </div>

            <p className="text-sm leading-6 font-bold text-[var(--text-muted)]">
              هل أنت متأكد من حذف هذا الاختبار نهائياً؟
              <br />
              سيتم حذف نتيجة الطالب لهذا النطاق من الأجزاء، ولا يمكن التراجع عن هذه العملية.
            </p>

            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-soft)] p-3.5 text-xs space-y-1.5 font-bold">
              <p><strong>الطالب:</strong> {deletingExam.student.displayName}</p>
              <p><strong>النطاق:</strong> {deletingExam.scopes.map((s) => s.label).join("، ")}</p>
              <p><strong>التاريخ:</strong> {deletingExam.examDate}</p>
              <p><strong>النتيجة:</strong> {deletingExam.resultLabel ?? "غير مجاز"}</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                className="rounded-xl border border-[var(--border-color)] bg-[var(--card-soft)] px-4 py-2.5 text-sm font-black text-[var(--text-main)] hover:bg-[var(--card-bg)] transition"
                onClick={() => setDeletingExam(null)}
                disabled={busy === `delete-${deletingExam.id}`}
              >
                تراجع
              </button>
              <button
                type="button"
                className="rounded-xl bg-[var(--status-danger-text)] px-4 py-2.5 text-sm font-black text-white hover:opacity-90 transition disabled:opacity-50"
                onClick={() => void confirmHardDelete()}
                disabled={busy === `delete-${deletingExam.id}`}
              >
                {busy === `delete-${deletingExam.id}` ? "جاري الحذف..." : "نعم، حذف نهائي"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PendingExamsList({
  items,
  onRefresh,
}: {
  items: SyncQueueItem[];
  onRefresh: () => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleManualSync = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setNotice("⚠️ أنت غير متصل بالإنترنت حالياً. يرجى الاتصال بالإنترنت أولاً للمزامنة.");
      return;
    }

    setSyncing(true);
    setNotice(null);

    const res = await processSyncQueue();
    setSyncing(false);
    onRefresh();

    if (res.success > 0) {
      setNotice(`✅ تم بنجاح مزامنة ${res.success} اختبار مع الخادم.`);
    } else if (res.failed > 0) {
      setNotice(`⚠️ تعذر مزامنة ${res.failed} اختبار. راجع أسباب الفشل أدناه.`);
    } else {
      setNotice("لا توجد اختبارات معلقة للمزامنة.");
    }
  }, [onRefresh]);

  return (
    <section className="rounded-3xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] p-5 shadow-sm space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--status-info-border)] pb-3">
        <div>
          <h3 className="text-base font-black text-[var(--status-info-text)] flex items-center gap-2">
            <span>📝 اختبارات بانتظار المزامنة ({items.length})</span>
          </h3>
          <p className="mt-0.5 text-xs font-bold text-[var(--text-muted)]">
            تم حفظ هذه الاختبارات الرسمية محلياً على هذا الجهاز لعدم توفر إنترنت.
          </p>
        </div>

        <button
          type="button"
          disabled={syncing || (typeof navigator !== "undefined" && !navigator.onLine)}
          onClick={() => void handleManualSync()}
          className="rounded-2xl bg-[var(--primary)] px-5 py-2 text-xs font-black text-white shadow-sm transition hover:bg-[var(--primary-dark)] disabled:opacity-50"
        >
          {syncing ? "جاري المزامنة..." : "🔄 مزامنة الآن"}
        </button>
      </div>

      {notice ? (
        <div className="rounded-2xl bg-[var(--card-bg)] p-3 text-xs font-black text-[var(--text-main)] border border-[var(--border-color)]">
          {notice}
        </div>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => {
          const payload = item.payload as {
            studentName?: string;
            halaqaName?: string;
            score?: number;
            examDate?: string;
            juzFrom?: number;
            juzTo?: number;
            examType?: string;
          };

          return (
            <div
              key={item.queueId}
              className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 shadow-2xs space-y-2 text-[var(--text-main)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-black text-[var(--text-main)]">
                    اختبار الطالب: <span className="text-[var(--primary)]">{payload.studentName || "طالب"}</span> ({payload.halaqaName || "حلقة"})
                  </h4>
                  <p className="text-xs font-bold text-[var(--text-muted)]">
                    التاريخ: {payload.examDate} | الدرجة: <span className="font-black text-[var(--primary)]">{payload.score}/100</span> | النطاق: {payload.examType === "INDIVIDUAL" ? getJuzLabel(payload.juzFrom) : `من ${getJuzLabel(payload.juzFrom)} إلى ${getJuzLabel(payload.juzTo)}`}
                  </p>
                </div>

                <div>
                  {item.status === "pending" ? (
                    <span className="rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-1 text-xs font-extrabold text-[var(--status-warning-text)]">
                      🟠 بانتظار المزامنة
                    </span>
                  ) : item.status === "syncing" ? (
                    <span className="rounded-xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-3 py-1 text-xs font-extrabold text-[var(--status-info-text)]">
                      🔵 جاري المزامنة...
                    </span>
                  ) : item.status === "conflict" ? (
                    <span className="rounded-xl border border-purple-300 bg-purple-100 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-300 px-3 py-1 text-xs font-extrabold text-purple-900">
                      ⚠️ تعارض في البيانات (409)
                    </span>
                  ) : item.status === "failed" ? (
                    <span className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-1 text-xs font-extrabold text-[var(--status-danger-text)]">
                      🔴 فشلت المزامنة
                    </span>
                  ) : (
                    <span className="rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 py-1 text-xs font-extrabold text-[var(--status-success-text)]">
                      ✅ تمت المزامنة
                    </span>
                  )}
                </div>
              </div>

              {item.errorMessage ? (
                <div className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-2 text-xs font-bold text-[var(--status-danger-text)]">
                  <span className="font-black">سبب عدم الإكمال:</span> {item.errorMessage}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
