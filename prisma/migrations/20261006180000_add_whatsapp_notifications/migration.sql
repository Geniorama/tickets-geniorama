-- Notificaciones por WhatsApp: número, consentimiento y categorías por usuario.
-- Solo columnas nuevas; nadie queda activado sin pedirlo.
ALTER TABLE "users" ADD COLUMN "whatsapp_phone" TEXT;
ALTER TABLE "users" ADD COLUMN "whatsapp_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "whatsapp_events" TEXT[] DEFAULT ARRAY[]::TEXT[];
