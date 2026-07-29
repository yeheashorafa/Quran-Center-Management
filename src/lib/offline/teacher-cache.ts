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
  if (defaultCache) return defaultCache;

  try {
    const { idbGetAll } = await import("./indexed-db");
    const items = await idbGetAll<TeacherCacheRecord>(STORES.TEACHER_CACHE);
    return items[0] ?? null;
  } catch {
    return null;
  }
}

export async function clearTeacherDataCache(): Promise<void> {
  await idbClear(STORES.TEACHER_CACHE);
}

export async function addOfflineStudentToTeacherCache(
  teacherId: string,
  halaqaId: string,
  newStudent: SessionStudentValue,
): Promise<void> {
  const cache = await getTeacherDataCache(teacherId, halaqaId);
  if (!cache) return;

  const existingIndex = cache.students.findIndex((s) => s.studentId === newStudent.studentId);
  if (existingIndex >= 0) {
    cache.students[existingIndex] = newStudent;
  } else {
    cache.students.push(newStudent);
  }

  cache.cachedAt = Date.now();
  await idbPut(STORES.TEACHER_CACHE, cache);
}

export async function replaceTempStudentIdInTeacherCache(
  teacherId: string,
  halaqaId: string,
  tempStudentId: string,
  realStudentId: string,
): Promise<void> {
  const cache = await getTeacherDataCache(teacherId, halaqaId);
  if (!cache) return;

  let modified = false;
  cache.students = cache.students.map((s) => {
    if (s.studentId === tempStudentId || s.tempId === tempStudentId) {
      modified = true;
      return {
        ...s,
        studentId: realStudentId,
        isPendingSync: false,
        tempId: undefined,
      };
    }
    return s;
  });

  if (modified) {
    cache.cachedAt = Date.now();
    await idbPut(STORES.TEACHER_CACHE, cache);
  }
}
