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
  if (examinerId) {
    const cache = await idbGet<ExaminerCacheRecord>(STORES.EXAMINER_CACHE, examinerId);
    if (cache) return cache;
  }

  const genericCache = await idbGet<ExaminerCacheRecord>(STORES.EXAMINER_CACHE, "examiner");
  if (genericCache) return genericCache;

  try {
    const { idbGetAll } = await import("./indexed-db");
    const items = await idbGetAll<ExaminerCacheRecord>(STORES.EXAMINER_CACHE);
    return items[0] ?? null;
  } catch {
    return null;
  }
}

export async function clearExaminerDataCache(): Promise<void> {
  await idbClear(STORES.EXAMINER_CACHE);
}
