-- ============================================================
-- Migración 0005: comportamiento al eliminar áreas
-- Las referencias a un área eliminada quedan en NULL (sin área)
-- en lugar de bloquear el borrado. La reasignación de personas
-- se gestiona en la UI antes de confirmar.
-- ============================================================

alter table public.areas drop constraint areas_parent_area_id_fkey;
alter table public.areas
  add constraint areas_parent_area_id_fkey
  foreign key (parent_area_id) references public.areas(id) on delete set null;

alter table public.profiles drop constraint profiles_area_id_fkey;
alter table public.profiles
  add constraint profiles_area_id_fkey
  foreign key (area_id) references public.areas(id) on delete set null;

alter table public.teams drop constraint teams_area_id_fkey;
alter table public.teams
  add constraint teams_area_id_fkey
  foreign key (area_id) references public.areas(id) on delete set null;

alter table public.positions drop constraint positions_area_id_fkey;
alter table public.positions
  add constraint positions_area_id_fkey
  foreign key (area_id) references public.areas(id) on delete set null;

alter table public.invitations drop constraint invitations_area_id_fkey;
alter table public.invitations
  add constraint invitations_area_id_fkey
  foreign key (area_id) references public.areas(id) on delete set null;
