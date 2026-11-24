-- Libro de costos para el tablero gerencial. Aditiva: tipo y tabla nuevos.

CREATE TYPE "ExpenseKind" AS ENUM ('PERSONAL', 'PROVEEDOR', 'OPERACION');

CREATE TABLE "expenses" (
  "id" TEXT NOT NULL,
  "concept" TEXT NOT NULL,
  "kind" "ExpenseKind" NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "incurred_on" TIMESTAMP(3) NOT NULL,
  "supplier" TEXT,
  "notes" TEXT,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "expenses_incurred_on_idx" ON "expenses"("incurred_on");
CREATE INDEX "expenses_kind_idx" ON "expenses"("kind");

ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
