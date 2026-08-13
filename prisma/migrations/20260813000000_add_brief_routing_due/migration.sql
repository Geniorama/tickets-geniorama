-- Plazo de entrega por regla de brief.
--
-- Aditivo y nullable: las reglas que ya existan se quedan sin plazo automático,
-- que es el comportamiento actual (la tarea solo lleva fecha límite si n8n la
-- manda en el payload).

ALTER TABLE "brief_routings" ADD COLUMN "due_days" INTEGER;
ALTER TABLE "brief_routings" ADD COLUMN "due_time" TEXT;
