-- ============================================================
-- Migración 0012: historial laboral interno + fotos de perfil
-- · employment_periods: registro oficial (mantenido por TH) de
--   cargos, periodos, tipo de contrato, responsabilidades y
--   logros — insumo para cartas de referencia laboral o de
--   ejecución de contratos
-- · bucket público "avatars" para fotos de perfil
-- ============================================================

create table public.employment_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  position_title text not null,
  area text,
  reports_to text,
  contract_type text not null default 'laboral'
    check (contract_type in ('laboral', 'prestacion-servicios', 'aprendizaje', 'practicas', 'otro')),
  start_date date not null,
  end_date date,                       -- null = cargo actual
  responsibilities text,
  achievements text,
  created_at timestamptz not null default now()
);

alter table public.employment_periods enable row level security;
-- lo ve el dueño, su línea de liderazgo y TH; lo mantiene TH
create policy ep_select on public.employment_periods for select to authenticated
  using (can_view_professional(user_id));
create policy ep_admin on public.employment_periods for all to authenticated
  using (is_admin()) with check (is_admin());

create trigger employment_periods_audit after insert or update or delete on public.employment_periods
  for each row execute function public.write_audit();

-- Cargo actual de David + primer registro de su historial
update public.profiles set position = 'Líder de Operaciones'
  where email = 'david.yomayusa@innovahub.org';

insert into public.employment_periods (user_id, position_title, area, reports_to, contract_type, start_date, responsibilities)
select id, 'Líder de Operaciones', 'Operaciones', 'Junta Directiva', 'laboral',
       coalesce(hire_date, current_date),
       'Dirección del área de operaciones y administración global de la plataforma.'
from public.profiles where email = 'david.yomayusa@innovahub.org';

-- Bucket público para fotos de perfil
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

do $$
begin
  execute $pol$
    create policy "avatars_own_write" on storage.objects for all to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  $pol$;
exception when insufficient_privilege then
  raise notice 'Crear la policy de avatars desde el dashboard.';
end $$;
