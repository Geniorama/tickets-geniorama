-- Núcleo compartido, paso 2: adjuntos polimórficos.
--
-- Unifica ticket_attachments, task_attachments y project_attachments en una
-- sola tabla `attachments`, conservando los ids originales.
--
-- Normaliza tres convenciones distintas para "esto es un enlace, no un archivo":
--   · tickets   → nunca tuvieron enlaces; todo pasa a type='file'
--   · tareas    → marcaban el enlace con el centinela storage_path='link';
--                 pasa a type='link' con storage_path NULL
--   · proyectos → ya tenían columna type; se copia tal cual
--
-- `position` solo existía en proyectos. Para tickets y tareas se genera a
-- partir del orden actual de visualización (created_at ascendente), que es el
-- que usan las pantallas hoy, así que el orden no cambia a la vista.
--
-- Las tablas viejas NO se eliminan: quedan intactas hasta verificar en
-- producción. El DROP va en una migración posterior.

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "entity_type" "EntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'file',
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "storage_path" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attachments_entity_type_entity_id_position_created_at_idx" ON "attachments"("entity_type", "entity_id", "position", "created_at");

-- CreateIndex
CREATE INDEX "attachments_uploaded_by_id_idx" ON "attachments"("uploaded_by_id");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill
-- ─────────────────────────────────────────────────────────────────────────────

-- Adjuntos de ticket: siempre archivos.
INSERT INTO "attachments" (
    "id", "entity_type", "entity_id", "type", "file_url", "file_name",
    "storage_path", "position", "uploaded_by_id", "created_at"
)
SELECT
    a."id", 'TICKET'::"EntityType", a."ticket_id", 'file', a."file_url", a."file_name",
    a."storage_path",
    (ROW_NUMBER() OVER (PARTITION BY a."ticket_id" ORDER BY a."created_at", a."id") - 1)::int,
    a."uploaded_by_id", a."created_at"
FROM "ticket_attachments" a;

-- Adjuntos de tarea: el centinela storage_path='link' se traduce a type='link'.
INSERT INTO "attachments" (
    "id", "entity_type", "entity_id", "type", "file_url", "file_name",
    "storage_path", "position", "uploaded_by_id", "created_at"
)
SELECT
    a."id", 'TASK'::"EntityType", a."task_id",
    CASE WHEN a."storage_path" = 'link' THEN 'link' ELSE 'file' END,
    a."file_url", a."file_name",
    NULLIF(a."storage_path", 'link'),
    (ROW_NUMBER() OVER (PARTITION BY a."task_id" ORDER BY a."created_at", a."id") - 1)::int,
    a."uploaded_by_id", a."created_at"
FROM "task_attachments" a;

-- Adjuntos de proyecto: ya traían type y position.
INSERT INTO "attachments" (
    "id", "entity_type", "entity_id", "type", "file_url", "file_name",
    "storage_path", "position", "uploaded_by_id", "created_at"
)
SELECT
    a."id", 'PROJECT'::"EntityType", a."project_id", a."type", a."file_url", a."file_name",
    a."storage_path", a."position", a."uploaded_by_id", a."created_at"
FROM "project_attachments" a;
