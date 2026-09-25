-- Proyectos: de cinco estados a Activo / Inactivo / Borrador.
--
-- El estado (Planificación, En desarrollo, En revisión, Completado, Pausado)
-- deja de existir. Lo que significaba se conserva en is_active antes de borrar
-- la columna: lo terminado o detenido pasa a inactivo; lo demás sigue activo.
-- Escrita a mano porque mueve datos: `db push` borraría la columna sin
-- trasladar nada.
UPDATE "projects" SET "is_active" = false WHERE "status" IN ('COMPLETADO', 'PAUSADO');

-- Borrador: solo lo ve su creador hasta que lo publica. Los existentes ya
-- están publicados.
ALTER TABLE "projects" ADD COLUMN "is_draft" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "projects" DROP COLUMN "status";
DROP TYPE "ProjectStatus";
