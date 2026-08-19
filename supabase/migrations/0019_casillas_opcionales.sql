-- ============================================================
-- Migración 0019: casillas de evaluación opcionales
--  Los comentarios dejan de ser obligatorios al calificar (se
--  retiran los CHECK de mínimo 30 caracteres y de evidencia para
--  el nivel 4). La calidad del relato STAR pasa a ser sugerida,
--  no forzada. Además, el formulario 360 guarda un comentario
--  adicional libre como review_item (block 'contribution',
--  item_ref 'adicional') — sin cambios de esquema.
-- ============================================================

alter table public.review_items drop constraint if exists score_needs_comment;
alter table public.review_items drop constraint if exists score4_needs_evidence;
