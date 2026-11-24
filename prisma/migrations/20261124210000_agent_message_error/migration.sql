-- Falla del agente al responder un mensaje (texto del error). Aditiva: columna nueva y nula.

ALTER TABLE "agent_messages" ADD COLUMN "error" TEXT;
