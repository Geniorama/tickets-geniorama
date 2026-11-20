-- Cuentas de cobro junto a las facturas. Aditiva: tipo nuevo, columnas con
-- valor por defecto (todo lo existente queda como FACTURA) y un vínculo
-- opcional a la oportunidad que originó la venta.

CREATE TYPE "BillingDocType" AS ENUM ('FACTURA', 'CUENTA_COBRO');

ALTER TABLE "billing_items"
  ADD COLUMN "doc_type" "BillingDocType" NOT NULL DEFAULT 'FACTURA',
  ADD COLUMN "received_by" TEXT,
  ADD COLUMN "deal_id" TEXT;

ALTER TABLE "billing_items"
  ADD CONSTRAINT "billing_items_deal_id_fkey"
  FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "billing_items_doc_type_idx" ON "billing_items"("doc_type");
CREATE INDEX "billing_items_deal_id_idx" ON "billing_items"("deal_id");
