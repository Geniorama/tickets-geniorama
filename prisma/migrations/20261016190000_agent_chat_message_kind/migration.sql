-- Notas de voz en el chat del agente: se guarda solo la transcripción.
ALTER TABLE "agent_chat_messages" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'text';
