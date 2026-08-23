-- Separa el nombre de un contacto en nombre y apellidos.
--
-- La migración que genera Prisma para este cambio elimina `name` y añade
-- `first_name NOT NULL` de golpe: sobre una tabla con filas falla, y si no
-- fallara se llevaría los nombres por delante. Esta va en cuatro pasos para que
-- no se pierda nada.
--
-- El corte es por el **primer** espacio: lo de antes es el nombre de pila y lo
-- de después son los apellidos. Es lo correcto en español, donde son dos
-- —«Ana Pérez Gómez» da «Ana» + «Pérez Gómez»—; cortar por el último espacio
-- dejaría «Ana Pérez» de nombre.

-- 1. Las columnas nuevas nacen aceptando nulos para poder rellenarlas.
ALTER TABLE "contacts" ADD COLUMN "first_name" TEXT;
ALTER TABLE "contacts" ADD COLUMN "last_name"  TEXT;

-- 2. Se reparte lo que ya había. Antes se normalizan los espacios: un nombre
--    tecleado como «Luis   Carlos  Ruiz» debe quedar «Luis» + «Carlos Ruiz»,
--    no arrastrar los dobles espacios al apellido para siempre.
UPDATE "contacts" SET "name" = btrim(regexp_replace("name", '\s+', ' ', 'g'));

UPDATE "contacts"
SET
  "first_name" = CASE
    WHEN position(' ' IN "name") > 0
      THEN split_part("name", ' ', 1)
    ELSE "name"
  END,
  "last_name" = CASE
    WHEN position(' ' IN "name") > 0
      THEN substr("name", position(' ' IN "name") + 1)
    ELSE NULL
  END;

-- 3. Red de seguridad: un nombre vacío o solo espacios dejaría un nulo, y la
--    columna va a ser obligatoria. Antes que romper la migración, se conserva
--    algo legible.
UPDATE "contacts" SET "first_name" = 'Sin nombre'
WHERE "first_name" IS NULL OR btrim("first_name") = '';

ALTER TABLE "contacts" ALTER COLUMN "first_name" SET NOT NULL;

-- 4. Ya no hace falta el campo viejo.
ALTER TABLE "contacts" DROP COLUMN "name";

-- La agenda se lee y se ordena por apellido, como cualquier agenda.
CREATE INDEX "contacts_last_name_first_name_idx" ON "contacts"("last_name", "first_name");
