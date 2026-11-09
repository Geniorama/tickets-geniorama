-- Informe mensual del cliente (AG·P-5): un adjunto —del ticket o de un
-- comentario— puede marcarse como el informe de un mes («YYYY-MM»).
-- Solo aditivo: columnas nullable e índices.
ALTER TABLE "attachments" ADD COLUMN "report_month" TEXT;
CREATE INDEX "attachments_report_month_idx" ON "attachments"("report_month");

ALTER TABLE "comment_attachments" ADD COLUMN "report_month" TEXT;
CREATE INDEX "comment_attachments_report_month_idx" ON "comment_attachments"("report_month");
