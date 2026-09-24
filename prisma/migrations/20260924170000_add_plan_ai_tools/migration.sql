-- Herramientas de IA para clientes: el plan decide si los clientes de la
-- empresa pueden usar el diagnóstico y los informes con IA en sus fichas.
--
-- Aditivo y desactivado por defecto: ningún cliente gana acceso por la
-- migración; se activa plan por plan.
ALTER TABLE "plans" ADD COLUMN "ai_tools" BOOLEAN NOT NULL DEFAULT false;
