-- ============================================================
-- Migración 0010: puntos de control contra usuarios duplicados
-- · Correo: refuerzo con unicidad case-insensitive en profiles
--   (Auth ya lo garantiza; esto es defensa en profundidad)
-- · Documento: columna normalizada (solo dígitos/letras, sin
--   puntos ni espacios) + unicidad por (tipo, número) en la BD —
--   imposible registrar dos personas con la misma cédula aunque
--   la escriban distinto
-- ============================================================

-- Documento normalizado: '1.023.456-789' y '1023456789' son el mismo
alter table public.personal_info
  add column document_number_norm text generated always as
    (nullif(upper(regexp_replace(coalesce(document_number, ''), '[^0-9A-Za-z]', '', 'g')), '')) stored;

create unique index personal_info_document_unique
  on public.personal_info (document_type, document_number_norm)
  where document_number_norm is not null and document_type is not null;

-- Correo único sin importar mayúsculas/minúsculas
create unique index profiles_email_lower_unique
  on public.profiles (lower(email));
