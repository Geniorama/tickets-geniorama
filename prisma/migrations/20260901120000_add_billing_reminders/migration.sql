-- Recordatorios de cobro automáticos.
--
-- Tres cosas: separar el vencimiento de la factura de la fecha de facturar,
-- las reglas que escribe el administrador, y el registro de lo enviado.

-- ── 1. El vencimiento, en su propio campo ────────────────────────────────────
ALTER TABLE "billing_items" ADD COLUMN "invoice_due_date" TIMESTAMP(3);
ALTER TABLE "billing_items" ADD COLUMN "reminders_off" BOOLEAN NOT NULL DEFAULT false;

-- Hasta ahora `due_date` significaba «cuándo facturar» y, para lo ya emitido,
-- «cuándo vence». Se traspasa solo en ese segundo caso, que es donde la fecha
-- ya era un vencimiento; en lo no emitido sigue queriendo decir lo que decía.
UPDATE "billing_items"
   SET "invoice_due_date" = "due_date"
 WHERE "due_date" IS NOT NULL
   AND "status" IN ('FACTURADO', 'ABONADO', 'PAGADO');

CREATE INDEX "billing_items_invoice_due_date_idx" ON "billing_items"("invoice_due_date");

-- ── 2. Reglas ────────────────────────────────────────────────────────────────
CREATE TYPE "ReminderChannel" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP');
CREATE TYPE "ReminderStatus"  AS ENUM ('SENT', 'FAILED', 'SKIPPED');

CREATE TABLE "billing_reminder_rules" (
    "id"           TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "offset_days"  INTEGER NOT NULL,
    "channels"     "ReminderChannel"[],
    "subject"      TEXT NOT NULL,
    "body"         TEXT NOT NULL,
    "is_active"    BOOLEAN NOT NULL DEFAULT true,
    "active_since" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT NOT NULL,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "billing_reminder_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "billing_reminder_rules_is_active_idx" ON "billing_reminder_rules"("is_active");

ALTER TABLE "billing_reminder_rules"
  ADD CONSTRAINT "billing_reminder_rules_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 3. Registro de envíos ────────────────────────────────────────────────────
CREATE TABLE "billing_reminders" (
    "id"              TEXT NOT NULL,
    "rule_id"         TEXT,
    "billing_item_id" TEXT NOT NULL,
    "channel"         "ReminderChannel" NOT NULL,
    "status"          "ReminderStatus" NOT NULL,
    "recipient"       TEXT NOT NULL,
    "recipient_name"  TEXT,
    "body"            TEXT NOT NULL,
    "error"           TEXT,
    "sent_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "billing_reminders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "billing_reminders_billing_item_id_sent_at_idx"
  ON "billing_reminders"("billing_item_id", "sent_at");

ALTER TABLE "billing_reminders"
  ADD CONSTRAINT "billing_reminders_rule_id_fkey"
  FOREIGN KEY ("rule_id") REFERENCES "billing_reminder_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "billing_reminders"
  ADD CONSTRAINT "billing_reminders_billing_item_id_fkey"
  FOREIGN KEY ("billing_item_id") REFERENCES "billing_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- El seguro contra reenvíos, y la razón de que este fichero sea a mano.
--
-- Único **solo sobre los entregados**: una regla no puede volver a escribirle
-- al mismo cliente por el mismo canal sobre el mismo cobro, pase lo que pase
-- con el reloj o con un doble disparo del cron. Un envío fallido no ocupa el
-- sitio, así que mañana se reintenta solo.
CREATE UNIQUE INDEX "billing_reminders_una_vez_por_regla"
  ON "billing_reminders"("rule_id", "billing_item_id", "channel")
  WHERE "status" = 'SENT';

-- ── 4. Una regla de ejemplo, apagada ─────────────────────────────────────────
-- Apagada a propósito: enciende quien decida que hay que perseguir el dinero,
-- y no un despliegue. Sirve para ver la forma del mensaje antes de escribir el
-- propio. Se salta si no hay ningún administrador todavía.
INSERT INTO "billing_reminder_rules"
  ("id", "name", "offset_days", "channels", "subject", "body", "is_active", "created_by_id", "updated_at")
SELECT
  'seed_recordatorio_ejemplo',
  'Aviso a los 3 días del vencimiento',
  3,
  ARRAY['EMAIL']::"ReminderChannel"[],
  'Factura {{factura}} pendiente — {{empresa}}',
  E'Hola {{contacto}},\n\nTe escribimos para recordarte que la factura {{factura}} por {{pendiente}}, correspondiente a {{concepto}}, venció el {{vencimiento}}.\n\nSi ya la pagaste, ignora este mensaje y disculpa la insistencia. Si necesitas el soporte o quieres acordar una fecha, responde a este correo.\n\nGracias,\nGeniorama',
  false,
  u."id",
  CURRENT_TIMESTAMP
FROM "users" u
WHERE u."role" = 'ADMINISTRADOR'
ORDER BY u."created_at" ASC
LIMIT 1;
