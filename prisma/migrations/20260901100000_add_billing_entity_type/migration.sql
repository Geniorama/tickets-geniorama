-- Los cobros pasan a admitir comentarios y adjuntos.
--
-- No hace falta ninguna tabla nueva: comentarios y adjuntos viven desde la
-- Fase 0 en tablas compartidas identificadas por `entityType` + `entityId`.
-- Dar de alta un módulo ahí es añadir un valor al enum, que es exactamente
-- para lo que se hizo así.
--
-- En su propia migración: PostgreSQL no deja **usar** un valor de enum en la
-- misma transacción en que se añade.
ALTER TYPE "EntityType" ADD VALUE 'BILLING';
