"use client";

import { idbClear, idbGet, idbPut, STORES } from "./indexed-db";
import type {
  SessionStudentValue,
  TeacherSessionDashboardData,
  TeacherSessionEditorData,
} from "@/lib/memorization-sessions/types";

export type TeacherCacheRecord = {
  id: string; // `${teacherId}_${halaqaId}`
  teacherId: string;
  halaqaId: string;
  dashboard: TeacherSessionDashboardData;
  students: SessionStudentValue[];
  editor: TeacherSessionEditorData | null;
  cachedAt: number;
};

export async function saveTeacherDataCache(
  teacherId: string,
  halaqaId: string,
  dashboard: TeacherSessionDashboardData,
  students: SessionStudentValue[],
  editor?: TeacherSessionEditorData | null,
): Promise<void> {
  if (!teacherId) return;

  const id = `${teacherId}_${halaqaId || "default"}`;
  const record: TeacherCacheRecord = {
    id,
    teacherId,
    halaqaId,
    dashboard,
    students,
    editor: editor ?? null,
    cachedAt: Date.now(),
  };

  await idbPut(STORES.TEACHER_CACHE, record);
}

export async function getTeacherDataCache(
  teacherId: string,
  halaqaId?: string,
): Promise<TeacherCacheRecord | null> {
  if (!teacherId) return null;
  const id = `${teacherId}_${halaqaId || "default"}`;
  const cache = await idbGet<TeacherCacheRecord>(STORES.TEACHER_CACHE, id);
  if (cache) return cache;

  // Fallback: try default key or first matching teacher record
  const defaultCache = await idbGet<TeacherCacheRecord>(STORES.TEACHER_CACHE, `${teacherId}_default`);
  return defaultCache;
}

export async function clearTeacherDataCache(): Promise<void> {
  await idbClear(STORES.TEACHER_CACHE);
}
