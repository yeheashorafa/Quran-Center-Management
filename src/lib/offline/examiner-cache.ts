"use client";

import { idbClear, idbGet, idbPut, STORES } from "./indexed-db";
import type { OfficialExamListItem, OfficialExamOptionsData } from "@/lib/official-exams/types";

export type ExaminerCacheRecord = {
  id: string; // `${examinerId}`
  examinerId: string;
  options: OfficialExamOptionsData;
  exams: OfficialExamListItem[];
  cachedAt: number;
};

export async function saveExaminerDataCache(
  examinerId: string,
  options: OfficialExamOptionsData,
  exams: OfficialExamListItem[],
): Promise<void> {
  if (!examinerId) return;

  const record: ExaminerCacheRecord = {
    id: examinerId,
    examinerId,
    options,
    exams,
    cachedAt: Date.now(),
  };

  await idbPut(STORES.EXAMINER_CACHE, record);
}

export async function getExaminerDataCache(
  examinerId?: string,
): Promise<ExaminerCacheRecord | null> {
  const id = examinerId || "default";
  const cache = await idbGet<ExaminerCacheRecord>(STORES.EXAMINER_CACHE, id);
  if (cache) return cache;

  // Fallback to first available cache if examinerId matches or generic
  const allCaches = await idbGet<ExaminerCacheRecord>(STORES.EXAMINER_CACHE, "examiner");
  return allCaches;
}

export async function clearExaminerDataCache(): Promise<void> {
  await idbClear(STORES.EXAMINER_CACHE);
}
