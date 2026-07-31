"use client";

import { idbGet, idbPut, STORES } from "./indexed-db";
import type { ManagerDashboardData } from "@/lib/manager/types";
import type { ManagerDailyMonitoringData } from "@/lib/manager-monitoring/types";
import type { OfficialExamListItem } from "@/lib/official-exams/types";
import type { MonthlyReportOptions } from "@/lib/reports/types";

export type ManagerCacheRecord = {
  id: string; // managerId
  cachedAt: number;
  managerName?: string;
  data: ManagerDashboardData;
  monitoringData: ManagerDailyMonitoringData;
  officialExams: OfficialExamListItem[];
  reportOptions?: MonthlyReportOptions;
};

// Recursively sanitize objects to guarantee no secrets or passwordHashes are stored locally
function sanitizeForCache<T>(val: T): T {
  if (!val || typeof val !== "object" || val === null) return val;
  if (Array.isArray(val)) {
    return val.map((item) => sanitizeForCache(item)) as unknown as T;
  }
  const obj = val as Record<string, unknown>;
  const clean: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes("password") ||
      lowerKey.includes("hash") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("token") ||
      lowerKey.includes("session")
    ) {
      continue;
    }
    clean[key] = sanitizeForCache(obj[key]);
  }
  return clean as T;
}

export async function saveManagerDataCache(
  managerId: string,
  managerName: string,
  data: ManagerDashboardData,
  monitoringData: ManagerDailyMonitoringData,
  officialExams: OfficialExamListItem[],
  reportOptions?: MonthlyReportOptions | null,
): Promise<void> {
  const record: ManagerCacheRecord = {
    id: managerId,
    cachedAt: Date.now(),
    managerName,
    data: sanitizeForCache(data),
    monitoringData: sanitizeForCache(monitoringData),
    officialExams: sanitizeForCache(officialExams),
    reportOptions: reportOptions ? sanitizeForCache(reportOptions) : undefined,
  };
  await idbPut(STORES.MANAGER_CACHE, record);
}

export async function getManagerDataCache(
  managerId?: string,
): Promise<ManagerCacheRecord | null> {
  if (managerId) {
    const cached = await idbGet<ManagerCacheRecord>(STORES.MANAGER_CACHE, managerId);
    if (cached) return cached;
  }
  // Fallback to first available cache entry
  try {
    const { idbGetAll } = await import("./indexed-db");
    const items = await idbGetAll<ManagerCacheRecord>(STORES.MANAGER_CACHE);
    return items[0] ?? null;
  } catch {
    return null;
  }
}

export async function clearManagerDataCache(): Promise<void> {
  try {
    const { idbClear } = await import("./indexed-db");
    await idbClear(STORES.MANAGER_CACHE);
  } catch (err) {
    console.warn("Failed to clear manager cache:", err);
  }
}

export async function addOfflineUserToManagerCache(user: import("@/lib/manager/types").ManagerUserItem): Promise<void> {
  const cache = await getManagerDataCache();
  if (!cache) return;

  const existingIndex = cache.data.users.findIndex((u) => u.id === user.id);
  if (existingIndex >= 0) {
    cache.data.users[existingIndex] = user;
  } else {
    cache.data.users.push(user);
  }

  cache.cachedAt = Date.now();
  await idbPut(STORES.MANAGER_CACHE, cache);
}

export async function addOfflineHalaqaToManagerCache(halaqa: import("@/lib/manager/types").ManagerHalaqaItem): Promise<void> {
  const cache = await getManagerDataCache();
  if (!cache) return;

  const existingIndex = cache.data.halaqat.findIndex((h) => h.id === halaqa.id);
  if (existingIndex >= 0) {
    cache.data.halaqat[existingIndex] = halaqa;
  } else {
    cache.data.halaqat.push(halaqa);
  }

  cache.cachedAt = Date.now();
  await idbPut(STORES.MANAGER_CACHE, cache);
}

export async function replaceTempUserIdInManagerCache(tempUserId: string, realUserId: string): Promise<void> {
  const cache = await getManagerDataCache();
  if (!cache) return;

  let modified = false;
  cache.data.users = cache.data.users.map((u) => {
    if (u.id === tempUserId || u.tempId === tempUserId) {
      modified = true;
      return {
        ...u,
        id: realUserId,
        isPendingSync: false,
        tempId: undefined,
      };
    }
    return u;
  });

  cache.data.halaqat = cache.data.halaqat.map((h) => {
    if (h.primaryTeacher?.id === tempUserId) {
      modified = true;
      return {
        ...h,
        primaryTeacher: {
          ...h.primaryTeacher,
          id: realUserId,
        },
      };
    }
    return h;
  });

  if (modified) {
    cache.cachedAt = Date.now();
    await idbPut(STORES.MANAGER_CACHE, cache);
  }
}

export async function replaceTempHalaqaIdInManagerCache(tempHalaqaId: string, realHalaqaId: string): Promise<void> {
  const cache = await getManagerDataCache();
  if (!cache) return;

  let modified = false;
  cache.data.halaqat = cache.data.halaqat.map((h) => {
    if (h.id === tempHalaqaId || h.tempId === tempHalaqaId) {
      modified = true;
      return {
        ...h,
        id: realHalaqaId,
        isPendingSync: false,
        tempId: undefined,
      };
    }
    return h;
  });

  if (modified) {
    cache.cachedAt = Date.now();
    await idbPut(STORES.MANAGER_CACHE, cache);
  }
}

export async function removeStudentFromManagerCache(studentId: string): Promise<void> {
  try {
    const cache = await getManagerDataCache();
    if (!cache) return;
    let modified = false;

    if (cache.officialExams) {
      const orig = cache.officialExams.length;
      cache.officialExams = cache.officialExams.filter((ex) => ex.student?.id !== studentId);
      if (cache.officialExams.length !== orig) modified = true;
    }

    if (modified) {
      cache.cachedAt = Date.now();
      await idbPut(STORES.MANAGER_CACHE, cache);
    }
  } catch (err) {
    console.warn("Failed to remove student from manager cache:", err);
  }
}

