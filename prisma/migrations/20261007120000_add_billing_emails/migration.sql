-- Plantillas de correo de Facturación y los correos que salen con ellas.
--
-- Distinto de los recordatorios: aquellos los dispara una regla según el
-- vencimiento; estos los manda una persona, en el momento o a una hora.

-- ── 1. Plantillas ────────────────────────────────────────────────────────────
CREATE TABLE "billing_email_templates" (
    "id"              TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "subject"         TEXT NOT NULL,
    "body"            TEXT NOT NULL,
    "only_if_pending" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id"   TEXT NOT NULL,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "billing_email_templates_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "billing_email_templates"
  ADD CONSTRAINT "billing_email_templates_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 2. Correos: los programados y el registro de lo enviado ──────────────────
CREATE TYPE "BillingEmailStatus" AS ENUM ('PROGRAMADO', 'ENVIANDO', 'ENVIADO', 'FALLIDO', 'CANCELADO', 'OMITIDO');

CREATE TABLE "billing_emails" (
    "id"              TEXT NOT NULL,
    "template_id"     TEXT,
    "template_name"   TEXT,
    "billing_item_id" TEXT NOT NULL,
    "subject"         TEXT NOT NULL,
    "body"            TEXT NOT NULL,
    "recipients"      TEXT[],
    "only_if_pending" BOOLEAN NOT NULL DEFAULT false,
    "status"          "BillingEmailStatus" NOT NULL,
    "scheduled_for"   TIMESTAMP(3),
    "sent_at"         TIMESTAMP(3),
    "error"           TEXT,
    "created_by_id"   TEXT NOT NULL,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "billing_emails_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "billing_emails_status_scheduled_for_idx" ON "billing_emails"("status", "scheduled_for");
CREATE INDEX "billing_emails_billing_item_id_created_at_idx" ON "billing_emails"("billing_item_id", "created_at");

ALTER TABLE "billing_emails"
  ADD CONSTRAINT "billing_emails_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "billing_email_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "billing_emails"
  ADD CONSTRAINT "billing_emails_billing_item_id_fkey"
  FOREIGN KEY ("billing_item_id") REFERENCES "billing_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "billing_emails"
  ADD CONSTRAINT "billing_emails_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 3. Dos plantillas de partida ─────────────────────────────────────────────
-- Las dos que se pidieron al encargar esto. No mandan nada por existir: una
-- plantilla solo sale cuando alguien la elige en un cobro. Se saltan si no hay
-- ningún administrador todavía.
INSERT INTO "billing_email_templates"
  ("id", "name", "subject", "body", "only_if_pending", "created_by_id", "updated_at")
SELECT p."id", p."name", p."subject", p."body", p."only_if_pending", u."id", CURRENT_TIMESTAMP
FROM (
  VALUES
    (
      'seed_correo_pago_recibido',
      'Pago recibido',
      'Recibimos tu pago — {{concepto}}',
      E'Hola {{contacto}},\n\nTe confirmamos que recibimos tu pago de {{ultimo_abono}} el {{fecha_abono}}, correspondiente a {{concepto}} (factura {{factura}}).\n\nSaldo pendiente: {{pendiente}}.\n\nGracias por tu pago,\nGeniorama',
      false
    ),
    (
      'seed_correo_cobranza',
      'Cobranza',
      'Factura {{factura}} pendiente de pago — {{empresa}}',
      E'Hola {{contacto}},\n\nTe escribimos porque la factura {{factura}}, correspondiente a {{concepto}}, tiene un saldo pendiente de {{pendiente}} y venció el {{vencimiento}}.\n\nSi ya realizaste el pago, por favor responde a este correo con el soporte. Si necesitas acordar una fecha, cuéntanos y lo revisamos.\n\nGracias,\nGeniorama',
      true
    )
) AS p("id", "name", "subject", "body", "only_if_pending")
CROSS JOIN (
  SELECT "id" FROM "users" WHERE "role" = 'ADMINISTRADOR' ORDER BY "created_at" ASC LIMIT 1
) u;
