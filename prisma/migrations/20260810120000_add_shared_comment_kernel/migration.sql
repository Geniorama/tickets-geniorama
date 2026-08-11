-- Núcleo compartido, paso 1: comentarios polimórficos.
--
-- Crea comments / comment_attachments / comment_reactions y copia el contenido
-- de las seis tablas actuales conservando los ids originales, de modo que los
-- adjuntos y reacciones sigan apuntando a su comentario.
--
-- Las tablas viejas NO se eliminan: quedan intactas hasta verificar la lectura
-- nueva en producción. La migración de borrado va aparte.

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('TICKET', 'TASK', 'PROJECT');

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "entity_type" "EntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "attachment_type" TEXT,
    "attachment_url" TEXT,
    "attachment_name" TEXT,
    "attachment_storage_path" TEXT,
    "author_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_attachments" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT,
    "storage_path" TEXT,
    "comment_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_reactions" (
    "comment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "ReactionType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_reactions_pkey" PRIMARY KEY ("comment_id","user_id")
);

-- CreateIndex
CREATE INDEX "comments_entity_type_entity_id_created_at_idx" ON "comments"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "comments_author_id_idx" ON "comments"("author_id");

-- CreateIndex
CREATE INDEX "comment_attachments_comment_id_idx" ON "comment_attachments"("comment_id");

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_attachments" ADD CONSTRAINT "comment_attachments_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill
-- ─────────────────────────────────────────────────────────────────────────────

-- Comentarios de tickets
INSERT INTO "comments" (
    "id", "entity_type", "entity_id", "body", "is_internal",
    "attachment_type", "attachment_url", "attachment_name", "attachment_storage_path",
    "author_id", "created_at", "updated_at"
)
SELECT
    "id", 'TICKET'::"EntityType", "ticket_id", "body", "is_internal",
    "attachment_type", "attachment_url", "attachment_name", "attachment_storage_path",
    "author_id", "created_at", "updated_at"
FROM "ticket_comments";

-- Comentarios de tareas (no existe is_internal en tareas: siempre false)
INSERT INTO "comments" (
    "id", "entity_type", "entity_id", "body", "is_internal",
    "attachment_type", "attachment_url", "attachment_name", "attachment_storage_path",
    "author_id", "created_at", "updated_at"
)
SELECT
    "id", 'TASK'::"EntityType", "task_id", "body", false,
    "attachment_type", "attachment_url", "attachment_name", "attachment_storage_path",
    "author_id", "created_at", "updated_at"
FROM "task_comments";

-- Adjuntos
INSERT INTO "comment_attachments" ("id", "type", "url", "name", "storage_path", "comment_id", "created_at")
SELECT "id", "type", "url", "name", "storage_path", "comment_id", "created_at"
FROM "ticket_comment_attachments";

INSERT INTO "comment_attachments" ("id", "type", "url", "name", "storage_path", "comment_id", "created_at")
SELECT "id", "type", "url", "name", "storage_path", "comment_id", "created_at"
FROM "task_comment_attachments";

-- Reacciones
INSERT INTO "comment_reactions" ("comment_id", "user_id", "type", "created_at")
SELECT "comment_id", "user_id", "type", "created_at"
FROM "ticket_comment_reactions";

INSERT INTO "comment_reactions" ("comment_id", "user_id", "type", "created_at")
SELECT "comment_id", "user_id", "type", "created_at"
FROM "task_comment_reactions";
