-- ============================================================
-- Migración 0007: descripciones en áreas y equipos + borrado
-- seguro de equipos (referencias quedan sin equipo, no bloquean)
-- ============================================================

alter table public.areas add column description text;
alter table public.teams add column description text;

-- Eliminar un equipo no debe bloquearse: personas e invitaciones
-- quedan "sin equipo"; subequipos pasan a raíz
alter table public.profiles drop constraint profiles_team_id_fkey;
alter table public.profiles
  add constraint profiles_team_id_fkey
  foreign key (team_id) references public.teams(id) on delete set null;

alter table public.invitations drop constraint invitations_team_id_fkey;
alter table public.invitations
  add constraint invitations_team_id_fkey
  foreign key (team_id) references public.teams(id) on delete set null;

alter table public.teams drop constraint teams_parent_team_id_fkey;
alter table public.teams
  add constraint teams_parent_team_id_fkey
  foreign key (parent_team_id) references public.teams(id) on delete set null;

-- Auditoría sobre equipos y cargos (areas ya estaba auditada)
do $$
declare t text;
begin
  foreach t in array array['teams', 'positions'] loop
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I
       for each row execute function public.write_audit()', t, t);
  end loop;
end $$;
