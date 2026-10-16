-- Agente IA de atención a clientes: se activa por plan, como «Herramientas de IA».
ALTER TABLE "plans" ADD COLUMN "ai_agent" BOOLEAN NOT NULL DEFAULT false;
