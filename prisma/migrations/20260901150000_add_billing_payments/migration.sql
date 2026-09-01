-- Los abonos pasan de ser un número a ser una lista.
--
-- `paid_amount` guardaba un único importe que solo se escribía al arrastrar la
-- tarjeta a «Abonado». Un segundo abono no cabía en ninguna parte: había que
-- machacar el primero, perdiendo cuándo entró y cuánto fue. Y como el tablero
-- ignora que sueltes una tarjeta en la columna donde ya está, en la práctica no
-- había forma de registrarlo.

CREATE TABLE "billing_payments" (
    "id"               TEXT NOT NULL,
    "amount"           DOUBLE PRECISION NOT NULL,
    "paid_on"          TIMESTAMP(3) NOT NULL,
    "method"           TEXT,
    "note"             TEXT,
    "billing_item_id"  TEXT NOT NULL,
    "registered_by_id" TEXT NOT NULL,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "billing_payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "billing_payments_billing_item_id_paid_on_idx"
  ON "billing_payments"("billing_item_id", "paid_on");

ALTER TABLE "billing_payments"
  ADD CONSTRAINT "billing_payments_billing_item_id_fkey"
  FOREIGN KEY ("billing_item_id") REFERENCES "billing_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "billing_payments"
  ADD CONSTRAINT "billing_payments_registered_by_id_fkey"
  FOREIGN KEY ("registered_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Lo ya cobrado se convierte en su primer abono. Sin esto, los cobros que hoy
-- están en «Abonado» o «Pagado» aparecerían mañana como si nadie hubiera
-- pagado nada: `paid_amount` seguiría diciendo la cifra, pero la lista estaría
-- vacía y el primer recálculo la pondría a cero.
--
-- La fecha, la mejor que se tiene: la de pago, si no la de emisión, si no la
-- de creación. Y a nombre de quien creó el cobro, que es lo único que consta.
INSERT INTO "billing_payments" ("id", "amount", "paid_on", "note", "billing_item_id", "registered_by_id")
SELECT
  'seed_pago_' || b."id",
  b."paid_amount",
  COALESCE(b."paid_at", b."invoiced_at", b."created_at"),
  'Abono anterior al registro de abonos. La fecha es aproximada.',
  b."id",
  b."created_by_id"
FROM "billing_items" b
WHERE b."paid_amount" > 0;
