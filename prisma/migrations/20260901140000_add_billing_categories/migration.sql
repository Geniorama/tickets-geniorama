-- Cómo cataloga contabilidad lo que se vende.
--
-- La categoría va en la línea del cobro y no en el cobro: una misma factura
-- mezcla el hosting del año con un rediseño, y separar eso es justo lo que
-- contabilidad necesita.

CREATE TABLE "billing_categories" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "color"     TEXT NOT NULL DEFAULT '#64748b',
    "position"  INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "billing_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "billing_categories_name_key" ON "billing_categories"("name");

-- Nula y con SET NULL: los cobros que ya existen no tienen categoría, y
-- retirar una categoría del catálogo no debe borrar la línea de un cobro.
ALTER TABLE "billing_lines" ADD COLUMN "category_id" TEXT;
CREATE INDEX "billing_lines_category_id_idx" ON "billing_lines"("category_id");

ALTER TABLE "billing_lines"
  ADD CONSTRAINT "billing_lines_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "billing_categories"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Las tres que ya se venden. Se pueden renombrar y añadir más sin desplegar.
INSERT INTO "billing_categories" ("id", "name", "color", "position") VALUES
  ('seed_cat_hosting',    'Hosting',         '#3b82f6', 0),
  ('seed_cat_desarrollo', 'Desarrollo web',  '#8b5cf6', 1),
  ('seed_cat_marketing',  'Marketing',       '#f59e0b', 2)
ON CONFLICT ("name") DO NOTHING;
