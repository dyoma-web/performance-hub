-- ============================================================
-- Migración 0015: cargos reales de Innovahub + reglas 360
--  · Catálogo real de cargos (liderazgos y operativos) con su
--    familia de rol por defecto y marca de liderazgo.
--  · Re-mapeo best-effort de la familia de cada persona según su
--    cargo (editable luego por TH en la UI).
--  · Las asignaciones de LÍDER se derivan del organigrama:
--      - se crean/actualizan automáticamente al cambiar manager_id
--      - NO se pueden eliminar ni anular a mano (trigger)
--      - el RPC de generación las sincroniza también
--  · Progreso anónimo de "mi evaluación": el evaluado ve cuántas
--    evaluaciones sobre él van enviadas, sin ver quiénes evalúan.
-- ============================================================

-- ------------------------------------------------------------
-- 1. CATÁLOGO DE CARGOS REALES
-- ------------------------------------------------------------
alter table public.positions
  add column if not exists family_id uuid references public.role_families(id),
  add column if not exists is_leadership boolean not null default false;

do $$
declare rec record;
begin
  for rec in
    select * from (values
      ('Gerente General',                      0, true,  '00000000-0000-4000-f000-000000000001'::uuid, 'Dirección general (CEO)'),
      ('Gerente de Operaciones',               1, true,  '00000000-0000-4000-f000-000000000001'::uuid, 'Lidera el área de Operaciones (gestoras y sus equipos)'),
      ('Gerente Financiera y Administrativa',  1, true,  '00000000-0000-4000-f000-000000000003'::uuid, 'Recursos, procesos y cumplimiento'),
      ('Talento Humano',                       1, true,  '00000000-0000-4000-f000-000000000003'::uuid, 'People Ops: cultura, desarrollo y bienestar'),
      ('Asocios',                              1, true,  '00000000-0000-4000-f000-000000000001'::uuid, 'Relaciones y oportunidades estratégicas'),
      ('Gestora de Proyecto',                  2, true,  '00000000-0000-4000-f000-000000000001'::uuid, 'Lidera un equipo de 1 creativo + 1 pedagoga'),
      ('Diseñador/a Visual',                   3, false, '00000000-0000-4000-f000-000000000002'::uuid, 'Creativo/a del equipo de proyecto'),
      ('Diseñadora Instruccional',             3, false, '00000000-0000-4000-f000-000000000001'::uuid, 'Pedagoga del equipo de proyecto'),
      ('Gestor Administrativo de Proyectos',   3, false, '00000000-0000-4000-f000-000000000003'::uuid, 'Soporte administrativo de proyectos'),
      ('Soporte Técnico y Tecnología',         3, false, '00000000-0000-4000-f000-000000000004'::uuid, 'Plataformas, soporte y continuidad tecnológica')
    ) as t(name, lvl, is_lead, fam, descr)
  loop
    if exists (select 1 from positions p where lower(p.name) = lower(rec.name)) then
      update positions
         set level = rec.lvl, is_leadership = rec.is_lead, family_id = rec.fam,
             description = coalesce(description, rec.descr), is_active = true
       where lower(name) = lower(rec.name);
    else
      insert into positions (name, level, is_leadership, family_id, description)
      values (rec.name, rec.lvl, rec.is_lead, rec.fam, rec.descr);
    end if;
  end loop;
end $$;

-- ------------------------------------------------------------
-- 2. RE-MAPEO DE FAMILIA POR CARGO (best-effort, editable en UI)
-- ------------------------------------------------------------
alter table public.profiles disable trigger profiles_protect;

-- Pedagogía / diseño instruccional → Consultoría
update public.profiles set family_id = '00000000-0000-4000-f000-000000000001'
 where position is not null and (position ilike '%instruccional%' or position ilike '%pedagog%');
-- Administrativo → Operaciones (antes que el patrón 'proyecto')
update public.profiles set family_id = '00000000-0000-4000-f000-000000000003'
 where position is not null and position ilike '%administrativ%';
-- Creativo / diseño visual → Creativo
update public.profiles set family_id = '00000000-0000-4000-f000-000000000002'
 where position is not null and (position ilike '%creativ%' or position ilike '%visual%')
   and position not ilike '%instruccional%';
-- Soporte / tecnología → Tecnología
update public.profiles set family_id = '00000000-0000-4000-f000-000000000004'
 where position is not null and (position ilike '%soporte%' or position ilike '%tecnolog%' or position ilike '%sistemas%');
-- Gestoras, asocios, gerencia general y de operaciones → Consultoría
update public.profiles set family_id = '00000000-0000-4000-f000-000000000001'
 where position is not null and (
   position ilike '%gestora%' or position ilike '%asocio%'
   or position ilike '%gerente general%' or position ilike '%gerente de operaciones%'
   or (position ilike '%proyecto%' and position not ilike '%administrativ%'));
-- Financiera, contaduría, Talento Humano → Operaciones
update public.profiles set family_id = '00000000-0000-4000-f000-000000000003'
 where position is not null and (
   position ilike '%financier%' or position ilike '%contad%'
   or position ilike '%talento%' or position ilike '%people%');

alter table public.profiles enable trigger profiles_protect;

-- ------------------------------------------------------------
-- 3. PROTECCIÓN: las asignaciones de LÍDER no se tocan a mano
--    (solo la sincronización interna, marcada con app.sync_360)
-- ------------------------------------------------------------
create or replace function public.protect_lider_assignments()
returns trigger language plpgsql as
$$
begin
  if old.kind = 'lider' and coalesce(current_setting('app.sync_360', true), '') <> 'on' then
    if tg_op = 'DELETE' then
      raise exception 'Las asignaciones de líder no se eliminan manualmente: cambian al modificar el organigrama';
    elsif new.status = 'anulada' and old.status <> 'anulada' then
      raise exception 'Las asignaciones de líder no se anulan manualmente: cambian al modificar el organigrama';
    end if;
  end if;
  return coalesce(new, old);
end
$$;

create trigger evaluation_assignments_protect_lider
  before update or delete on public.evaluation_assignments
  for each row execute function public.protect_lider_assignments();

-- ------------------------------------------------------------
-- 4. SINCRONIZACIÓN CON EL ORGANIGRAMA
--    Al cambiar el líder (manager_id) o activarse/archivarse una
--    persona, sus asignaciones de líder y su autoevaluación se
--    actualizan en todos los ciclos abiertos.
-- ------------------------------------------------------------
create or replace function public.sync_lider_assignments()
returns trigger language plpgsql security definer set search_path = public as
$$
declare
  c record;
  eligible boolean;
begin
  eligible := new.manager_id is not null and new.is_active
              and new.archived_at is null and new.role <> 'invitado';
  perform set_config('app.sync_360', 'on', true);
  for c in select id from cycles where status not in ('finalized', 'archived') loop
    -- retirar la asignación de líder que ya no corresponde
    delete from evaluation_assignments a
     where a.cycle_id = c.id and a.kind = 'lider' and a.evaluatee_id = new.id
       and a.status <> 'enviada'
       and (not eligible or a.evaluator_id <> new.manager_id);
    update evaluation_assignments a set status = 'anulada'
     where a.cycle_id = c.id and a.kind = 'lider' and a.evaluatee_id = new.id
       and a.status = 'enviada'
       and (not eligible or a.evaluator_id <> new.manager_id);
    -- crear (o revivir) la asignación con el líder actual
    if eligible then
      insert into evaluation_assignments (cycle_id, evaluator_id, evaluatee_id, kind, origin, created_by)
      values (c.id, new.manager_id, new.id, 'lider', 'auto', auth.uid())
      on conflict (cycle_id, evaluator_id, evaluatee_id, kind)
      do update set status = case
        when evaluation_assignments.status = 'anulada' then 'enviada'
        else evaluation_assignments.status end;
    end if;
    -- autoevaluación de personas nuevas/reactivadas
    if new.is_active and new.archived_at is null and new.role <> 'invitado' then
      insert into evaluation_assignments (cycle_id, evaluator_id, evaluatee_id, kind, origin, created_by)
      values (c.id, new.id, new.id, 'auto', 'auto', auth.uid())
      on conflict (cycle_id, evaluator_id, evaluatee_id, kind) do nothing;
    end if;
  end loop;
  perform set_config('app.sync_360', 'off', true);
  return new;
end
$$;

create trigger profiles_sync_lider
  after insert or update of manager_id, is_active, archived_at on public.profiles
  for each row execute function public.sync_lider_assignments();

-- ------------------------------------------------------------
-- 5. RPC de generación: ahora también sincroniza las de líder
-- ------------------------------------------------------------
create or replace function public.generate_evaluation_assignments(p_cycle uuid)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  pol record;
  rec record;
  deficit int;
  n_lider int := 0;
  n_auto int := 0;
  n_par int := 0;
  n_sync int := 0;
  n int;
begin
  if not public.can_manage_evals() then
    raise exception 'Solo administración o Talento Humano puede generar asignaciones';
  end if;

  insert into cycle_eval_policies (cycle_id, updated_by)
  values (p_cycle, auth.uid())
  on conflict (cycle_id) do nothing;
  select * into pol from cycle_eval_policies where cycle_id = p_cycle;

  -- Sincronizar con el organigrama: retirar asignaciones de líder obsoletas
  perform set_config('app.sync_360', 'on', true);
  delete from evaluation_assignments a
   where a.cycle_id = p_cycle and a.kind = 'lider' and a.status <> 'enviada'
     and not exists (
       select 1 from profiles p
       where p.id = a.evaluatee_id and p.manager_id = a.evaluator_id
         and p.is_active and p.archived_at is null and p.role <> 'invitado');
  get diagnostics n = row_count; n_sync := n;
  update evaluation_assignments a set status = 'anulada'
   where a.cycle_id = p_cycle and a.kind = 'lider' and a.status = 'enviada'
     and not exists (
       select 1 from profiles p
       where p.id = a.evaluatee_id and p.manager_id = a.evaluator_id
         and p.is_active and p.archived_at is null and p.role <> 'invitado');
  get diagnostics n = row_count; n_sync := n_sync + n;
  perform set_config('app.sync_360', 'off', true);

  -- Líder evalúa OBLIGATORIAMENTE a cada subordinado directo activo
  insert into evaluation_assignments (cycle_id, evaluator_id, evaluatee_id, kind, origin, created_by)
  select p_cycle, p.manager_id, p.id, 'lider', 'auto', auth.uid()
  from profiles p
  join profiles m on m.id = p.manager_id
  where p.is_active and p.archived_at is null and p.role <> 'invitado'
    and m.is_active and m.archived_at is null
  on conflict (cycle_id, evaluator_id, evaluatee_id, kind) do nothing;
  get diagnostics n = row_count; n_lider := n;

  -- Autoevaluación (incluye la dimensión humana) para toda persona activa
  insert into evaluation_assignments (cycle_id, evaluator_id, evaluatee_id, kind, origin, created_by)
  select p_cycle, p.id, p.id, 'auto', 'auto', auth.uid()
  from profiles p
  where p.is_active and p.archived_at is null and p.role <> 'invitado'
  on conflict (cycle_id, evaluator_id, evaluatee_id, kind) do nothing;
  get diagnostics n = row_count; n_auto := n;

  -- Pares aleatorias hasta la meta de cada evaluador
  if pol.random_enabled then
    for rec in
      select p.id,
             coalesce(o.peer_target, pol.peer_target) as target,
             p.manager_id
      from profiles p
      left join eval_policy_overrides o
        on o.cycle_id = p_cycle and o.user_id = p.id
      where p.is_active and p.archived_at is null and p.role <> 'invitado'
    loop
      deficit := rec.target - (
        select count(*) from evaluation_assignments a
        where a.cycle_id = p_cycle and a.evaluator_id = rec.id
          and a.kind = 'par' and a.status <> 'anulada');
      if deficit > 0 then
        insert into evaluation_assignments (cycle_id, evaluator_id, evaluatee_id, kind, origin, created_by)
        select p_cycle, rec.id, c.id, 'par', 'aleatoria', auth.uid()
        from profiles c
        where c.is_active and c.archived_at is null and c.role <> 'invitado'
          and c.id <> rec.id
          and c.manager_id is distinct from rec.id   -- a subordinados los evalúa como líder
          and rec.manager_id is distinct from c.id   -- a su líder no lo evalúa como par
          and not exists (
            select 1 from evaluation_assignments a
            where a.cycle_id = p_cycle and a.evaluator_id = rec.id
              and a.evaluatee_id = c.id and a.status <> 'anulada')
        order by (
            select count(*) from evaluation_assignments a2
            where a2.cycle_id = p_cycle and a2.evaluatee_id = c.id
              and a2.kind = 'par' and a2.status <> 'anulada') asc,
          random()
        limit deficit;
        get diagnostics n = row_count; n_par := n_par + n;
      end if;
    end loop;
  end if;

  return jsonb_build_object('lider', n_lider, 'auto', n_auto, 'par', n_par, 'sincronizadas', n_sync);
end
$$;

-- ------------------------------------------------------------
-- 6. PROGRESO ANÓNIMO DE "MI EVALUACIÓN"
--    El evaluado solo ve conteos (no quién lo evalúa).
-- ------------------------------------------------------------
create or replace function public.my_evaluation_progress(p_cycle uuid)
returns jsonb language sql stable security definer set search_path = public as
$$
  select jsonb_build_object(
    'total', count(*),
    'enviadas', count(*) filter (where status = 'enviada')
  )
  from evaluation_assignments
  where cycle_id = p_cycle and evaluatee_id = auth.uid() and status <> 'anulada'
$$;

-- ------------------------------------------------------------
-- 7. Las asignaciones OBLIGATORIAS quedan definidas desde ya:
--    líder→subordinado y autoevaluación para los ciclos abiertos
--    (las de pares se generan/ajustan desde la vista de admin).
-- ------------------------------------------------------------
do $$
declare c record;
begin
  for c in select id from cycles where status not in ('finalized', 'archived') loop
    insert into evaluation_assignments (cycle_id, evaluator_id, evaluatee_id, kind, origin)
    select c.id, p.manager_id, p.id, 'lider', 'auto'
    from profiles p
    join profiles m on m.id = p.manager_id
    where p.is_active and p.archived_at is null and p.role <> 'invitado'
      and m.is_active and m.archived_at is null
    on conflict (cycle_id, evaluator_id, evaluatee_id, kind) do nothing;

    insert into evaluation_assignments (cycle_id, evaluator_id, evaluatee_id, kind, origin)
    select c.id, p.id, p.id, 'auto', 'auto'
    from profiles p
    where p.is_active and p.archived_at is null and p.role <> 'invitado'
    on conflict (cycle_id, evaluator_id, evaluatee_id, kind) do nothing;
  end loop;
end $$;
