-- Núcleo compartido, paso 3: checklists polimórficos.
--
-- Unifica ticket_checklists / task_checklists y sus ítems en checklists /
-- checklist_items, conservando los ids originales para que los ítems sigan
-- apuntando a su checklist.
--
-- Los ítems mantienen clave foránea real hacia el checklist: la cascada entre
-- checklist e ítem sigue existiendo. Lo único que pierde cascada es el vínculo
-- con el ticket o la tarea.
--
-- Las tablas viejas NO se eliminan: quedan intactas hasta verificar en
-- producción.

-- CreateTable
CREATE TABLE "checklists" (
    "id" TEXT NOT NULL,
    "entity_type" "EntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_items" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "is_checked" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "checklist_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "checklists_entity_type_entity_id_position_idx" ON "checklists"("entity_type", "entity_id", "position");

-- CreateIndex
CREATE INDEX "checklist_items_checklist_id_position_idx" ON "checklist_items"("checklist_id", "position");

-- AddForeignKey
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "checklists" ("id", "entity_type", "entity_id", "title", "position", "created_by_id", "created_at", "updated_at")
SELECT "id", 'TICKET'::"EntityType", "ticket_id", "title", "position", "created_by_id", "created_at", "updated_at"
FROM "ticket_checklists";

INSERT INTO "checklists" ("id", "entity_type", "entity_id", "title", "position", "created_by_id", "created_at", "updated_at")
SELECT "id", 'TASK'::"EntityType", "task_id", "title", "position", "created_by_id", "created_at", "updated_at"
FROM "task_checklists";

-- Los ítems vienen de dos tablas heredadas que nunca creó una migración, sino
-- un `db push` de antes de usarlas. Existen en producción pero no en una base
-- nueva: sin este guardia, el historial no puede levantar una desde cero. Los
-- checklists de arriba sí los crea la migración anterior, así que esos van
-- sueltos y como mucho copian cero filas.
DO $$
BEGIN
  IF to_regclass('public.ticket_checklist_items') IS NOT NULL THEN
    INSERT INTO "checklist_items" ("id", "title", "is_checked", "position", "checklist_id", "created_by_id", "created_at", "updated_at")
    SELECT "id", "title", "is_checked", "position", "checklist_id", "created_by_id", "created_at", "updated_at"
    FROM "ticket_checklist_items";
  END IF;

  IF to_regclass('public.task_checklist_items') IS NOT NULL THEN
    INSERT INTO "checklist_items" ("id", "title", "is_checked", "position", "checklist_id", "created_by_id", "created_at", "updated_at")
    SELECT "id", "title", "is_checked", "position", "checklist_id", "created_by_id", "created_at", "updated_at"
    FROM "task_checklist_items";
  END IF;
END $$;
