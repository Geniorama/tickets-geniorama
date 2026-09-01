-- El vínculo con el cliente de Xubio.
--
-- Aditiva y sin relleno: nulo significa «todavía no emparejado», que es donde
-- están todas hoy. Guardar el vínculo es lo que impide duplicar clientes en la
-- contabilidad cuando alguien renombre una empresa en un lado o en el otro.
ALTER TABLE "companies" ADD COLUMN "xubio_client_id" TEXT;

-- Un cliente de Xubio no puede estar enlazado a dos empresas de aquí: sería
-- facturarle a nombre de otro. Parcial, porque los nulos son la norma.
CREATE UNIQUE INDEX "companies_xubio_client_id_key"
  ON "companies"("xubio_client_id") WHERE "xubio_client_id" IS NOT NULL;
