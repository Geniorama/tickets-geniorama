-- El correo de un contacto pasa a ser obligatorio y el teléfono a E.164.
--
-- Dos cambios con riesgos distintos:
--
--   · El teléfono **se puede arreglar solo**: lo que hay se normaliza y punto.
--   · El correo **no**. Poner NOT NULL sobre una columna con nulos exige
--     inventarse un valor, y un correo inventado en un CRM acaba en una
--     campaña enviada a la nada. Así que si hay contactos sin correo, esta
--     migración se para y lo dice: se rellenan a mano y se vuelve a lanzar.
--     Fallar es peor que continuar en casi todo, menos en fabricar datos.

-- ── Teléfonos a E.164 ────────────────────────────────────────────────────────
-- Se quitan espacios, guiones, puntos y paréntesis; «00» pasa a «+»; y a lo que
-- se quede sin indicativo se le pone el de Colombia, que es de donde son. El
-- «0» de larga distancia nacional no va en el número internacional.
UPDATE "contacts"
SET "phone" = regexp_replace("phone", '[\s()./-]', '', 'g')
WHERE "phone" IS NOT NULL;

UPDATE "contacts"
SET "phone" = '+' || substr("phone", 3)
WHERE "phone" LIKE '00%';

UPDATE "contacts"
SET "phone" = '+57' || regexp_replace("phone", '^0+', '')
WHERE "phone" IS NOT NULL AND "phone" NOT LIKE '+%';

-- Lo que siga sin parecer un teléfono se deja en nulo antes que guardar basura
-- con pinta de válida: un campo vacío se ve, uno mal se manda.
UPDATE "contacts"
SET "phone" = NULL
WHERE "phone" IS NOT NULL
  AND "phone" !~ '^\+\d{8,15}$';

-- ── Correo obligatorio ───────────────────────────────────────────────────────
DO $$
DECLARE
  sin_correo INTEGER;
BEGIN
  SELECT count(*) INTO sin_correo
  FROM "contacts"
  WHERE "email" IS NULL OR btrim("email") = '';

  IF sin_correo > 0 THEN
    -- Ojo: en RAISE el único marcador es «%». No hay «%L» —eso es de format()—
    -- y ponerlo deja el mensaje partido justo cuando más falta hace entenderlo.
    RAISE EXCEPTION
      'Hay % contacto(s) sin correo y el correo pasa a ser obligatorio. Rellénalos y vuelve a lanzar la migración. Para verlos: SELECT id, first_name, last_name, company_id FROM contacts WHERE email IS NULL OR btrim(email) = '''';',
      sin_correo;
  END IF;
END $$;

-- Un correo con espacios alrededor rompe cualquier envío.
UPDATE "contacts" SET "email" = lower(btrim("email"));

ALTER TABLE "contacts" ALTER COLUMN "email" SET NOT NULL;
