-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('BACKLOG', 'POR_FACTURAR', 'FACTURADO', 'ABONADO', 'PAGADO');


-- CreateTable
CREATE TABLE "billing_items" (
    "id" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "status" "BillingStatus" NOT NULL DEFAULT 'BACKLOG',
    "amount" DOUBLE PRECISION NOT NULL,
    "paid_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "company_id" TEXT NOT NULL,
    "due_date" TIMESTAMP(3),
    "invoice_number" TEXT,
    "invoiced_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "notes" TEXT,
    "owner_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "billing_items_status_idx" ON "billing_items"("status");

-- CreateIndex
CREATE INDEX "billing_items_company_id_idx" ON "billing_items"("company_id");

-- CreateIndex
CREATE INDEX "billing_items_due_date_idx" ON "billing_items"("due_date");

-- AddForeignKey
ALTER TABLE "billing_items" ADD CONSTRAINT "billing_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_items" ADD CONSTRAINT "billing_items_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_items" ADD CONSTRAINT "billing_items_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

