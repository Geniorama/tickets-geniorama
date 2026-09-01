-- Núcleo compartido, paso 5 (y último de la Fase 0): plantillas y vínculos de
-- bóveda polimórficos.
--
--   · ticket_templates + task_templates          → templates
--   · ticket_vault_entries + project_vault_entries → vault_links
--
-- En `templates`, `entity_type` no apunta a una entidad concreta: indica qué
-- crea la plantilla. `estimated_hours` solo lo usan las de tarea, así que en
-- las de ticket queda nulo.
--
-- Las tablas viejas NO se eliminan: quedan intactas hasta verificar en
-- producción.

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "entity_type" "EntityType" NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIA',
    "category" TEXT,
    "estimated_hours" DOUBLE PRECISION,
    "checklist" JSONB NOT NULL DEFAULT '[]',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_links" (
    "entity_type" "EntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "vault_entry_id" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vault_links_pkey" PRIMARY KEY ("entity_type","entity_id","vault_entry_id")
);

-- CreateIndex
CREATE INDEX "templates_entity_type_name_idx" ON "templates"("entity_type", "name");

-- CreateIndex
CREATE INDEX "vault_links_vault_entry_id_idx" ON "vault_links"("vault_entry_id");

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_links" ADD CONSTRAINT "vault_links_vault_entry_id_fkey" FOREIGN KEY ("vault_entry_id") REFERENCES "vault_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill
-- ─────────────────────────────────────────────────────────────────────────────

-- Condicionado: `ticket_templates`, `task_templates` y `ticket_vault_entries`
-- vienen del `db push` anterior a usar migraciones y se borran en
-- 20260813120000. En una base nueva no existen y no hay nada que copiar.

-- Plantillas de ticket: sin estimación de horas.
DO $$
BEGIN
  IF to_regclass('public.ticket_templates') IS NOT NULL THEN
    INSERT INTO "templates" (
        "id", "entity_type", "name", "title", "description", "priority", "category",
        "estimated_hours", "checklist", "created_by_id", "created_at", "updated_at"
    )
    SELECT "id", 'TICKET'::"EntityType", "name", "title", "description", "priority", "category",
           NULL, "checklist", "created_by_id", "created_at", "updated_at"
    FROM "ticket_templates";
  END IF;
END $$;

-- Plantillas de tarea.
DO $$
BEGIN
  IF to_regclass('public.task_templates') IS NOT NULL THEN
    INSERT INTO "templates" (
        "id", "entity_type", "name", "title", "description", "priority", "category",
        "estimated_hours", "checklist", "created_by_id", "created_at", "updated_at"
    )
    SELECT "id", 'TASK'::"EntityType", "name", "title", "description", "priority", "category",
           "estimated_hours", "checklist", "created_by_id", "created_at", "updated_at"
    FROM "task_templates";
  END IF;
END $$;

-- Vínculos de bóveda.
DO $$
BEGIN
  IF to_regclass('public.ticket_vault_entries') IS NOT NULL THEN
    INSERT INTO "vault_links" ("entity_type", "entity_id", "vault_entry_id", "added_at")
    SELECT 'TICKET'::"EntityType", "ticket_id", "vault_entry_id", "added_at"
    FROM "ticket_vault_entries";
  END IF;
END $$;

INSERT INTO "vault_links" ("entity_type", "entity_id", "vault_entry_id", "added_at")
SELECT 'PROJECT'::"EntityType", "project_id", "vault_entry_id", "added_at"
FROM "project_vault_entries";
