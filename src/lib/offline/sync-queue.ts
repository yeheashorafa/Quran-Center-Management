"use client";

import { idbDelete, idbGetAll, idbPut, STORES } from "./indexed-db";
import { removeSessionDraft } from "./session-drafts";

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
  score: number;
  notes: string;
  idempotencyKey?: string;
  studentName?: string;
  halaqaName?: string;
};

export type SyncQueueItem = {
  queueId: string;
  type: "save_student" | "save_session" | "save_official_exam";
  endpoint: string;
  method: "PUT" | "POST";
  payload: SessionSyncPayload | OfficialExamSyncPayload;
  createdAt: number;
  updatedAt: number;
  status: SyncQueueItemStatus;
  errorMessage: string | null;
  teacherId?: string;
  halaqaId?: string;
  sessionDate?: string;
  examinerId?: string;
};

export async function enqueueSyncItem(
  item: Omit<SyncQueueItem, "queueId" | "createdAt" | "updatedAt" | "status" | "errorMessage">,
): Promise<string> {
  const prefix = item.type === "save_official_exam" ? item.examinerId || "examiner" : `${item.teacherId}_${item.halaqaId}`;
  const dateKey = item.type === "save_official_exam" ? (item.payload as OfficialExamSyncPayload).examDate : item.sessionDate;
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

let isSyncing = false;

export async function processSyncQueue(
  onStatusChange?: (status: "syncing" | "synced" | "failed" | "idle", pendingCount: number) => void,
): Promise<{ success: number; failed: number }> {
  if (isSyncing || typeof navigator === "undefined" || !navigator.onLine) {
    const pending = await getPendingSyncCount();
    onStatusChange?.("idle", pending);
    return { success: 0, failed: 0 };
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

  onStatusChange?.("syncing", pendingItems.length);

  let successCount = 0;
  let failedCount = 0;

  for (const item of pendingItems) {
    if (!navigator.onLine) break;

    item.status = "syncing";
    item.updatedAt = Date.now();
    await idbPut(STORES.SYNC_QUEUE, item);

    try {
      const response = await fetch(item.endpoint, {
        method: item.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.payload),
      });

      const json = await response.json().catch(() => ({}));

      if (response.ok) {
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
        item.errorMessage = item.type === "save_official_exam"
          ? "تم تسجيل اختبار على الخادم لنفس الطالب والتاريخ من جهاز آخر (تعارض 409). لم تُحذف البيانات المحفوظة محلياً."
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
