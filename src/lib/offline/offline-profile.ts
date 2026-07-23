"use client";

import { idbClear, idbGet, idbPut, STORES } from "./indexed-db";

export type OfflineTeacherProfile = {
  role: "TEACHER";
  teacherId: string;
  halaqaId: string;
  teacherName: string;
  halaqaName: string;
  cachedAt: number;
  lastOnlineLoginAt: number;
};

export type OfflineExaminerProfile = {
  role: "EXAMINER";
  examinerId: string;
  examinerName: string;
  cachedAt: number;
  lastOnlineLoginAt: number;
};

export async function saveOfflineTeacherProfile(profile: {
  teacherId: string;
  halaqaId: string;
  teacherName: string;
  halaqaName: string;
  cachedAt?: number;
  lastOnlineLoginAt?: number;
}): Promise<void> {
  if (!profile.teacherId) return;

  const now = Date.now();
  const record: OfflineTeacherProfile = {
    role: "TEACHER",
    teacherId: profile.teacherId,
    halaqaId: profile.halaqaId,
    teacherName: profile.teacherName,
    halaqaName: profile.halaqaName,
    cachedAt: profile.cachedAt || now,
    lastOnlineLoginAt: profile.lastOnlineLoginAt || now,
  };

  await idbPut(STORES.OFFLINE_PROFILE, record);
}

export async function getOfflineTeacherProfile(): Promise<OfflineTeacherProfile | null> {
  const profile = await idbGet<OfflineTeacherProfile>(STORES.OFFLINE_PROFILE, "TEACHER");
  return profile && profile.role === "TEACHER" ? profile : null;
}

export async function saveOfflineExaminerProfile(profile: {
  examinerId: string;
  examinerName: string;
  cachedAt?: number;
  lastOnlineLoginAt?: number;
}): Promise<void> {
  if (!profile.examinerId) return;

  const now = Date.now();
  const record: OfflineExaminerProfile = {
    role: "EXAMINER",
    examinerId: profile.examinerId,
    examinerName: profile.examinerName,
    cachedAt: profile.cachedAt || now,
    lastOnlineLoginAt: profile.lastOnlineLoginAt || now,
  };

  await idbPut(STORES.OFFLINE_PROFILE, record);
}

export async function getOfflineExaminerProfile(): Promise<OfflineExaminerProfile | null> {
  const profile = await idbGet<OfflineExaminerProfile>(STORES.OFFLINE_PROFILE, "EXAMINER");
  return profile && profile.role === "EXAMINER" ? profile : null;
}

export async function clearOfflineProfiles(): Promise<void> {
  await idbClear(STORES.OFFLINE_PROFILE);
}
