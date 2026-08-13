-- ============================================================
-- Migración 0014: Evaluación de desempeño 360 (Estrategia 2026-1)
--  · Rol 'talento' (People Ops / Talento Humano) con permisos de
--    configuración de evaluaciones, junto al admin.
--  · Diccionario de competencias: 5 organizacionales (todos),
--    competencias por familia de rol y de liderazgo, con
--    indicadores observables y pregunta cualitativa STAR.
--  · Familias de rol (5) y asignación de familia por persona.
--  · Política de evaluación por ciclo (nº de evaluaciones a pares
--    por persona) con excepciones por usuario.
--  · Asignaciones de evaluación: líder→subordinado (obligatoria),
--    pares dirigidas o aleatorias (solo transversales) y
--    autoevaluación; generación automática + edición manual.
--  · Dimensión humana: preguntas de bienestar/energía en la
--    autoevaluación (sin escala numérica).
-- ============================================================

-- ------------------------------------------------------------
-- 1. ROL 'talento' (People Ops) — se agrega a los CHECK existentes
-- ------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select conrelid::regclass::text as tbl, conname
    from pg_constraint
    where contype = 'c'
      and conrelid in ('public.profiles'::regclass, 'public.user_roles'::regclass,
                       'public.invitations'::regclass)
      and pg_get_constraintdef(oid) like '%role = ANY%'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'talento', 'facilitador', 'colaborador', 'invitado'));
alter table public.user_roles add constraint user_roles_role_check
  check (role in ('admin', 'talento', 'facilitador', 'colaborador', 'invitado'));
alter table public.invitations add constraint invitations_role_check
  check (role in ('admin', 'talento', 'facilitador', 'colaborador', 'invitado'));

-- ¿Puede configurar evaluaciones? (admin general o Talento Humano)
create or replace function public.can_manage_evals()
returns boolean language sql stable security definer set search_path = public as
$$ select public.is_admin() or public.has_role('talento') $$;

-- Talento Humano puede editar perfiles (asignar familia, equipo, cargo)
create policy profiles_talento_update on public.profiles for update to authenticated
  using (public.has_role('talento')) with check (public.has_role('talento'));

-- El trigger de protección ahora permite a Talento cambiar equipo/familia,
-- pero el ROL de plataforma sigue reservado al admin.
create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = public as
$$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar el rol';
  end if;
  if (new.team_id is distinct from old.team_id
      or new.family_id is distinct from old.family_id)
     and not public.can_manage_evals() then
    raise exception 'Solo administración o Talento Humano puede cambiar equipo o familia';
  end if;
  return new;
end
$$;

-- ------------------------------------------------------------
-- 2. FAMILIAS DE ROL (5) Y DICCIONARIO DE COMPETENCIAS
-- ------------------------------------------------------------
create table public.role_families (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.competencies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  comp_type text not null check (comp_type in ('organizacional', 'familia', 'liderazgo')),
  family_id uuid references public.role_families(id) on delete cascade,
  name text not null,
  definition text not null default '',
  -- [{"name": "...", "description": "..."}] comportamientos observables
  indicators jsonb not null default '[]'::jsonb,
  star_question text,          -- pregunta cualitativa (metodología STAR)
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (comp_type <> 'familia' or family_id is not null)
);

-- Familia de rol de cada persona (define sus competencias funcionales)
alter table public.profiles
  add column family_id uuid references public.role_families(id);

-- ------------------------------------------------------------
-- 3. DIMENSIÓN HUMANA (bienestar/energía — sin escala numérica)
-- ------------------------------------------------------------
create table public.wellbeing_questions (
  code text primary key,
  category text not null,
  question text not null,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table public.wellbeing_answers (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_code text not null references public.wellbeing_questions(code) on delete cascade,
  answer text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, user_id, question_code)
);

-- ------------------------------------------------------------
-- 4. POLÍTICA DE EVALUACIÓN POR CICLO + EXCEPCIONES POR USUARIO
-- ------------------------------------------------------------
create table public.cycle_eval_policies (
  cycle_id uuid primary key references public.cycles(id) on delete cascade,
  -- nº de evaluaciones a pares (transversales) que debe completar cada persona
  peer_target int not null default 2 check (peer_target between 0 and 10),
  -- si al generar se completan los cupos faltantes con personas aleatorias
  random_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create table public.eval_policy_overrides (
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  peer_target int not null check (peer_target between 0 and 10),
  primary key (cycle_id, user_id)
);

-- ------------------------------------------------------------
-- 5. ASIGNACIONES DE EVALUACIÓN
--    kind: 'lider' (líder→subordinado: transversales + familia
--          [+ liderazgo si el evaluado lidera]), 'par' (solo
--          transversales), 'auto' (autoevaluación + bienestar)
-- ------------------------------------------------------------
create table public.evaluation_assignments (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  evaluator_id uuid not null references public.profiles(id) on delete cascade,
  evaluatee_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('auto', 'lider', 'par')),
  origin text not null default 'manual' check (origin in ('auto', 'aleatoria', 'manual')),
  status text not null default 'pendiente'
    check (status in ('pendiente', 'en-curso', 'enviada', 'anulada')),
  review_id uuid references public.reviews(id) on delete set null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, evaluator_id, evaluatee_id, kind),
  check (kind <> 'auto' or evaluator_id = evaluatee_id),
  check (kind = 'auto' or evaluator_id <> evaluatee_id)
);

create trigger evaluation_assignments_updated_at
  before update on public.evaluation_assignments
  for each row execute function public.set_updated_at();
create trigger evaluation_assignments_audit
  after insert or update or delete on public.evaluation_assignments
  for each row execute function public.write_audit();
create trigger wellbeing_answers_updated_at
  before update on public.wellbeing_answers
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 6. GENERACIÓN AUTOMÁTICA DE ASIGNACIONES (RPC)
--    · lider→subordinado para toda persona activa con líder
--    · autoevaluación para toda persona activa
--    · pares aleatorias hasta cubrir la meta (política/override),
--      balanceando cuántas evaluaciones recibe cada persona
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
  n int;
begin
  if not public.can_manage_evals() then
    raise exception 'Solo administración o Talento Humano puede generar asignaciones';
  end if;

  insert into cycle_eval_policies (cycle_id, updated_by)
  values (p_cycle, auth.uid())
  on conflict (cycle_id) do nothing;
  select * into pol from cycle_eval_policies where cycle_id = p_cycle;

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

  return jsonb_build_object('lider', n_lider, 'auto', n_auto, 'par', n_par);
end
$$;

-- ------------------------------------------------------------
-- 7. REVIEWS: permitir crear la review desde una asignación
--    (par→'peer', líder→'facilitator', auto→'self') y dar
--    visibilidad del expediente a Talento Humano.
-- ------------------------------------------------------------
create or replace function public.has_assignment(p_cycle uuid, p_evaluatee uuid)
returns boolean language sql stable security definer set search_path = public as
$$
  select exists (
    select 1 from evaluation_assignments a
    where a.cycle_id = p_cycle
      and a.evaluator_id = auth.uid()
      and a.evaluatee_id = p_evaluatee
      and a.status <> 'anulada'
  )
$$;

create policy reviews_insert_assigned on public.reviews for insert to authenticated
  with check (reviewer_id = auth.uid() and public.has_assignment(cycle_id, evaluatee_id));
create policy reviews_talento_select on public.reviews for select to authenticated
  using (public.has_role('talento'));
create policy review_items_talento_select on public.review_items for select to authenticated
  using (public.has_role('talento'));

-- ------------------------------------------------------------
-- 8. ROW LEVEL SECURITY
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['role_families', 'competencies', 'wellbeing_questions',
                           'wellbeing_answers', 'cycle_eval_policies',
                           'eval_policy_overrides', 'evaluation_assignments'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Diccionario: lectura para autenticados; escritura admin/talento
create policy families_select on public.role_families for select to authenticated using (true);
create policy families_manage on public.role_families for all to authenticated
  using (can_manage_evals()) with check (can_manage_evals());
create policy competencies_select on public.competencies for select to authenticated using (true);
create policy competencies_manage on public.competencies for all to authenticated
  using (can_manage_evals()) with check (can_manage_evals());
create policy wq_select on public.wellbeing_questions for select to authenticated using (true);
create policy wq_manage on public.wellbeing_questions for all to authenticated
  using (can_manage_evals()) with check (can_manage_evals());

-- Bienestar: el dueño escribe; lo ven dueño, su cadena de liderazgo y TH
create policy wa_select on public.wellbeing_answers for select to authenticated
  using (user_id = auth.uid() or is_manager_of(user_id) or can_manage_evals());
create policy wa_insert on public.wellbeing_answers for insert to authenticated
  with check (user_id = auth.uid());
create policy wa_update on public.wellbeing_answers for update to authenticated
  using (user_id = auth.uid());
create policy wa_delete on public.wellbeing_answers for delete to authenticated
  using (user_id = auth.uid() or is_admin());

-- Política: lectura autenticados (cada quien puede ver la meta); escritura admin/talento
create policy pol_select on public.cycle_eval_policies for select to authenticated using (true);
create policy pol_manage on public.cycle_eval_policies for all to authenticated
  using (can_manage_evals()) with check (can_manage_evals());
create policy ovr_select on public.eval_policy_overrides for select to authenticated
  using (user_id = auth.uid() or can_manage_evals());
create policy ovr_manage on public.eval_policy_overrides for all to authenticated
  using (can_manage_evals()) with check (can_manage_evals());

-- Asignaciones: el evaluador ve las suyas; la cadena de liderazgo del
-- evaluador ve las de su equipo; admin/talento gestiona todo.
-- (El evaluado NO ve quién lo evalúa como par — protege el anonimato.)
create policy ea_select on public.evaluation_assignments for select to authenticated
  using (evaluator_id = auth.uid() or is_manager_of(evaluator_id) or can_manage_evals());
create policy ea_manage on public.evaluation_assignments for all to authenticated
  using (can_manage_evals()) with check (can_manage_evals());
-- El evaluador actualiza el estado de su asignación (en-curso/enviada + review)
create policy ea_evaluator_update on public.evaluation_assignments for update to authenticated
  using (evaluator_id = auth.uid()) with check (evaluator_id = auth.uid());

-- ------------------------------------------------------------
-- 9. SEED — Familias de rol (Estrategia 2026-1 §2)
-- ------------------------------------------------------------
insert into public.role_families (id, key, name, description, sort_order) values
  ('00000000-0000-4000-f000-000000000001', 'consultoria', 'Consultoría / Pedagogía / Proyectos',
   'Líder de Asocios, Asociador, Project Manager, Asesoría pedagógica.', 1),
  ('00000000-0000-4000-f000-000000000002', 'creativo', 'Creativo / Contenido',
   'Diseño gráfico y multimedia.', 2),
  ('00000000-0000-4000-f000-000000000003', 'operaciones', 'Operaciones / Administrativo / Financiero',
   'Liderazgo financiero y administrativo, contaduría, gestión administrativa de proyectos.', 3),
  ('00000000-0000-4000-f000-000000000004', 'tecnologia', 'Tecnología',
   'Análisis y soporte tecnológico.', 4),
  ('00000000-0000-4000-f000-000000000005', 'liderazgo', 'Liderazgo',
   'CEO y líderes de área (las competencias de liderazgo complementan a las funcionales).', 5);

-- ------------------------------------------------------------
-- 10. SEED — Competencias organizacionales (TODOS, transversales)
-- ------------------------------------------------------------
insert into public.competencies (code, comp_type, name, definition, indicators, star_question, sort_order) values
('org-autogestion', 'organizacional', 'Autogestión y accountability',
 'Capacidad para organizar el trabajo diario, honrar los compromisos adquiridos y asumir la responsabilidad total de los resultados, demostrando un alto nivel de autonomía y confiabilidad en un entorno de trabajo a distancia.',
 '[{"name":"Cumple tiempos y entregables sin supervisión constante","description":"Ejecuta sus tareas dentro de los plazos acordados, sin necesidad de micromanagement o recordatorios frecuentes."},
   {"name":"Prioriza adecuadamente las tareas","description":"Distingue entre lo urgente y lo importante, enfocando su energía en las actividades de mayor valor."},
   {"name":"Da seguimiento a compromisos","description":"Mantiene el control sobre las tareas delegadas o en pausa y las lleva hasta su conclusión."},
   {"name":"Escala problemas oportunamente","description":"Levanta la mano de forma preventiva ante riesgos, bloqueos o retrasos inminentes."}]'::jsonb,
 'Describe una situación reciente en la que esta persona tuvo que manejar múltiples prioridades urgentes de forma autónoma. ¿Qué acciones tomó para organizar su trabajo y cumplir con los compromisos?', 1),
('org-comunicacion', 'organizacional', 'Comunicación efectiva y consciente',
 'Habilidad para transmitir ideas de manera clara, empática y en el momento oportuno, logrando adaptarse a los distintos interlocutores y maximizando el uso de las herramientas de la virtualidad.',
 '[{"name":"Comunica de forma clara y estructurada","description":"Redacta y verbaliza sus ideas de manera directa y concisa, evitando ambigüedades que generen reprocesos."},
   {"name":"Escucha activamente","description":"Presta atención plena y hace preguntas para confirmar que comprendió antes de actuar o responder."},
   {"name":"Adapta su mensaje al interlocutor","description":"Ajusta tono, nivel técnico y enfoque según hable con un aliado externo, un líder o un compañero."},
   {"name":"Documenta y deja trazabilidad","description":"Registra acuerdos, avances y decisiones clave en las plataformas del equipo."}]'::jsonb,
 'Relata un momento en el que hubo un malentendido, falta de claridad o un desafío de comunicación en un proyecto. ¿Cómo intervino esta persona para aclarar el mensaje y qué impacto tuvo en la dinámica del equipo?', 2),
('org-colaboracion', 'organizacional', 'Colaboración y co-creación',
 'Disposición y habilidad para trabajar de forma articulada con otros compañeros, impulsando la construcción conjunta de soluciones y fomentando relaciones de confianza que fortalezcan el tejido del equipo remoto.',
 '[{"name":"Comparte información oportunamente","description":"Pone a disposición del equipo recursos, datos o hallazgos relevantes de manera proactiva."},
   {"name":"Apoya a otros en momentos clave","description":"Ofrece ayuda y conocimiento cuando un compañero enfrenta picos de trabajo o bloqueos."},
   {"name":"Construye sobre ideas del equipo","description":"Apoya las propuestas de sus compañeros como punto de partida para mejorarlas en conjunto."},
   {"name":"Genera relaciones positivas","description":"Mantiene una actitud constructiva y de buen trato, contribuyendo a un clima laboral sano."}]'::jsonb,
 'Comparte un ejemplo en el que esta persona haya ido más allá de sus responsabilidades para destrabar o apoyar el trabajo de un compañero. ¿Qué hizo específicamente y cómo sumó al resultado conjunto?', 3),
('org-resultados', 'organizacional', 'Orientación a resultados con propósito',
 'Capacidad para ejecutar su trabajo con un alto estándar de calidad, asegurando que cada meta cumplida esté directamente alineada con los objetivos estratégicos y el impacto de la compañía.',
 '[{"name":"Cumple objetivos definidos","description":"Alcanza consistentemente las metas cuantitativas y cualitativas asignadas para el ciclo."},
   {"name":"Cuida la calidad de los entregables","description":"Entrega productos pulidos, minimizando correcciones y revisiones de terceros."},
   {"name":"Entiende el impacto de su trabajo","description":"Comprende cómo sus tareas contribuyen al éxito general, con sentido de propósito."},
   {"name":"Propone mejoras","description":"Sugiere proactivamente ajustes en procesos o herramientas para trabajar mejor."}]'::jsonb,
 'Menciona un entregable o proyecto donde consideres que esta persona aportó un valor excepcional o superó las expectativas. ¿Qué detalles cuidó o qué esfuerzo adicional implementó para lograr ese nivel de calidad?', 4),
('org-aprendizaje', 'organizacional', 'Aprendizaje continuo y adaptabilidad',
 'Disposición permanente para actualizar conocimientos, adquirir nuevas habilidades y navegar con flexibilidad los cambios de contexto, mostrando siempre una actitud proactiva y resiliente.',
 '[{"name":"Busca aprender constantemente","description":"Se capacita por iniciativa propia en temas relevantes para su rol."},
   {"name":"Aplica nuevos conocimientos","description":"Integra nuevas metodologías o herramientas en sus rutinas para mejorar su desempeño."},
   {"name":"Se adapta a cambios de contexto","description":"Asimila positivamente giros de proyecto, reestructuraciones o nuevas directrices."},
   {"name":"Recibe feedback constructivamente","description":"Escucha áreas de mejora con apertura y las usa como insumo real para evolucionar."}]'::jsonb,
 'Describe cómo reaccionó esta persona frente a un cambio de contexto reciente (un giro en un proyecto, una nueva herramienta o un feedback de mejora). ¿Cómo adaptó su forma de trabajo a esta nueva realidad?', 5);

-- ------------------------------------------------------------
-- 11. SEED — Competencias por familia de rol
-- ------------------------------------------------------------
insert into public.competencies (code, comp_type, family_id, name, definition, indicators, star_question, sort_order) values
-- A. Consultoría / Pedagogía / Proyectos
('fam-a-estrategia', 'familia', '00000000-0000-4000-f000-000000000001', 'Pensamiento estratégico',
 'Capacidad para analizar el entorno y las necesidades de los clientes (internos o externos) con una visión integral, proponiendo soluciones estructuradas de alto impacto alineadas con los objetivos de Innovahub.',
 '[{"name":"Comprende el contexto del cliente","description":"Investiga, hace preguntas clave y analiza a profundidad la situación antes de definir una ruta de acción."},
   {"name":"Conecta soluciones con necesidades reales","description":"Diseña propuestas que resuelven el dolor o la expectativa central del proyecto."},
   {"name":"Anticipa riesgos y oportunidades","description":"Identifica cuellos de botella antes de que ocurran y detecta espacios para maximizar el éxito."}]'::jsonb,
 null, 10),
('fam-a-proyectos', 'familia', '00000000-0000-4000-f000-000000000001', 'Gestión de proyectos',
 'Habilidad para estructurar, ejecutar y monitorear iniciativas de principio a fin, garantizando el cumplimiento de los objetivos de manera organizada, autónoma y visible para todos los involucrados.',
 '[{"name":"Planifica y organiza entregables","description":"Desglosa requerimientos complejos en tareas claras con hitos, prioridades y cronogramas realistas."},
   {"name":"Hace seguimiento efectivo","description":"Monitorea el avance dejando trazabilidad y comunicando el estado a los stakeholders."},
   {"name":"Gestiona tiempos y recursos","description":"Optimiza las plataformas disponibles, cumple plazos y articula el esfuerzo de otros sin sobrecargas."}]'::jsonb,
 null, 11),
('fam-a-stakeholders', 'familia', '00000000-0000-4000-f000-000000000001', 'Relacionamiento estratégico',
 'Construye relaciones sólidas y transparentes con las personas que impactan o se ven impactadas por su trabajo, ya sean usuarios externos, aliados o compañeros de otros equipos internos.',
 '[{"name":"Genera confianza","description":"A través del cumplimiento de acuerdos, la empatía y la comunicación transparente con su red de trabajo."},
   {"name":"Gestiona expectativas","description":"Alinea proactivamente a las partes sobre tiempos, alcances reales y posibles obstáculos."},
   {"name":"Maneja conversaciones difíciles","description":"Aborda desacuerdos y cuellos de botella con asertividad y enfoque en soluciones."}]'::jsonb,
 'Describe una situación en la que esta persona tuvo que gestionar un obstáculo, un retraso o una expectativa poco realista con un stakeholder (interno o externo). ¿Cómo manejó la conversación y qué acuerdos logró?', 12),
-- B. Creativo / Contenido
('fam-b-creatividad', 'familia', '00000000-0000-4000-f000-000000000002', 'Creatividad aplicada',
 'Habilidad para generar conceptos originales y soluciones visuales o narrativas que no solo destaquen estéticamente, sino que respondan estratégicamente a las necesidades de comunicación del proyecto.',
 '[{"name":"Propone ideas innovadoras","description":"Va más allá de las solicitudes básicas, explorando nuevos formatos, tendencias o enfoques creativos."},
   {"name":"Traduce conceptos en piezas visuales","description":"Convierte ideas abstractas o información compleja en recursos gráficos claros y atractivos."},
   {"name":"Aporta valor creativo al proyecto","description":"Sus intervenciones elevan la calidad general del entregable como componente estratégico del mensaje."}]'::jsonb,
 'Comparte un ejemplo en el que esta persona haya recibido un requerimiento básico y lo haya transformado en una pieza o concepto que elevó el impacto del mensaje. ¿Qué valor visual o conceptual agregó?', 20),
('fam-b-calidad', 'familia', '00000000-0000-4000-f000-000000000002', 'Calidad técnica',
 'Garantiza un alto nivel de excelencia técnica y estética en todos los entregables, asegurando que los productos visuales o multimedia cumplan con los estándares profesionales y la identidad de la empresa.',
 '[{"name":"Maneja herramientas con dominio","description":"Utiliza el software de diseño o edición de manera eficiente y actualizada."},
   {"name":"Entrega piezas bien ejecutadas","description":"Produce resultados pulidos, optimizados y libres de errores técnicos, ortográficos o de formato."},
   {"name":"Cuida los detalles","description":"Atiende la estética, coherencia visual, alineación y resolución antes de finalizar una entrega."}]'::jsonb,
 null, 21),
('fam-b-brief', 'familia', '00000000-0000-4000-f000-000000000002', 'Interpretación de brief',
 'Capacidad para asimilar, analizar y procesar instrucciones o requerimientos iniciales, traduciéndolos en entregables creativos que cumplen con precisión el objetivo estratégico solicitado.',
 '[{"name":"Comprende requerimientos","description":"Analiza las instrucciones a fondo y solicita aclaraciones si existen vacíos antes de ejecutar."},
   {"name":"Alinea entregables a objetivos","description":"Asegura que el producto final responda al propósito planteado sin desviar el enfoque."},
   {"name":"Ajusta según feedback","description":"Itera sobre el trabajo aplicando los cambios solicitados de forma rápida y precisa."}]'::jsonb,
 null, 22),
-- C. Operaciones / Administrativo / Financiero
('fam-c-organizacion', 'familia', '00000000-0000-4000-f000-000000000003', 'Organización y control',
 'Capacidad para estructurar, mantener y supervisar la información y los procesos del área, garantizando eficiencia, exactitud y trazabilidad en la ejecución de las tareas diarias de Innovahub.',
 '[{"name":"Maneja información ordenadamente","description":"Clasifica, documenta y resguarda la información clave para fácil acceso del equipo."},
   {"name":"Cumple procesos","description":"Sigue rigurosamente lineamientos, políticas y flujos de trabajo establecidos."},
   {"name":"Minimiza errores","description":"Revisa meticulosamente datos, reportes y entregables antes de finalizarlos."}]'::jsonb,
 null, 30),
('fam-c-financiera', 'familia', '00000000-0000-4000-f000-000000000003', 'Gestión financiera / administrativa',
 'Administra de manera eficiente y transparente los recursos, procesos y registros de la empresa, asegurando el cumplimiento legal y la sostenibilidad del negocio.',
 '[{"name":"Controla recursos","description":"Gestiona presupuestos, compras y gastos velando por la salud financiera."},
   {"name":"Asegura cumplimiento normativo","description":"Garantiza que las operaciones contables y contractuales se ajusten a la normativa vigente."},
   {"name":"Optimiza procesos","description":"Identifica oportunidades para reducir costos, simplificar trámites o mejorar flujos del área."}]'::jsonb,
 null, 31),
('fam-c-soporte', 'familia', '00000000-0000-4000-f000-000000000003', 'Soporte al negocio',
 'Actúa como un habilitador clave para el resto de los equipos, garantizando que cuenten con el respaldo operativo necesario para ejecutar los proyectos sin contratiempos.',
 '[{"name":"Facilita la operación del equipo","description":"Remueve bloqueos administrativos y gestiona soluciones logísticas ágiles."},
   {"name":"Responde oportunamente","description":"Atiende solicitudes internas dentro de los tiempos esperados, generando confianza."},
   {"name":"Propone mejoras operativas","description":"Sugiere ajustes proactivos para que la operación sea más fluida en el entorno remoto."}]'::jsonb,
 'Menciona un momento en el que recurriste a esta persona para resolver un cuello de botella logístico, financiero o administrativo. ¿Cómo fue su nivel de respuesta y qué solución implementó para facilitar tu trabajo?', 32),
-- D. Tecnología
('fam-d-problemas', 'familia', '00000000-0000-4000-f000-000000000004', 'Resolución de problemas técnicos',
 'Capacidad para identificar, analizar y solucionar incidencias tecnológicas de manera ágil y definitiva, garantizando la continuidad del trabajo remoto del equipo.',
 '[{"name":"Diagnostica fallas","description":"Identifica la causa raíz de problemas de hardware, software o conectividad con análisis estructurado."},
   {"name":"Da soluciones efectivas","description":"Implementa correcciones de fondo, evitando que la misma falla se repita."},
   {"name":"Minimiza impacto","description":"Actúa con urgencia ante caídas o bloqueos, reduciendo el tiempo de inactividad."}]'::jsonb,
 null, 40),
('fam-d-usuario', 'familia', '00000000-0000-4000-f000-000000000004', 'Orientación al usuario',
 'Habilidad para brindar soporte técnico de manera empática, traduciendo el lenguaje técnico a términos sencillos y asegurando una experiencia positiva para el colaborador.',
 '[{"name":"Explica de forma clara","description":"Comunica soluciones paso a paso sin tecnicismos innecesarios."},
   {"name":"Acompaña con paciencia","description":"Mantiene una actitud de servicio amable hasta resolver completamente la necesidad."},
   {"name":"Prioriza necesidades del usuario","description":"Organiza sus tiempos de respuesta según el impacto de la falla en los entregables."}]'::jsonb,
 null, 41),
('fam-d-plataformas', 'familia', '00000000-0000-4000-f000-000000000004', 'Gestión de plataformas',
 'Administra, mantiene y mejora las herramientas tecnológicas de la empresa, asegurando que el ecosistema digital sea estable, seguro y eficiente para todos.',
 '[{"name":"Mantiene estabilidad","description":"Realiza revisiones periódicas y monitorea el rendimiento de sistemas y accesos."},
   {"name":"Optimiza herramientas","description":"Configura y actualiza el software proponiendo mejoras que faciliten el trabajo remoto."},
   {"name":"Documenta procesos","description":"Crea y actualiza manuales y bases de conocimiento que fomentan la autogestión."}]'::jsonb,
 null, 42);

-- ------------------------------------------------------------
-- 12. SEED — Competencias de liderazgo (solo líderes)
-- ------------------------------------------------------------
insert into public.competencies (code, comp_type, family_id, name, definition, indicators, star_question, sort_order) values
('lid-consciente', 'liderazgo', '00000000-0000-4000-f000-000000000005', 'Liderazgo consciente',
 'Capacidad para guiar al equipo desde la empatía y la coherencia, promoviendo un entorno de seguridad psicológica que valore tanto los resultados como el componente humano en la virtualidad.',
 '[{"name":"Inspira desde el ejemplo","description":"Actúa con integridad y coherencia con los valores de Innovahub, modelando lo que espera del equipo."},
   {"name":"Genera confianza","description":"Construye relaciones transparentes, delegando con responsabilidad y respaldando a su gente."},
   {"name":"Cuida el bienestar del equipo","description":"Mantiene un radar activo sobre energía y carga laboral, promoviendo equilibrio sano."}]'::jsonb,
 'Relata un momento en el que este líder haya demostrado preocupación genuina por el equilibrio, la carga laboral o el bienestar emocional de alguien del equipo. ¿Qué decisiones tomó para respaldar esa preocupación?', 50),
('lid-talento', 'liderazgo', '00000000-0000-4000-f000-000000000005', 'Desarrollo de talento',
 'Habilidad para potenciar las capacidades de su equipo, brindando orientación continua y creando oportunidades reales para el crecimiento profesional y personal.',
 '[{"name":"Da feedback frecuente","description":"Retroalimenta de forma oportuna, constructiva y específica, reconociendo y corrigiendo a tiempo."},
   {"name":"Acompaña el crecimiento","description":"Construye y da seguimiento a planes de desarrollo, retando al equipo con nuevos aprendizajes."},
   {"name":"Identifica potencial","description":"Reconoce fortalezas únicas y promueve espacios donde cada persona maximice su impacto."}]'::jsonb,
 'Comparte una situación en la que este líder te haya dado una retroalimentación difícil pero constructiva, o te haya retado a asumir un nuevo desafío. ¿Cómo estructuró ese acompañamiento y qué crecimiento detonó en ti?', 51),
('lid-decisiones', 'liderazgo', '00000000-0000-4000-f000-000000000005', 'Toma de decisiones',
 'Capacidad para elegir el mejor curso de acción frente a diferentes escenarios, balanceando la urgencia operativa con el rigor analítico.',
 '[{"name":"Analiza información","description":"Recopila datos, consulta expertos y evalúa pros y contras antes de decidir."},
   {"name":"Decide oportunamente","description":"Actúa con agilidad ante bloqueos o crisis, evitando la parálisis por análisis."},
   {"name":"Asume consecuencias","description":"Se responsabiliza de los resultados de sus decisiones y aprende de ellos."}]'::jsonb,
 'Describe un momento de alta incertidumbre o donde un proyecto estaba bloqueado. ¿Cómo analizó la situación este líder y de qué manera la decisión que tomó dio claridad y rumbo al equipo?', 52),
('lid-vision', 'liderazgo', '00000000-0000-4000-f000-000000000005', 'Visión estratégica',
 'Habilidad para proyectar el futuro del área o de la empresa, conectando las acciones del día a día con el propósito a largo plazo de la compañía.',
 '[{"name":"Define un rumbo claro","description":"Establece metas y prioridades comprensibles que guían el esfuerzo colectivo."},
   {"name":"Alinea al equipo con objetivos","description":"Asegura que cada persona entienda cómo su rol contribuye al panorama general."},
   {"name":"Detecta oportunidades","description":"Identifica tendencias y nuevas vías de acción para impulsar la evolución de la organización."}]'::jsonb,
 'Describe un momento de alta incertidumbre o donde un proyecto estaba bloqueado. ¿Cómo analizó la situación este líder y de qué manera la decisión que tomó dio claridad y rumbo al equipo?', 53),
('lid-cambio', 'liderazgo', '00000000-0000-4000-f000-000000000005', 'Gestión del cambio',
 'Capacidad para impulsar y acompañar a la organización durante las transiciones, asegurando que las nuevas herramientas, políticas o estructuras se adopten con éxito.',
 '[{"name":"Lidera transformaciones","description":"Promueve activamente las nuevas iniciativas, guiando del estado actual al deseado."},
   {"name":"Comunica cambios","description":"Transmite los porqués de cada ajuste de forma transparente y anticipada."},
   {"name":"Reduce resistencia","description":"Escucha preocupaciones frente a los cambios y ofrece soporte para la adaptación."}]'::jsonb,
 null, 54);

-- ------------------------------------------------------------
-- 13. SEED — Dimensión humana (batería de bienestar, autoevaluación)
-- ------------------------------------------------------------
insert into public.wellbeing_questions (code, category, question, sort_order) values
('bienestar-energia', 'Balance energético',
 'Pensando en tu rol actual, ¿qué tipo de tareas, dinámicas o proyectos te están dando mayor energía y entusiasmo en tu día a día?', 1),
('bienestar-desgaste', 'Balance energético',
 'Por el contrario, ¿qué situaciones, procesos o tareas sientes que te están drenando la energía o generando mayor fricción operativa?', 2),
('bienestar-proposito', 'Conexión con el propósito',
 '¿Sientes que el trabajo que realizas actualmente te permite conectar con tu propósito profesional y aportar un valor significativo a los objetivos de Innovahub? Por favor, amplía brevemente tu respuesta.', 3),
('bienestar-soporte', 'Bienestar y soporte en la virtualidad',
 'Para asegurar que tu experiencia de trabajo remoto sea sostenible y saludable, ¿qué acción específica podría implementar tu líder o el equipo para apoyar mejor tu equilibrio en los próximos 6 meses?', 4);

-- ------------------------------------------------------------
-- 14. SEED — Familia demo por tipo de rol existente
-- ------------------------------------------------------------
update public.profiles set family_id = '00000000-0000-4000-f000-000000000002' where role_type = 'designer';
update public.profiles set family_id = '00000000-0000-4000-f000-000000000004' where role_type = 'engineer';
update public.profiles set family_id = '00000000-0000-4000-f000-000000000001' where role_type = 'marketing';
update public.profiles set family_id = '00000000-0000-4000-f000-000000000003' where family_id is null;
