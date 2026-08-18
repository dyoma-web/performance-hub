-- ============================================================
-- Migración 0018: privacidad estricta, auditoría ampliada y buzón
--  · Visibilidad: más allá de nombre/cargo, la información de las
--    personas (personal, profesional, HV, contactos) solo la ven el
--    dueño y admin/Talento Humano. Se retira el acceso de la cadena
--    de liderazgo.
--  · Auditoría: acceso para admin/TH; se auditan además profiles,
--    política de evaluación, excepciones y reglas de notificación.
--    (reviews, review_items, asignaciones, ciclos, calibraciones,
--    objetivos y datos sensibles ya se auditaban desde 0001/0003.)
--  · Buzón de retroalimentación: texto + imágenes adjuntas (bucket
--    privado); escriben todos, leen admin/TH.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PRIVACIDAD
-- ------------------------------------------------------------
-- "Profesional" (educación, experiencia, reconocimientos, docs,
-- historial interno, ratings): dueño + admin/TH
create or replace function public.can_view_professional(target uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select target = auth.uid() or public.can_manage_evals() $$;

-- "Personal/sensible" (identificación, dependientes, contactos de
-- emergencia, preferencias, referencias, mascotas...): dueño + admin/TH.
-- Se recrean dinámicamente todas las policies de lectura *_owner_sel.
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public' and policyname like '%\_owner\_sel' escape '\'
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    execute format(
      'create policy %I on %I.%I for select to authenticated
       using (user_id = auth.uid() or public.can_manage_evals())',
      r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 2. AUDITORÍA
-- ------------------------------------------------------------
drop policy audit_select on public.audit_log;
create policy audit_select on public.audit_log for select to authenticated
  using (public.can_manage_evals());

-- Cobertura adicional relevante para auditoría/rollback
do $$
declare t text;
begin
  foreach t in array array['profiles', 'cycle_eval_policies',
                           'eval_policy_overrides', 'notification_rules'] loop
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I
       for each row execute function public.write_audit()', t, t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 3. BUZÓN DE RETROALIMENTACIÓN
-- ------------------------------------------------------------
create table public.platform_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(trim(message)) >= 5),
  -- rutas en el bucket privado 'feedback'
  images text[] not null default '{}',
  page text,
  created_at timestamptz not null default now()
);

alter table public.platform_feedback enable row level security;
create policy pf_insert on public.platform_feedback for insert to authenticated
  with check (user_id = auth.uid());
create policy pf_select on public.platform_feedback for select to authenticated
  using (user_id = auth.uid() or public.can_manage_evals());
create policy pf_delete on public.platform_feedback for delete to authenticated
  using (public.is_admin());

insert into storage.buckets (id, name, public)
values ('feedback', 'feedback', false)
on conflict (id) do nothing;

do $$
begin
  execute $pol$
    create policy "feedback_upload" on storage.objects for insert to authenticated
    with check (bucket_id = 'feedback' and (storage.foldername(name))[1] = auth.uid()::text)
  $pol$;
  execute $pol$
    create policy "feedback_read" on storage.objects for select to authenticated
    using (bucket_id = 'feedback'
           and ((storage.foldername(name))[1] = auth.uid()::text or public.can_manage_evals()))
  $pol$;
exception when insufficient_privilege then
  raise notice 'No fue posible crear las policies de storage desde SQL; crearlas en el dashboard.';
end $$;
