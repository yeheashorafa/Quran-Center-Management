"use client";

import { idbDelete, idbGetAll, idbPut, STORES } from "./indexed-db";
import { removeSessionDraft, replaceTempStudentIdInSessionDrafts } from "./session-drafts";
import { replaceTempStudentIdInTeacherCache } from "./teacher-cache";
import { replaceTempHalaqaIdInManagerCache, replaceTempUserIdInManagerCache } from "./manager-cache";

export type SyncQueueItemStatus = "pending" | "syncing" | "synced" | "failed" | "conflict";

export type SessionSyncPayload = {
  date: string;
  complete: boolean;
  items: Array<{
    studentId: string;
    enrollmentId: string;
    attendance: string;
    notes: string;
    baseVersion?: number | null;
    activities: Array<{
      type: string;
      pageCount: number;
      text: string;
    }>;
  }>;
};

export type OfficialExamSyncPayload = {
  studentId: string;
  examDate: string;
  examType: "INDIVIDUAL" | "COLLECTIVE";
  juzFrom: number;
  juzTo: number;
  isNotPassed?: boolean;
  score: number | null;
  notes: string;
  idempotencyKey?: string;
  studentName?: string;
  halaqaName?: string;
};

export type StudentCreateSyncPayload = {
  tempStudentId: string;
  halaqaId: string;
  fullName: string;
  displayName: string;
  parentPhone?: string | null;
  gradeLevel?: string | null;
  memorizationStartedOn?: string | null;
  idempotencyKey: string;
};

export type UserCreateSyncPayload = {
  tempUserId: string;
  username: string;
  displayName: string;
  role: "TEACHER" | "CENTER_MANAGER" | "EXAMINER";
  idempotencyKey: string;
};

export type HalaqaCreateSyncPayload = {
  tempHalaqaId: string;
  nameAr: string;
  stageId: string;
  teacherUserId: string;
  weekdays: string[];
  effectiveFrom: string;
  notes?: string | null;
  idempotencyKey: string;
  dependencyId?: string | null;
};

export type SyncQueueItem = {
  queueId: string;
  type: "save_student" | "save_session" | "save_official_exam" | "create_student" | "create_user" | "create_halaqa";
  endpoint: string;
  method: "PUT" | "POST";
  payload:
    | SessionSyncPayload
    | OfficialExamSyncPayload
    | StudentCreateSyncPayload
    | UserCreateSyncPayload
    | HalaqaCreateSyncPayload;
  createdAt: number;
  updatedAt: number;
  status: SyncQueueItemStatus;
  errorMessage: string | null;
  teacherId?: string;
  halaqaId?: string;
  sessionDate?: string;
  examinerId?: string;
  dependencyId?: string | null;
};

export async function enqueueSyncItem(
  item: Omit<SyncQueueItem, "queueId" | "createdAt" | "updatedAt" | "status" | "errorMessage">,
): Promise<string> {
  const prefix = item.type === "save_official_exam" ? item.examinerId || "examiner" : `${item.teacherId}_${item.halaqaId}`;
  const dateKey = item.type === "save_official_exam" ? (item.payload as OfficialExamSyncPayload).examDate : (item.sessionDate || "draft");
  const queueId = `${prefix}_${dateKey}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const record: SyncQueueItem = {
    ...item,
    queueId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: "pending",
    errorMessage: null,
  };

  await idbPut(STORES.SYNC_QUEUE, record);
  return queueId;
}

export async function getAllSyncItems(): Promise<SyncQueueItem[]> {
  const items = await idbGetAll<SyncQueueItem>(STORES.SYNC_QUEUE);
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getPendingSyncCount(): Promise<number> {
  const items = await getAllSyncItems();
  return items.filter((item) => item.status === "pending" || item.status === "failed" || item.status === "conflict").length;
}

export type NetworkCheckResult =
  | { online: true; authenticated: true; user?: unknown }
  | { online: true; authenticated: false; message: string }
  | { online: false; authenticated: false; message: string };

export async function checkServerConnection(): Promise<NetworkCheckResult> {
  try {
    const res = await fetch("/api/auth/me", {
      method: "GET",
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return { online: true, authenticated: true, user: data.user };
    }
    if (res.status === 401 || res.status === 403) {
      return {
        online: true,
        authenticated: false,
        message: "تحتاج تسجيل الدخول بالإنترنت مرة واحدة قبل المزامنة.",
      };
    }
    return {
      online: true,
      authenticated: false,
      message: `خطأ في الاتصال بالخادم (${res.status}).`,
    };
  } catch {
    return {
      online: false,
      authenticated: false,
      message: "لا يوجد اتصال فعلي بالسيرفر.",
    };
  }
}

export async function deleteSyncItem(queueId: string): Promise<void> {
  await idbDelete(STORES.SYNC_QUEUE, queueId);
}

export async function clearFailedSyncItems(): Promise<void> {
  const items = await getAllSyncItems();
  for (const item of items) {
    if (item.status === "failed" || item.status === "conflict") {
      await idbDelete(STORES.SYNC_QUEUE, item.queueId);
    }
  }
}

export async function clearAllSyncItems(): Promise<void> {
  const items = await getAllSyncItems();
  for (const item of items) {
    await idbDelete(STORES.SYNC_QUEUE, item.queueId);
  }
}

let isSyncing = false;

export async function processSyncQueue(
  onStatusChange?: (status: "syncing" | "synced" | "failed" | "idle", pendingCount: number) => void,
): Promise<{ success: number; failed: number; message?: string }> {
  if (isSyncing) {
    const pending = await getPendingSyncCount();
    onStatusChange?.("idle", pending);
    return { success: 0, failed: 0 };
  }

  // Perform real server connection check before syncing
  const check = await checkServerConnection();
  if (!check.online || !check.authenticated) {
    const pending = await getPendingSyncCount();
    onStatusChange?.("failed", pending);
    return { success: 0, failed: 0, message: check.message };
  }

  isSyncing = true;
  const items = await getAllSyncItems();
  const pendingItems = items.filter((i) => i.status === "pending" || i.status === "failed");

  if (pendingItems.length === 0) {
    isSyncing = false;
    const count = await getPendingSyncCount();
    onStatusChange?.(count > 0 ? "failed" : "synced", count);
    return { success: 0, failed: 0 };
  }

  // Sort pending items by dependency order: create_user -> create_halaqa -> create_student -> others
  const typePriority: Record<string, number> = {
    create_user: 1,
    create_halaqa: 2,
    create_student: 3,
    save_session: 4,
    save_official_exam: 5,
    save_student: 6,
  };
  pendingItems.sort((a, b) => (typePriority[a.type] || 10) - (typePriority[b.type] || 10));

  onStatusChange?.("syncing", pendingItems.length);

  let successCount = 0;
  let failedCount = 0;

  for (const item of pendingItems) {
    if (typeof navigator !== "undefined" && !navigator.onLine) break;

    // Dependency check for create_halaqa depending on a pending temp_user
    if (item.type === "create_halaqa" && item.dependencyId) {
      const isDependencyStillPending = pendingItems.some(
        (depItem) =>
          depItem.type === "create_user" &&
          (depItem.payload as UserCreateSyncPayload).tempUserId === item.dependencyId &&
          (depItem.status === "pending" || depItem.status === "failed" || depItem.status === "conflict"),
      );
      if (isDependencyStillPending) {
        // Skip until teacher user is created first
        continue;
      }
    }

    item.status = "syncing";
    item.updatedAt = Date.now();
    await idbPut(STORES.SYNC_QUEUE, item);

    try {
      let bodyPayload: unknown = item.payload;
      if (item.type === "create_student") {
        const p = item.payload as StudentCreateSyncPayload;
        bodyPayload = {
          halaqaId: p.halaqaId,
          fullName: p.fullName,
          displayName: p.displayName,
          parentPhone: p.parentPhone,
          gradeLevel: p.gradeLevel,
          memorizationStartedOn: p.memorizationStartedOn,
        };
      } else if (item.type === "create_user") {
        const p = item.payload as UserCreateSyncPayload;
        bodyPayload = {
          username: p.username,
          displayName: p.displayName,
          role: p.role,
        };
      } else if (item.type === "create_halaqa") {
        const p = item.payload as HalaqaCreateSyncPayload;
        bodyPayload = {
          nameAr: p.nameAr,
          stageId: p.stageId,
          teacherUserId: p.teacherUserId,
          weekdays: p.weekdays,
          effectiveFrom: p.effectiveFrom,
          notes: p.notes,
        };
      }

      const response = await fetch(item.endpoint, {
        method: item.method,
        headers: {
          "Content-Type": "application/json",
          ...(item.type === "create_student"
            ? { "X-Idempotency-Key": (item.payload as StudentCreateSyncPayload).idempotencyKey }
            : item.type === "create_user"
            ? { "X-Idempotency-Key": (item.payload as UserCreateSyncPayload).idempotencyKey }
            : item.type === "create_halaqa"
            ? { "X-Idempotency-Key": (item.payload as HalaqaCreateSyncPayload).idempotencyKey }
            : {}),
        },
        body: JSON.stringify(bodyPayload),
      });

      const json = await response.json().catch(() => ({}));

      if (response.ok) {
        if (item.type === "create_student" && json.student?.id) {
          const p = item.payload as StudentCreateSyncPayload;
          const realStudentId = json.student.id as string;

          if (item.teacherId && item.halaqaId) {
            await replaceTempStudentIdInTeacherCache(
              item.teacherId,
              item.halaqaId,
              p.tempStudentId,
              realStudentId,
            );
          }
          await replaceTempStudentIdInSessionDrafts(p.tempStudentId, realStudentId);

          const allItems = await getAllSyncItems();
          for (const qItem of allItems) {
            if (qItem.type === "save_session") {
              const sPayload = qItem.payload as SessionSyncPayload;
              let modified = false;
              for (const sEntry of sPayload.items) {
                if (sEntry.studentId === p.tempStudentId) {
                  sEntry.studentId = realStudentId;
                  modified = true;
                }
              }
              if (modified) {
                await idbPut(STORES.SYNC_QUEUE, qItem);
              }
            }
          }
        } else if (item.type === "create_user" && json.user?.id) {
          const p = item.payload as UserCreateSyncPayload;
          const realUserId = json.user.id as string;

          await replaceTempUserIdInManagerCache(p.tempUserId, realUserId);

          const allItems = await getAllSyncItems();
          for (const qItem of allItems) {
            if (qItem.type === "create_halaqa") {
              const hPayload = qItem.payload as HalaqaCreateSyncPayload;
              if (hPayload.teacherUserId === p.tempUserId || qItem.dependencyId === p.tempUserId) {
                hPayload.teacherUserId = realUserId;
                qItem.dependencyId = null;
                await idbPut(STORES.SYNC_QUEUE, qItem);
              }
            }
          }
        } else if (item.type === "create_halaqa") {
          const p = item.payload as HalaqaCreateSyncPayload;
          const realHalaqaId = (json.halaqah?.id || json.halaqaId || json.id) as string;
          if (realHalaqaId) {
            await replaceTempHalaqaIdInManagerCache(p.tempHalaqaId, realHalaqaId);
          }
        }

        item.status = "synced";
        item.updatedAt = Date.now();
        await idbDelete(STORES.SYNC_QUEUE, item.queueId);
        if (item.teacherId && item.halaqaId && item.sessionDate) {
          await removeSessionDraft(item.teacherId, item.halaqaId, item.sessionDate);
        }
        successCount++;
      } else if (response.status === 401 || response.status === 403) {
        item.status = "pending";
        item.errorMessage = "يرجى تسجيل الدخول عند توفر الإنترنت لإكمال المزامنة.";
        item.updatedAt = Date.now();
        await idbPut(STORES.SYNC_QUEUE, item);
        failedCount++;
        break; // Stop syncing until user re-logs in
      } else if (response.status === 409) {
        item.status = "conflict";
        item.errorMessage = item.type === "create_user"
          ? "اسم المستخدم موجود مسبقاً على الخادم (تعارض 409). لم تُحذف المسودة محلياً."
          : item.type === "create_halaqa"
          ? "اسم الحلقة مستخدم مسبقاً على الخادم (تعارض 409). لم تُحذف المسودة محلياً."
          : item.type === "create_student"
          ? "يوجد تعارض في إضافة الطالب على الخادم (409). لم تُحذف مسودة الطالب المحلية."
          : item.type === "save_official_exam"
          ? "تم تسجيل اختبار على الخادم لنفس الطالب والتاريخ من جهاز أمر (تعارض 409). لم تُحذف البيانات المحفوظة محلياً."
          : "يوجد تعديل أحدث على هذه الجلسة من جهاز آخر (تعارض 409). راجع الجلسة قبل المزامنة.";
        item.updatedAt = Date.now();
        await idbPut(STORES.SYNC_QUEUE, item);
        failedCount++;
      } else {
        item.status = "failed";
        item.errorMessage = json.message || "حدث خطأ أثناء رفع البيانات إلى السيرفر.";
        item.updatedAt = Date.now();
        await idbPut(STORES.SYNC_QUEUE, item);
        failedCount++;
      }
    } catch {
      item.status = "pending";
      item.errorMessage = "تعذر الاتصال بالشبكة للمزامنة.";
      item.updatedAt = Date.now();
      await idbPut(STORES.SYNC_QUEUE, item);
      failedCount++;
      break; // Network connection lost
    }
  }

  isSyncing = false;
  const finalCount = await getPendingSyncCount();
  onStatusChange?.(failedCount > 0 ? "failed" : "synced", finalCount);

  return { success: successCount, failed: failedCount };
}
