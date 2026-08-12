-- Enrutamiento de briefs entrantes desde n8n.
--
-- Aditivo: crea la tabla de mapeo `brief_routings` y añade a `tasks` la
-- referencia externa que hace idempotente el webhook. Ninguna columna existente
-- se toca, así que no hay datos que migrar.

-- Referencia al sistema externo que originó la tarea (id de ejecución de n8n).
-- Nullable: todas las tareas ya existentes se quedan en NULL, y Postgres admite
-- múltiples NULL bajo un índice UNIQUE.
ALTER TABLE "tasks" ADD COLUMN "external_ref" TEXT;

CREATE UNIQUE INDEX "tasks_external_ref_key" ON "tasks"("external_ref");

CREATE TABLE "brief_routings" (
    "id" TEXT NOT NULL,
    "brief_type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "assigned_to_id" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIA',
    "category" TEXT,
    "estimated_hours" DOUBLE PRECISION,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brief_routings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "brief_routings_brief_type_key" ON "brief_routings"("brief_type");

ALTER TABLE "brief_routings"
    ADD CONSTRAINT "brief_routings_assigned_to_id_fkey"
    FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
