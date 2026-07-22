-- Initial schema for Quran Center Management
-- Generated from prisma/schema.prisma and reviewed for PostgreSQL.

CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'DISABLED', 'LOCKED');
CREATE TYPE "program_type" AS ENUM ('BASE', 'SEASONAL');
CREATE TYPE "program_status" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "halaqa_status" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "weekday" AS ENUM ('SATURDAY', 'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY');
CREATE TYPE "staff_assignment_role" AS ENUM ('PRIMARY_TEACHER', 'ASSISTANT_TEACHER');
CREATE TYPE "enrollment_status" AS ENUM ('ACTIVE', 'COMPLETED', 'TRANSFERRED', 'WITHDRAWN', 'INACTIVE');
CREATE TYPE "memorization_session_status" AS ENUM ('DRAFT', 'COMPLETED', 'LOCKED');
CREATE TYPE "attendance_status" AS ENUM ('PENDING', 'PRESENT', 'ABSENT', 'EXCUSED', 'NOT_HEARD');
CREATE TYPE "activity_type" AS ENUM ('MEMORIZATION', 'REVIEW', 'RECITATION');
CREATE TYPE "exam_type" AS ENUM ('INDIVIDUAL', 'COLLECTIVE', 'CUSTOM');
CREATE TYPE "exam_status" AS ENUM ('ACTIVE', 'VOIDED');
CREATE TYPE "exam_scope_type" AS ENUM ('JUZ', 'SURAH', 'AYAH_RANGE', 'PAGE_RANGE', 'CUSTOM');

CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "username" VARCHAR(80) NOT NULL,
  "normalized_username" VARCHAR(80) NOT NULL,
  "display_name" VARCHAR(160) NOT NULL,
  "password_hash" TEXT NOT NULL,
  "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
  "failed_login_count" INTEGER NOT NULL DEFAULT 0,
  "locked_until" TIMESTAMPTZ(3),
  "last_login_at" TIMESTAMPTZ(3),
  "password_changed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "users_normalized_username_key" UNIQUE ("normalized_username")
);

CREATE TABLE "roles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(80) NOT NULL,
  "name_ar" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "is_system" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "roles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "roles_code_key" UNIQUE ("code")
);

CREATE TABLE "permissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(120) NOT NULL,
  "name_ar" VARCHAR(160) NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "permissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "permissions_code_key" UNIQUE ("code")
);

CREATE TABLE "user_roles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "role_id" UUID NOT NULL,
  "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_roles_user_id_role_id_key" UNIQUE ("user_id", "role_id")
);

CREATE TABLE "role_permissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "role_id" UUID NOT NULL,
  "permission_id" UUID NOT NULL,
  "granted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "role_permissions_role_id_permission_id_key" UNIQUE ("role_id", "permission_id")
);

CREATE TABLE "auth_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "token_hash" VARCHAR(128) NOT NULL,
  "remember_device" BOOLEAN NOT NULL DEFAULT false,
  "device_label" VARCHAR(160),
  "user_agent" TEXT,
  "ip_address" VARCHAR(64),
  "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "revoked_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_sessions_token_hash_key" UNIQUE ("token_hash")
);

CREATE TABLE "programs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(60) NOT NULL,
  "name_ar" VARCHAR(120) NOT NULL,
  "type" "program_type" NOT NULL,
  "status" "program_status" NOT NULL DEFAULT 'ACTIVE',
  "starts_on" DATE,
  "ends_on" DATE,
  "archived_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "programs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "programs_code_key" UNIQUE ("code")
);

CREATE TABLE "stages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(60) NOT NULL,
  "name_ar" VARCHAR(120) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "stages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stages_code_key" UNIQUE ("code")
);

CREATE TABLE "stage_default_schedules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "stage_id" UUID NOT NULL,
  "weekday" "weekday" NOT NULL,
  CONSTRAINT "stage_default_schedules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stage_default_schedules_stage_id_weekday_key" UNIQUE ("stage_id", "weekday")
);

CREATE TABLE "halaqat" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(80) NOT NULL,
  "name_ar" VARCHAR(160) NOT NULL,
  "program_id" UUID NOT NULL,
  "stage_id" UUID,
  "status" "halaqa_status" NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "halaqat_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "halaqat_code_key" UNIQUE ("code")
);

CREATE TABLE "halaqa_schedules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "halaqa_id" UUID NOT NULL,
  "weekday" "weekday" NOT NULL,
  "effective_from" DATE NOT NULL,
  "effective_to" DATE,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "halaqa_schedules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "halaqa_schedules_halaqa_id_weekday_effective_from_key" UNIQUE ("halaqa_id", "weekday", "effective_from")
);

CREATE TABLE "halaqa_staff_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "halaqa_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" "staff_assignment_role" NOT NULL DEFAULT 'PRIMARY_TEACHER',
  "starts_on" DATE NOT NULL,
  "ends_on" DATE,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "halaqa_staff_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "halaqa_staff_assignments_halaqa_id_user_id_starts_on_key" UNIQUE ("halaqa_id", "user_id", "starts_on")
);

CREATE TABLE "students" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "full_name" VARCHAR(200) NOT NULL,
  "normalized_full_name" VARCHAR(200) NOT NULL,
  "display_name" VARCHAR(160) NOT NULL,
  "parent_phone" VARCHAR(40),
  "grade_level" VARCHAR(80),
  "memorization_started_on" DATE,
  "notes" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "student_enrollments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "student_id" UUID NOT NULL,
  "program_id" UUID NOT NULL,
  "halaqa_id" UUID NOT NULL,
  "status" "enrollment_status" NOT NULL DEFAULT 'ACTIVE',
  "started_on" DATE NOT NULL,
  "ended_on" DATE,
  "end_reason" VARCHAR(240),
  "created_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "student_enrollments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "student_enrollments_student_id_halaqa_id_started_on_key" UNIQUE ("student_id", "halaqa_id", "started_on")
);

CREATE TABLE "student_transfers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "student_id" UUID NOT NULL,
  "from_enrollment_id" UUID NOT NULL,
  "to_enrollment_id" UUID NOT NULL,
  "transferred_by_user_id" UUID,
  "transfer_date" DATE NOT NULL,
  "note" TEXT,
  "idempotency_key" VARCHAR(120),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_transfers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "student_transfers_from_enrollment_id_key" UNIQUE ("from_enrollment_id"),
  CONSTRAINT "student_transfers_to_enrollment_id_key" UNIQUE ("to_enrollment_id"),
  CONSTRAINT "student_transfers_idempotency_key_key" UNIQUE ("idempotency_key")
);

CREATE TABLE "memorization_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "halaqa_id" UUID NOT NULL,
  "teacher_assignment_id" UUID,
  "session_date" DATE NOT NULL,
  "status" "memorization_session_status" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "idempotency_key" VARCHAR(120),
  "created_by_user_id" UUID,
  "completed_by_user_id" UUID,
  "completed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "memorization_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "memorization_sessions_idempotency_key_key" UNIQUE ("idempotency_key"),
  CONSTRAINT "memorization_sessions_halaqa_id_session_date_key" UNIQUE ("halaqa_id", "session_date")
);

CREATE TABLE "session_record_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "session_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "enrollment_id" UUID,
  "attendance" "attendance_status" NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "session_record_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "session_record_items_session_id_student_id_key" UNIQUE ("session_id", "student_id")
);

CREATE TABLE "session_activities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "item_id" UUID NOT NULL,
  "type" "activity_type" NOT NULL,
  "order_no" INTEGER NOT NULL DEFAULT 1,
  "surah_name" VARCHAR(120),
  "from_ayah" INTEGER,
  "to_ayah" INTEGER,
  "from_page" INTEGER,
  "to_page" INTEGER,
  "page_count" DECIMAL(8, 2) NOT NULL DEFAULT 0,
  "details" JSONB,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "session_activities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "session_activities_item_id_type_order_no_key" UNIQUE ("item_id", "type", "order_no")
);

CREATE TABLE "official_exams" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "student_id" UUID NOT NULL,
  "enrollment_id" UUID,
  "examiner_user_id" UUID NOT NULL,
  "created_by_user_id" UUID,
  "exam_date" DATE NOT NULL,
  "exam_type" "exam_type" NOT NULL,
  "status" "exam_status" NOT NULL DEFAULT 'ACTIVE',
  "score" DECIMAL(5, 2),
  "result_label" VARCHAR(80),
  "notes" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "idempotency_key" VARCHAR(120),
  "voided_at" TIMESTAMPTZ(3),
  "void_reason" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "official_exams_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "official_exams_idempotency_key_key" UNIQUE ("idempotency_key")
);

CREATE TABLE "official_exam_scopes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "exam_id" UUID NOT NULL,
  "order_no" INTEGER NOT NULL DEFAULT 1,
  "type" "exam_scope_type" NOT NULL,
  "juz_from" INTEGER,
  "juz_to" INTEGER,
  "surah_name" VARCHAR(120),
  "ayah_from" INTEGER,
  "ayah_to" INTEGER,
  "page_from" INTEGER,
  "page_to" INTEGER,
  "custom_text" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "official_exam_scopes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "official_exam_scopes_exam_id_order_no_key" UNIQUE ("exam_id", "order_no")
);

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actor_user_id" UUID,
  "action" VARCHAR(120) NOT NULL,
  "entity_type" VARCHAR(100) NOT NULL,
  "entity_id" UUID,
  "old_values" JSONB,
  "new_values" JSONB,
  "metadata" JSONB,
  "request_id" UUID,
  "device_id" VARCHAR(120),
  "ip_address" VARCHAR(64),
  "user_agent" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "users_status_deleted_at_idx" ON "users" ("status", "deleted_at");
CREATE INDEX "user_roles_role_id_idx" ON "user_roles" ("role_id");
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions" ("permission_id");
CREATE INDEX "auth_sessions_user_id_expires_at_idx" ON "auth_sessions" ("user_id", "expires_at");
CREATE INDEX "auth_sessions_expires_at_revoked_at_idx" ON "auth_sessions" ("expires_at", "revoked_at");
CREATE INDEX "programs_type_status_deleted_at_idx" ON "programs" ("type", "status", "deleted_at");
CREATE INDEX "stages_is_active_sort_order_idx" ON "stages" ("is_active", "sort_order");
CREATE INDEX "halaqat_program_id_status_deleted_at_idx" ON "halaqat" ("program_id", "status", "deleted_at");
CREATE INDEX "halaqat_stage_id_status_deleted_at_idx" ON "halaqat" ("stage_id", "status", "deleted_at");
CREATE INDEX "halaqa_schedules_halaqa_id_effective_from_effective_to_idx" ON "halaqa_schedules" ("halaqa_id", "effective_from", "effective_to");
CREATE INDEX "halaqa_staff_assignments_user_id_starts_on_ends_on_idx" ON "halaqa_staff_assignments" ("user_id", "starts_on", "ends_on");
CREATE INDEX "halaqa_staff_assignments_halaqa_id_role_starts_on_ends_on_idx" ON "halaqa_staff_assignments" ("halaqa_id", "role", "starts_on", "ends_on");
CREATE INDEX "students_normalized_full_name_idx" ON "students" ("normalized_full_name");
CREATE INDEX "students_is_active_deleted_at_idx" ON "students" ("is_active", "deleted_at");
CREATE INDEX "student_enrollments_student_id_status_started_on_ended_on_idx" ON "student_enrollments" ("student_id", "status", "started_on", "ended_on");
CREATE INDEX "student_enrollments_program_id_status_ended_on_idx" ON "student_enrollments" ("program_id", "status", "ended_on");
CREATE INDEX "student_enrollments_halaqa_id_status_ended_on_idx" ON "student_enrollments" ("halaqa_id", "status", "ended_on");
CREATE INDEX "student_transfers_student_id_transfer_date_idx" ON "student_transfers" ("student_id", "transfer_date");
CREATE INDEX "student_transfers_transfer_date_idx" ON "student_transfers" ("transfer_date");
CREATE INDEX "memorization_sessions_session_date_status_idx" ON "memorization_sessions" ("session_date", "status");
CREATE INDEX "memorization_sessions_teacher_assignment_id_session_date_idx" ON "memorization_sessions" ("teacher_assignment_id", "session_date");
CREATE INDEX "session_record_items_student_id_session_id_idx" ON "session_record_items" ("student_id", "session_id");
CREATE INDEX "session_record_items_attendance_session_id_idx" ON "session_record_items" ("attendance", "session_id");
CREATE INDEX "session_activities_type_item_id_idx" ON "session_activities" ("type", "item_id");
CREATE INDEX "official_exams_student_id_exam_date_idx" ON "official_exams" ("student_id", "exam_date");
CREATE INDEX "official_exams_examiner_user_id_exam_date_idx" ON "official_exams" ("examiner_user_id", "exam_date");
CREATE INDEX "official_exams_exam_date_status_idx" ON "official_exams" ("exam_date", "status");
CREATE INDEX "official_exam_scopes_type_exam_id_idx" ON "official_exam_scopes" ("type", "exam_id");
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs" ("entity_type", "entity_id", "created_at");
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs" ("actor_user_id", "created_at");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" ("created_at");

CREATE UNIQUE INDEX "halaqa_schedules_one_open_period_key" ON "halaqa_schedules" ("halaqa_id", "weekday") WHERE "effective_to" IS NULL;
CREATE UNIQUE INDEX "halaqa_one_active_primary_teacher_key" ON "halaqa_staff_assignments" ("halaqa_id") WHERE "role" = 'PRIMARY_TEACHER' AND "ends_on" IS NULL AND "deleted_at" IS NULL;
CREATE UNIQUE INDEX "student_one_active_enrollment_per_program_key" ON "student_enrollments" ("student_id", "program_id") WHERE "status" = 'ACTIVE' AND "ended_on" IS NULL AND "deleted_at" IS NULL;

ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stage_default_schedules" ADD CONSTRAINT "stage_default_schedules_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "stages" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "halaqat" ADD CONSTRAINT "halaqat_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "halaqat" ADD CONSTRAINT "halaqat_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "stages" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "halaqa_schedules" ADD CONSTRAINT "halaqa_schedules_halaqa_id_fkey" FOREIGN KEY ("halaqa_id") REFERENCES "halaqat" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "halaqa_staff_assignments" ADD CONSTRAINT "halaqa_staff_assignments_halaqa_id_fkey" FOREIGN KEY ("halaqa_id") REFERENCES "halaqat" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "halaqa_staff_assignments" ADD CONSTRAINT "halaqa_staff_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "students" ADD CONSTRAINT "students_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_halaqa_id_fkey" FOREIGN KEY ("halaqa_id") REFERENCES "halaqat" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "student_transfers" ADD CONSTRAINT "student_transfers_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_transfers" ADD CONSTRAINT "student_transfers_from_enrollment_id_fkey" FOREIGN KEY ("from_enrollment_id") REFERENCES "student_enrollments" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_transfers" ADD CONSTRAINT "student_transfers_to_enrollment_id_fkey" FOREIGN KEY ("to_enrollment_id") REFERENCES "student_enrollments" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_transfers" ADD CONSTRAINT "student_transfers_transferred_by_user_id_fkey" FOREIGN KEY ("transferred_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "memorization_sessions" ADD CONSTRAINT "memorization_sessions_halaqa_id_fkey" FOREIGN KEY ("halaqa_id") REFERENCES "halaqat" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "memorization_sessions" ADD CONSTRAINT "memorization_sessions_teacher_assignment_id_fkey" FOREIGN KEY ("teacher_assignment_id") REFERENCES "halaqa_staff_assignments" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "memorization_sessions" ADD CONSTRAINT "memorization_sessions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "memorization_sessions" ADD CONSTRAINT "memorization_sessions_completed_by_user_id_fkey" FOREIGN KEY ("completed_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "session_record_items" ADD CONSTRAINT "session_record_items_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "memorization_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "session_record_items" ADD CONSTRAINT "session_record_items_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "session_record_items" ADD CONSTRAINT "session_record_items_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "student_enrollments" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "session_activities" ADD CONSTRAINT "session_activities_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "session_record_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "official_exams" ADD CONSTRAINT "official_exams_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "official_exams" ADD CONSTRAINT "official_exams_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "student_enrollments" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "official_exams" ADD CONSTRAINT "official_exams_examiner_user_id_fkey" FOREIGN KEY ("examiner_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "official_exams" ADD CONSTRAINT "official_exams_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "official_exam_scopes" ADD CONSTRAINT "official_exam_scopes_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "official_exams" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "programs" ADD CONSTRAINT "programs_date_range_check" CHECK ("ends_on" IS NULL OR "starts_on" IS NULL OR "ends_on" >= "starts_on");
ALTER TABLE "halaqa_schedules" ADD CONSTRAINT "halaqa_schedules_date_range_check" CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from");
ALTER TABLE "halaqa_staff_assignments" ADD CONSTRAINT "halaqa_staff_assignments_date_range_check" CHECK ("ends_on" IS NULL OR "ends_on" >= "starts_on");
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_date_range_check" CHECK ("ended_on" IS NULL OR "ended_on" >= "started_on");
ALTER TABLE "student_transfers" ADD CONSTRAINT "student_transfers_different_enrollments_check" CHECK ("from_enrollment_id" <> "to_enrollment_id");
ALTER TABLE "session_activities" ADD CONSTRAINT "session_activities_nonnegative_pages_check" CHECK ("page_count" >= 0);
ALTER TABLE "session_activities" ADD CONSTRAINT "session_activities_ayah_range_check" CHECK ("to_ayah" IS NULL OR "from_ayah" IS NULL OR "to_ayah" >= "from_ayah");
ALTER TABLE "session_activities" ADD CONSTRAINT "session_activities_page_range_check" CHECK ("to_page" IS NULL OR "from_page" IS NULL OR "to_page" >= "from_page");
ALTER TABLE "official_exams" ADD CONSTRAINT "official_exams_score_range_check" CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= 100));
ALTER TABLE "official_exam_scopes" ADD CONSTRAINT "official_exam_scopes_juz_range_check" CHECK ("juz_to" IS NULL OR "juz_from" IS NULL OR "juz_to" >= "juz_from");
ALTER TABLE "official_exam_scopes" ADD CONSTRAINT "official_exam_scopes_ayah_range_check" CHECK ("ayah_to" IS NULL OR "ayah_from" IS NULL OR "ayah_to" >= "ayah_from");
ALTER TABLE "official_exam_scopes" ADD CONSTRAINT "official_exam_scopes_page_range_check" CHECK ("page_to" IS NULL OR "page_from" IS NULL OR "page_to" >= "page_from");

-- Keep the denormalized program_id on enrollments consistent with the selected halaqa.
CREATE OR REPLACE FUNCTION "ensure_enrollment_program_matches_halaqa"()
RETURNS TRIGGER AS $$
DECLARE
  halaqa_program_id UUID;
BEGIN
  SELECT "program_id"
  INTO halaqa_program_id
  FROM "halaqat"
  WHERE "id" = NEW."halaqa_id";

  IF halaqa_program_id IS NULL THEN
    RAISE EXCEPTION 'Halaqa % does not exist', NEW."halaqa_id";
  END IF;

  IF halaqa_program_id <> NEW."program_id" THEN
    RAISE EXCEPTION 'Enrollment program must match halaqa program';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "student_enrollments_program_match_trigger"
BEFORE INSERT OR UPDATE OF "program_id", "halaqa_id"
ON "student_enrollments"
FOR EACH ROW
EXECUTE FUNCTION "ensure_enrollment_program_matches_halaqa"();
