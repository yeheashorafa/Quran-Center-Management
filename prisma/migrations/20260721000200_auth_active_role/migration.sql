-- Tie every new authenticated session to the role explicitly selected at login.
-- Existing rows remain nullable so deploying this migration safely invalidates no data.
ALTER TABLE "auth_sessions"
ADD COLUMN "active_role_id" UUID;

CREATE INDEX "auth_sessions_active_role_id_idx"
ON "auth_sessions"("active_role_id");

ALTER TABLE "auth_sessions"
ADD CONSTRAINT "auth_sessions_active_role_id_fkey"
FOREIGN KEY ("active_role_id") REFERENCES "roles"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
