CREATE TABLE "legacy_migration_runs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "source_system" VARCHAR(100) NOT NULL,
  "source_fingerprint" VARCHAR(64) NOT NULL,
  "status" VARCHAR(40) NOT NULL,
  "dry_run" BOOLEAN NOT NULL DEFAULT false,
  "input_manifest" JSONB,
  "summary" JSONB,
  "error_message" TEXT,
  "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "legacy_migration_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "legacy_id_maps" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "run_id" UUID,
  "source_system" VARCHAR(100) NOT NULL,
  "entity_type" VARCHAR(80) NOT NULL,
  "legacy_id" VARCHAR(300) NOT NULL,
  "new_id" UUID NOT NULL,
  "canonical_key" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "legacy_id_maps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "legacy_migration_runs_source_system_source_fingerprint_status_idx"
  ON "legacy_migration_runs"("source_system", "source_fingerprint", "status");
CREATE INDEX "legacy_migration_runs_started_at_idx" ON "legacy_migration_runs"("started_at");
CREATE UNIQUE INDEX "legacy_id_maps_source_system_entity_type_legacy_id_key"
  ON "legacy_id_maps"("source_system", "entity_type", "legacy_id");
CREATE INDEX "legacy_id_maps_entity_type_new_id_idx" ON "legacy_id_maps"("entity_type", "new_id");
CREATE INDEX "legacy_id_maps_run_id_idx" ON "legacy_id_maps"("run_id");

ALTER TABLE "legacy_id_maps"
  ADD CONSTRAINT "legacy_id_maps_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "legacy_migration_runs"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
