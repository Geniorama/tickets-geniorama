-- Las tablas que nunca creó una migración.
--
-- Este proyecto empezó usando `prisma db push`, que sincroniza el esquema
-- contra la base sin dejar rastro de cómo llegó ahí. Cuando más adelante se
-- adoptaron las migraciones, todo lo creado hasta entonces quedó fuera del
-- historial: existía en la base de producción, pero ningún fichero lo creaba.
--
-- El síntoma era que `prisma migrate deploy` no podía levantar una base desde
-- cero —fallaba al tocar una tabla que, según el historial, no existía—. Da
-- igual mientras solo haya una base y nadie la pierda; deja de dar igual el día
-- que haya que montar un entorno de pruebas, reconstruir tras un desastre o
-- correr las migraciones en integración continua.
--
-- Esto lo cierra: recrea aquí las siete tablas y los dos tipos que faltaban. Cada bloque solo
-- actúa **si la tabla no está**, así que en producción no hace absolutamente
-- nada; su único trabajo es en una base nueva.
--
-- Va fechada antes de `20260806120000_add_checklist_groups`, que es la primera
-- que necesitaba alguna de ellas, y después de las que crean `users`,
-- `projects`, `tasks` y `tickets`, a las que apuntan sus claves foráneas.

-- ── Tipos enumerados ─────────────────────────────────────────────────────────
-- Mismo origen que las tablas: nacieron en el `db push` y ninguna migración los
-- declara. `RecurrenceFrequency` lo necesita la tabla de aquí abajo;
-- `ReactionType`, el núcleo de comentarios de 20260810120000.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RecurrenceFrequency') THEN
    CREATE TYPE "RecurrenceFrequency" AS ENUM ('DIARIA', 'SEMANAL', 'MENSUAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReactionType') THEN
    CREATE TYPE "ReactionType" AS ENUM ('LIKE', 'GENIO', 'DISLIKE', 'REVISANDO');
  END IF;
END $$;

-- ── Ajustes de la aplicación ─────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.app_settings') IS NULL THEN
    CREATE TABLE "app_settings" (
        "key"        TEXT NOT NULL,
        "value"      TEXT NOT NULL,
        "updated_at" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
    );
  END IF;
END $$;

-- ── Notificaciones ───────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.notifications') IS NULL THEN
    CREATE TABLE "notifications" (
        "id"         TEXT NOT NULL,
        "type"       TEXT NOT NULL,
        "title"      TEXT NOT NULL,
        "message"    TEXT NOT NULL,
        "link"       TEXT,
        "is_read"    BOOLEAN NOT NULL DEFAULT false,
        "read_at"    TIMESTAMP(3),
        "user_id"    TEXT NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Miembros de un proyecto ──────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.project_members') IS NULL THEN
    CREATE TABLE "project_members" (
        "project_id" TEXT NOT NULL,
        "user_id"    TEXT NOT NULL,
        "added_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "project_members_pkey" PRIMARY KEY ("project_id", "user_id")
    );
    ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey"
      FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Plantillas de tareas recurrentes ─────────────────────────────────────────
-- OJO con `checklist`: aquí es `TEXT[]`, que es lo que era **en este punto de
-- la historia**. La migración siguiente lo convierte a JSONB agrupado. Crearlo
-- ya como JSONB rompería esa conversión, que espera un array de texto.
DO $$
BEGIN
  IF to_regclass('public.recurring_task_templates') IS NULL THEN
    CREATE TABLE "recurring_task_templates" (
        "id"                   TEXT NOT NULL,
        "title"                TEXT NOT NULL,
        "description"          TEXT NOT NULL,
        "priority"             "Priority" NOT NULL DEFAULT 'MEDIA',
        "category"             TEXT,
        "estimated_hours"      DOUBLE PRECISION,
        "checklist"            TEXT[] DEFAULT ARRAY[]::TEXT[],
        "project_id"           TEXT,
        "assigned_to_id"       TEXT,
        "created_by_id"        TEXT NOT NULL,
        "frequency"            "RecurrenceFrequency" NOT NULL,
        "interval"             INTEGER NOT NULL DEFAULT 1,
        "days_of_week"         TEXT,
        "day_of_month"         INTEGER,
        "start_date"           TIMESTAMP(3) NOT NULL,
        "end_date"             TIMESTAMP(3),
        "next_run_at"          TIMESTAMP(3) NOT NULL,
        "last_run_at"          TIMESTAMP(3),
        "is_active"            BOOLEAN NOT NULL DEFAULT true,
        "due_date_offset_days" INTEGER NOT NULL DEFAULT 0,
        "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at"           TIMESTAMP(3) NOT NULL,
        CONSTRAINT "recurring_task_templates_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX "recurring_task_templates_is_active_next_run_at_idx"
      ON "recurring_task_templates"("is_active", "next_run_at");
    ALTER TABLE "recurring_task_templates" ADD CONSTRAINT "recurring_task_templates_project_id_fkey"
      FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    ALTER TABLE "recurring_task_templates" ADD CONSTRAINT "recurring_task_templates_assigned_to_id_fkey"
      FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    ALTER TABLE "recurring_task_templates" ADD CONSTRAINT "recurring_task_templates_created_by_id_fkey"
      FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Webhooks de usuario ──────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.user_webhooks') IS NULL THEN
    CREATE TABLE "user_webhooks" (
        "id"           TEXT NOT NULL,
        "label"        TEXT,
        "url"          TEXT NOT NULL,
        "secret"       TEXT,
        "events"       TEXT[] DEFAULT ARRAY[]::TEXT[],
        "is_active"    BOOLEAN NOT NULL DEFAULT true,
        "last_status"  INTEGER,
        "last_error"   TEXT,
        "last_sent_at" TIMESTAMP(3),
        "user_id"      TEXT NOT NULL,
        "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at"   TIMESTAMP(3) NOT NULL,
        CONSTRAINT "user_webhooks_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX "user_webhooks_user_id_idx" ON "user_webhooks"("user_id");
    ALTER TABLE "user_webhooks" ADD CONSTRAINT "user_webhooks_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Revisores de tareas y tickets ────────────────────────────────────────────
-- Tablas de unión implícitas de Prisma: columnas "A" y "B", sin más.
DO $$
BEGIN
  IF to_regclass('public."_TaskReviewers"') IS NULL THEN
    CREATE TABLE "_TaskReviewers" (
        "A" TEXT NOT NULL,
        "B" TEXT NOT NULL,
        CONSTRAINT "_TaskReviewers_AB_pkey" PRIMARY KEY ("A", "B")
    );
    CREATE INDEX "_TaskReviewers_B_index" ON "_TaskReviewers"("B");
    ALTER TABLE "_TaskReviewers" ADD CONSTRAINT "_TaskReviewers_A_fkey"
      FOREIGN KEY ("A") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "_TaskReviewers" ADD CONSTRAINT "_TaskReviewers_B_fkey"
      FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF to_regclass('public."_TicketReviewers"') IS NULL THEN
    CREATE TABLE "_TicketReviewers" (
        "A" TEXT NOT NULL,
        "B" TEXT NOT NULL,
        CONSTRAINT "_TicketReviewers_AB_pkey" PRIMARY KEY ("A", "B")
    );
    CREATE INDEX "_TicketReviewers_B_index" ON "_TicketReviewers"("B");
    ALTER TABLE "_TicketReviewers" ADD CONSTRAINT "_TicketReviewers_A_fkey"
      FOREIGN KEY ("A") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "_TicketReviewers" ADD CONSTRAINT "_TicketReviewers_B_fkey"
      FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Columnas sueltas del mismo origen ────────────────────────────────────────
-- Lo mismo que arriba pero a nivel de columna: campos que se añadieron con
-- `db push` a tablas que sí crea el historial. `IF NOT EXISTS` las hace
-- invisibles en producción, donde ya están todas.
ALTER TABLE "users"    ADD COLUMN IF NOT EXISTS "area"  TEXT;
ALTER TABLE "users"    ADD COLUMN IF NOT EXISTS "cargo" TEXT;

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "is_private" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "tickets"  ADD COLUMN IF NOT EXISTS "due_date" TIMESTAMP(3);
ALTER TABLE "tickets"  ADD COLUMN IF NOT EXISTS "is_draft" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "tasks"    ADD COLUMN IF NOT EXISTS "start_time" TEXT;
ALTER TABLE "tasks"    ADD COLUMN IF NOT EXISTS "end_time"   TEXT;
ALTER TABLE "tasks"    ADD COLUMN IF NOT EXISTS "is_draft"   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tasks"    ADD COLUMN IF NOT EXISTS "number"     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "tasks"    ADD COLUMN IF NOT EXISTS "recurring_template_id" TEXT;

-- Una tarea puede no colgar de ningún proyecto.
ALTER TABLE "tasks" ALTER COLUMN "project_id" DROP NOT NULL;

-- La clave foránea no admite IF NOT EXISTS: se comprueba a mano.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_recurring_template_id_fkey') THEN
    ALTER TABLE "tasks" ADD CONSTRAINT "tasks_recurring_template_id_fkey"
      FOREIGN KEY ("recurring_template_id") REFERENCES "recurring_task_templates"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Un valor de enumerado ────────────────────────────────────────────────────
-- `POR_ASIGNAR` es el primero de `TicketStatus` en producción, así que se
-- inserta antes de `ABIERTO` y no al final: el orden de un enumerado se ve en
-- cualquier consulta que ordene por estado.
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'POR_ASIGNAR' BEFORE 'ABIERTO';
