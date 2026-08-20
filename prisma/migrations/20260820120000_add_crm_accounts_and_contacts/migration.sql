-- Fase 3, paso 1: cuentas y contactos del CRM.
--
-- `Company` gana una etapa comercial en vez de crear una entidad «Lead» aparte.
-- Así, cuando un prospecto se gana no hay conversión ni duplicado: la misma
-- empresa pasa a CLIENTE y conserva su historial, sus contactos y —desde ese
-- momento— sus proyectos, tickets y planes.
--
-- El backfill pone TODAS las empresas actuales en CLIENTE, que es lo que son.
-- Por eso los selectores que a partir de ahora filtran por etapa siguen
-- mostrando exactamente lo mismo que hoy: el cambio no altera nada visible
-- hasta que se cree el primer lead.

-- CreateEnum
CREATE TYPE "AccountStage" AS ENUM ('LEAD', 'PROSPECTO', 'CLIENTE', 'INACTIVO');

-- AlterTable: el DEFAULT ya deja en CLIENTE las filas existentes
ALTER TABLE "companies"
  ADD COLUMN "stage" "AccountStage" NOT NULL DEFAULT 'CLIENTE',
  ADD COLUMN "owner_id" TEXT,
  ADD COLUMN "source" TEXT;

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "position" TEXT,
    "notes" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "companies_stage_idx" ON "companies"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_user_id_key" ON "contacts"("user_id");

-- CreateIndex
CREATE INDEX "contacts_company_id_is_primary_idx" ON "contacts"("company_id", "is_primary");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
