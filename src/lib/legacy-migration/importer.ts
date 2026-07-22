import { randomBytes, randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "../../generated/prisma/client";
import { hashPassword } from "../auth/password";
import { normalizeArabicName } from "./normalize";
import type { MigrationPlan } from "./types";

type ImportOptions = {
  allowErrors: boolean;
};

type ImportResult = {
  runId: string;
  alreadyImported: boolean;
  counts: Record<string, number>;
};

type Tx = Prisma.TransactionClient;

function asDate(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function asTimestamp(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

async function createRun(prisma: PrismaClient, plan: MigrationPlan): Promise<string> {
  const runId = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "legacy_migration_runs"
      ("id", "source_system", "source_fingerprint", "status", "dry_run", "input_manifest", "summary")
    VALUES
      (CAST(${runId} AS UUID), ${plan.sourceSystem}, ${plan.sourceFingerprint}, 'IMPORTING', false,
       CAST(${JSON.stringify(plan.inputManifest)} AS JSONB), CAST(${JSON.stringify(plan.statistics)} AS JSONB))
  `;
  return runId;
}

async function markRunFailed(prisma: PrismaClient, runId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await prisma.$executeRaw`
    UPDATE "legacy_migration_runs"
    SET "status" = 'FAILED', "error_message" = ${message}, "completed_at" = CURRENT_TIMESTAMP
    WHERE "id" = CAST(${runId} AS UUID)
  `;
}

async function ensureNotAlreadyImported(prisma: PrismaClient, plan: MigrationPlan): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"::text AS "id"
    FROM "legacy_migration_runs"
    WHERE "source_system" = ${plan.sourceSystem}
      AND "source_fingerprint" = ${plan.sourceFingerprint}
      AND "status" = 'COMPLETED'
    ORDER BY "completed_at" DESC
    LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

async function upsertLegacyMap(
  tx: Tx,
  runId: string,
  plan: MigrationPlan,
  entityType: string,
  legacyId: string,
  newId: string,
  canonicalKey: string | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await tx.$executeRaw`
    INSERT INTO "legacy_id_maps"
      ("run_id", "source_system", "entity_type", "legacy_id", "new_id", "canonical_key", "metadata")
    VALUES
      (CAST(${runId} AS UUID), ${plan.sourceSystem}, ${entityType}, ${legacyId}, CAST(${newId} AS UUID),
       ${canonicalKey}, CAST(${metadata ? JSON.stringify(metadata) : null} AS JSONB))
    ON CONFLICT ("source_system", "entity_type", "legacy_id")
    DO UPDATE SET
      "run_id" = EXCLUDED."run_id",
      "new_id" = EXCLUDED."new_id",
      "canonical_key" = EXCLUDED."canonical_key",
      "metadata" = EXCLUDED."metadata"
  `;
}

export async function importMigrationPlan(
  prisma: PrismaClient,
  plan: MigrationPlan,
  options: ImportOptions,
): Promise<ImportResult> {
  const errorCount = plan.warnings.filter((warning) => warning.severity === "ERROR").length;
  if (errorCount > 0 && !options.allowErrors) {
    throw new Error(
      `Migration plan contains ${errorCount} unresolved errors. Review the reports or rerun with --allow-errors to import only resolvable records.`,
    );
  }

  const completedRunId = await ensureNotAlreadyImported(prisma, plan);
  if (completedRunId) {
    return { runId: completedRunId, alreadyImported: true, counts: plan.statistics };
  }

  const runId = await createRun(prisma, plan);
  const impossiblePasswordHash = await hashPassword(randomBytes(48).toString("base64url"));

  try {
    await prisma.$transaction(
      async (tx) => {
        const idResolution = new Map<string, string>();

        const roles = await tx.role.findMany({ select: { id: true, code: true } });
        const roleByCode = new Map(roles.map((role) => [role.code, role.id]));
        const existingUsers = await tx.user.findMany({
          where: { deletedAt: null },
          select: { id: true, displayName: true },
        });
        const existingUsersByName = new Map<string, Array<{ id: string; displayName: string }>>();
        for (const user of existingUsers) {
          const normalized = normalizeArabicName(user.displayName);
          const group = existingUsersByName.get(normalized) ?? [];
          group.push(user);
          existingUsersByName.set(normalized, group);
        }

        for (const planned of plan.users) {
          const existingMatches = existingUsersByName.get(normalizeArabicName(planned.displayName)) ?? [];
          let userId: string;
          if (existingMatches.length === 1) {
            userId = existingMatches[0]!.id;
          } else {
            const user = await tx.user.upsert({
              where: { id: planned.id },
              update: { displayName: planned.displayName },
              create: {
                id: planned.id,
                username: planned.username,
                normalizedUsername: planned.normalizedUsername,
                displayName: planned.displayName,
                passwordHash: impossiblePasswordHash,
                status: "DISABLED",
                passwordChangedAt: null,
              },
              select: { id: true },
            });
            userId = user.id;
          }
          idResolution.set(planned.id, userId);

          for (const roleCode of planned.roleCodes) {
            const roleId = roleByCode.get(roleCode);
            if (!roleId) throw new Error(`Required role is missing. Run db:seed first: ${roleCode}`);
            await tx.userRole.upsert({
              where: { userId_roleId: { userId, roleId } },
              update: {},
              create: { userId, roleId },
            });
          }
        }

        const programIdByCode = new Map<string, string>();
        for (const planned of plan.programs) {
          const program = await tx.program.upsert({
            where: { code: planned.code },
            update: {
              nameAr: planned.nameAr,
              type: planned.type,
              status: planned.status,
              startsOn: asDate(planned.startsOn),
              endsOn: asDate(planned.endsOn),
              archivedAt: planned.status === "ARCHIVED" ? new Date() : null,
            },
            create: {
              id: planned.id,
              code: planned.code,
              nameAr: planned.nameAr,
              type: planned.type,
              status: planned.status,
              startsOn: asDate(planned.startsOn),
              endsOn: asDate(planned.endsOn),
              archivedAt: planned.status === "ARCHIVED" ? new Date() : null,
            },
            select: { id: true },
          });
          programIdByCode.set(planned.code, program.id);
          idResolution.set(planned.id, program.id);
        }

        const stages = await tx.stage.findMany({ select: { id: true, code: true } });
        const stageIdByCode = new Map(stages.map((stage) => [stage.code, stage.id]));
        const halaqaIdByPlannedId = new Map<string, string>();

        for (const planned of plan.halaqat) {
          const programId = programIdByCode.get(planned.programCode);
          if (!programId) throw new Error(`Program is missing: ${planned.programCode}`);
          const stageId = planned.stageCode ? stageIdByCode.get(planned.stageCode) ?? null : null;
          if (planned.stageCode && !stageId) throw new Error(`Stage is missing. Run db:seed first: ${planned.stageCode}`);

          const halaqa = await tx.halaqa.upsert({
            where: { code: planned.code },
            update: {
              nameAr: planned.nameAr,
              programId,
              stageId,
              status: planned.status,
              notes: `مرحّلة من النظام القديم (${planned.sourceGroupName} / ${planned.sourceSheikhName}).`,
            },
            create: {
              id: planned.id,
              code: planned.code,
              nameAr: planned.nameAr,
              programId,
              stageId,
              status: planned.status,
              notes: `مرحّلة من النظام القديم (${planned.sourceGroupName} / ${planned.sourceSheikhName}).`,
            },
            select: { id: true },
          });
          halaqaIdByPlannedId.set(planned.id, halaqa.id);
          idResolution.set(planned.id, halaqa.id);

          for (const weekday of planned.observedWeekdays) {
            const effectiveFrom = asDate(planned.firstObservedOn)!;
            const exactExisting = await tx.halaqaSchedule.findUnique({
              where: {
                halaqaId_weekday_effectiveFrom: {
                  halaqaId: halaqa.id,
                  weekday: weekday as never,
                  effectiveFrom,
                },
              },
              select: { id: true },
            });
            const openExisting = planned.status === "ACTIVE"
              ? await tx.halaqaSchedule.findFirst({
                  where: { halaqaId: halaqa.id, weekday: weekday as never, effectiveTo: null },
                  select: { id: true },
                })
              : null;
            if (!exactExisting && !openExisting) {
              await tx.halaqaSchedule.create({
                data: {
                  halaqaId: halaqa.id,
                  weekday: weekday as never,
                  effectiveFrom,
                  effectiveTo: planned.status === "ARCHIVED" ? asDate(planned.lastObservedOn) : null,
                },
              });
            }
          }
        }

        for (const planned of plan.staffAssignments) {
          const halaqaId = halaqaIdByPlannedId.get(planned.halaqaId);
          const userId = idResolution.get(planned.plannedUserId);
          if (!halaqaId || !userId) continue;
          const startsOn = asDate(planned.startsOn)!;
          const assignment = await tx.halaqaStaffAssignment.findUnique({
            where: { halaqaId_userId_startsOn: { halaqaId, userId, startsOn } },
            select: { id: true },
          });
          const assignmentId = assignment?.id ?? (await tx.halaqaStaffAssignment.create({
            data: {
              id: planned.id,
              halaqaId,
              userId,
              role: planned.role,
              startsOn,
              endsOn: asDate(planned.endsOn),
            },
            select: { id: true },
          })).id;
          idResolution.set(planned.id, assignmentId);
        }

        const existingStudents = await tx.student.findMany({
          where: { deletedAt: null },
          select: { id: true, normalizedFullName: true, parentPhone: true, gradeLevel: true, notes: true },
        });
        const existingStudentsByName = new Map<string, typeof existingStudents>();
        for (const student of existingStudents) {
          const group = existingStudentsByName.get(student.normalizedFullName) ?? [];
          group.push(student);
          existingStudentsByName.set(student.normalizedFullName, group);
        }

        for (const planned of plan.students) {
          const matches = existingStudentsByName.get(planned.normalizedFullName) ?? [];
          let studentId: string;
          if (matches.length === 1) {
            const existing = matches[0]!;
            await tx.student.update({
              where: { id: existing.id },
              data: {
                parentPhone: existing.parentPhone || planned.parentPhone,
                gradeLevel: existing.gradeLevel || planned.gradeLevel,
                notes: existing.notes || planned.notes,
              },
            });
            studentId = existing.id;
          } else if (matches.length > 1) {
            throw new Error(`Multiple current students match normalized name: ${planned.fullName}`);
          } else {
            const created = await tx.student.upsert({
              where: { id: planned.id },
              update: {},
              create: {
                id: planned.id,
                fullName: planned.fullName,
                normalizedFullName: planned.normalizedFullName,
                displayName: planned.displayName,
                parentPhone: planned.parentPhone,
                gradeLevel: planned.gradeLevel,
                memorizationStartedOn: asDate(planned.memorizationStartedOn),
                notes: planned.notes,
                isActive: planned.isActive,
                createdAt: asTimestamp(planned.createdAt) ?? undefined,
                updatedAt: asTimestamp(planned.updatedAt) ?? undefined,
              },
              select: { id: true },
            });
            studentId = created.id;
          }
          idResolution.set(planned.id, studentId);
        }

        const enrollmentIdByPlannedId = new Map<string, string>();
        for (const planned of plan.enrollments) {
          const studentId = idResolution.get(planned.studentId);
          const halaqaId = halaqaIdByPlannedId.get(planned.halaqaId);
          const programId = programIdByCode.get(planned.programCode);
          if (!studentId || !halaqaId || !programId) continue;
          const startedOn = asDate(planned.startedOn)!;

          const sameEnrollment = await tx.studentEnrollment.findUnique({
            where: { studentId_halaqaId_startedOn: { studentId, halaqaId, startedOn } },
            select: { id: true },
          });
          if (sameEnrollment) {
            enrollmentIdByPlannedId.set(planned.id, sameEnrollment.id);
            idResolution.set(planned.id, sameEnrollment.id);
            continue;
          }

          if (planned.status === "ACTIVE") {
            const conflicting = await tx.studentEnrollment.findFirst({
              where: {
                studentId,
                programId,
                status: "ACTIVE",
                endedOn: null,
                deletedAt: null,
              },
              select: { id: true, halaqaId: true },
            });
            if (conflicting) {
              if (conflicting.halaqaId !== halaqaId) {
                throw new Error(`Active enrollment conflict for migrated student ${studentId}.`);
              }
              enrollmentIdByPlannedId.set(planned.id, conflicting.id);
              idResolution.set(planned.id, conflicting.id);
              continue;
            }
          }

          const enrollment = await tx.studentEnrollment.create({
            data: {
              id: planned.id,
              studentId,
              programId,
              halaqaId,
              status: planned.status,
              startedOn,
              endedOn: asDate(planned.endedOn),
              endReason: planned.endReason,
            },
            select: { id: true },
          });
          enrollmentIdByPlannedId.set(planned.id, enrollment.id);
          idResolution.set(planned.id, enrollment.id);
        }

        for (const planned of plan.sessions) {
          const halaqaId = halaqaIdByPlannedId.get(planned.halaqaId);
          if (!halaqaId) continue;
          const sessionDate = asDate(planned.sessionDate)!;
          const existing = await tx.memorizationSession.findUnique({
            where: { halaqaId_sessionDate: { halaqaId, sessionDate } },
            select: { id: true },
          });
          if (existing && existing.id !== planned.id) {
            throw new Error(`A non-migration session already exists for halaqa/date ${halaqaId}/${planned.sessionDate}.`);
          }
          const session = existing ?? await tx.memorizationSession.create({
            data: {
              id: planned.id,
              halaqaId,
              teacherAssignmentId: planned.assignmentId ? idResolution.get(planned.assignmentId) ?? null : null,
              sessionDate,
              status: planned.status,
              notes: planned.notes,
              idempotencyKey: `legacy:${plan.sourceFingerprint}:session:${planned.id}`,
              completedAt: asTimestamp(planned.completedAt),
              createdAt: asTimestamp(planned.createdAt) ?? undefined,
              updatedAt: asTimestamp(planned.updatedAt) ?? undefined,
            },
            select: { id: true },
          });
          idResolution.set(planned.id, session.id);

          for (const plannedItem of planned.items) {
            const studentId = idResolution.get(plannedItem.studentId);
            if (!studentId) continue;
            const item = await tx.sessionRecordItem.upsert({
              where: { sessionId_studentId: { sessionId: session.id, studentId } },
              update: {},
              create: {
                id: plannedItem.id,
                sessionId: session.id,
                studentId,
                enrollmentId: plannedItem.enrollmentId ? enrollmentIdByPlannedId.get(plannedItem.enrollmentId) ?? null : null,
                attendance: plannedItem.attendance,
                notes: plannedItem.notes,
              },
              select: { id: true },
            });
            idResolution.set(plannedItem.id, item.id);

            for (const activity of plannedItem.activities) {
              const created = await tx.sessionActivity.upsert({
                where: { itemId_type_orderNo: { itemId: item.id, type: activity.type, orderNo: activity.orderNo } },
                update: {},
                create: {
                  id: activity.id,
                  itemId: item.id,
                  type: activity.type,
                  orderNo: activity.orderNo,
                  surahName: activity.surahName,
                  fromAyah: activity.fromAyah,
                  toAyah: activity.toAyah,
                  pageCount: activity.pageCount,
                  details: jsonValue(activity.details),
                },
                select: { id: true },
              });
              idResolution.set(activity.id, created.id);
            }
          }
        }

        for (const planned of plan.exams) {
          const studentId = idResolution.get(planned.studentId);
          const examinerUserId = idResolution.get(planned.examinerPlannedUserId);
          if (!studentId || !examinerUserId) continue;
          const existing = await tx.officialExam.findUnique({ where: { id: planned.id }, select: { id: true } });
          const exam = existing ?? await tx.officialExam.create({
            data: {
              id: planned.id,
              studentId,
              enrollmentId: planned.enrollmentId ? enrollmentIdByPlannedId.get(planned.enrollmentId) ?? null : null,
              examinerUserId,
              examDate: asDate(planned.examDate)!,
              examType: planned.examType,
              status: "ACTIVE",
              score: planned.score,
              resultLabel: planned.resultLabel,
              notes: planned.notes,
              idempotencyKey: `legacy:${plan.sourceFingerprint}:exam:${planned.id}`,
            },
            select: { id: true },
          });
          idResolution.set(planned.id, exam.id);

          for (const scope of planned.scopes) {
            const created = await tx.officialExamScope.upsert({
              where: { examId_orderNo: { examId: exam.id, orderNo: scope.orderNo } },
              update: {},
              create: {
                id: scope.id,
                examId: exam.id,
                orderNo: scope.orderNo,
                type: scope.type,
                juzFrom: scope.juzFrom,
                juzTo: scope.juzTo,
                customText: scope.customText,
              },
              select: { id: true },
            });
            idResolution.set(scope.id, created.id);
          }
        }

        for (const mapping of plan.legacyMaps) {
          const actualId = idResolution.get(mapping.plannedNewId) ?? mapping.plannedNewId;
          await upsertLegacyMap(
            tx,
            runId,
            plan,
            mapping.entityType,
            mapping.legacyId,
            actualId,
            mapping.canonicalKey,
            mapping.metadata,
          );
        }

        await tx.auditLog.create({
          data: {
            action: "LEGACY_MIGRATION_COMPLETED",
            entityType: "legacy_migration_run",
            entityId: runId,
            requestId: runId,
            metadata: jsonValue({
              sourceSystem: plan.sourceSystem,
              sourceFingerprint: plan.sourceFingerprint,
              statistics: plan.statistics,
              importedUsersDisabled: true,
              oldPasswordsImported: false,
            }),
          },
        });

        await tx.$executeRaw`
          UPDATE "legacy_migration_runs"
          SET "status" = 'COMPLETED', "summary" = CAST(${JSON.stringify(plan.statistics)} AS JSONB),
              "completed_at" = CURRENT_TIMESTAMP, "error_message" = NULL
          WHERE "id" = CAST(${runId} AS UUID)
        `;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 15_000, timeout: 180_000 },
    );
  } catch (error) {
    await markRunFailed(prisma, runId, error);
    throw error;
  }

  return { runId, alreadyImported: false, counts: plan.statistics };
}
