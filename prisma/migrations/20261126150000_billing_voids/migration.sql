-- Anulación de facturas y cuentas de cobro, y su cementerio. Aditiva: ningún
-- cobro existente cambia de estado.

ALTER TYPE "BillingStatus" ADD VALUE IF NOT EXISTS 'ANULADO';

CREATE TABLE "billing_voids" (
    "id" TEXT NOT NULL,
    "billing_item_id" TEXT,
    "doc_type" "BillingDocType" NOT NULL,
    "invoice_number" TEXT,
    "concept" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "invoiced_at" TIMESTAMP(3),
    "invoice_due_date" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "reissue" BOOLEAN NOT NULL,
    "voided_by_id" TEXT NOT NULL,
    "voided_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_voids_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "billing_voids_created_at_idx" ON "billing_voids"("created_at");

CREATE INDEX "billing_voids_billing_item_id_idx" ON "billing_voids"("billing_item_id");

ALTER TABLE "billing_voids" ADD CONSTRAINT "billing_voids_billing_item_id_fkey" FOREIGN KEY ("billing_item_id") REFERENCES "billing_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
