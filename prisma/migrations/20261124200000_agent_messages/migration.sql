-- Conversaciones del agente por canal (WhatsApp). Aditiva: tipos y tabla nuevos.

CREATE TYPE "AgentChannel" AS ENUM ('WHATSAPP');
CREATE TYPE "AgentMessageDirection" AS ENUM ('IN', 'OUT');

CREATE TABLE "agent_messages" (
  "id" TEXT NOT NULL,
  "channel" "AgentChannel" NOT NULL,
  "direction" "AgentMessageDirection" NOT NULL,
  "phone" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "wa_message_id" TEXT,
  "client_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_messages_wa_message_id_key" ON "agent_messages"("wa_message_id");
CREATE INDEX "agent_messages_channel_phone_created_at_idx" ON "agent_messages"("channel", "phone", "created_at");

ALTER TABLE "agent_messages"
  ADD CONSTRAINT "agent_messages_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
