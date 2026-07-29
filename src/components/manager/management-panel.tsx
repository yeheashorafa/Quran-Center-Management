"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { AppRoleCode } from "@/lib/auth/constants";
import { WEEKDAY_CODES, WEEKDAY_LABELS, type WeekdayCode } from "@/lib/halaqat/weekdays";
import type { ManagerDashboardData } from "@/lib/manager/types";
import { StudentManagementPanel } from "@/components/students/student-management-panel";
import { DailyMonitoringPanel } from "@/components/manager/daily-monitoring-panel";
import { ManagerAlertsPanel } from "@/components/manager/manager-alerts-panel";
import { StudentFollowUpPanel } from "@/components/manager/student-follow-up-panel";
import { AuditLogPanel } from "@/components/manager/audit-log-panel";
import { ManagerExamsPanel } from "@/components/manager/manager-exams-panel";
import { MonthlyReportsPanel } from "@/components/reports/monthly-reports-panel";
import { ParentReportSelector } from "@/components/reports/parent-report-selector";
import type { ManagerDailyMonitoringData } from "@/lib/manager-monitoring/types";
import type { MonthlyReportOptions } from "@/lib/reports/types";
import type { OfficialExamListItem } from "@/lib/official-exams/types";
import {
  saveManagerDataCache,
  getManagerDataCache,
  addOfflineUserToManagerCache,
  addOfflineHalaqaToManagerCache,
} from "@/lib/offline/manager-cache";
import { enqueueSyncItem } from "@/lib/offline/sync-queue";

type ActiveTab = "monitoring" | "alerts" | "followup" | "exams" | "reports" | "parent_report" | "students" | "halaqat" | "users" | "audit";

type ApiMessage = {
  message?: string;
};

type HalaqaDeleteModalState = {
  isOpen: boolean;
  halaqaId: string;
  halaqaName: string;
  counts: {
    enrollments: number;
    sessions: number;
    exams: number;
  };
  hasLinkedData: boolean;
  typedName: string;
  loading: boolean;
};

const ROLE_LABELS: Record<AppRoleCode, string> = {
  TEACHER: "شيخ / محفّظ",
  CENTER_MANAGER: "مدير مركز",
  EXAMINER: "مختبر / ممتحن",
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

export function ManagementPanel({
  data: initialData,
  monitoringData,
  reportOptions,
  officialExams = [],
  initialTab = "monitoring",
  isOffline = false,
}: {
  data: ManagerDashboardData;
  monitoringData: ManagerDailyMonitoringData;
  reportOptions?: MonthlyReportOptions;
  officialExams?: OfficialExamListItem[];
  initialTab?: ActiveTab;
  isOffline?: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState<ManagerDashboardData>(initialData);
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [halaqaDeleteModal, setHalaqaDeleteModal] = useState<HalaqaDeleteModalState | null>(null);

  // Merge pending offline drafts from IndexedDB cache
  useEffect(() => {
    let isMounted = true;
    void getManagerDataCache().then((cache) => {
      if (!isMounted || !cache) return;
      const pendingUsers = cache.data.users.filter((u) => u.isPendingSync || u.id.startsWith("temp_user"));
      const pendingHalaqat = cache.data.halaqat.filter((h) => h.isPendingSync || h.id.startsWith("temp_halaqa"));

      if (pendingUsers.length > 0 || pendingHalaqat.length > 0) {
        setData((prev) => {
          const mergedUsers = [...prev.users];
          for (const pUser of pendingUsers) {
            if (!mergedUsers.some((u) => u.id === pUser.id)) {
              mergedUsers.push(pUser);
            }
          }

          const mergedHalaqat = [...prev.halaqat];
          for (const pHalaqa of pendingHalaqat) {
            if (!mergedHalaqat.some((h) => h.id === pHalaqa.id)) {
              mergedHalaqat.push(pHalaqa);
            }
          }

          return {
            ...prev,
            users: mergedUsers,
            halaqat: mergedHalaqat,
          };
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [initialData]);

  // Automatically save snapshot to IndexedDB when viewing online
  useEffect(() => {
    if (!isOffline && typeof window !== "undefined" && data && monitoringData) {
      void saveManagerDataCache(
        "manager",
        "مدير المركز",
        data,
        monitoringData,
        officialExams,
        reportOptions,
      ).then(() => {
        setNotice({
          type: "success",
          text: "تم حفظ نسخة المدير لهذا الجهاز للعرض بدون إنترنت.",
        });
      });
    }
  }, [isOffline, data, monitoringData, officialExams, reportOptions]);

  // User Management Modals state
  const [viewingUser, setViewingUser] = useState<{
    id: string;
    displayName: string;
    username: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    lastLoginAt: string | null;
    roles: Array<{ code: string; nameAr: string }>;
    activeHalaqat: Array<{ id: string; nameAr: string; stageName: string | null }>;
    isCurrentUser: boolean;
  } | null>(null);
  const [editingUser, setEditingUser] = useState<{
    id: string;
    displayName: string;
    username: string;
    role: "TEACHER" | "CENTER_MANAGER" | "EXAMINER";
    status: "ACTIVE" | "DISABLED";
    isCurrentUser: boolean;
  } | null>(null);

  const [resettingUser, setResettingUser] = useState<{
    id: string;
    displayName: string;
    username: string;
  } | null>(null);
  const [resetMode, setResetMode] = useState<"manual" | "generate">("manual");
  const [manualPassword, setManualPassword] = useState("");
  const [confirmManualPassword, setConfirmManualPassword] = useState("");
  const [generatedPasswordResult, setGeneratedPasswordResult] = useState<string | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const activeTeachers = useMemo(
    () =>
      data.users.filter(
        (user) => user.status === "ACTIVE" && user.roles.some((role) => role.code === "TEACHER"),
      ),
    [data.users],
  );

  const firstStage = data.stages[0];
  const [halaqaStageId, setHalaqaStageId] = useState(firstStage?.id ?? "");
  const [halaqaWeekdays, setHalaqaWeekdays] = useState<WeekdayCode[]>(
    firstStage?.defaultWeekdays ?? [],
  );

  function showResult(type: "success" | "error", text: string) {
    setNotice({ type, text });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleStageChange(stageId: string) {
    setHalaqaStageId(stageId);
    const stage = data.stages.find((item) => item.id === stageId);
    setHalaqaWeekdays(stage?.defaultWeekdays ?? []);
  }

  function toggleWeekday(weekday: WeekdayCode) {
    setHalaqaWeekdays((current) =>
      current.includes(weekday)
        ? current.filter((item) => item !== weekday)
        : [...current, weekday],
    );
  }

  async function createHalaqa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyKey("create-halaqa");
    setNotice(null);

    const form = event.currentTarget;
    const formData = new FormData(form);

    const nameAr = String(formData.get("nameAr") || "").trim();
    const teacherUserId = String(formData.get("teacherUserId") || "").trim();
    const effectiveFrom = String(formData.get("effectiveFrom") || "").trim();
    const notes = String(formData.get("notes") || "").trim();

    if (nameAr.length < 2) {
      showResult("error", "أدخل اسم الحلقة (حرفين على الأقل).");
      setBusyKey(null);
      return;
    }
    if (!teacherUserId) {
      showResult("error", "اختر الشيخ المسؤول عن الحلقة.");
      setBusyKey(null);
      return;
    }
    if (!halaqaWeekdays.length) {
      showResult("error", "اختر يوماً واحداً على الأقل لأيام الحلقة.");
      setBusyKey(null);
      return;
    }

    if (isOffline || (typeof navigator !== "undefined" && !navigator.onLine)) {
      try {
        const tempHalaqaId = `temp_halaqa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const idempotencyKey = `create_halaqa_${tempHalaqaId}_${Date.now()}`;
        const dependencyId = teacherUserId.startsWith("temp_user") ? teacherUserId : null;

        const stage = data.stages.find((s) => s.id === halaqaStageId);
        const teacher = data.users.find((u) => u.id === teacherUserId);

        const newHalaqa: import("@/lib/manager/types").ManagerHalaqaItem = {
          id: tempHalaqaId,
          code: `H_${Date.now().toString().slice(-4)}`,
          nameAr,
          status: "ACTIVE",
          notes: notes || null,
          stage: stage ? { id: stage.id, nameAr: stage.nameAr } : null,
          primaryTeacher: teacher ? { id: teacher.id, displayName: teacher.displayName } : null,
          weekdays: halaqaWeekdays as WeekdayCode[],
          activeStudentsCount: 0,
          isPendingSync: true,
          tempId: tempHalaqaId,
        };

        await addOfflineHalaqaToManagerCache(newHalaqa);

        await enqueueSyncItem({
          type: "create_halaqa",
          endpoint: "/api/manager/halaqat",
          method: "POST",
          payload: {
            tempHalaqaId,
            nameAr,
            stageId: halaqaStageId,
            teacherUserId,
            weekdays: halaqaWeekdays,
            effectiveFrom,
            notes,
            idempotencyKey,
            dependencyId,
          },
          dependencyId,
        });

        setData((prev) => ({
          ...prev,
          halaqat: [...prev.halaqat, newHalaqa],
        }));

        form.reset();
        setHalaqaWeekdays(firstStage?.defaultWeekdays ?? []);
        showResult("success", "تم حفظ مسودة الحلقة محلياً (بانتظار المزامنة). وسترفع تلقائياً عند عودة الشبكة.");
      } catch {
        showResult("error", "تعذر حفظ مسودة الحلقة محلياً.");
      } finally {
        setBusyKey(null);
      }
      return;
    }

    try {
      const response = await fetch("/api/manager/halaqat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nameAr,
          stageId: halaqaStageId,
          teacherUserId,
          weekdays: halaqaWeekdays,
          effectiveFrom,
          notes,
        }),
      });

      const message = await readApiMessage(response);
      if (!response.ok) throw new Error(message);

      form.reset();
      setHalaqaWeekdays(firstStage?.defaultWeekdays ?? []);
      showResult("success", message);
      router.refresh();
    } catch (error) {
      showResult("error", error instanceof Error ? error.message : "تعذر إنشاء الحلقة.");
    } finally {
      setBusyKey(null);
    }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyKey("create-user");
    setNotice(null);

    const form = event.currentTarget;
    const formData = new FormData(form);

    const displayName = String(formData.get("displayName") || "").trim();
    const username = String(formData.get("username") || "").trim();
    const password = String(formData.get("password") || "").trim();
    const role = String(formData.get("role") || "TEACHER") as AppRoleCode;

    if (displayName.length < 2) {
      showResult("error", "أدخل اسم المستخدم الظاهر (حرفين على الأقل).");
      setBusyKey(null);
      return;
    }
    if (username.length < 3) {
      showResult("error", "اسم المستخدم يجب أن يتكون من 3 أحرف على الأقل.");
      setBusyKey(null);
      return;
    }

    if (isOffline || (typeof navigator !== "undefined" && !navigator.onLine)) {
      try {
        const tempUserId = `temp_user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const idempotencyKey = `create_user_${tempUserId}_${Date.now()}`;
        const roleNameAr = role === "TEACHER" ? "محفظ" : role === "EXAMINER" ? "مختبر" : "مدير النظام";

        const newUser: import("@/lib/manager/types").ManagerUserItem = {
          id: tempUserId,
          username,
          displayName,
          status: "ACTIVE",
          roles: [{ code: role, nameAr: roleNameAr }],
          activeHalaqat: [],
          isCurrentUser: false,
          isPendingSync: true,
          tempId: tempUserId,
        };

        await addOfflineUserToManagerCache(newUser);

        await enqueueSyncItem({
          type: "create_user",
          endpoint: "/api/manager/users",
          method: "POST",
          payload: {
            tempUserId,
            username,
            displayName,
            role: role as "TEACHER" | "CENTER_MANAGER" | "EXAMINER",
            idempotencyKey,
          },
        });

        setData((prev) => ({
          ...prev,
          users: [...prev.users, newUser],
        }));

        form.reset();
        showResult("success", "تم حفظ مسودة المستخدم محلياً (بدون كلمة مرور - بانتظار المزامنة). عند عودة الشبكة سيتم إنشاؤه وتعيين كلمة مرور له.");
      } catch {
        showResult("error", "تعذر حفظ مسودة المستخدم محلياً.");
      } finally {
        setBusyKey(null);
      }
      return;
    }

    try {
      const response = await fetch("/api/manager/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          username,
          password,
          role,
        }),
      });

      const message = await readApiMessage(response);
      if (!response.ok) throw new Error(message);

      form.reset();
      showResult("success", message);
      router.refresh();
    } catch (error) {
      showResult("error", error instanceof Error ? error.message : "تعذر إنشاء المستخدم.");
    } finally {
      setBusyKey(null);
    }
  }

  async function requestHalaqaStatusToggle(
    halaqaId: string,
    targetStatus: "ACTIVE" | "INACTIVE",
    nameAr: string,
  ) {
    const isDeactivating = targetStatus === "INACTIVE";
    if (!confirm(isDeactivating ? `هل أنت متأكد من إيقاف حلقة (${nameAr})؟ سيتم إنهاء الأساليب التشغيلية دون حذف أي بيانات تاريخية.` : `هل أنت متأكد من إعادة تفعيل حلقة (${nameAr})؟`)) {
      return;
    }

    setBusyKey(`halaqa-${halaqaId}`);
    setNotice(null);

    try {
      const response = await fetch(`/api/manager/halaqat/${halaqaId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: targetStatus,
          effectiveOn: todayInputValue(),
        }),
      });

      const message = await readApiMessage(response);
      if (!response.ok) throw new Error(message);

      showResult("success", message);
      router.refresh();
    } catch (error) {
      showResult("error", error instanceof Error ? error.message : "تعذر تغيير حالة الحلقة.");
    } finally {
      setBusyKey(null);
    }
  }

  async function requestHalaqaPermanentDelete(halaqaId: string, halaqaName: string) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      showResult("error", "الحذف النهائي يحتاج اتصالاً بالإنترنت.");
      return;
    }

    setBusyKey(`delete-halaqa-${halaqaId}`);
    setNotice(null);

    try {
      const response = await fetch(`/api/manager/halaqat/${halaqaId}`);
      const apiData = (await response.json().catch(() => ({}))) as {
        message?: string;
        counts?: { enrollments: number; sessions: number; exams: number };
        hasLinkedData?: boolean;
      };

      if (!response.ok) throw new Error(apiData.message || "تعذر جلب بيانات الحلقة.");

      const counts = apiData.counts || { enrollments: 0, sessions: 0, exams: 0 };
      const hasLinkedData = Boolean(apiData.hasLinkedData);

      setHalaqaDeleteModal({
        isOpen: true,
        halaqaId,
        halaqaName,
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

  async function executeHalaqaPermanentDelete(halaqaId: string) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      showResult("error", "الحذف النهائي يحتاج اتصالاً بالإنترنت.");
      return;
    }

    setBusyKey(`delete-halaqa-${halaqaId}`);
    try {
      const response = await fetch(`/api/manager/halaqat/${halaqaId}?force=true`, {
        method: "DELETE",
      });

      const message = await readApiMessage(response);
      if (!response.ok) throw new Error(message);

      showResult("success", message);
      setHalaqaDeleteModal(null);
      router.refresh();
    } catch (error) {
      showResult("error", error instanceof Error ? error.message : "تعذر حذف الحلقة.");
    } finally {
      setBusyKey(null);
    }
  }

  async function requestUserStatusToggle(
    userId: string,
    targetStatus: "ACTIVE" | "DISABLED",
    displayName: string,
  ) {
    if (!confirm(targetStatus === "DISABLED" ? `هل أنت متأكد من إيقاف حساب (${displayName})؟` : `هل أنت متأكد من تفعيل حساب (${displayName})؟`)) {
      return;
    }

    setBusyKey(`user-${userId}`);
    setNotice(null);

    try {
      const response = await fetch(`/api/manager/users/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: targetStatus,
          effectiveOn: todayInputValue(),
        }),
      });

      const message = await readApiMessage(response);
      if (!response.ok) throw new Error(message);

      showResult("success", message);
      router.refresh();
    } catch (error) {
      showResult("error", error instanceof Error ? error.message : "تعذر تغيير حالة المستخدم.");
    } finally {
      setBusyKey(null);
    }
  }

  async function requestUserPermanentDelete(userId: string, displayName: string) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      showResult("error", "الحذف النهائي يحتاج اتصالاً بالإنترنت.");
      return;
    }

    if (!confirm(`هل أنت متأكد من حذف المستخدم (${displayName}) نهائياً؟ هذا الإجراء غير قابل للتراجع عنه، وسيُنفذ فقط إذا كان المستخدم غير مرتبط بأي سجلات أو حلقات.`)) {
      return;
    }

    setBusyKey(`delete-user-${userId}`);
    setNotice(null);

    try {
      const response = await fetch(`/api/manager/users/${userId}`, {
        method: "DELETE",
      });

      const message = await readApiMessage(response);
      if (!response.ok) throw new Error(message);

      showResult("success", message);
      router.refresh();
    } catch (error) {
      showResult("error", error instanceof Error ? error.message : "تعذر حذف المستخدم.");
    } finally {
      setBusyKey(null);
    }
  }

  async function openUserDetailsModal(userId: string) {
    setBusyKey(`view-user-${userId}`);
    try {
      const response = await fetch(`/api/manager/users/${userId}`);
      const apiData = await response.json();
      if (!response.ok) throw new Error(apiData.message || "تعذر جلب تفاصيل المستخدم.");
      setViewingUser(apiData.user);
    } catch (error) {
      showResult("error", error instanceof Error ? error.message : "تعذر جلب تفاصيل المستخدم.");
    } finally {
      setBusyKey(null);
    }
  }

  function openUserEditModal(user: ManagerDashboardData["users"][number]) {
    const mainRoleCode = user.roles[0]?.code || "TEACHER";
    setEditingUser({
      id: user.id,
      displayName: user.displayName,
      username: user.username,
      role: mainRoleCode as "TEACHER" | "CENTER_MANAGER" | "EXAMINER",
      status: user.status === "DISABLED" ? "DISABLED" : "ACTIVE",
      isCurrentUser: user.isCurrentUser,
    });
  }

  async function saveUserEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingUser) return;

    if (editingUser.isCurrentUser && editingUser.status === "DISABLED") {
      showResult("error", "لا يمكنك إيقاف حسابك الحالي.");
      return;
    }
    if (editingUser.isCurrentUser && editingUser.role !== "CENTER_MANAGER") {
      showResult("error", "لا يمكنك إزالة صلاحية المدير عن حسابك الحالي.");
      return;
    }

    setBusyKey(`save-user-${editingUser.id}`);
    try {
      const response = await fetch(`/api/manager/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: editingUser.displayName,
          username: editingUser.username,
          role: editingUser.role,
          status: editingUser.status,
        }),
      });
      const message = await readApiMessage(response);
      if (!response.ok) throw new Error(message);

      showResult("success", message);
      setEditingUser(null);
      router.refresh();
    } catch (error) {
      showResult("error", error instanceof Error ? error.message : "تعذر تحديث بيانات المستخدم.");
    } finally {
      setBusyKey(null);
    }
  }

  function openUserResetPasswordModal(user: ManagerDashboardData["users"][number]) {
    setResettingUser({
      id: user.id,
      displayName: user.displayName,
      username: user.username,
    });
    setResetMode("manual");
    setManualPassword("");
    setConfirmManualPassword("");
    setGeneratedPasswordResult(null);
    setCopiedPassword(false);
  }

  async function executePasswordReset() {
    if (!resettingUser) return;

    if (resetMode === "manual") {
      if (!manualPassword || manualPassword.length < 6) {
        showResult("error", "كلمة المرور الجديدة يجب أن تتكون من 6 خانات على الأقل.");
        return;
      }
      if (manualPassword !== confirmManualPassword) {
        showResult("error", "كلمتا المرور غير متطابقتين.");
        return;
      }
    }

    setBusyKey(`reset-pass-${resettingUser.id}`);
    try {
      const response = await fetch(`/api/manager/users/${resettingUser.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: resetMode,
          newPassword: resetMode === "manual" ? manualPassword : undefined,
        }),
      });
      const apiData = await response.json();
      if (!response.ok) throw new Error(apiData.message || "تعذر إعادة تعيين كلمة المرور.");

      setGeneratedPasswordResult(apiData.temporaryPassword);
      setCopiedPassword(false);
      showResult("success", "تم إعادة تعيين كلمة المرور بنجاح. انسخ كلمة المرور الجديدة قبل إغلاق النافذة.");
    } catch (error) {
      showResult("error", error instanceof Error ? error.message : "تعذر إعادة تعيين كلمة المرور.");
    } finally {
      setBusyKey(null);
    }
  }

  function handleCopyPassword(text: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 3000);
    }
  }

  return (
    <div className="space-y-5" dir="rtl">
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

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <SummaryCard value={data.stats.activeStudents} label="طالب نشط" />
        <SummaryCard value={data.stats.activeHalaqat} label="حلقة نشطة" />
        <SummaryCard value={data.stats.activeTeachers} label="شيخ نشط" />
        <SummaryCard value={data.stats.totalUsers} label="مستخدم" />
      </div>

      <div className="grid grid-cols-3 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-1 shadow-sm sm:grid-cols-4 lg:grid-cols-8">
        <TabButton active={activeTab === "monitoring"} onClick={() => setActiveTab("monitoring")}>
          المتابعة
        </TabButton>
        <TabButton active={activeTab === "alerts"} onClick={() => setActiveTab("alerts")}>
          التنبيهات
        </TabButton>
        <TabButton active={activeTab === "followup"} onClick={() => setActiveTab("followup")}>
          متابعة الطلاب
        </TabButton>
        <TabButton active={activeTab === "exams"} onClick={() => setActiveTab("exams")}>
          الاختبارات
        </TabButton>
        <TabButton active={activeTab === "reports"} onClick={() => setActiveTab("reports")}>
          التقارير
        </TabButton>
        <TabButton active={activeTab === "parent_report"} onClick={() => setActiveTab("parent_report")}>
          تقرير ولي الأمر
        </TabButton>
        <TabButton active={activeTab === "students"} onClick={() => setActiveTab("students")}>
          الطلاب
        </TabButton>
        <TabButton active={activeTab === "halaqat"} onClick={() => setActiveTab("halaqat")}>
          الحلقات
        </TabButton>
        <TabButton active={activeTab === "users"} onClick={() => setActiveTab("users")}>
          المستخدمون
        </TabButton>
      </div>

      {activeTab === "monitoring" ? (
        <DailyMonitoringPanel initialData={monitoringData} />
      ) : activeTab === "alerts" ? (
        <ManagerAlertsPanel initialDate={monitoringData.date} />
      ) : activeTab === "followup" ? (
        <StudentFollowUpPanel
          initialDate={monitoringData.date}
          stages={data.stages}
          halaqat={data.studentHalaqat}
        />
      ) : activeTab === "exams" ? (
        <ManagerExamsPanel
          initialExams={officialExams}
          stages={data.stages}
          halaqat={data.studentHalaqat}
        />
      ) : activeTab === "reports" && reportOptions ? (
        <MonthlyReportsPanel
          options={reportOptions}
          initialMonth={todayInputValue().slice(0, 7)}
        />
      ) : activeTab === "parent_report" ? (
        <ParentReportSelector
          title="تنزيل تقرير ولي الأمر (PDF)"
          description="حدد المرحلة والحلقة ثم اختر الطالب للتنزيل المباشر كملف PDF بدون معاينة."
          stages={data.stages}
          halaqat={data.studentHalaqat}
          students={data.students.map((s) => ({
            id: s.id,
            displayName: s.displayName,
            halaqaId: s.activeEnrollment?.halaqa.id,
            halaqaName: s.activeEnrollment?.halaqa.nameAr,
            stageName: s.activeEnrollment?.halaqa.stageName,
          }))}
        />
      ) : activeTab === "audit" ? (
        <AuditLogPanel />
      ) : activeTab === "halaqat" ? (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] text-[var(--text-main)]">
          <section className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 shadow-sm sm:p-5">
            <div className="mb-4">
              <p className="text-xs font-bold text-[var(--gold)]">إدارة الحلقات</p>
              <h2 className="mt-1 text-xl font-black text-[var(--text-main)]">إضافة حلقة جديدة</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                يتم ربط الحلقة بالمرحلة والشيخ وأيام الدوام في عملية واحدة.
              </p>
            </div>

            {!activeTeachers.length ? (
              <div className="rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-3 text-sm font-bold text-[var(--status-warning-text)]">
                أضف مستخدماً بدور الشيخ أولاً قبل إنشاء الحلقة.
              </div>
            ) : null}

            <form className="mt-4 space-y-4" onSubmit={createHalaqa}>
              <div>
                <label className="form-label" htmlFor="halaqa-name">اسم الحلقة</label>
                <input
                  className="form-control font-bold"
                  id="halaqa-name"
                  name="nameAr"
                  placeholder="مثال: حلقة أشبال 1"
                  required
                />
              </div>

              <div>
                <label className="form-label" htmlFor="halaqa-stage">المرحلة</label>
                <select
                  className="form-control font-bold"
                  id="halaqa-stage"
                  value={halaqaStageId}
                  onChange={(event) => handleStageChange(event.target.value)}
                  required
                >
                  {data.stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>{stage.nameAr}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label" htmlFor="halaqa-teacher">الشيخ المسؤول</label>
                <select
                  className="form-control font-bold"
                  id="halaqa-teacher"
                  name="teacherUserId"
                  required
                  disabled={!activeTeachers.length}
                >
                  <option value="">-- اختر الشيخ --</option>
                  {activeTeachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>{teacher.displayName}</option>
                  ))}
                </select>
              </div>

              <fieldset>
                <legend className="form-label">أيام الحلقة</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {WEEKDAY_CODES.map((weekday) => {
                    const checked = halaqaWeekdays.includes(weekday);
                    return (
                      <label
                        key={weekday}
                        className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition ${
                          checked
                            ? "border-[var(--primary)] bg-[var(--card-soft)] text-[var(--primary)]"
                            : "border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-muted)]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="size-4 accent-[var(--primary)]"
                          checked={checked}
                          onChange={() => toggleWeekday(weekday)}
                        />
                        {WEEKDAY_LABELS[weekday]}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div>
                <label className="form-label" htmlFor="halaqa-start">تاريخ بدء الجدول</label>
                <input
                  className="form-control font-bold"
                  id="halaqa-start"
                  name="effectiveFrom"
                  type="date"
                  defaultValue={todayInputValue()}
                  required
                />
              </div>

              <div>
                <label className="form-label" htmlFor="halaqa-notes">ملاحظات</label>
                <textarea
                  className="form-control min-h-24 resize-y font-bold"
                  id="halaqa-notes"
                  name="notes"
                  placeholder="اختياري"
                />
              </div>

              <button
                className="min-h-12 w-full rounded-2xl bg-[var(--primary)] px-4 font-black text-white transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={busyKey !== null || !activeTeachers.length || !halaqaWeekdays.length}
              >
                {busyKey === "create-halaqa" ? "جاري الإنشاء..." : "إنشاء الحلقة"}
              </button>
            </form>
          </section>

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-[var(--gold)]">الحلقات المسجلة</p>
                <h2 className="mt-1 text-xl font-black text-[var(--text-main)]">قائمة الحلقات</h2>
              </div>
              <span className="rounded-full bg-[var(--card-soft)] border border-[var(--border-color)] px-3 py-1 text-xs font-black text-[var(--primary)]">
                {data.halaqat.length}
              </span>
            </div>

            {data.halaqat.length ? data.halaqat.map((halaqa) => (
              <article key={halaqa.id} className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 shadow-sm sm:p-5 text-[var(--text-main)] transition-colors duration-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black text-[var(--text-main)]">{halaqa.nameAr}</h3>
                      <StatusBadge active={halaqa.status === "ACTIVE"} />
                      {halaqa.isPendingSync || halaqa.id.startsWith("temp_halaqa") ? (
                        <span className="rounded-xl border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          ⏳ مسودة - بانتظار المزامنة
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{halaqa.code}</p>
                  </div>
                  <div className="rounded-2xl bg-[var(--card-soft)] border border-[var(--border-color)] px-3 py-2 text-center">
                    <div className="text-lg font-black text-[var(--primary)]">{halaqa.activeStudentsCount}</div>
                    <div className="text-[10px] font-bold text-[var(--text-muted)]">طالب نشط</div>
                  </div>
                </div>

                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <InfoItem label="المرحلة" value={halaqa.stage?.nameAr || "غير محددة"} />
                  <InfoItem label="الشيخ" value={halaqa.primaryTeacher?.displayName || "غير معيّن"} />
                </dl>

                <div className="mt-4">
                  <p className="text-xs font-extrabold text-[var(--text-muted)]">أيام الحلقة</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {halaqa.weekdays.map((weekday) => (
                      <span key={weekday} className="rounded-full bg-[var(--card-soft)] border border-[var(--border-color)] px-3 py-1 text-xs font-bold text-[var(--text-main)]">
                        {WEEKDAY_LABELS[weekday]}
                      </span>
                    ))}
                  </div>
                </div>

                {halaqa.notes ? <p className="mt-4 rounded-xl bg-[var(--card-soft)] border border-[var(--border-color)] p-3 text-sm leading-6 text-[var(--text-muted)]">{halaqa.notes}</p> : null}

                {halaqa.status === "INACTIVE" ? (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      className="min-h-11 rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 text-sm font-black text-[var(--status-success-text)] transition hover:opacity-90 disabled:opacity-60"
                      disabled={busyKey !== null}
                      onClick={() => requestHalaqaStatusToggle(halaqa.id, "ACTIVE", halaqa.nameAr)}
                    >
                      {busyKey === `halaqa-${halaqa.id}` ? "جاري التحديث..." : "إعادة تفعيل الحلقة"}
                    </button>
                    <button
                      className="min-h-11 rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 text-sm font-black text-[var(--status-danger-text)] transition hover:opacity-90 disabled:opacity-60"
                      disabled={busyKey !== null}
                      onClick={() => requestHalaqaPermanentDelete(halaqa.id, halaqa.nameAr)}
                    >
                      {busyKey === `delete-halaqa-${halaqa.id}` ? "جاري التحقق..." : "حذف نهائي"}
                    </button>
                  </div>
                ) : (
                  <button
                    className="mt-4 min-h-11 w-full rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-4 text-sm font-black text-[var(--status-danger-text)] transition hover:opacity-90 disabled:opacity-60"
                    disabled={busyKey !== null}
                    onClick={() => requestHalaqaStatusToggle(halaqa.id, "INACTIVE", halaqa.nameAr)}
                  >
                    {busyKey === `halaqa-${halaqa.id}` ? "جاري التحديث..." : "إيقاف الحلقة بدون حذف البيانات"}
                  </button>
                )}
              </article>
            )) : (
              <EmptyState text="لم تتم إضافة حلقات بعد." />
            )}
          </section>
        </div>
      ) : activeTab === "students" ? (
        <StudentManagementPanel students={data.students} halaqat={data.studentHalaqat} isOffline={isOffline} />
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] text-[var(--text-main)]">
          <section className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 shadow-sm sm:p-5">
            <p className="text-xs font-bold text-[var(--gold)]">إدارة المستخدمين</p>
            <h2 className="mt-1 text-xl font-black text-[var(--text-main)]">إضافة مستخدم</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
              كلمة الدخول تُشفّر في الخادم ولا تُعرض مرة أخرى بعد الحفظ.
            </p>

            <form className="mt-5 space-y-4" onSubmit={createUser}>
              <div>
                <label className="form-label" htmlFor="display-name">الاسم الظاهر</label>
                <input className="form-control font-bold" id="display-name" name="displayName" placeholder="مثال: الشيخ أحمد" required />
              </div>
              <div>
                <label className="form-label" htmlFor="username">اسم المستخدم</label>
                <input className="form-control font-bold" id="username" name="username" autoComplete="off" placeholder="ahmad" required />
              </div>
              <div>
                <label className="form-label" htmlFor="new-password">
                  كلمة الدخول {isOffline || (typeof navigator !== "undefined" && !navigator.onLine) ? "(مسودة أوفلاين)" : ""}
                </label>
                <input
                  className="form-control font-bold disabled:opacity-60"
                  id="new-password"
                  name="password"
                  type="password"
                  minLength={6}
                  autoComplete="new-password"
                  placeholder={
                    isOffline || (typeof navigator !== "undefined" && !navigator.onLine)
                      ? "تتم المزامنة بدون كلمة مرور وتُطلب عند عودة الإنترنت"
                      : "6 خانات على الأقل"
                  }
                  required={!isOffline && (typeof navigator === "undefined" || navigator.onLine)}
                  disabled={isOffline || (typeof navigator !== "undefined" && !navigator.onLine)}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="user-role">الصلاحية</label>
                <select className="form-control font-bold" id="user-role" name="role" defaultValue="TEACHER" required>
                  {Object.entries(ROLE_LABELS).map(([code, label]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </div>
              <button
                className="min-h-12 w-full rounded-2xl bg-[var(--primary)] px-4 font-black text-white transition hover:bg-[var(--primary-dark)] disabled:opacity-60"
                disabled={busyKey !== null}
              >
                {busyKey === "create-user" ? "جاري الإنشاء..." : "إنشاء المستخدم"}
              </button>
            </form>
          </section>

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-[var(--gold)]">الحسابات المسجلة</p>
                <h2 className="mt-1 text-xl font-black text-[var(--text-main)]">قائمة المستخدمين</h2>
              </div>
              <span className="rounded-full bg-[var(--card-soft)] border border-[var(--border-color)] px-3 py-1 text-xs font-black text-[var(--primary)]">{data.users.length}</span>
            </div>

            {data.users.map((user) => (
              <article key={user.id} className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 shadow-sm sm:p-5 text-[var(--text-main)] transition-colors duration-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black text-[var(--text-main)]">{user.displayName}</h3>
                      <StatusBadge active={user.status === "ACTIVE"} label={user.status === "LOCKED" ? "موقوف مؤقتاً" : undefined} />
                      {user.isPendingSync || user.id.startsWith("temp_user") ? (
                        <span className="rounded-xl border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          ⏳ مسودة - بانتظار المزامنة
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">@{user.username}</p>
                  </div>
                  {user.isCurrentUser ? (
                    <span className="rounded-full bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] px-3 py-1 text-[10px] font-black text-[var(--status-warning-text)]">حسابك</span>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {user.roles.map((role) => (
                    <span key={role.code} className="rounded-full bg-[var(--card-soft)] border border-[var(--border-color)] px-3 py-1 text-xs font-bold text-[var(--primary)]">
                      {role.nameAr}
                    </span>
                  ))}
                </div>

                {user.activeHalaqat.length ? (
                  <div className="mt-4 rounded-2xl bg-[var(--card-soft)] border border-[var(--border-color)] p-3">
                    <p className="text-xs font-extrabold text-[var(--text-muted)]">الحلقات المرتبطة</p>
                    <p className="mt-1 text-sm font-bold leading-6 text-[var(--text-main)]">
                      {user.activeHalaqat.map((halaqa) => halaqa.nameAr).join("، ")}
                    </p>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-[var(--border-color)]">
                  <button
                    className="min-h-10 rounded-xl border border-[var(--border-color)] bg-[var(--card-soft)] px-3 text-xs font-black text-[var(--text-main)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-60"
                    disabled={busyKey !== null}
                    type="button"
                    onClick={() => void openUserDetailsModal(user.id)}
                  >
                    {busyKey === `view-user-${user.id}` ? "جاري التحميل..." : "عرض التفاصيل"}
                  </button>

                  <button
                    className="min-h-10 rounded-xl border border-[var(--border-color)] bg-[var(--card-soft)] px-3 text-xs font-black text-[var(--text-main)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-60"
                    disabled={busyKey !== null}
                    type="button"
                    onClick={() => openUserEditModal(user)}
                  >
                    تعديل
                  </button>

                  <button
                    className="min-h-10 rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 text-xs font-black text-[var(--status-warning-text)] transition hover:opacity-90 disabled:opacity-60"
                    disabled={busyKey !== null}
                    type="button"
                    onClick={() => openUserResetPasswordModal(user)}
                  >
                    إعادة تعيين كلمة المرور
                  </button>

                  <button
                    className="min-h-10 rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 text-xs font-black text-[var(--status-danger-text)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={busyKey !== null || user.isCurrentUser}
                    type="button"
                    onClick={() => requestUserStatusToggle(user.id, user.status === "ACTIVE" ? "DISABLED" : "ACTIVE", user.displayName)}
                  >
                    {busyKey === `user-${user.id}`
                      ? "جاري التحديث..."
                      : user.isCurrentUser
                        ? "حسابك الحالي"
                        : user.status === "ACTIVE"
                          ? "إيقاف"
                          : "تفعيل"}
                  </button>

                  {user.status === "DISABLED" && !user.isCurrentUser ? (
                    <button
                      className="min-h-10 rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 text-xs font-black text-[var(--status-danger-text)] transition hover:opacity-90 disabled:opacity-60"
                      disabled={busyKey !== null}
                      type="button"
                      onClick={() => requestUserPermanentDelete(user.id, user.displayName)}
                    >
                      {busyKey === `delete-user-${user.id}` ? "جاري الحذف..." : "حذف نهائي"}
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </section>
        </div>
      )}

      {viewingUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150" dir="rtl">
          <div className="w-full max-w-lg space-y-4 rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6 shadow-2xl text-[var(--text-main)]">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <h3 className="text-lg font-black text-[var(--text-main)] flex items-center gap-2">
                <span>📋</span> تفاصيل المستخدم
              </h3>
              <button
                type="button"
                className="size-8 rounded-full bg-[var(--card-soft)] text-sm font-black text-[var(--text-muted)] hover:text-[var(--text-main)]"
                onClick={() => setViewingUser(null)}
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-bold">
              <InfoItem label="الاسم الكامل" value={viewingUser.displayName} />
              <InfoItem label="اسم المستخدم" value={`@${viewingUser.username}`} />
              <InfoItem label="الحالة" value={viewingUser.status === "ACTIVE" ? "نشط" : viewingUser.status === "LOCKED" ? "موقوف مؤقتاً" : "معطل"} />
              <InfoItem label="الأدوار" value={viewingUser.roles.map((r) => r.nameAr).join("، ") || "بدون"} />
              <InfoItem label="تاريخ الإنشاء" value={new Date(viewingUser.createdAt).toLocaleDateString("ar-SA")} />
              <InfoItem label="آخر دخول" value={viewingUser.lastLoginAt ? new Date(viewingUser.lastLoginAt).toLocaleString("ar-SA") : "لم يدخل بعد"} />
            </div>

            {viewingUser.activeHalaqat.length ? (
              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-soft)] p-3 space-y-1">
                <p className="text-xs font-extrabold text-[var(--text-muted)]">الحلقات والمراحل المرتبطة:</p>
                <div className="space-y-1 pt-1">
                  {viewingUser.activeHalaqat.map((h) => (
                    <div key={h.id} className="text-xs font-bold text-[var(--text-main)] flex justify-between">
                      <span>• {h.nameAr}</span>
                      {h.stageName ? <span className="text-[var(--text-muted)]">({h.stageName})</span> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-3 text-xs font-bold text-[var(--status-warning-text)] leading-6">
              🔒 <strong>ملاحظة أمنية:</strong> كلمة المرور الحالية محميّة ومخزنة بنظام التشفير Argon2id ولن تُعرض هنا أو في أي مكان آخر لأسباب أمنية.
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                className="min-h-10 rounded-xl border border-[var(--border-color)] bg-[var(--card-soft)] px-5 text-xs font-black text-[var(--text-main)] hover:bg-[var(--card-bg)]"
                onClick={() => setViewingUser(null)}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editingUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150" dir="rtl">
          <form onSubmit={saveUserEdit} className="w-full max-w-md space-y-4 rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6 shadow-2xl text-[var(--text-main)]">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <h3 className="text-lg font-black text-[var(--text-main)] flex items-center gap-2">
                <span>✏️</span> تعديل بيانات المستخدم
              </h3>
              <button
                type="button"
                className="size-8 rounded-full bg-[var(--card-soft)] text-sm font-black text-[var(--text-muted)] hover:text-[var(--text-main)]"
                onClick={() => setEditingUser(null)}
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs font-bold">
              <div>
                <label className="block text-[var(--text-muted)] mb-1" htmlFor="edit-displayName">الاسم الظاهر الكامل:</label>
                <input
                  id="edit-displayName"
                  className="form-control text-sm font-bold w-full rounded-xl border border-[var(--border-color)] bg-[var(--card-soft)] p-2.5 text-[var(--text-main)]"
                  value={editingUser.displayName}
                  onChange={(e) => setEditingUser({ ...editingUser, displayName: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-[var(--text-muted)] mb-1" htmlFor="edit-username">اسم المستخدم (Username):</label>
                <input
                  id="edit-username"
                  className="form-control text-sm font-bold w-full rounded-xl border border-[var(--border-color)] bg-[var(--card-soft)] p-2.5 text-[var(--text-main)]"
                  value={editingUser.username}
                  onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-[var(--text-muted)] mb-1" htmlFor="edit-role">الدور / الصلاحية:</label>
                <select
                  id="edit-role"
                  className="form-control text-sm font-bold w-full rounded-xl border border-[var(--border-color)] bg-[var(--card-soft)] p-2.5 text-[var(--text-main)]"
                  value={editingUser.role}
                  disabled={editingUser.isCurrentUser}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as "TEACHER" | "CENTER_MANAGER" | "EXAMINER" })}
                >
                  <option value="TEACHER">شيخ / معلم حلقة (TEACHER)</option>
                  <option value="EXAMINER">مختبر رسمي (EXAMINER)</option>
                  <option value="CENTER_MANAGER">مدير المركز (CENTER_MANAGER)</option>
                </select>
                {editingUser.isCurrentUser ? (
                  <p className="mt-1 text-[11px] text-[var(--status-warning-text)]">لا يمكنك تغيير دورك عن مدير المركز للحفاظ على إمكانية الوصول.</p>
                ) : null}
              </div>

              <div>
                <label className="block text-[var(--text-muted)] mb-1" htmlFor="edit-status">الحالة:</label>
                <select
                  id="edit-status"
                  className="form-control text-sm font-bold w-full rounded-xl border border-[var(--border-color)] bg-[var(--card-soft)] p-2.5 text-[var(--text-main)]"
                  value={editingUser.status}
                  disabled={editingUser.isCurrentUser}
                  onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value as "ACTIVE" | "DISABLED" })}
                >
                  <option value="ACTIVE">نشط (ACTIVE)</option>
                  <option value="DISABLED">معطل (DISABLED)</option>
                </select>
                {editingUser.isCurrentUser ? (
                  <p className="mt-1 text-[11px] text-[var(--status-warning-text)]">لا يمكنك تعطيل حسابك الحالي.</p>
                ) : null}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="min-h-10 rounded-xl border border-[var(--border-color)] bg-[var(--card-soft)] px-4 text-xs font-bold text-[var(--text-main)] hover:bg-[var(--card-bg)]"
                onClick={() => setEditingUser(null)}
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="min-h-10 rounded-xl bg-[var(--primary)] px-5 text-xs font-black text-white hover:opacity-90 disabled:opacity-50"
                disabled={busyKey === `save-user-${editingUser.id}`}
              >
                {busyKey === `save-user-${editingUser.id}` ? "جاري الحفظ..." : "حفظ التعديلات"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {resettingUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150" dir="rtl">
          <div className="w-full max-w-md space-y-4 rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6 shadow-2xl text-[var(--text-main)]">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <h3 className="text-lg font-black text-[var(--text-main)] flex items-center gap-2">
                <span>🔑</span> إعادة تعيين كلمة المرور
              </h3>
              <button
                type="button"
                className="size-8 rounded-full bg-[var(--card-soft)] text-sm font-black text-[var(--text-muted)] hover:text-[var(--text-main)]"
                onClick={() => setResettingUser(null)}
              >
                ✕
              </button>
            </div>

            <div className="rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-3 text-xs font-bold text-[var(--status-warning-text)] leading-6">
              ⚠️ <strong>تحذير أمني:</strong> لا يمكن عرض كلمة المرور الحالية لأسباب أمنية. يمكنك فقط تعيين كلمة مرور جديدة.
            </div>

            <p className="text-xs font-bold text-[var(--text-muted)]">
              المستخدم: <strong className="text-[var(--text-main)]">{resettingUser.displayName} (@{resettingUser.username})</strong>
            </p>

            {!generatedPasswordResult ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[var(--card-soft)] p-1 border border-[var(--border-color)]">
                  <button
                    type="button"
                    className={`min-h-9 rounded-xl text-xs font-black transition ${
                      resetMode === "manual" ? "bg-[var(--primary)] text-white" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                    }`}
                    onClick={() => setResetMode("manual")}
                  >
                    إدخال يدوي
                  </button>
                  <button
                    type="button"
                    className={`min-h-9 rounded-xl text-xs font-black transition ${
                      resetMode === "generate" ? "bg-[var(--primary)] text-white" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                    }`}
                    onClick={() => setResetMode("generate")}
                  >
                    توليد كلمة سر مؤقتة
                  </button>
                </div>

                {resetMode === "manual" ? (
                  <div className="space-y-3 text-xs font-bold">
                    <div>
                      <label className="block text-[var(--text-muted)] mb-1" htmlFor="reset-newPassword">كلمة المرور الجديدة:</label>
                      <input
                        id="reset-newPassword"
                        type="password"
                        className="form-control text-sm font-bold w-full rounded-xl border border-[var(--border-color)] bg-[var(--card-soft)] p-2.5 text-[var(--text-main)]"
                        placeholder="أدخل 6 خانات على الأقل..."
                        value={manualPassword}
                        onChange={(e) => setManualPassword(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[var(--text-muted)] mb-1" htmlFor="reset-confirmPassword">تأكيد كلمة المرور الجديدة:</label>
                      <input
                        id="reset-confirmPassword"
                        type="password"
                        className="form-control text-sm font-bold w-full rounded-xl border border-[var(--border-color)] bg-[var(--card-soft)] p-2.5 text-[var(--text-main)]"
                        placeholder="أعد كتابة كلمة المرور..."
                        value={confirmManualPassword}
                        onChange={(e) => setConfirmManualPassword(e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-soft)] p-4 text-center text-xs font-bold text-[var(--text-muted)] space-y-2">
                    <p>سيتم توليد كلمة سر عشوائية آمنة ومؤقتة للمستخدم.</p>
                    <p className="text-[var(--primary)]">تظهر كلمة المرور مرة واحدة فقط عند التوليد ومزودة بفيشة نسخ.</p>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    className="min-h-10 rounded-xl border border-[var(--border-color)] bg-[var(--card-soft)] px-4 text-xs font-bold text-[var(--text-main)] hover:bg-[var(--card-bg)]"
                    onClick={() => setResettingUser(null)}
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    className="min-h-10 rounded-xl bg-[var(--primary)] px-5 text-xs font-black text-white hover:opacity-90 disabled:opacity-50"
                    disabled={busyKey === `reset-pass-${resettingUser.id}`}
                    onClick={() => void executePasswordReset()}
                  >
                    {busyKey === `reset-pass-${resettingUser.id}` ? "جاري التعيين..." : resetMode === "manual" ? "حفظ كلمة المرور الجديدة" : "توليد كلمة مرور مؤقتة الآن"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                <div className="rounded-2xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-4 text-xs font-bold text-[var(--status-success-text)] leading-6 space-y-1">
                  <p className="text-sm font-black">✅ تم إعادة تعيين كلمة المرور بنجاح.</p>
                  <p>انسخ كلمة المرور الجديدة قبل إغلاق هذه النافذة، حيث لن يتم عرضها مرة أخرى.</p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-extrabold text-[var(--text-muted)]">كلمة المرور الجديدة الصريحة:</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-xl border border-[var(--primary)] bg-[var(--card-soft)] p-3 text-center font-mono text-base font-black text-[var(--primary)] dir-ltr tracking-wider">
                      {generatedPasswordResult}
                    </div>
                    <button
                      type="button"
                      className="min-h-12 rounded-xl bg-[var(--primary)] px-4 text-xs font-black text-white hover:opacity-90 transition"
                      onClick={() => handleCopyPassword(generatedPasswordResult)}
                    >
                      {copiedPassword ? "تم النسخ! ✓" : "نسخ كلمة المرور"}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    className="min-h-10 rounded-xl border border-[var(--border-color)] bg-[var(--card-soft)] px-6 text-xs font-black text-[var(--text-main)] hover:bg-[var(--card-bg)]"
                    onClick={() => setResettingUser(null)}
                  >
                    إغلاق النافذة
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {halaqaDeleteModal && halaqaDeleteModal.isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs" dir="rtl">
          <div className="w-full max-w-lg space-y-4 rounded-3xl border border-[var(--status-danger-border)] bg-[var(--card-bg)] p-6 shadow-2xl text-[var(--text-main)]">
            <div className="flex items-center gap-3 text-[var(--status-danger-text)]">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-xl font-black">⚠️</div>
              <h3 className="text-lg font-black text-[var(--text-main)]">
                {halaqaDeleteModal.hasLinkedData ? "تأكيد الحذف النهائي لحلقة تحتوي على بيانات" : "حذف الحلقة نهائياً"}
              </h3>
            </div>

            {halaqaDeleteModal.hasLinkedData ? (
              <div className="space-y-2 rounded-2xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-4 text-xs font-bold leading-6 text-[var(--status-danger-text)]">
                <p className="text-sm font-black text-[var(--status-danger-text)]">هذه الحلقة تحتوي على بيانات مرتبطة. حذفها سيؤدي إلى حذف:</p>
                <ul className="list-inside list-disc space-y-1">
                  <li>تسجيلات الطلاب المرتبطة بالحلقة ({halaqaDeleteModal.counts.enrollments} طالب/تسجيل)</li>
                  <li>جلسات التسميع ({halaqaDeleteModal.counts.sessions} جلسة)</li>
                  <li>الحفظ والمراجعة والسرد التابع لهذه الجلسات</li>
                  <li>الاختبارات الرسمية المرتبطة ({halaqaDeleteModal.counts.exams} اختبار)</li>
                  <li>أي بيانات تشغيلية مرتبطة بهذه الحلقة</li>
                </ul>
                <p className="pt-1 font-black text-[var(--status-danger-text)]">لا يمكن التراجع عن هذه العملية.</p>
              </div>
            ) : (
              <p className="text-sm font-bold text-[var(--text-muted)]">
                هل أنت متأكد من حذف حلقة ({halaqaDeleteModal.halaqaName}) نهائياً؟ لا تحتوي الحلقة على أي بيانات مرتبطة.
              </p>
            )}

            {halaqaDeleteModal.hasLinkedData ? (
              <div className="space-y-2">
                <label className="block text-xs font-extrabold text-[var(--text-main)]" htmlFor="halaqa-confirm-input">
                  اكتب اسم الحلقة لتأكيد الحذف النهائي: <span className="font-black text-[var(--status-danger-text)]">({halaqaDeleteModal.halaqaName})</span>
                </label>
                <input
                  id="halaqa-confirm-input"
                  className="form-control text-sm font-bold"
                  placeholder="اكتب اسم الحلقة هنا للتأكيد..."
                  value={halaqaDeleteModal.typedName}
                  onChange={(e) =>
                    setHalaqaDeleteModal((prev) => (prev ? { ...prev, typedName: e.target.value } : null))
                  }
                />
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                className="min-h-11 rounded-xl border border-[var(--border-color)] bg-[var(--card-soft)] px-4 text-sm font-bold text-[var(--text-main)] hover:border-[var(--primary)]"
                onClick={() => setHalaqaDeleteModal(null)}
                disabled={halaqaDeleteModal.loading}
              >
                إلغاء
              </button>

              <button
                type="button"
                className="min-h-11 rounded-xl bg-[var(--status-danger-text)] px-5 text-sm font-black text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  halaqaDeleteModal.loading ||
                  (halaqaDeleteModal.hasLinkedData &&
                    halaqaDeleteModal.typedName.trim() !== halaqaDeleteModal.halaqaName.trim())
                }
                onClick={async () => {
                  setHalaqaDeleteModal((prev) => (prev ? { ...prev, loading: true } : null));
                  await executeHalaqaPermanentDelete(halaqaDeleteModal.halaqaId);
                }}
              >
                {halaqaDeleteModal.loading ? "جاري الحذف..." : "حذف نهائي للحلقة والبيانات"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({ value, label }: { value: number; label: string }) {
  return (
    <article className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-3 text-center shadow-sm sm:p-4 transition hover:border-[var(--primary)] text-[var(--text-main)]">
      <div className="text-2xl font-black text-[var(--primary)] sm:text-3xl">{value}</div>
      <div className="mt-1 text-[11px] font-bold text-[var(--text-muted)] sm:text-xs">{label}</div>
    </article>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className={`min-h-11 rounded-xl px-4 text-sm font-black transition ${
        active
          ? "bg-[var(--primary)] text-white shadow-sm"
          : "text-[var(--text-muted)] hover:bg-[var(--card-soft)] hover:text-[var(--text-main)]"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function StatusBadge({ active, label }: { active: boolean; label?: string }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${
        active
          ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
          : "border-[var(--border-color)] bg-[var(--card-soft)] text-[var(--text-muted)]"
      }`}
    >
      {label || (active ? "نشط" : "متوقف")}
    </span>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--card-soft)] border border-[var(--border-color)] p-3">
      <dt className="text-[11px] font-extrabold text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-1 font-black text-[var(--text-main)]">{value}</dd>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-[var(--border-color)] bg-[var(--card-bg)] p-8 text-center text-sm font-bold text-[var(--text-muted)]">
      {text}
    </div>
  );
}
