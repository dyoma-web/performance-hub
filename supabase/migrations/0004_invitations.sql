-- ============================================================
-- Módulo Personas — Migración 0004: invitaciones de usuarios
-- El admin registra la invitación; cuando la persona se registra
-- con ese email, su perfil nace pre-asignado (rol, área, equipo,
-- jefe, cargo) vía trigger — sin exponer la service key.
-- ============================================================

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  role text not null default 'colaborador'
    check (role in ('admin', 'facilitador', 'colaborador', 'invitado')),
  extra_roles text[] not null default '{}',
  area_id uuid references public.areas(id),
  team_id uuid references public.teams(id),
  manager_id uuid references public.profiles(id),
  position_id uuid references public.positions(id),
  position_title text,
  role_type text not null default 'default',
  invited_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create unique index invitations_email_pending
  on public.invitations (lower(email)) where accepted_at is null;

alter table public.invitations enable row level security;
create policy inv_admin on public.invitations for all to authenticated
  using (is_admin()) with check (is_admin());

create trigger invitations_audit after insert or update or delete on public.invitations
  for each row execute function public.write_audit();

-- handle_new_user ahora aplica la invitación pendiente del email (si existe)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as
$$
declare
  inv record;
  display_name text;
begin
  select * into inv
  from invitations
  where lower(email) = lower(new.email) and accepted_at is null
  limit 1;

  display_name := coalesce(new.raw_user_meta_data ->> 'name', inv.name, split_part(new.email, '@', 1));

  insert into public.profiles (id, email, name, avatar, role, team_id, area_id, manager_id, position, role_type)
  values (
    new.id,
    new.email,
    display_name,
    upper(left(display_name, 2)),
    coalesce(inv.role, 'colaborador'),
    inv.team_id,
    inv.area_id,
    inv.manager_id,
    inv.position_title,
    coalesce(inv.role_type, 'default')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, coalesce(inv.role, 'colaborador'))
  on conflict do nothing;

  if inv.id is not null then
    if array_length(inv.extra_roles, 1) > 0 then
      insert into public.user_roles (user_id, role)
      select new.id, r from unnest(inv.extra_roles) as r
      on conflict do nothing;
    end if;
    if inv.position_id is not null then
      insert into public.position_assignments (user_id, position_id, is_primary)
      values (new.id, inv.position_id, true)
      on conflict do nothing;
    end if;
    update invitations set accepted_at = now() where id = inv.id;
  end if;

  return new;
end
$$;
