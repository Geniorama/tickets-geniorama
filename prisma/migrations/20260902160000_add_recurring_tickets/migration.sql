-- Tickets recurrentes.
--
-- Espejo de `recurring_task_templates`, con los campos propios de un ticket:
-- cliente, plan y sitio en vez de proyecto. Aditiva: una tabla nueva y una
-- columna nullable en `tickets`. No toca ni una fila existente.

CREATE TABLE IF NOT EXISTS "recurring_ticket_templates" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIA',
    "category" TEXT,
    "checklist" JSONB NOT NULL DEFAULT '[]',

    "client_id" TEXT,
    "plan_id" TEXT,
    "site_id" TEXT,
    "assigned_to_id" TEXT,
    "reviewer_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],

    "created_by_id" TEXT NOT NULL,

    "frequency" "RecurrenceFrequency" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "days_of_week" TEXT,
    "day_of_month" INTEGER,

    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3) NOT NULL,
    "last_run_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    "due_date_offset_days" INTEGER NOT NULL DEFAULT 0,

    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_ticket_templates_pkey" PRIMARY KEY ("id")
);

-- El barrido diario busca exactamente por aquí: las activas que ya vencieron.
CREATE INDEX IF NOT EXISTS "recurring_ticket_templates_is_active_next_run_at_idx"
  ON "recurring_ticket_templates"("is_active", "next_run_at");

-- De qué recurrencia salió cada ticket.
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "recurring_template_id" TEXT;

CREATE INDEX IF NOT EXISTS "tickets_recurring_template_id_idx"
  ON "tickets"("recurring_template_id");

-- Todas las relaciones de la plantilla son SetNull: que se dé de baja a un
-- colaborador o se archive un sitio no puede borrar la programación de un
-- mantenimiento. La plantilla se queda sin ese dato y se ve en su pantalla.
ALTER TABLE "recurring_ticket_templates"
  ADD CONSTRAINT "recurring_ticket_templates_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recurring_ticket_templates"
  ADD CONSTRAINT "recurring_ticket_templates_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recurring_ticket_templates"
  ADD CONSTRAINT "recurring_ticket_templates_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recurring_ticket_templates"
  ADD CONSTRAINT "recurring_ticket_templates_assigned_to_id_fkey"
  FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recurring_ticket_templates"
  ADD CONSTRAINT "recurring_ticket_templates_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Borrar la programación no se lleva los tickets que ya se atendieron.
ALTER TABLE "tickets"
  ADD CONSTRAINT "tickets_recurring_template_id_fkey"
  FOREIGN KEY ("recurring_template_id") REFERENCES "recurring_ticket_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
