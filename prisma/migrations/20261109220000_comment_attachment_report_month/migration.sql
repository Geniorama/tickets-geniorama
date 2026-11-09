-- Complemento de 20261109210000_attachment_report_month (AG·P-5).
--
-- Esa migración se amplió con `comment_attachments` después de que alguna base
-- ya la hubiera registrado como aplicada, y Prisma no vuelve a ejecutar una
-- migración modificada: esas bases se quedaron sin esta columna. Idempotente,
-- así que no hace nada donde ya exista.
ALTER TABLE "comment_attachments" ADD COLUMN IF NOT EXISTS "report_month" TEXT;
CREATE INDEX IF NOT EXISTS "comment_attachments_report_month_idx" ON "comment_attachments"("report_month");
