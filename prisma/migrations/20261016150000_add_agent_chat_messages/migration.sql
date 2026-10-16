-- Chat del agente de atención dentro de la plataforma (el agente vive en n8n).
CREATE TABLE "agent_chat_messages" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agent_chat_messages_user_id_created_at_idx" ON "agent_chat_messages"("user_id", "created_at");
CREATE INDEX "agent_chat_messages_conversation_id_created_at_idx" ON "agent_chat_messages"("conversation_id", "created_at");

ALTER TABLE "agent_chat_messages" ADD CONSTRAINT "agent_chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
