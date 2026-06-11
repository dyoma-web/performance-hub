-- ============================================================
-- Migración 0006: mascotas, núcleo familiar, convivencia y
-- celebraciones con consentimiento individual.
-- Principio: nunca inferir — preguntar. Que vivir solo no
-- signifique "sin familia" y que ninguna celebración se asuma.
-- ============================================================

-- MASCOTAS (dato personal: dueño + TH)
create table public.pets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  species text not null check (species in ('perro', 'gato', 'ave', 'pez', 'roedor', 'reptil', 'otro')),
  breed text,
  birth_date date,
  notes text,
  created_at timestamptz not null default now()
);

-- NÚCLEO FAMILIAR CERCANO ≠ CONVIVENCIA
-- is_core_family: pertenece al núcleo cercano aunque no conviva (ej: padres)
alter table public.dependents
  add column is_core_family boolean not null default true;

-- ¿Con quién vive? (independiente de si tiene o no familia)
alter table public.personal_info
  add column household text
  check (household in ('solo', 'pareja', 'familia', 'compartido', 'otro'));

-- CELEBRACIONES: catálogo configurable + preferencia individual
-- (dato sensible: puede revelar convicciones religiosas/ideológicas -> dueño + TH)
create table public.celebrations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  date_hint text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.celebration_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  celebration_id uuid not null references public.celebrations(id) on delete cascade,
  participates boolean not null,
  extends_to_family boolean,          -- ej: "mis hijos tampoco lo celebran"
  notes text,
  updated_at timestamptz not null default now(),
  primary key (user_id, celebration_id)
);

create trigger celebration_preferences_updated_at
  before update on public.celebration_preferences
  for each row execute function public.set_updated_at();

-- RLS
alter table public.pets enable row level security;
alter table public.celebrations enable row level security;
alter table public.celebration_preferences enable row level security;

do $$
declare t text;
begin
  foreach t in array array['pets', 'celebration_preferences'] loop
    execute format('create policy %I_owner_sel on public.%I for select to authenticated using (user_id = auth.uid() or is_admin())', t, t);
    execute format('create policy %I_owner_ins on public.%I for insert to authenticated with check (user_id = auth.uid() or is_admin())', t, t);
    execute format('create policy %I_owner_upd on public.%I for update to authenticated using (user_id = auth.uid() or is_admin())', t, t);
    execute format('create policy %I_owner_del on public.%I for delete to authenticated using (user_id = auth.uid() or is_admin())', t, t);
  end loop;
end $$;

create policy celebrations_select on public.celebrations for select to authenticated using (true);
create policy celebrations_admin on public.celebrations for all to authenticated
  using (is_admin()) with check (is_admin());

-- LÍNEAS BASE / HISTORIAL: auditoría sobre TODO el perfil
-- (personal_info, dependents, emergency_contacts ya estaban auditados en 0003)
do $$
declare t text;
begin
  foreach t in array array['personal_preferences', 'pets', 'celebration_preferences',
                           'education', 'work_experience', 'recognitions',
                           'professional_references', 'profile_documents'] loop
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I
       for each row execute function public.write_audit()', t, t);
  end loop;
end $$;

-- Catálogo inicial de celebraciones (editable por People Ops)
insert into public.celebrations (name, description, date_hint, sort_order) values
  ('Halloween', 'Disfraces y dulces; algunas familias no lo celebran por convicciones.', '31 de octubre', 1),
  ('Navidad', 'Celebración de fin de año; puede tener connotación religiosa.', 'Diciembre', 2),
  ('Día de las Velitas', 'Tradición colombiana de diciembre.', '7 de diciembre', 3),
  ('Semana Santa', 'Celebración religiosa.', 'Marzo/Abril', 4),
  ('Día de la Familia', 'Jornada de integración familiar — la familia es como cada quien la define.', 'Variable', 5),
  ('Amor y Amistad', 'Celebración de septiembre en Colombia.', 'Septiembre', 6),
  ('Año Nuevo', 'Recibimiento del año.', '31 de diciembre', 7);
