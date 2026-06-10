-- ============================================================
-- Performance Hub — Migración 0001: esquema inicial
-- Entidades de la especificación §13 + reglas de negocio §5/§7/§14
-- ============================================================

-- ------------------------------------------------------------
-- 1. EQUIPOS
-- ------------------------------------------------------------
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_team_id uuid references public.teams(id),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. PERFILES (extiende auth.users)
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  role text not null default 'colaborador'
    check (role in ('admin', 'facilitador', 'colaborador', 'invitado')),
  team_id uuid references public.teams(id),
  position text,
  role_type text not null default 'default',
  avatar text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Funciones auxiliares para RLS (security definer evita recursión)
-- ------------------------------------------------------------
create or replace function public.user_role()
returns text language sql stable security definer set search_path = public as
$$ select role from profiles where id = auth.uid() $$;

create or replace function public.user_team()
returns uuid language sql stable security definer set search_path = public as
$$ select team_id from profiles where id = auth.uid() $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select role from profiles where id = auth.uid()) = 'admin', false) $$;

-- ¿El usuario actual es facilitador del equipo de `target`?
create or replace function public.is_facilitator_of(target uuid)
returns boolean language sql stable security definer set search_path = public as
$$
  select exists (
    select 1
    from profiles me
    join profiles t on t.id = target
    where me.id = auth.uid()
      and me.role = 'facilitador'
      and me.team_id is not null
      and me.team_id = t.team_id
  )
$$;

-- ------------------------------------------------------------
-- 3. CICLOS DE EVALUACIÓN
-- ------------------------------------------------------------
create table public.cycles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'draft'
    check (status in ('draft', 'open', 'self-review', 'peer-feedback',
                      'manager-review', 'meeting', 'calibration', 'finalized', 'archived')),
  config jsonb not null default '{
    "weights": {"results": 40, "behaviors": 30, "skills": 20, "contribution": 10},
    "peer_anonymous": false,
    "require_evidence_for_all": true,
    "min_feedforward_actions": 2
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date > start_date)
);

-- ------------------------------------------------------------
-- 4. CATÁLOGO (comportamientos, habilidades por rol, contribución)
-- ------------------------------------------------------------
create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('behavior', 'skill', 'contribution')),
  key text not null,
  role_type text,            -- solo para kind = 'skill'
  name text not null,
  description text not null default '',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index catalog_items_unique
  on public.catalog_items (kind, key, coalesce(role_type, ''));

-- ------------------------------------------------------------
-- 5. OBJETIVOS (bloque Resultados)
-- ------------------------------------------------------------
create table public.objectives (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  metric text not null,
  weight int not null check (weight between 0 and 100),
  progress int not null default 0 check (progress between 0 and 100),
  status text not null default 'in-progress'
    check (status in ('in-progress', 'completed', 'at-risk', 'dropped')),
  evidence_links text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 6. REVIEWS (auto, facilitador, par, stakeholder)
-- ------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  evaluatee_id uuid not null references public.profiles(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('self', 'facilitator', 'peer', 'stakeholder')),
  status text not null default 'requested'
    check (status in ('requested', 'draft', 'submitted', 'declined')),
  anonymous boolean not null default false,
  recognition text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, evaluatee_id, reviewer_id, type),
  check (type <> 'self' or evaluatee_id = reviewer_id)
);

-- ------------------------------------------------------------
-- 7. ÍTEMS DE REVIEW (puntaje + comentario + evidencia)
-- Regla §5/§14: un "4" exige evidencia concreta — a nivel de BD
-- ------------------------------------------------------------
create table public.review_items (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  block text not null check (block in ('results', 'behaviors', 'skills', 'contribution')),
  item_ref text not null,    -- id de objetivo o key del catálogo
  score smallint check (score between 1 and 4),
  comment text,
  evidence_links text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (review_id, block, item_ref),
  -- todo puntaje exige un comentario con ejemplo concreto (≥30 caracteres)
  constraint score_needs_comment
    check (score is null or char_length(coalesce(comment, '')) >= 30),
  -- un 4 "Sobresaliente" exige link de evidencia o comentario extenso (≥80)
  constraint score4_needs_evidence
    check (score is distinct from 4
           or coalesce(array_length(evidence_links, 1), 0) > 0
           or char_length(coalesce(comment, '')) >= 80)
);

-- ------------------------------------------------------------
-- 8. FEEDFORWARD (acciones propuestas dentro de un review)
-- ------------------------------------------------------------
create table public.feedforward_items (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  action text not null check (char_length(action) >= 10),
  indicator text not null,
  due_date date,
  responsible_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 9. PLAN DE ACCIÓN (feedforward consolidado, "documento vivo")
-- ------------------------------------------------------------
create table public.plan_actions (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  indicator text not null,
  due_date date,
  responsible_id uuid references public.profiles(id),
  status text not null default 'pending'
    check (status in ('pending', 'in-progress', 'completed', 'dropped')),
  source_review_id uuid references public.reviews(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.action_notes (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.plan_actions(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  note text not null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 10. CHECK-INS MENSUALES (§6)
-- ------------------------------------------------------------
create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  checkin_date date not null default current_date,
  achievements text,
  blockers text,
  support_needed text,
  fb_continue text,
  fb_adjust text,
  fb_start text,
  objective_updates text,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'reviewed')),
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 11. REUNIONES 1:1 Y ACUERDOS
-- ------------------------------------------------------------
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  evaluatee_id uuid not null references public.profiles(id) on delete cascade,
  facilitator_id uuid not null references public.profiles(id) on delete cascade,
  scheduled_at timestamptz,
  duration_min int not null default 45,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'done', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agreements (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  description text not null,
  due_date date,
  signed_by_collaborator_at timestamptz,
  signed_by_facilitator_at timestamptz,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 12. CALIBRACIÓN (§7)
-- Regla: cambiar una nota exige racional (≥20 caracteres) — a nivel de BD
-- ------------------------------------------------------------
create table public.calibrations (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  evaluatee_id uuid not null references public.profiles(id) on delete cascade,
  original_score numeric(3, 2) not null check (original_score between 1 and 4),
  adjusted_score numeric(3, 2) check (adjusted_score between 1 and 4),
  rationale text,
  adjusted_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint adjustment_needs_rationale
    check (adjusted_score is null
           or adjusted_score = original_score
           or char_length(coalesce(rationale, '')) >= 20)
);

-- ------------------------------------------------------------
-- 13. NOTIFICACIONES IN-APP (§9)
-- ------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 14. AUDITORÍA INMUTABLE (§8/§14) — solo insert vía trigger
-- ------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  entity text not null,
  entity_id uuid,
  action text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as
$$ begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','cycles','objectives','reviews','review_items',
                           'plan_actions','checkins','meetings'] loop
    execute format(
      'create trigger %I_updated_at before update on public.%I
       for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- Auditoría automática sobre entidades sensibles
create or replace function public.write_audit()
returns trigger language plpgsql security definer set search_path = public as
$$
begin
  insert into audit_log (actor_id, entity, entity_id, action, before, after)
  values (
    auth.uid(),
    tg_table_name,
    coalesce(new.id, old.id),
    lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end
$$;

do $$
declare t text;
begin
  foreach t in array array['cycles','reviews','review_items','calibrations',
                           'plan_actions','objectives'] loop
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I
       for each row execute function public.write_audit()', t, t);
  end loop;
end $$;

-- Crear perfil automáticamente al registrarse un usuario
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as
$$
begin
  insert into public.profiles (id, email, name, avatar)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    upper(left(coalesce(new.raw_user_meta_data ->> 'name', new.email), 2))
  )
  on conflict (id) do nothing;
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Solo un admin puede cambiar rol o equipo de un perfil
create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = public as
$$
begin
  if (new.role is distinct from old.role or new.team_id is distinct from old.team_id)
     and not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar rol o equipo';
  end if;
  return new;
end
$$;

create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['teams','profiles','cycles','catalog_items','objectives',
                           'reviews','review_items','feedforward_items','plan_actions',
                           'action_notes','checkins','meetings','agreements',
                           'calibrations','notifications','audit_log'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- TEAMS: lectura para todos los autenticados; escritura solo admin
create policy teams_select on public.teams for select to authenticated using (true);
create policy teams_admin on public.teams for all to authenticated
  using (is_admin()) with check (is_admin());

-- PROFILES: directorio visible para autenticados; cada quien edita el suyo; admin todo
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin on public.profiles for all to authenticated
  using (is_admin()) with check (is_admin());

-- CYCLES y CATALOG: lectura autenticados; escritura admin
create policy cycles_select on public.cycles for select to authenticated using (true);
create policy cycles_admin on public.cycles for all to authenticated
  using (is_admin()) with check (is_admin());
create policy catalog_select on public.catalog_items for select to authenticated using (true);
create policy catalog_admin on public.catalog_items for all to authenticated
  using (is_admin()) with check (is_admin());

-- OBJECTIVES: dueño y su facilitador gestionan; admin lee
create policy objectives_select on public.objectives for select to authenticated
  using (user_id = auth.uid() or is_facilitator_of(user_id) or is_admin());
create policy objectives_write on public.objectives for insert to authenticated
  with check (user_id = auth.uid() or is_facilitator_of(user_id) or is_admin());
create policy objectives_update on public.objectives for update to authenticated
  using (user_id = auth.uid() or is_facilitator_of(user_id) or is_admin());
create policy objectives_delete on public.objectives for delete to authenticated
  using (user_id = auth.uid() or is_facilitator_of(user_id) or is_admin());

-- REVIEWS:
--  - el reviewer ve y edita su propia review
--  - el evaluado ve reviews sobre él SOLO cuando están enviadas (§3/§14)
--  - el facilitador del evaluado y el admin ven todo el expediente
create policy reviews_select on public.reviews for select to authenticated
  using (
    reviewer_id = auth.uid()
    or (evaluatee_id = auth.uid() and status = 'submitted')
    or is_facilitator_of(evaluatee_id)
    or is_admin()
  );
create policy reviews_insert on public.reviews for insert to authenticated
  with check (
    -- autoevaluación propia
    (type = 'self' and reviewer_id = auth.uid() and evaluatee_id = auth.uid())
    -- el evaluado o su facilitador solicitan feedback de pares/stakeholders (§2)
    or (type in ('peer', 'stakeholder')
        and (evaluatee_id = auth.uid() or is_facilitator_of(evaluatee_id)))
    -- el facilitador crea su propia review sobre alguien de su equipo
    or (type = 'facilitator' and reviewer_id = auth.uid() and is_facilitator_of(evaluatee_id))
    or is_admin()
  );
create policy reviews_update on public.reviews for update to authenticated
  using (reviewer_id = auth.uid() or is_admin());
create policy reviews_delete on public.reviews for delete to authenticated
  using (is_admin());

-- REVIEW_ITEMS y FEEDFORWARD: heredan la visibilidad de su review
create or replace function public.can_see_review(rid uuid)
returns boolean language sql stable security definer set search_path = public as
$$
  select exists (
    select 1 from reviews r
    where r.id = rid
      and (r.reviewer_id = auth.uid()
           or (r.evaluatee_id = auth.uid() and r.status = 'submitted')
           or is_facilitator_of(r.evaluatee_id)
           or is_admin())
  )
$$;

create or replace function public.owns_review(rid uuid)
returns boolean language sql stable security definer set search_path = public as
$$
  select exists (
    select 1 from reviews r
    where r.id = rid and (r.reviewer_id = auth.uid() or is_admin())
  )
$$;

create policy review_items_select on public.review_items for select to authenticated
  using (can_see_review(review_id));
create policy review_items_write on public.review_items for insert to authenticated
  with check (owns_review(review_id));
create policy review_items_update on public.review_items for update to authenticated
  using (owns_review(review_id));
create policy review_items_delete on public.review_items for delete to authenticated
  using (owns_review(review_id));

create policy ff_select on public.feedforward_items for select to authenticated
  using (can_see_review(review_id));
create policy ff_write on public.feedforward_items for insert to authenticated
  with check (owns_review(review_id));
create policy ff_update on public.feedforward_items for update to authenticated
  using (owns_review(review_id));
create policy ff_delete on public.feedforward_items for delete to authenticated
  using (owns_review(review_id));

-- PLAN_ACTIONS y ACTION_NOTES: dueño, su facilitador y admin
create policy plan_select on public.plan_actions for select to authenticated
  using (user_id = auth.uid() or is_facilitator_of(user_id) or is_admin());
create policy plan_write on public.plan_actions for insert to authenticated
  with check (user_id = auth.uid() or is_facilitator_of(user_id) or is_admin());
create policy plan_update on public.plan_actions for update to authenticated
  using (user_id = auth.uid() or is_facilitator_of(user_id) or is_admin());
create policy plan_delete on public.plan_actions for delete to authenticated
  using (is_admin());

create policy notes_select on public.action_notes for select to authenticated
  using (exists (select 1 from plan_actions a where a.id = action_id
                 and (a.user_id = auth.uid() or is_facilitator_of(a.user_id) or is_admin())));
create policy notes_insert on public.action_notes for insert to authenticated
  with check (author_id = auth.uid());

-- CHECKINS: dueño gestiona; su facilitador lee y marca revisado; admin lee
create policy checkins_select on public.checkins for select to authenticated
  using (user_id = auth.uid() or is_facilitator_of(user_id) or is_admin());
create policy checkins_insert on public.checkins for insert to authenticated
  with check (user_id = auth.uid());
create policy checkins_update on public.checkins for update to authenticated
  using (user_id = auth.uid() or is_facilitator_of(user_id));
create policy checkins_delete on public.checkins for delete to authenticated
  using (user_id = auth.uid() and status = 'draft');

-- MEETINGS y AGREEMENTS: solo los participantes (y admin)
create policy meetings_select on public.meetings for select to authenticated
  using (evaluatee_id = auth.uid() or facilitator_id = auth.uid() or is_admin());
create policy meetings_insert on public.meetings for insert to authenticated
  with check (facilitator_id = auth.uid() or is_admin());
create policy meetings_update on public.meetings for update to authenticated
  using (evaluatee_id = auth.uid() or facilitator_id = auth.uid() or is_admin());

create policy agreements_select on public.agreements for select to authenticated
  using (exists (select 1 from meetings m where m.id = meeting_id
                 and (m.evaluatee_id = auth.uid() or m.facilitator_id = auth.uid() or is_admin())));
create policy agreements_write on public.agreements for insert to authenticated
  with check (exists (select 1 from meetings m where m.id = meeting_id
                      and (m.evaluatee_id = auth.uid() or m.facilitator_id = auth.uid() or is_admin())));
create policy agreements_update on public.agreements for update to authenticated
  using (exists (select 1 from meetings m where m.id = meeting_id
                 and (m.evaluatee_id = auth.uid() or m.facilitator_id = auth.uid() or is_admin())));

-- CALIBRATIONS: solo admin y facilitadores del evaluado (§7)
create policy calib_select on public.calibrations for select to authenticated
  using (is_admin() or is_facilitator_of(evaluatee_id));
create policy calib_insert on public.calibrations for insert to authenticated
  with check (is_admin() or is_facilitator_of(evaluatee_id));
create policy calib_update on public.calibrations for update to authenticated
  using (is_admin());

-- NOTIFICATIONS: cada quien las suyas; cualquier autenticado puede generar (sistema)
create policy notif_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated
  using (user_id = auth.uid());
create policy notif_insert on public.notifications for insert to authenticated
  with check (true);

-- AUDIT_LOG: inmutable — solo lectura para admin; escribe únicamente el trigger
create policy audit_select on public.audit_log for select to authenticated
  using (is_admin());
