-- A dónde se le reclaman los cobros a cada cliente.
--
-- Aditiva y sin relleno: vacío significa «usa el contacto principal», que es
-- exactamente lo que se venía haciendo. Nadie cambia de destinatario por esto.
ALTER TABLE "companies"
  ADD COLUMN "billing_emails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
