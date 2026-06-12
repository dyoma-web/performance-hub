-- ============================================================
-- Migración 0013: estado "retirado" (archivado) para personas
-- · archived_at: marca de retiro de la empresa. El retirado sale
--   del organigrama y las vistas operativas (is_active = false)
--   pero conserva TODA su información, y es reversible
--   (desarchivar lo reactiva).
-- Estados resultantes:
--   activo      -> is_active = true,  archived_at null
--   suspendido  -> is_active = false, archived_at null
--   retirado    -> is_active = false, archived_at con fecha
-- ============================================================

alter table public.profiles
  add column archived_at timestamptz;
