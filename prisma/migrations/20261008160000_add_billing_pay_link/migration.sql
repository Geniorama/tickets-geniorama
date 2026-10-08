-- Link de pago en línea (Payments Way) para los cobros.

-- ── 1. La llave del link ─────────────────────────────────────────────────────
ALTER TABLE "billing_items" ADD COLUMN "pay_token" TEXT;
CREATE UNIQUE INDEX "billing_items_pay_token_key" ON "billing_items"("pay_token");

-- ── 2. Los intentos de pago ──────────────────────────────────────────────────
CREATE TABLE "billing_gateway_orders" (
    "id"              TEXT NOT NULL,
    "amount"          DOUBLE PRECISION NOT NULL,
    "status"          TEXT NOT NULL DEFAULT 'created',
    "payment_ref"     TEXT,
    "payment_id"      TEXT,
    "payer_email"     TEXT,
    "billing_item_id" TEXT NOT NULL,
    "created_by_id"   TEXT NOT NULL,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "billing_gateway_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "billing_gateway_orders_payment_id_key" ON "billing_gateway_orders"("payment_id");
CREATE INDEX "billing_gateway_orders_billing_item_id_created_at_idx" ON "billing_gateway_orders"("billing_item_id", "created_at");

ALTER TABLE "billing_gateway_orders"
  ADD CONSTRAINT "billing_gateway_orders_billing_item_id_fkey"
  FOREIGN KEY ("billing_item_id") REFERENCES "billing_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "billing_gateway_orders"
  ADD CONSTRAINT "billing_gateway_orders_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 3. Plantilla de correo para mandarlo ─────────────────────────────────────
-- Misma forma que las dos de partida: a nombre del primer administrador, y sin
-- pisar nada si alguien ya creó una con ese nombre.
INSERT INTO "billing_email_templates"
  ("id", "name", "subject", "body", "only_if_pending", "created_by_id", "updated_at")
SELECT 'seed_correo_link_pago',
       'Link de pago',
       'Paga en línea tu factura {{factura}} — {{concepto}}',
       E'Hola {{contacto}},\n\nPuedes pagar en línea el saldo de {{pendiente}} correspondiente a {{concepto}} (factura {{factura}}) desde este enlace:\n\n{{link_pago}}\n\nEl pago es seguro y queda registrado automáticamente. Si ya lo realizaste, por favor ignora este mensaje.\n\nGracias,\nGeniorama',
       true,
       u."id",
       CURRENT_TIMESTAMP
FROM (
  SELECT "id" FROM "users" WHERE "role" = 'ADMINISTRADOR' ORDER BY "created_at" ASC LIMIT 1
) u
WHERE NOT EXISTS (SELECT 1 FROM "billing_email_templates" WHERE "name" = 'Link de pago');
