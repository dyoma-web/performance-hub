-- ============================================================
-- Módulo Personas — Migración 0003
-- Estructura organizacional, multi-rol, identificación personal
-- (datos sensibles con RLS estricta), perfil profesional y
-- competencias con valoración 360.
-- Principio de privacidad: 3 categorías de dato
--   · Público interno  -> todos los autenticados
--   · Profesional      -> dueño + cadena de liderazgo + TH(admin)
--   · Personal/sensible-> SOLO dueño + TH(admin)
-- ============================================================

-- ------------------------------------------------------------
-- 1. ORGANIZACIÓN
-- ------------------------------------------------------------
create table public.areas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_area_id uuid references public.areas(id),
  lead_id uuid references public.profiles(id),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.positions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level int not null default 0,           -- 0 = más alto (junta), creciente hacia abajo
  area_id uuid references public.areas(id),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Una persona puede tener VARIOS cargos (ej: socio + gerente)
create table public.position_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  position_id uuid not null references public.positions(id) on delete cascade,
  is_primary boolean not null default false,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  unique (user_id, position_id)
);

-- Multi-rol de plataforma (profiles.role queda como rol primario)
create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('admin', 'facilitador', 'colaborador', 'invitado')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.org_settings (
  id int primary key default 1 check (id = 1),  -- singleton
  chart_visibility text not null default 'company'
    check (chart_visibility in ('branch', 'team', 'area', 'company')),
  role_overrides jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Jerarquía en profiles
alter table public.profiles
  add column manager_id uuid references public.profiles(id),
  add column area_id uuid references public.areas(id),
  add column photo_url text,
  add column hire_date date;

alter table public.teams add column area_id uuid references public.areas(id);

-- ------------------------------------------------------------
-- Funciones de autorización (actualizadas para multi-rol)
-- ------------------------------------------------------------
create or replace function public.has_role(r text)
returns boolean language sql stable security definer set search_path = public as
$$
  select exists (select 1 from profiles where id = auth.uid() and role = r)
      or exists (select 1 from user_roles where user_id = auth.uid() and role = r)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as
$$ select public.has_role('admin') $$;

-- ¿auth.uid() está en la cadena de liderazgo (hacia arriba) de `target`?
create or replace function public.is_manager_of(target uuid)
returns boolean language plpgsql stable security definer set search_path = public as
$$
declare
  cur uuid := target;
  i int := 0;
begin
  if auth.uid() is null or target is null or target = auth.uid() then
    return false;
  end if;
  loop
    select manager_id into cur from profiles where id = cur;
    exit when cur is null or i >= 12;
    if cur = auth.uid() then
      return true;
    end if;
    i := i + 1;
  end loop;
  return false;
end
$$;

-- Categoría "Profesional": dueño, cadena de liderazgo, líder de área, TH
create or replace function public.can_view_professional(target uuid)
returns boolean language sql stable security definer set search_path = public as
$$
  select target = auth.uid()
      or public.is_admin()
      or public.is_manager_of(target)
      or exists (
           select 1 from profiles p
           join areas a on a.id = p.area_id
           where p.id = target and a.lead_id = auth.uid()
         )
$$;

-- ------------------------------------------------------------
-- 2. IDENTIFICACIÓN PERSONAL (sensible: dueño + TH)
-- ------------------------------------------------------------
create table public.personal_info (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  document_type text check (document_type in ('CC', 'CE', 'TI', 'PAS', 'PEP', 'NIT', 'OTRO')),
  document_number text,
  birth_date date,
  phone text,
  address text,
  city text,
  country text default 'Colombia',
  marital_status text check (marital_status in ('soltero', 'casado', 'union-libre', 'separado', 'viudo', 'otro')),
  gender text,
  blood_type text check (blood_type in ('O+','O-','A+','A-','B+','B-','AB+','AB-')),
  contract_type text check (contract_type in ('indefinido', 'fijo', 'prestacion-servicios', 'aprendizaje', 'practicas', 'otro')),
  eps text,
  pension_fund text,
  consent_given_at timestamptz,           -- habeas data: consentimiento explícito
  updated_at timestamptz not null default now()
);

create table public.dependents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  full_name text not null,
  relationship text not null check (relationship in ('hijo', 'hija', 'pareja', 'padre', 'madre', 'hermano', 'otro')),
  birth_date date,
  lives_together boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  full_name text not null,
  relationship text not null,
  phone text not null,
  phone_alt text,
  created_at timestamptz not null default now()
);

create table public.personal_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  diet text check (diet in ('omnivoro', 'vegetariano', 'vegano', 'pescetariano', 'sin-gluten', 'kosher', 'halal', 'otro')),
  allergies text,
  shirt_size text check (shirt_size in ('XS', 'S', 'M', 'L', 'XL', 'XXL')),
  hobbies text,
  celebrate_birthday boolean not null default true,
  notes text,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. PERFIL PROFESIONAL (dueño + liderazgo + TH)
-- ------------------------------------------------------------
create table public.education (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  institution text not null,
  location text,
  level text check (level in ('bachillerato', 'tecnico', 'tecnologo', 'pregrado', 'especializacion', 'maestria', 'doctorado', 'diplomado', 'curso', 'certificacion')),
  start_date date,
  end_date date,                          -- null = en curso
  description text,
  created_at timestamptz not null default now()
);

create table public.work_experience (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  company text not null,
  position text not null,
  start_date date,
  end_date date,                          -- null = actual
  description text,
  achievements text,
  created_at timestamptz not null default now()
);

-- Referencias: contienen datos de terceros -> dueño + TH solamente
create table public.professional_references (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  full_name text not null,
  relationship text,
  company text,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.recognitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  granted_by text,
  date_granted date,
  description text,
  link text,
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

-- Repositorio de documentos (HV, certificados) en Supabase Storage
create table public.profile_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('cv', 'certificado', 'diploma', 'otro')),
  name text not null,
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4. COMPETENCIAS 360 Y VALORACIÓN DE TRABAJO
-- ------------------------------------------------------------
create table public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,                          -- ej: técnica, blanda, liderazgo
  role_type text,                         -- null = aplica a todos
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.skill_ratings (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.skills(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,   -- evaluado
  rater_id uuid not null references public.profiles(id) on delete cascade,
  relation text not null check (relation in ('self', 'peer', 'leader')),
  score smallint not null check (score between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (skill_id, user_id, rater_id),
  check (relation <> 'self' or user_id = rater_id)
);

-- Valoración de entregables/servicios (aplica a contratistas o por proyecto)
create table public.work_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,   -- valorado
  evaluator_id uuid not null references public.profiles(id),
  project text not null,
  quality smallint not null check (quality between 1 and 5),
  timeliness smallint not null check (timeliness between 1 and 5),
  cost_value smallint check (cost_value between 1 and 5),   -- solo si aplica (servicios)
  comment text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- TRIGGERS (updated_at + auditoría sobre datos sensibles)
-- ------------------------------------------------------------
-- write_audit ahora soporta tablas sin columna `id` (PK compuesta o user_id)
create or replace function public.write_audit()
returns trigger language plpgsql security definer set search_path = public as
$$
declare
  rec jsonb := to_jsonb(coalesce(new, old));
  eid uuid;
begin
  begin
    eid := nullif(rec ->> 'id', '')::uuid;
  exception when others then
    eid := null;
  end;
  if eid is null then
    begin
      eid := nullif(rec ->> 'user_id', '')::uuid;
    exception when others then
      eid := null;
    end;
  end if;
  insert into audit_log (actor_id, entity, entity_id, action, before, after)
  values (
    auth.uid(),
    tg_table_name,
    eid,
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
  foreach t in array array['personal_info', 'personal_preferences', 'skill_ratings'] loop
    execute format(
      'create trigger %I_updated_at before update on public.%I
       for each row execute function public.set_updated_at()', t, t);
  end loop;
  -- auditoría: cambios en datos sensibles y estructura organizacional
  foreach t in array array['personal_info', 'dependents', 'emergency_contacts',
                           'position_assignments', 'user_roles', 'areas', 'org_settings'] loop
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I
       for each row execute function public.write_audit()', t, t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['areas', 'positions', 'position_assignments', 'user_roles', 'org_settings',
                           'personal_info', 'dependents', 'emergency_contacts', 'personal_preferences',
                           'education', 'work_experience', 'professional_references', 'recognitions',
                           'profile_documents', 'skills', 'skill_ratings', 'work_ratings'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ORGANIZACIÓN: lectura interna para todos; escritura admin
create policy areas_select on public.areas for select to authenticated using (true);
create policy areas_admin on public.areas for all to authenticated using (is_admin()) with check (is_admin());
create policy positions_select on public.positions for select to authenticated using (true);
create policy positions_admin on public.positions for all to authenticated using (is_admin()) with check (is_admin());
create policy passign_select on public.position_assignments for select to authenticated using (true);
create policy passign_admin on public.position_assignments for all to authenticated using (is_admin()) with check (is_admin());
create policy uroles_select on public.user_roles for select to authenticated using (true);
create policy uroles_admin on public.user_roles for all to authenticated using (is_admin()) with check (is_admin());
create policy orgset_select on public.org_settings for select to authenticated using (true);
create policy orgset_admin on public.org_settings for all to authenticated using (is_admin()) with check (is_admin());

-- PERSONAL/SENSIBLE: SOLO dueño + TH (ni siquiera el jefe directo)
do $$
declare t text;
begin
  foreach t in array array['personal_info', 'dependents', 'emergency_contacts', 'personal_preferences',
                           'professional_references'] loop
    execute format('create policy %I_owner_sel on public.%I for select to authenticated using (user_id = auth.uid() or is_admin())', t, t);
    execute format('create policy %I_owner_ins on public.%I for insert to authenticated with check (user_id = auth.uid() or is_admin())', t, t);
    execute format('create policy %I_owner_upd on public.%I for update to authenticated using (user_id = auth.uid() or is_admin())', t, t);
    execute format('create policy %I_owner_del on public.%I for delete to authenticated using (user_id = auth.uid() or is_admin())', t, t);
  end loop;
end $$;

-- PROFESIONAL: dueño escribe; dueño + liderazgo + TH leen
do $$
declare t text;
begin
  foreach t in array array['education', 'work_experience', 'recognitions', 'profile_documents'] loop
    execute format('create policy %I_prof_sel on public.%I for select to authenticated using (can_view_professional(user_id))', t, t);
    execute format('create policy %I_prof_ins on public.%I for insert to authenticated with check (user_id = auth.uid() or is_admin())', t, t);
    execute format('create policy %I_prof_upd on public.%I for update to authenticated using (user_id = auth.uid() or is_admin())', t, t);
    execute format('create policy %I_prof_del on public.%I for delete to authenticated using (user_id = auth.uid() or is_admin())', t, t);
  end loop;
end $$;

-- COMPETENCIAS: catálogo visible; ratings — evaluador escribe el suyo,
-- lo ven evaluado, evaluador, liderazgo del evaluado y TH
create policy skills_select on public.skills for select to authenticated using (true);
create policy skills_admin on public.skills for all to authenticated using (is_admin()) with check (is_admin());
create policy sr_select on public.skill_ratings for select to authenticated
  using (user_id = auth.uid() or rater_id = auth.uid() or can_view_professional(user_id));
create policy sr_insert on public.skill_ratings for insert to authenticated
  with check (rater_id = auth.uid());
create policy sr_update on public.skill_ratings for update to authenticated
  using (rater_id = auth.uid());
create policy sr_delete on public.skill_ratings for delete to authenticated
  using (rater_id = auth.uid() or is_admin());

-- VALORACIÓN DE TRABAJO: evalúan líderes/TH; ve el valorado, su liderazgo y TH
create policy wr_select on public.work_ratings for select to authenticated
  using (user_id = auth.uid() or evaluator_id = auth.uid() or can_view_professional(user_id));
create policy wr_insert on public.work_ratings for insert to authenticated
  with check (evaluator_id = auth.uid() and (is_manager_of(user_id) or is_admin()));
create policy wr_delete on public.work_ratings for delete to authenticated
  using (is_admin());

-- ------------------------------------------------------------
-- STORAGE: bucket privado para HV y certificados
-- (si el rol postgres no puede crear policies en storage.objects,
--  se configuran desde el dashboard — el aviso queda en NOTICE)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('profile-docs', 'profile-docs', false)
on conflict (id) do nothing;

do $$
begin
  execute $pol$
    create policy "profile_docs_owner" on storage.objects for all to authenticated
    using (bucket_id = 'profile-docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()))
    with check (bucket_id = 'profile-docs' and (storage.foldername(name))[1] = auth.uid()::text)
  $pol$;
exception when insufficient_privilege then
  raise notice 'No fue posible crear la policy de storage desde SQL; crearla en el dashboard.';
end $$;

-- ------------------------------------------------------------
-- SEED: estructura demo + multi-rol + datos de ejemplo
-- ------------------------------------------------------------
-- Áreas (la raíz representa la dirección general / junta)
insert into public.areas (id, name, parent_area_id, lead_id, sort_order) values
  ('00000000-0000-4000-b000-000000000001', 'Dirección General', null, '00000000-0000-4000-a000-0000000000a6', 0),
  ('00000000-0000-4000-b000-000000000002', 'Diseño de Producto', '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-0000000000a2', 1),
  ('00000000-0000-4000-b000-000000000003', 'Ingeniería', '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-0000000000a7', 2),
  ('00000000-0000-4000-b000-000000000004', 'Marketing', '00000000-0000-4000-b000-000000000001', null, 3),
  ('00000000-0000-4000-b000-000000000005', 'People Ops', '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-0000000000a6', 4);

update public.teams set area_id = '00000000-0000-4000-b000-000000000005' where id = '00000000-0000-4000-a000-000000000010';
update public.teams set area_id = '00000000-0000-4000-b000-000000000002' where id = '00000000-0000-4000-a000-000000000011';
update public.teams set area_id = '00000000-0000-4000-b000-000000000003' where id = '00000000-0000-4000-a000-000000000012';
update public.teams set area_id = '00000000-0000-4000-b000-000000000004' where id = '00000000-0000-4000-a000-000000000013';

-- Cargos
insert into public.positions (id, name, level, description) values
  ('00000000-0000-4000-c000-000000000001', 'Gerente General', 0, 'Dirección general de la organización'),
  ('00000000-0000-4000-c000-000000000002', 'Líder de Área', 1, 'Responsable de un área funcional'),
  ('00000000-0000-4000-c000-000000000003', 'Senior UI Designer', 2, null),
  ('00000000-0000-4000-c000-000000000004', 'Product Designer', 2, null),
  ('00000000-0000-4000-c000-000000000005', 'Frontend Engineer', 2, null),
  ('00000000-0000-4000-c000-000000000006', 'Backend Engineer', 2, null),
  ('00000000-0000-4000-c000-000000000007', 'Marketing Specialist', 2, null);

-- Asignaciones (Daniela es Gerente Y Líder de People Ops -> multi-cargo)
insert into public.position_assignments (user_id, position_id, is_primary) values
  ('00000000-0000-4000-a000-0000000000a6', '00000000-0000-4000-c000-000000000001', true),
  ('00000000-0000-4000-a000-0000000000a6', '00000000-0000-4000-c000-000000000002', false),
  ('00000000-0000-4000-a000-0000000000a2', '00000000-0000-4000-c000-000000000002', true),
  ('00000000-0000-4000-a000-0000000000a7', '00000000-0000-4000-c000-000000000002', true),
  ('00000000-0000-4000-a000-0000000000a1', '00000000-0000-4000-c000-000000000003', true),
  ('00000000-0000-4000-a000-0000000000a4', '00000000-0000-4000-c000-000000000004', true),
  ('00000000-0000-4000-a000-0000000000a3', '00000000-0000-4000-c000-000000000005', true),
  ('00000000-0000-4000-a000-0000000000a5', '00000000-0000-4000-c000-000000000006', true),
  ('00000000-0000-4000-a000-0000000000a8', '00000000-0000-4000-c000-000000000007', true);

-- Multi-rol: roles actuales + Sara también es colaboradora (la evalúan a ella también)
insert into public.user_roles (user_id, role)
select id, role from public.profiles
on conflict do nothing;
insert into public.user_roles (user_id, role) values
  ('00000000-0000-4000-a000-0000000000a2', 'colaborador'),
  ('00000000-0000-4000-a000-0000000000a7', 'colaborador')
on conflict do nothing;

-- Jerarquía (reporta a) + área + antigüedad
update public.profiles set manager_id = '00000000-0000-4000-a000-0000000000a2', area_id = '00000000-0000-4000-b000-000000000002', hire_date = '2024-10-15' where id = '00000000-0000-4000-a000-0000000000a1';
update public.profiles set manager_id = '00000000-0000-4000-a000-0000000000a6', area_id = '00000000-0000-4000-b000-000000000002', hire_date = '2023-03-01' where id = '00000000-0000-4000-a000-0000000000a2';
update public.profiles set manager_id = '00000000-0000-4000-a000-0000000000a7', area_id = '00000000-0000-4000-b000-000000000003', hire_date = '2024-01-20' where id = '00000000-0000-4000-a000-0000000000a3';
update public.profiles set manager_id = '00000000-0000-4000-a000-0000000000a2', area_id = '00000000-0000-4000-b000-000000000002', hire_date = '2025-02-10' where id = '00000000-0000-4000-a000-0000000000a4';
update public.profiles set manager_id = '00000000-0000-4000-a000-0000000000a7', area_id = '00000000-0000-4000-b000-000000000003', hire_date = '2023-08-05' where id = '00000000-0000-4000-a000-0000000000a5';
update public.profiles set manager_id = null, area_id = '00000000-0000-4000-b000-000000000001', hire_date = '2022-01-10' where id = '00000000-0000-4000-a000-0000000000a6';
update public.profiles set manager_id = '00000000-0000-4000-a000-0000000000a6', area_id = '00000000-0000-4000-b000-000000000003', hire_date = '2022-06-15' where id = '00000000-0000-4000-a000-0000000000a7';
update public.profiles set manager_id = '00000000-0000-4000-a000-0000000000a6', area_id = '00000000-0000-4000-b000-000000000004', hire_date = '2024-05-02' where id = '00000000-0000-4000-a000-0000000000a8';

-- Configuración del organigrama
insert into public.org_settings (id, chart_visibility) values (1, 'company');

-- Catálogo inicial de competencias (técnicas desde el catálogo existente + transversales)
insert into public.skills (name, category, role_type, description)
select name, 'técnica', role_type, description from public.catalog_items where kind = 'skill';
insert into public.skills (name, category, role_type, description) values
  ('Liderazgo', 'liderazgo', null, 'Inspira, da dirección y desarrolla a otros.'),
  ('Comunicación', 'blanda', null, 'Transmite ideas con claridad oral y escrita.'),
  ('Trabajo en equipo', 'blanda', null, 'Colabora efectivamente hacia objetivos comunes.'),
  ('Gestión del tiempo', 'blanda', null, 'Prioriza y cumple compromisos.');

-- Datos personales demo (Alejandra, con consentimiento)
insert into public.personal_info (user_id, document_type, document_number, birth_date, phone, city, marital_status, blood_type, contract_type, consent_given_at)
values ('00000000-0000-4000-a000-0000000000a1', 'CC', '1.023.456.789', '1993-04-18', '+57 310 555 1234', 'Bogotá', 'union-libre', 'O+', 'indefinido', now());
insert into public.dependents (user_id, full_name, relationship, birth_date, lives_together)
values ('00000000-0000-4000-a000-0000000000a1', 'Martín Rivera', 'hijo', '2019-09-02', true);
insert into public.emergency_contacts (user_id, full_name, relationship, phone)
values ('00000000-0000-4000-a000-0000000000a1', 'Rosa Delgado', 'Madre', '+57 311 555 9876');
insert into public.personal_preferences (user_id, diet, shirt_size, hobbies)
values ('00000000-0000-4000-a000-0000000000a1', 'vegetariano', 'M', 'Ilustración, senderismo');

-- Perfil profesional demo
insert into public.education (user_id, title, institution, location, level, start_date, end_date, description) values
  ('00000000-0000-4000-a000-0000000000a1', 'Diseño Gráfico', 'Universidad Nacional de Colombia', 'Bogotá', 'pregrado', '2011-01-15', '2016-06-30', 'Énfasis en diseño digital y sistemas de diseño.'),
  ('00000000-0000-4000-a000-0000000000a1', 'Certificación WCAG 2.1', 'IAAP', 'Remoto', 'certificacion', '2025-01-10', '2025-03-15', 'Accesibilidad web profesional.');
insert into public.work_experience (user_id, company, position, start_date, end_date, description) values
  ('00000000-0000-4000-a000-0000000000a1', 'Agencia Pixel', 'UI Designer', '2016-08-01', '2024-09-30', 'Diseño de interfaces para clientes de banca y retail.');
insert into public.recognitions (user_id, title, granted_by, date_granted, description, is_internal) values
  ('00000000-0000-4000-a000-0000000000a1', 'Mejor aporte al Design System', 'Equipo de Producto', '2025-12-15', 'Por el sistema de tokens que aceleró al equipo completo.', true);
