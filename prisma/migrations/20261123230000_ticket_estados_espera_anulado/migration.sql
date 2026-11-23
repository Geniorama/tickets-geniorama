-- Dos estados nuevos de ticket y el motivo que los acompaña. Aditiva: los
-- tickets existentes no cambian de estado y `status_reason` queda en NULL.

ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'ESPERA_CLIENTE';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'ANULADO';

ALTER TABLE "tickets" ADD COLUMN "status_reason" TEXT;
