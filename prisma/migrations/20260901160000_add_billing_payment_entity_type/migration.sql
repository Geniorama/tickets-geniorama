-- Un abono puede llevar su comprobante de pago.
--
-- No hacen falta tablas: los adjuntos viven desde la Fase 0 en una tabla
-- compartida identificada por entidad e id. Dar de alta una entidad ahí es
-- añadir un valor al enum, que es para lo que se hizo así.
--
-- Va en su propia migración porque PostgreSQL no deja **usar** un valor de
-- enumerado en la misma transacción en que se añade.
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'BILLING_PAYMENT';
