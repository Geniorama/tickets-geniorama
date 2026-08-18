-- Agente de WhatsApp.
--
-- Aditiva: no mueve ni transforma datos existentes.

-- Número de WhatsApp verificado del usuario (E.164 sin '+').
ALTER TABLE "users" ADD COLUMN "whatsapp_phone" TEXT;
CREATE UNIQUE INDEX "users_whatsapp_phone_key" ON "users"("whatsapp_phone");

-- Estado de la conversación por número.
CREATE TABLE "whatsapp_conversations" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "user_id" TEXT,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "pending" JSONB,
    "verify_code_hash" TEXT,
    "verify_user_id" TEXT,
    "verify_expires_at" TIMESTAMP(3),
    "verify_attempts" INTEGER NOT NULL DEFAULT 0,
    "blocked_until" TIMESTAMP(3),
    "last_message_id" TEXT,
    "last_reply" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_conversations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "whatsapp_conversations_phone_key" ON "whatsapp_conversations"("phone");
CREATE INDEX "whatsapp_conversations_user_id_idx" ON "whatsapp_conversations"("user_id");

ALTER TABLE "whatsapp_conversations"
    ADD CONSTRAINT "whatsapp_conversations_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
