-- ============================================================
-- Migración 0009: catálogo administrable de Tipos de Labor
-- (antes lista fija en código). profiles.role_type, skills.role_type
-- y catalog_items.role_type referencian work_types.key (referencia
-- blanda: el borrado se gestiona en la UI con reasignación a 'default')
-- ============================================================

create table public.work_types (
  key text primary key,
  name text not null,
  description text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.work_types enable row level security;
create policy wt_select on public.work_types for select to authenticated using (true);
create policy wt_admin on public.work_types for all to authenticated
  using (is_admin()) with check (is_admin());

create trigger work_types_audit after insert or update or delete on public.work_types
  for each row execute function public.write_audit();

insert into public.work_types (key, name, description, sort_order) values
  ('default',   'General',     'Aplica a cualquier rol sin especialización definida.', 0),
  ('designer',  'Diseño',      'Roles de diseño de producto, UI/UX y visual.', 1),
  ('engineer',  'Ingeniería',  'Roles de desarrollo de software y tecnología.', 2),
  ('marketing', 'Marketing',   'Roles de mercadeo, comunicaciones y crecimiento.', 3);
