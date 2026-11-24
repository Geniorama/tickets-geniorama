-- Nómina vinculada a costos. Aditiva: tabla nueva; cada registro apunta al
-- costo (expenses) que mantiene.

CREATE TABLE "payroll_entries" (
  "id" TEXT NOT NULL,
  "person_name" TEXT NOT NULL,
  "period" TIMESTAMP(3) NOT NULL,
  "base_salary" DOUBLE PRECISION NOT NULL,
  "extras" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "contributions" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "total" DOUBLE PRECISION NOT NULL,
  "notes" TEXT,
  "expense_id" TEXT,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payroll_entries_expense_id_key" ON "payroll_entries"("expense_id");
CREATE INDEX "payroll_entries_period_idx" ON "payroll_entries"("period");

ALTER TABLE "payroll_entries"
  ADD CONSTRAINT "payroll_entries_expense_id_fkey"
  FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll_entries"
  ADD CONSTRAINT "payroll_entries_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
