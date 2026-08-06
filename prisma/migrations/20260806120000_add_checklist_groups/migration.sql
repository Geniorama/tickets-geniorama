-- Varios checklists con título por ticket/tarea.
--
-- Los ítems pasan a colgar de un checklist en vez de del ticket/tarea. Los
-- ítems que ya existen se agrupan en un checklist llamado "Checklist" por
-- ticket/tarea, conservando su orden. El campo `checklist` de las plantillas
-- pasa de text[] a jsonb con la forma [{ "title": ..., "items": [...] }].
--
-- ATENCIÓN: este cambio NO se puede aplicar con `prisma db push`; eso borraría
-- los ítems existentes al reemplazar la columna. Ejecutar este archivo contra
-- la base y después `npx prisma db push` para verificar que no queda deriva.

-- CreateTable
CREATE TABLE "ticket_checklists" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "ticket_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_checklists" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "task_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_checklists_ticket_id_idx" ON "ticket_checklists"("ticket_id");

-- CreateIndex
CREATE INDEX "task_checklists_task_id_idx" ON "task_checklists"("task_id");

-- AddForeignKey
ALTER TABLE "ticket_checklists" ADD CONSTRAINT "ticket_checklists_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_checklists" ADD CONSTRAINT "ticket_checklists_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_checklists" ADD CONSTRAINT "task_checklists_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_checklists" ADD CONSTRAINT "task_checklists_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: un checklist "Checklist" por cada ticket/tarea que ya tenga ítems.
-- El autor y la fecha se heredan del ítem más antiguo del grupo.
INSERT INTO "ticket_checklists" ("id", "title", "position", "ticket_id", "created_by_id", "created_at", "updated_at")
SELECT gen_random_uuid()::text, 'Checklist', 0, i."ticket_id",
       (ARRAY_AGG(i."created_by_id" ORDER BY i."created_at"))[1],
       MIN(i."created_at"), CURRENT_TIMESTAMP
FROM "ticket_checklist_items" i
GROUP BY i."ticket_id";

INSERT INTO "task_checklists" ("id", "title", "position", "task_id", "created_by_id", "created_at", "updated_at")
SELECT gen_random_uuid()::text, 'Checklist', 0, i."task_id",
       (ARRAY_AGG(i."created_by_id" ORDER BY i."created_at"))[1],
       MIN(i."created_at"), CURRENT_TIMESTAMP
FROM "task_checklist_items" i
GROUP BY i."task_id";

-- AlterTable: los ítems pasan a colgar del checklist
ALTER TABLE "ticket_checklist_items" ADD COLUMN "checklist_id" TEXT;
UPDATE "ticket_checklist_items" i
SET "checklist_id" = c."id"
FROM "ticket_checklists" c
WHERE c."ticket_id" = i."ticket_id";
ALTER TABLE "ticket_checklist_items" ALTER COLUMN "checklist_id" SET NOT NULL;
ALTER TABLE "ticket_checklist_items" DROP CONSTRAINT IF EXISTS "ticket_checklist_items_ticket_id_fkey";
ALTER TABLE "ticket_checklist_items" DROP COLUMN "ticket_id";

ALTER TABLE "task_checklist_items" ADD COLUMN "checklist_id" TEXT;
UPDATE "task_checklist_items" i
SET "checklist_id" = c."id"
FROM "task_checklists" c
WHERE c."task_id" = i."task_id";
ALTER TABLE "task_checklist_items" ALTER COLUMN "checklist_id" SET NOT NULL;
ALTER TABLE "task_checklist_items" DROP CONSTRAINT IF EXISTS "task_checklist_items_task_id_fkey";
ALTER TABLE "task_checklist_items" DROP COLUMN "task_id";

-- CreateIndex
CREATE INDEX "ticket_checklist_items_checklist_id_idx" ON "ticket_checklist_items"("checklist_id");

-- CreateIndex
CREATE INDEX "task_checklist_items_checklist_id_idx" ON "task_checklist_items"("checklist_id");

-- AddForeignKey
ALTER TABLE "ticket_checklist_items" ADD CONSTRAINT "ticket_checklist_items_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "ticket_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "task_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: el checklist de las plantillas pasa de text[] a jsonb agrupado
ALTER TABLE "task_templates" ADD COLUMN "checklist_groups" JSONB NOT NULL DEFAULT '[]';
UPDATE "task_templates"
SET "checklist_groups" = CASE
  WHEN COALESCE(array_length("checklist", 1), 0) > 0
    THEN jsonb_build_array(jsonb_build_object('title', 'Checklist', 'items', to_jsonb("checklist")))
  ELSE '[]'::jsonb
END;
ALTER TABLE "task_templates" DROP COLUMN "checklist";
ALTER TABLE "task_templates" RENAME COLUMN "checklist_groups" TO "checklist";

ALTER TABLE "ticket_templates" ADD COLUMN "checklist_groups" JSONB NOT NULL DEFAULT '[]';
UPDATE "ticket_templates"
SET "checklist_groups" = CASE
  WHEN COALESCE(array_length("checklist", 1), 0) > 0
    THEN jsonb_build_array(jsonb_build_object('title', 'Checklist', 'items', to_jsonb("checklist")))
  ELSE '[]'::jsonb
END;
ALTER TABLE "ticket_templates" DROP COLUMN "checklist";
ALTER TABLE "ticket_templates" RENAME COLUMN "checklist_groups" TO "checklist";

ALTER TABLE "recurring_task_templates" ADD COLUMN "checklist_groups" JSONB NOT NULL DEFAULT '[]';
UPDATE "recurring_task_templates"
SET "checklist_groups" = CASE
  WHEN COALESCE(array_length("checklist", 1), 0) > 0
    THEN jsonb_build_array(jsonb_build_object('title', 'Checklist', 'items', to_jsonb("checklist")))
  ELSE '[]'::jsonb
END;
ALTER TABLE "recurring_task_templates" DROP COLUMN "checklist";
ALTER TABLE "recurring_task_templates" RENAME COLUMN "checklist_groups" TO "checklist";
