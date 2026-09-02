-- Historial de acciones.
--
-- Aditiva por completo: una tabla nueva y diez valores más en un enum. No toca
-- ni una fila existente, así que se aplica en caliente.

-- Los tipos de entidad que faltaban. PostgreSQL no admite varios ADD VALUE en
-- una sola sentencia, y `IF NOT EXISTS` permite reaplicar la migración sobre
-- una base donde `db push` ya los hubiera creado.
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'COMPANY';
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'CONTACT';
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'DEAL';
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'USER';
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'VAULT_ENTRY';
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'SITE';
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'PLAN';
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'SERVICE';
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'INTEGRATION';
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'SETTINGS';

CREATE TABLE IF NOT EXISTS "activity_log" (
    "id" TEXT NOT NULL,
    "entity_type" "EntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_label" TEXT,
    "changes" JSONB,
    "meta" JSONB,
    "actor_id" TEXT,
    "actor_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- El panel que se lee dentro de una ficha.
CREATE INDEX IF NOT EXISTS "activity_log_entity_type_entity_id_created_at_idx"
  ON "activity_log"("entity_type", "entity_id", "created_at" DESC);

-- El listado global de /admin/actividad, y su filtro por módulo.
CREATE INDEX IF NOT EXISTS "activity_log_created_at_idx"
  ON "activity_log"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "activity_log_entity_type_created_at_idx"
  ON "activity_log"("entity_type", "created_at" DESC);

-- «Qué ha hecho esta persona».
CREATE INDEX IF NOT EXISTS "activity_log_actor_id_created_at_idx"
  ON "activity_log"("actor_id", "created_at" DESC);

-- Al borrar un usuario la entrada se queda huérfana a propósito: `actor_name`
-- conserva quién fue. Perder el autor sería perder justo lo que se audita.
ALTER TABLE "activity_log"
  ADD CONSTRAINT "activity_log_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
