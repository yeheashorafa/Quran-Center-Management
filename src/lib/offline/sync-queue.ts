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

export type HalaqaUpdateSyncPayload = {
  halaqaId: string;
  nameAr?: string;
  stageId?: string;
  teacherUserId?: string;
  weekdays?: string[];
  status?: "ACTIVE" | "INACTIVE";
  notes?: string | null;
  idempotencyKey: string;
};

export type SyncQueueItem = {
  queueId: string;
  type:
    | "save_student"
    | "save_session"
    | "save_official_exam"
    | "create_student"
    | "create_user"
    | "create_halaqa"
    | "update_halaqa";
  endpoint: string;
  method: "PUT" | "POST" | "PATCH";
  payload:
    | SessionSyncPayload
    | OfficialExamSyncPayload
    | StudentCreateSyncPayload
    | UserCreateSyncPayload
    | HalaqaCreateSyncPayload
    | HalaqaUpdateSyncPayload;
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

export function buildIdempotencyKey(
  item: Omit<SyncQueueItem, "queueId" | "createdAt" | "updatedAt" | "status" | "errorMessage">,
): string {
  const teacherId = item.teacherId || "teacher";
  const halaqaId = item.halaqaId || "halaqa";
  const sessionDate = item.sessionDate || "draft";

  switch (item.type) {
    case "save_student": {
      const sPayload = item.payload as SessionSyncPayload;
      const firstStudentId = sPayload.items?.[0]?.studentId || "student";
      return `teacher.save_student:${teacherId}:${halaqaId}:${sessionDate}:${firstStudentId}`;
    }
    case "save_session": {
      return `teacher.save_session:${teacherId}:${halaqaId}:${sessionDate}`;
    }
    case "create_student": {
      const p = item.payload as StudentCreateSyncPayload;
      return `teacher.create_student:${teacherId}:${halaqaId}:${p.tempStudentId}`;
    }
    case "save_official_exam": {
      const p = item.payload as OfficialExamSyncPayload;
      const examinerId = item.examinerId || "examiner";
      return `examiner.save_exam:${examinerId}:${p.studentId}:${p.examDate}:${p.examType}:${p.juzFrom}:${p.juzTo}`;
    }
    case "create_user": {
      const p = item.payload as UserCreateSyncPayload;
      return `manager.create_user:${p.tempUserId}`;
    }
    case "create_halaqa": {
      const p = item.payload as HalaqaCreateSyncPayload;
      return `manager.create_halaqa:${p.tempHalaqaId}`;
    }
    case "update_halaqa": {
      const p = item.payload as HalaqaUpdateSyncPayload;
      return `manager.update_halaqa:${p.halaqaId}`;
    }
    default:
      return `${item.type}:${teacherId}:${halaqaId}:${sessionDate}`;
  }
}

export async function upsertSyncItem(
  item: Omit<SyncQueueItem, "queueId" | "createdAt" | "updatedAt" | "status" | "errorMessage">,
): Promise<string> {
  const idempotencyKey = buildIdempotencyKey(item);
  const existingItems = await getAllSyncItems();

  const teacherId = item.teacherId || "teacher";
  const halaqaId = item.halaqaId;
  const sessionDate = item.sessionDate;

  // Harmonization logic for save_session vs save_student:
  if (item.type === "save_session" && halaqaId && sessionDate) {
    // If a full session is being saved, remove obsolete standalone save_student items for the same teacher/halaqa/date
    for (const ex of existingItems) {
      if (
        ex.type === "save_student" &&
        ex.teacherId === teacherId &&
        ex.halaqaId === halaqaId &&
        ex.sessionDate === sessionDate
      ) {
        await idbDelete(STORES.SYNC_QUEUE, ex.queueId);
      }
    }
  } else if (item.type === "save_student" && halaqaId && sessionDate) {
    // If saving a single student, check if a full save_session item already exists for this teacher/halaqa/date
    const sessionKey = `teacher.save_session:${teacherId}:${halaqaId}:${sessionDate}`;
    const existingSessionItem = existingItems.find(
      (ex) =>
        ex.queueId === sessionKey ||
        (ex.type === "save_session" &&
          ex.teacherId === teacherId &&
          ex.halaqaId === halaqaId &&
          ex.sessionDate === sessionDate),
    );

    if (existingSessionItem) {
      // Update student inside existing save_session item payload!
      const sessionPayload = existingSessionItem.payload as SessionSyncPayload;
      const studentPayload = item.payload as SessionSyncPayload;
      if (studentPayload.items && studentPayload.items.length > 0) {
        for (const newItem of studentPayload.items) {
          const idx = sessionPayload.items.findIndex((s) => s.studentId === newItem.studentId);
          if (idx >= 0) {
            sessionPayload.items[idx] = newItem;
          } else {
            sessionPayload.items.push(newItem);
          }
        }
      }
      existingSessionItem.updatedAt = Date.now();
      existingSessionItem.status = "pending";
      existingSessionItem.errorMessage = null;
      await idbPut(STORES.SYNC_QUEUE, existingSessionItem);
      return existingSessionItem.queueId;
    }
  }

  // Look for existing item with exact idempotencyKey
  const existing = existingItems.find((ex) => ex.queueId === idempotencyKey);

  if (existing) {
    existing.payload = item.payload;
    existing.updatedAt = Date.now();
    existing.status = "pending";
    existing.errorMessage = null;
    existing.endpoint = item.endpoint;
    existing.method = item.method;
    if (item.teacherId) existing.teacherId = item.teacherId;
    if (item.halaqaId) existing.halaqaId = item.halaqaId;
    if (item.sessionDate) existing.sessionDate = item.sessionDate;
    if (item.examinerId) existing.examinerId = item.examinerId;
    if (item.dependencyId !== undefined) existing.dependencyId = item.dependencyId;

    await idbPut(STORES.SYNC_QUEUE, existing);
    return existing.queueId;
  }

  // Create new record with deterministic queueId
  const record: SyncQueueItem = {
    ...item,
    queueId: idempotencyKey,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: "pending",
    errorMessage: null,
  };

  await idbPut(STORES.SYNC_QUEUE, record);
  return idempotencyKey;
}

export async function enqueueSyncItem(
  item: Omit<SyncQueueItem, "queueId" | "createdAt" | "updatedAt" | "status" | "errorMessage">,
): Promise<string> {
  return upsertSyncItem(item);
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

export async function retryFailedSyncItems(): Promise<void> {
  const items = await getAllSyncItems();
  for (const item of items) {
    if (item.status === "failed" || item.status === "conflict") {
      item.status = "pending";
      item.errorMessage = null;
      item.updatedAt = Date.now();
      await idbPut(STORES.SYNC_QUEUE, item);
    }
  }
}

export async function clearAllSyncItems(): Promise<void> {
  const items = await getAllSyncItems();
  for (const item of items) {
    await idbDelete(STORES.SYNC_QUEUE, item.queueId);
  }
}

export type OfflineBackupData = {
  version: number;
  exportedAt: string;
  syncQueue: SyncQueueItem[];
  sessionDrafts: unknown[];
  teacherCache: unknown[];
};

export async function exportOfflineBackupData(): Promise<OfflineBackupData> {
  const syncQueue = await getAllSyncItems();
  const sessionDrafts = await idbGetAll(STORES.SESSION_DRAFTS);
  const teacherCache = await idbGetAll(STORES.TEACHER_CACHE);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    syncQueue,
    sessionDrafts,
    teacherCache,
  };
}

export function downloadBackupJsonFile(backupData: OfflineBackupData): void {
  const jsonStr = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const filename = `quran_center_offline_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export type FixLegacyResult = {
  totalBefore: number;
  totalAfter: number;
  mergedCount: number;
  tempIdFixedCount: number;
  conflictCount: number;
};

export async function fixLegacySyncItems(): Promise<FixLegacyResult> {
  const items = await getAllSyncItems();
  const totalBefore = items.length;

  if (items.length === 0) {
    return {
      totalBefore: 0,
      totalAfter: 0,
      mergedCount: 0,
      tempIdFixedCount: 0,
      conflictCount: 0,
    };
  }

  // 1. Group items by their calculated idempotencyKey
  const groups = new Map<string, SyncQueueItem[]>();

  for (const item of items) {
    const key = buildIdempotencyKey(item);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  }

  let mergedCount = 0;
  const tempIdFixedCount = 0;
  let conflictCount = 0;

  // Process groups: merge duplicates keeping the one with latest updatedAt
  for (const [key, groupItems] of groups.entries()) {
    groupItems.sort((a, b) => b.updatedAt - a.updatedAt);
    const primary = groupItems[0]!;

    for (let i = 1; i < groupItems.length; i++) {
      await idbDelete(STORES.SYNC_QUEUE, groupItems[i]!.queueId);
      mergedCount++;
    }

    if (primary.queueId !== key) {
      await idbDelete(STORES.SYNC_QUEUE, primary.queueId);
      primary.queueId = key;
    }

    // Check temp_student IDs in primary item
    let hasTempWithoutCreate = false;

    if (primary.type === "save_session" || primary.type === "save_student") {
      const p = primary.payload as SessionSyncPayload;
      for (const sItem of p.items) {
        if (sItem.studentId.startsWith("temp_student_")) {
          const hasPendingCreate = Array.from(groups.values()).some((gItems) =>
            gItems.some(
              (it) =>
                it.type === "create_student" &&
                (it.payload as StudentCreateSyncPayload).tempStudentId === sItem.studentId,
            ),
          );
          if (!hasPendingCreate) {
            hasTempWithoutCreate = true;
          }
        }
      }
    }

    if (hasTempWithoutCreate) {
      primary.status = "conflict";
      primary.errorMessage =
        "هذا الطالب أضيف محلياً لكن عملية إنشائه غير موجودة في الطابور. راجع العملية قبل المزامنة.";
      conflictCount++;
    } else if (primary.status === "failed") {
      if (
        primary.errorMessage?.includes("لا ينتمي إلى الحلقة") ||
        primary.errorMessage?.includes("غير صالح")
      ) {
        primary.status = "conflict";
        primary.errorMessage = "الطالب لم يعد منتمياً لهذه الحلقة في تاريخ الجلسة.";
        conflictCount++;
      }
    }

    await idbPut(STORES.SYNC_QUEUE, primary);
  }

  // 2. Harmonize save_session vs save_student across remaining items
  const remaining = await getAllSyncItems();
  const sessionItems = remaining.filter((i) => i.type === "save_session");

  for (const sItem of sessionItems) {
    const tId = sItem.teacherId || "teacher";
    const hId = sItem.halaqaId;
    const sDate = sItem.sessionDate;

    if (hId && sDate) {
      const obsoleteStudentOps = remaining.filter(
        (i) =>
          i.type === "save_student" &&
          i.teacherId === tId &&
          i.halaqaId === hId &&
          i.sessionDate === sDate,
      );
      for (const obs of obsoleteStudentOps) {
        await idbDelete(STORES.SYNC_QUEUE, obs.queueId);
        mergedCount++;
      }
    }
  }

  const finalItems = await getAllSyncItems();

  return {
    totalBefore,
    totalAfter: finalItems.length,
    mergedCount,
    tempIdFixedCount,
    conflictCount,
  };
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

  // Sort pending items by dependency order: create_user -> create_halaqa -> create_student -> save_session -> save_official_exam -> save_student
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
        continue;
      }
    }

    // Pre-sync guard: check temp_student IDs in save_session, save_student, or save_official_exam
    if (
      item.type === "save_session" ||
      item.type === "save_student" ||
      item.type === "save_official_exam"
    ) {
      let containsUnmappedTemp = false;
      const allQueueItems = await getAllSyncItems();

      if (item.type === "save_session" || item.type === "save_student") {
        const sPayload = item.payload as SessionSyncPayload;
        for (const sItem of sPayload.items) {
          if (sItem.studentId.startsWith("temp_student_")) {
            // Check if there is still a pending create_student item in queue for this tempStudentId
            const hasPendingCreate = allQueueItems.some(
              (q) =>
                q.type === "create_student" &&
                (q.payload as StudentCreateSyncPayload).tempStudentId === sItem.studentId &&
                (q.status === "pending" || q.status === "syncing" || q.status === "failed"),
            );
            if (hasPendingCreate) {
              // Wait for create_student to run first in loop
              containsUnmappedTemp = true;
              break;
            } else {
              // No create_student item exists for this temp_student -> mark conflict
              item.status = "conflict";
              item.errorMessage =
                "هذا الطالب أضيف محلياً لكن عملية إنشائه غير موجودة في الطابور. راجع العملية قبل المزامنة.";
              item.updatedAt = Date.now();
              await idbPut(STORES.SYNC_QUEUE, item);
              failedCount++;
              containsUnmappedTemp = true;
              break;
            }
          }
        }
      } else if (item.type === "save_official_exam") {
        const ePayload = item.payload as OfficialExamSyncPayload;
        if (ePayload.studentId.startsWith("temp_student_")) {
          const hasPendingCreate = allQueueItems.some(
            (q) =>
              q.type === "create_student" &&
              (q.payload as StudentCreateSyncPayload).tempStudentId === ePayload.studentId &&
              (q.status === "pending" || q.status === "syncing" || q.status === "failed"),
          );
          if (!hasPendingCreate) {
            item.status = "conflict";
            item.errorMessage =
              "هذا الطالب أضيف محلياً لكن عملية إنشائه غير موجودة في الطابور. راجع العملية قبل المزامنة.";
            item.updatedAt = Date.now();
            await idbPut(STORES.SYNC_QUEUE, item);
            failedCount++;
          }
          containsUnmappedTemp = true;
        }
      }

      if (containsUnmappedTemp) {
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
      } else if (item.type === "update_halaqa") {
        const p = item.payload as HalaqaUpdateSyncPayload;
        bodyPayload = {
          nameAr: p.nameAr,
          stageId: p.stageId,
          teacherUserId: p.teacherUserId,
          weekdays: p.weekdays,
          status: p.status,
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
            : item.type === "update_halaqa"
            ? { "X-Idempotency-Key": (item.payload as HalaqaUpdateSyncPayload).idempotencyKey }
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
            let modified = false;

            if (qItem.type === "save_session" || qItem.type === "save_student") {
              const sPayload = qItem.payload as SessionSyncPayload;
              for (const sEntry of sPayload.items) {
                if (sEntry.studentId === p.tempStudentId) {
                  sEntry.studentId = realStudentId;
                  modified = true;
                }
              }
            } else if (qItem.type === "save_official_exam") {
              const ePayload = qItem.payload as OfficialExamSyncPayload;
              if (ePayload.studentId === p.tempStudentId) {
                ePayload.studentId = realStudentId;
                modified = true;
              }
            }

            if (modified) {
              await idbPut(STORES.SYNC_QUEUE, qItem);
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
        item.errorMessage =
          item.type === "create_user"
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
      } else if (
        response.status === 400 &&
        (json.message?.includes("لا ينتمي إلى الحلقة") ||
          json.message?.includes("غير صالح") ||
          json.message?.includes("enrollment"))
      ) {
        item.status = "conflict";
        item.errorMessage = "الطالب لم يعد منتمياً لهذه الحلقة في تاريخ الجلسة.";
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

