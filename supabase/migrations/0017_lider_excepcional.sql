-- ============================================================
-- Migración 0017: asignaciones de líder EXCEPCIONALES (manuales)
--  Caso de uso: el CEO es evaluado como "líder" por el CINO según
--  la Matriz 2026, pero esa relación NO existe (ni debe existir)
--  en el organigrama — sería una jerarquía circular.
--  Regla: las asignaciones de líder con origin='auto' siguen
--  gobernadas por el organigrama (intocables a mano); las de
--  origin='manual' las gestiona admin/TH como las de pares y la
--  sincronización automática NO las toca.
-- ============================================================

-- 1. Protección: solo las de origen 'auto' quedan bloqueadas
create or replace function public.protect_lider_assignments()
returns trigger language plpgsql as
$$
begin
  if old.kind = 'lider' and old.origin = 'auto'
     and coalesce(current_setting('app.sync_360', true), '') <> 'on' then
    if tg_op = 'DELETE' then
      raise exception 'Las asignaciones de líder del organigrama no se eliminan manualmente: cambian al modificar el organigrama';
    elsif new.status = 'anulada' and old.status <> 'anulada' then
      raise exception 'Las asignaciones de líder del organigrama no se anulan manualmente: cambian al modificar el organigrama';
    end if;
  end if;
  return coalesce(new, old);
end
$$;

-- 2. Sincronización con el organigrama: ignora las manuales
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
    delete from evaluation_assignments a
     where a.cycle_id = c.id and a.kind = 'lider' and a.origin = 'auto'
       and a.evaluatee_id = new.id and a.status <> 'enviada'
       and (not eligible or a.evaluator_id <> new.manager_id);
    update evaluation_assignments a set status = 'anulada'
     where a.cycle_id = c.id and a.kind = 'lider' and a.origin = 'auto'
       and a.evaluatee_id = new.id and a.status = 'enviada'
       and (not eligible or a.evaluator_id <> new.manager_id);
    if eligible then
      insert into evaluation_assignments (cycle_id, evaluator_id, evaluatee_id, kind, origin, created_by)
      values (c.id, new.manager_id, new.id, 'lider', 'auto', auth.uid())
      on conflict (cycle_id, evaluator_id, evaluatee_id, kind)
      do update set status = case
        when evaluation_assignments.status = 'anulada' then 'enviada'
        else evaluation_assignments.status end;
    end if;
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

-- 3. RPC de generación: la limpieza de obsoletas solo aplica a 'auto'
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

  perform set_config('app.sync_360', 'on', true);
  delete from evaluation_assignments a
   where a.cycle_id = p_cycle and a.kind = 'lider' and a.origin = 'auto'
     and a.status <> 'enviada'
     and not exists (
       select 1 from profiles p
       where p.id = a.evaluatee_id and p.manager_id = a.evaluator_id
         and p.is_active and p.archived_at is null and p.role <> 'invitado');
  get diagnostics n = row_count; n_sync := n;
  update evaluation_assignments a set status = 'anulada'
   where a.cycle_id = p_cycle and a.kind = 'lider' and a.origin = 'auto'
     and a.status = 'enviada'
     and not exists (
       select 1 from profiles p
       where p.id = a.evaluatee_id and p.manager_id = a.evaluator_id
         and p.is_active and p.archived_at is null and p.role <> 'invitado');
  get diagnostics n = row_count; n_sync := n_sync + n;
  perform set_config('app.sync_360', 'off', true);

  insert into evaluation_assignments (cycle_id, evaluator_id, evaluatee_id, kind, origin, created_by)
  select p_cycle, p.manager_id, p.id, 'lider', 'auto', auth.uid()
  from profiles p
  join profiles m on m.id = p.manager_id
  where p.is_active and p.archived_at is null and p.role <> 'invitado'
    and m.is_active and m.archived_at is null
  on conflict (cycle_id, evaluator_id, evaluatee_id, kind) do nothing;
  get diagnostics n = row_count; n_lider := n;

  insert into evaluation_assignments (cycle_id, evaluator_id, evaluatee_id, kind, origin, created_by)
  select p_cycle, p.id, p.id, 'auto', 'auto', auth.uid()
  from profiles p
  where p.is_active and p.archived_at is null and p.role <> 'invitado'
  on conflict (cycle_id, evaluator_id, evaluatee_id, kind) do nothing;
  get diagnostics n = row_count; n_auto := n;

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
          and c.manager_id is distinct from rec.id
          and rec.manager_id is distinct from c.id
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
