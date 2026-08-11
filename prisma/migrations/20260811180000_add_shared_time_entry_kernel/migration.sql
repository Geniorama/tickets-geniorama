-- Núcleo compartido, paso 4: registros de tiempo polimórficos.
--
-- A diferencia de los pasos anteriores, aquí el nombre de la tabla destino ya
-- estaba ocupado: el modelo viejo de tickets se llamaba `time_entries`. Se
-- renombra a `ticket_time_entries` — simétrico con su hermana
-- `task_time_entries` — y el nombre limpio queda para la tabla compartida.
--
-- El renombrado incluye el índice de la clave primaria: los nombres de índice
-- son únicos por esquema en PostgreSQL, así que sin renombrarlo la creación de
-- la tabla nueva chocaría contra `time_entries_pkey`.
--
-- Las tablas viejas NO se eliminan: quedan intactas hasta verificar en
-- producción.

-- Liberar el nombre `time_entries`
ALTER TABLE "time_entries" RENAME TO "ticket_time_entries";
ALTER INDEX "time_entries_pkey" RENAME TO "ticket_time_entries_pkey";
ALTER TABLE "ticket_time_entries" RENAME CONSTRAINT "time_entries_ticket_id_fkey" TO "ticket_time_entries_ticket_id_fkey";
ALTER TABLE "ticket_time_entries" RENAME CONSTRAINT "time_entries_user_id_fkey" TO "ticket_time_entries_user_id_fkey";

-- CreateTable
CREATE TABLE "time_entries" (
    "id" TEXT NOT NULL,
    "entity_type" "EntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "stopped_at" TIMESTAMP(3),
    "user_id" TEXT NOT NULL,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "time_entries_entity_type_entity_id_started_at_idx" ON "time_entries"("entity_type", "entity_id", "started_at");

-- CreateIndex
CREATE INDEX "time_entries_user_id_stopped_at_idx" ON "time_entries"("user_id", "stopped_at");

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "time_entries" ("id", "entity_type", "entity_id", "started_at", "stopped_at", "user_id")
SELECT "id", 'TICKET'::"EntityType", "ticket_id", "started_at", "stopped_at", "user_id"
FROM "ticket_time_entries";

INSERT INTO "time_entries" ("id", "entity_type", "entity_id", "started_at", "stopped_at", "user_id")
SELECT "id", 'TASK'::"EntityType", "task_id", "started_at", "stopped_at", "user_id"
FROM "task_time_entries";
