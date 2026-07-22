import type { PrismaClient } from "../../generated/prisma/client";
import type { MigrationPlan } from "./types";

export interface VerificationResult {
  ok: boolean;
  sourceFingerprint: string;
  runId: string | null;
  expected: Record<string, number>;
  actual: Record<string, number>;
  differences: Array<{ metric: string; expected: number; actual: number }>;
  integrity: Record<string, number>;
}

export async function verifyMigrationPlan(prisma: PrismaClient, plan: MigrationPlan): Promise<VerificationResult> {
  const runs = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"::text AS "id"
    FROM "legacy_migration_runs"
    WHERE "source_system" = ${plan.sourceSystem}
      AND "source_fingerprint" = ${plan.sourceFingerprint}
      AND "status" = 'COMPLETED'
    ORDER BY "completed_at" DESC
    LIMIT 1
  `;
  const runId = runs[0]?.id ?? null;

  const mappedRows = await prisma.$queryRaw<Array<{ entityType: string; newId: string }>>`
    SELECT "entity_type" AS "entityType", "new_id"::text AS "newId"
    FROM "legacy_id_maps"
    WHERE "source_system" = ${plan.sourceSystem}
      AND (${runId}::text IS NULL OR "run_id" = CAST(${runId} AS UUID))
  `;
  const mappedCounts = new Map<string, number>();
  for (const row of mappedRows) {
    mappedCounts.set(row.entityType, (mappedCounts.get(row.entityType) ?? 0) + 1);
  }
  const mappedStudentIds = Array.from(new Set(
    mappedRows
      .filter((row) => row.entityType === "student" || row.entityType === "session_student_reference")
      .map((row) => row.newId),
  ));

  const legacySessionPrefix = `legacy:${plan.sourceFingerprint}:session:`;
  const legacyExamPrefix = `legacy:${plan.sourceFingerprint}:exam:`;
  const migratedSessions = await prisma.memorizationSession.findMany({
    where: { idempotencyKey: { startsWith: legacySessionPrefix } },
    select: { id: true },
  });
  const migratedSessionIds = migratedSessions.map((session) => session.id);

  const actual = {
    mappedStudents: mappedCounts.get("student") ?? 0,
    mappedSessionRecords: mappedCounts.get("session_record") ?? 0,
    mappedExams: (mappedCounts.get("exam") ?? 0) + (mappedCounts.get("official_exam") ?? 0),
    sessions: migratedSessionIds.length,
    students: mappedStudentIds.length
      ? await prisma.student.count({ where: { id: { in: mappedStudentIds } } })
      : 0,
    exams: await prisma.officialExam.count({ where: { idempotencyKey: { startsWith: legacyExamPrefix } } }),
    sessionItems: await prisma.sessionRecordItem.count({
      where: { sessionId: { in: migratedSessionIds.length ? migratedSessionIds : ["00000000-0000-0000-0000-000000000000"] } },
    }),
    activities: await prisma.sessionActivity.count({
      where: { item: { sessionId: { in: migratedSessionIds.length ? migratedSessionIds : ["00000000-0000-0000-0000-000000000000"] } } },
    }),
  };
  const expected = {
    mappedStudents: plan.legacyMaps.filter((mapping) => mapping.entityType === "student").length,
    mappedSessionRecords: plan.legacyMaps.filter((mapping) => mapping.entityType === "session_record").length,
    mappedExams: plan.exams.length,
    sessions: plan.sessions.length,
    students: plan.students.length,
    exams: plan.exams.length,
    sessionItems: plan.sessions.reduce((total, session) => total + session.items.length, 0),
    activities: plan.sessions.reduce((total, session) => total + session.items.reduce((itemTotal, item) => itemTotal + item.activities.length, 0), 0),
  };

  const differences = Object.entries(expected)
    .map(([metric, expectedValue]) => ({ metric, expected: expectedValue, actual: actual[metric as keyof typeof actual] }))
    .filter((item) => item.expected !== item.actual);

  const orphanRows = await prisma.$queryRaw<Array<{
    orphanSessionStudents: bigint;
    orphanEnrollmentStudents: bigint;
    orphanExamStudents: bigint;
    sessionsWithoutHalaqa: bigint;
  }>>`
    SELECT
      (SELECT COUNT(*) FROM "session_record_items" i LEFT JOIN "students" s ON s."id" = i."student_id" WHERE s."id" IS NULL)::bigint AS "orphanSessionStudents",
      (SELECT COUNT(*) FROM "student_enrollments" e LEFT JOIN "students" s ON s."id" = e."student_id" WHERE s."id" IS NULL)::bigint AS "orphanEnrollmentStudents",
      (SELECT COUNT(*) FROM "official_exams" e LEFT JOIN "students" s ON s."id" = e."student_id" WHERE s."id" IS NULL)::bigint AS "orphanExamStudents",
      (SELECT COUNT(*) FROM "memorization_sessions" ms LEFT JOIN "halaqat" h ON h."id" = ms."halaqa_id" WHERE h."id" IS NULL)::bigint AS "sessionsWithoutHalaqa"
  `;
  const orphan = orphanRows[0];
  const integrity = {
    orphanSessionStudents: Number(orphan?.orphanSessionStudents ?? 0),
    orphanEnrollmentStudents: Number(orphan?.orphanEnrollmentStudents ?? 0),
    orphanExamStudents: Number(orphan?.orphanExamStudents ?? 0),
    sessionsWithoutHalaqa: Number(orphan?.sessionsWithoutHalaqa ?? 0),
  };

  return {
    ok: Boolean(runId) && differences.length === 0 && Object.values(integrity).every((count) => count === 0),
    sourceFingerprint: plan.sourceFingerprint,
    runId,
    expected,
    actual,
    differences,
    integrity,
  };
}
