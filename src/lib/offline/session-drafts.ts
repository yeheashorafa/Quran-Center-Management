"use client";

import { idbDelete, idbGet, idbPut, STORES } from "./indexed-db";
import type { SessionStudentValue } from "@/lib/memorization-sessions/types";

export type SessionDraftRecord = {
  id: string; // `${teacherId}_${halaqaId}_${sessionDate}`
  teacherId: string;
  halaqaId: string;
  sessionDate: string;
  students: SessionStudentValue[];
  lastUpdatedAt: number;
};

export function makeDraftId(teacherId: string, halaqaId: string, sessionDate: string): string {
  return `${teacherId}_${halaqaId}_${sessionDate}`;
}

export async function saveSessionDraft(
  teacherId: string,
  halaqaId: string,
  sessionDate: string,
  students: SessionStudentValue[],
): Promise<void> {
  if (!teacherId || !halaqaId || !sessionDate) return;

  const draftId = makeDraftId(teacherId, halaqaId, sessionDate);
  const record: SessionDraftRecord = {
    id: draftId,
    teacherId,
    halaqaId,
    sessionDate,
    students,
    lastUpdatedAt: Date.now(),
  };

  await idbPut(STORES.SESSION_DRAFTS, record);
}

export async function getSessionDraft(
  teacherId: string,
  halaqaId: string,
  sessionDate: string,
): Promise<SessionDraftRecord | null> {
  if (!teacherId || !halaqaId || !sessionDate) return null;
  const draftId = makeDraftId(teacherId, halaqaId, sessionDate);
  return idbGet<SessionDraftRecord>(STORES.SESSION_DRAFTS, draftId);
}

export async function removeSessionDraft(
  teacherId: string,
  halaqaId: string,
  sessionDate: string,
): Promise<void> {
  if (!teacherId || !halaqaId || !sessionDate) return;
  const draftId = makeDraftId(teacherId, halaqaId, sessionDate);
  await idbDelete(STORES.SESSION_DRAFTS, draftId);
}
