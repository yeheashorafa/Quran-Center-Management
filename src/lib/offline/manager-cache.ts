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
