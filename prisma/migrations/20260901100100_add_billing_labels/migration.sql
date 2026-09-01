-- Etiquetas de facturación, como las del tablero anterior.


-- CreateTable
CREATE TABLE "billing_labels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_BillingItemLabels" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BillingItemLabels_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_labels_name_key" ON "billing_labels"("name");

-- CreateIndex
CREATE INDEX "_BillingItemLabels_B_index" ON "_BillingItemLabels"("B");

-- AddForeignKey
ALTER TABLE "_BillingItemLabels" ADD CONSTRAINT "_BillingItemLabels_A_fkey" FOREIGN KEY ("A") REFERENCES "billing_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BillingItemLabels" ADD CONSTRAINT "_BillingItemLabels_B_fkey" FOREIGN KEY ("B") REFERENCES "billing_labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Se siembran las dos que ya se usaban, para no empezar con el selector vacío.
-- El resto se crean desde la interfaz: por eso son filas y no un enum.
INSERT INTO "billing_labels" ("id", "name", "color", "position", "created_at") VALUES
  (gen_random_uuid()::text, 'Por revisar', '#f59e0b', 0, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Por cobrar',  '#3b82f6', 1, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
