-- Hooks y llaves de API: las integraciones salen de la app.
--
-- Dos movimientos en la misma migración porque son la misma decisión: la
-- plataforma deja de hablar con canales concretos (WhatsApp) y pasa a contar lo
-- que le ocurre para que cualquiera lo consuma desde fuera.

-- ─── Hooks salientes ─────────────────────────────────────────────────────────

CREATE TYPE "HookScope" AS ENUM ('ORG', 'PROJECT');

CREATE TABLE "hooks" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scope" "HookScope" NOT NULL DEFAULT 'ORG',
    "project_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_status" INTEGER,
    "last_error" TEXT,
    "last_sent_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hooks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hooks_is_active_scope_idx" ON "hooks"("is_active", "scope");
CREATE INDEX "hooks_project_id_idx" ON "hooks"("project_id");

ALTER TABLE "hooks"
    ADD CONSTRAINT "hooks_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hooks"
    ADD CONSTRAINT "hooks_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Historial de entregas. Se poda a 14 días desde la aplicación.
CREATE TABLE "hook_deliveries" (
    "id" TEXT NOT NULL,
    "hook_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" INTEGER,
    "error" TEXT,
    "duration_ms" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hook_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hook_deliveries_hook_id_created_at_idx" ON "hook_deliveries"("hook_id", "created_at" DESC);

ALTER TABLE "hook_deliveries"
    ADD CONSTRAINT "hook_deliveries_hook_id_fkey"
    FOREIGN KEY ("hook_id") REFERENCES "hooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Llaves de API (entrada) ─────────────────────────────────────────────────

CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "user_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "api_keys_prefix_key" ON "api_keys"("prefix");
CREATE UNIQUE INDEX "api_keys_token_hash_key" ON "api_keys"("token_hash");
CREATE INDEX "api_keys_user_id_idx" ON "api_keys"("user_id");

ALTER TABLE "api_keys"
    ADD CONSTRAINT "api_keys_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "api_keys"
    ADD CONSTRAINT "api_keys_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Retirada del agente de WhatsApp ─────────────────────────────────────────
--
-- Destructiva a propósito: el agente deja de existir, y con él la memoria de
-- las conversaciones, el vínculo teléfono→usuario y su prompt editable. Lo que
-- hacía el bot se rehace fuera, contra la API y los hooks de arriba.

DROP TABLE IF EXISTS "whatsapp_conversations";

DROP INDEX IF EXISTS "users_whatsapp_phone_key";
ALTER TABLE "users" DROP COLUMN IF EXISTS "whatsapp_phone";

DELETE FROM "app_settings" WHERE "key" = 'whatsapp_agent_prompt';
