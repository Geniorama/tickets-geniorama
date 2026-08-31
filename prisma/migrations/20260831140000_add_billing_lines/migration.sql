-- Un cobro pasa a tener líneas: varios conceptos, cada uno exento o con IVA.
--
-- `amount` cambia de significado: antes era «lo que se factura» y ahora es el
-- **total** (bases más IVA). Para los cobros que ya existan eso coincide, así
-- que basta con darles su línea y dejar el impuesto en cero: nadie había
-- declarado IVA todavía, y suponerlo cambiaría cifras que alguien ya miró.

-- AlterTable
ALTER TABLE "billing_items" ADD COLUMN     "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "tax_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "billing_lines" (
    "id" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "tax_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "billing_item_id" TEXT NOT NULL,

    CONSTRAINT "billing_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "billing_lines_billing_item_id_position_idx" ON "billing_lines"("billing_item_id", "position");

-- AddForeignKey
ALTER TABLE "billing_lines" ADD CONSTRAINT "billing_lines_billing_item_id_fkey" FOREIGN KEY ("billing_item_id") REFERENCES "billing_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Relleno: cada cobro que ya existía se convierte en una línea con su importe.
INSERT INTO "billing_lines" ("id", "concept", "amount", "tax_rate", "position", "billing_item_id")
SELECT
  -- Un id estable y sin dependencias: gen_random_uuid() viene con pgcrypto en
  -- PostgreSQL 13+, y aquí corre 17.
  gen_random_uuid()::text,
  "concept",
  "amount",
  0,
  0,
  "id"
FROM "billing_items";

-- Y el desglose del encabezado cuadra con esa única línea.
UPDATE "billing_items" SET "subtotal" = "amount", "tax_amount" = 0;
