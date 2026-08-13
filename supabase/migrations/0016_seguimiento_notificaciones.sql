-- ============================================================
-- Migración 0016: seguimiento 360 y motor de notificaciones
--  · Fecha límite de diligenciamiento por ciclo (visible a todos).
--  · Reglas de notificación configurables (admin/TH): recordatorios
--    a personas con evaluaciones pendientes y reportes de avance a
--    admin/TH; automáticas (pg_cron diario) o manuales; cadencia
--    diaria / día por medio / semanal / fechas específicas, con
--    exclusión de fines de semana y fechas puntuales.
--  · Canal actual: notificación in-app (tabla notifications). El
--    correo automático requiere SMTP/Edge Function (post-beta); el
--    correo manual se hace desde la UI vía cliente de correo.
-- ============================================================

-- ------------------------------------------------------------
-- 1. FECHA LÍMITE DE DILIGENCIAMIENTO
-- ------------------------------------------------------------
alter table public.cycle_eval_policies
  add column if not exists eval_deadline date;

-- ------------------------------------------------------------
-- 2. REGLAS DE NOTIFICACIÓN
-- ------------------------------------------------------------
create table public.notification_rules (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  kind text not null check (kind in ('recordatorio-pendientes', 'reporte-avance')),
  mode text not null default 'auto' check (mode in ('auto', 'manual')),
  cadence text not null default 'diaria'
    check (cadence in ('diaria', 'dia-por-medio', 'semanal', 'fechas')),
  specific_dates date[] not null default '{}',
  exclude_weekends boolean not null default true,
  exclude_dates date[] not null default '{}',
  window_start date,
  window_end date,
  message text,               -- plantilla: {pendientes} y {fecha_limite}
  is_active boolean not null default true,
  last_run_on date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.notification_rules enable row level security;
create policy nrules_manage on public.notification_rules for all to authenticated
  using (can_manage_evals()) with check (can_manage_evals());

-- ------------------------------------------------------------
-- 3. EJECUCIÓN DE UNA REGLA
--    p_force = true la ejecuta ya, ignorando cadencia/exclusiones
--    (la usa el botón "Ejecutar ahora" y también reglas manuales).
-- ------------------------------------------------------------
create or replace function public.run_notification_rule(p_rule uuid, p_force boolean default false)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  r record;
  pol record;
  cyc record;
  deadline date;
  base date;
  dow int;
  n int := 0;
  total int;
  enviadas int;
  rec record;
  msg text;
  body text;
begin
  -- pg_cron corre sin sesión (auth.uid() null); usuarios deben ser admin/TH
  if auth.uid() is not null and not public.can_manage_evals() then
    raise exception 'Solo administración o Talento Humano puede ejecutar reglas';
  end if;

  select * into r from notification_rules where id = p_rule;
  if not found then
    return jsonb_build_object('ejecutada', false, 'motivo', 'regla inexistente');
  end if;

  if not p_force then
    if not r.is_active then return jsonb_build_object('ejecutada', false, 'motivo', 'inactiva'); end if;
    if r.mode = 'manual' then return jsonb_build_object('ejecutada', false, 'motivo', 'manual'); end if;
    if r.last_run_on = current_date then return jsonb_build_object('ejecutada', false, 'motivo', 'ya corrió hoy'); end if;
    if r.window_start is not null and current_date < r.window_start then
      return jsonb_build_object('ejecutada', false, 'motivo', 'antes de la ventana');
    end if;
    if r.window_end is not null and current_date > r.window_end then
      return jsonb_build_object('ejecutada', false, 'motivo', 'después de la ventana');
    end if;
    dow := extract(dow from current_date)::int;
    if r.exclude_weekends and dow in (0, 6) then
      return jsonb_build_object('ejecutada', false, 'motivo', 'fin de semana excluido');
    end if;
    if current_date = any(r.exclude_dates) then
      return jsonb_build_object('ejecutada', false, 'motivo', 'fecha excluida');
    end if;
    base := coalesce(r.window_start, r.created_at::date);
    if r.cadence = 'dia-por-medio' and ((current_date - base) % 2) <> 0 then
      return jsonb_build_object('ejecutada', false, 'motivo', 'cadencia día por medio');
    end if;
    if r.cadence = 'semanal'
       and extract(dow from current_date) <> extract(dow from base) then
      return jsonb_build_object('ejecutada', false, 'motivo', 'cadencia semanal');
    end if;
    if r.cadence = 'fechas' and not (current_date = any(r.specific_dates)) then
      return jsonb_build_object('ejecutada', false, 'motivo', 'no es fecha programada');
    end if;
  end if;

  select * into cyc from cycles where id = r.cycle_id;
  select * into pol from cycle_eval_policies where cycle_id = r.cycle_id;
  deadline := coalesce(pol.eval_deadline, cyc.end_date);

  if r.kind = 'recordatorio-pendientes' then
    for rec in
      select a.evaluator_id, count(*)::int as pendientes
      from evaluation_assignments a
      join profiles p on p.id = a.evaluator_id
      where a.cycle_id = r.cycle_id
        and a.status in ('pendiente', 'en-curso')
        and p.is_active and p.archived_at is null
      group by a.evaluator_id
    loop
      msg := coalesce(nullif(trim(r.message), ''),
        'Tienes {pendientes} evaluación(es) de desempeño pendiente(s) del ciclo ' || cyc.name
        || '. La fecha límite es el {fecha_limite}.');
      msg := replace(msg, '{pendientes}', rec.pendientes::text);
      msg := replace(msg, '{fecha_limite}', to_char(deadline, 'DD/MM/YYYY'));
      insert into notifications (user_id, type, title, body, link)
      values (rec.evaluator_id, 'eval360', 'Evaluaciones 360 pendientes', msg, '/mis-evaluaciones');
      n := n + 1;
    end loop;
  else  -- reporte-avance para admin/TH
    select count(*)::int, (count(*) filter (where status = 'enviada'))::int
      into total, enviadas
    from evaluation_assignments
    where cycle_id = r.cycle_id and status <> 'anulada';
    body := format('Ciclo %s: %s de %s evaluaciones enviadas (%s%%). Faltan %s. Fecha límite: %s.',
      cyc.name, enviadas, total,
      case when total > 0 then round(enviadas::numeric / total * 100) else 0 end,
      total - enviadas, to_char(deadline, 'DD/MM/YYYY'));
    for rec in
      select distinct p.id
      from profiles p
      left join user_roles ur on ur.user_id = p.id
      where (p.role in ('admin', 'talento') or ur.role in ('admin', 'talento'))
        and p.is_active and p.archived_at is null
    loop
      insert into notifications (user_id, type, title, body, link)
      values (rec.id, 'eval360', 'Reporte de avance — Evaluación 360', body, '/evaluacion-360');
      n := n + 1;
    end loop;
  end if;

  update notification_rules set last_run_on = current_date where id = p_rule;
  return jsonb_build_object('ejecutada', true, 'notificados', n);
end
$$;

-- ------------------------------------------------------------
-- 4. RUNNER DIARIO (lo invoca pg_cron; también ejecutable a mano)
-- ------------------------------------------------------------
create or replace function public.run_notification_rules()
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  r record;
  res jsonb;
  results jsonb := '[]'::jsonb;
begin
  if auth.uid() is not null and not public.can_manage_evals() then
    raise exception 'Solo administración o Talento Humano';
  end if;
  for r in
    select nr.id from notification_rules nr
    join cycles c on c.id = nr.cycle_id
    where nr.is_active and nr.mode = 'auto'
      and c.status not in ('finalized', 'archived')
  loop
    res := public.run_notification_rule(r.id, false);
    results := results || jsonb_build_array(jsonb_build_object('rule', r.id) || res);
  end loop;
  return results;
end
$$;

-- ------------------------------------------------------------
-- 5. PROGRAMACIÓN DIARIA CON pg_cron (12:00 UTC = 7:00 Bogotá)
--    Si la extensión no está disponible, queda el aviso y las
--    reglas pueden ejecutarse manualmente desde la UI.
-- ------------------------------------------------------------
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('eval360-notifications', '0 12 * * *',
    'select public.run_notification_rules()');
exception when others then
  raise notice 'pg_cron no disponible (%): ejecutar las reglas manualmente desde la UI o habilitar la extensión en el dashboard.', sqlerrm;
end $$;
