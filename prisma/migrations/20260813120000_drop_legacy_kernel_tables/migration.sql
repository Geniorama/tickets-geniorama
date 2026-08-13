-- Limpieza de la Fase 0: elimina las 19 tablas que quedaron sin uso tras
-- unificar el núcleo compartido (v1.43.0 – v1.47.0).
--
-- ⚠️ IRREVERSIBLE. Antes de aplicar se verificó en producción que:
--   · ningún registro de las tablas viejas falta en las nuevas (0 huérfanos
--     en las 19 comprobaciones);
--   · las tablas nuevas reciben escrituras reales (más filas que el backfill);
--   · las viejas están congeladas (0 escrituras desde su migración);
--   · ninguna referencia viva en el código las menciona.
--
-- El orden respeta las dependencias: primero las hijas, luego las padre.

-- ── Reacciones y adjuntos de comentario (dependen de los comentarios) ────────
DROP TABLE IF EXISTS "ticket_comment_reactions";
DROP TABLE IF EXISTS "task_comment_reactions";
DROP TABLE IF EXISTS "ticket_comment_attachments";
DROP TABLE IF EXISTS "task_comment_attachments";

-- ── Comentarios ──────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS "ticket_comments";
DROP TABLE IF EXISTS "task_comments";

-- ── Ítems de checklist (dependen de los checklists) ─────────────────────────
DROP TABLE IF EXISTS "ticket_checklist_items";
DROP TABLE IF EXISTS "task_checklist_items";

-- ── Checklists ───────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS "ticket_checklists";
DROP TABLE IF EXISTS "task_checklists";

-- ── Adjuntos ─────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS "ticket_attachments";
DROP TABLE IF EXISTS "task_attachments";
DROP TABLE IF EXISTS "project_attachments";

-- ── Registros de tiempo ──────────────────────────────────────────────────────
DROP TABLE IF EXISTS "ticket_time_entries";
DROP TABLE IF EXISTS "task_time_entries";

-- ── Plantillas ───────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS "ticket_templates";
DROP TABLE IF EXISTS "task_templates";

-- ── Vínculos de bóveda ───────────────────────────────────────────────────────
DROP TABLE IF EXISTS "ticket_vault_entries";
DROP TABLE IF EXISTS "project_vault_entries";
