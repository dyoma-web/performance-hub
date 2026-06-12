-- ============================================================
-- Migración 0011: borrado de usuarios sin bloqueos referenciales
-- Las referencias "secundarias" a profiles (responsable, autor,
-- evaluador, líder, jefe) quedan en NULL al eliminar la cuenta;
-- los datos PROPIOS del usuario ya caían en cascada desde 0001.
-- ============================================================

-- feedforward: responsable sugerido
alter table public.feedforward_items drop constraint feedforward_items_responsible_id_fkey;
alter table public.feedforward_items
  add constraint feedforward_items_responsible_id_fkey
  foreign key (responsible_id) references public.profiles(id) on delete set null;

-- plan de acción: responsable
alter table public.plan_actions drop constraint plan_actions_responsible_id_fkey;
alter table public.plan_actions
  add constraint plan_actions_responsible_id_fkey
  foreign key (responsible_id) references public.profiles(id) on delete set null;

-- notas de avance: conservar la nota, anonimizar al autor eliminado
alter table public.action_notes alter column author_id drop not null;
alter table public.action_notes drop constraint action_notes_author_id_fkey;
alter table public.action_notes
  add constraint action_notes_author_id_fkey
  foreign key (author_id) references public.profiles(id) on delete set null;

-- check-ins: quién lo revisó
alter table public.checkins drop constraint checkins_reviewed_by_fkey;
alter table public.checkins
  add constraint checkins_reviewed_by_fkey
  foreign key (reviewed_by) references public.profiles(id) on delete set null;

-- calibraciones: quién ajustó (el log y la auditoría conservan el dato)
alter table public.calibrations drop constraint calibrations_adjusted_by_fkey;
alter table public.calibrations
  add constraint calibrations_adjusted_by_fkey
  foreign key (adjusted_by) references public.profiles(id) on delete set null;

-- valoración de trabajo: conservarla, anonimizar al evaluador eliminado
alter table public.work_ratings alter column evaluator_id drop not null;
alter table public.work_ratings drop constraint work_ratings_evaluator_id_fkey;
alter table public.work_ratings
  add constraint work_ratings_evaluator_id_fkey
  foreign key (evaluator_id) references public.profiles(id) on delete set null;

-- áreas: líder eliminado -> área sin líder
alter table public.areas drop constraint areas_lead_id_fkey;
alter table public.areas
  add constraint areas_lead_id_fkey
  foreign key (lead_id) references public.profiles(id) on delete set null;

-- jerarquía: jefe eliminado -> reportes quedan sin jefe (reasignar en Directorio)
alter table public.profiles drop constraint profiles_manager_id_fkey;
alter table public.profiles
  add constraint profiles_manager_id_fkey
  foreign key (manager_id) references public.profiles(id) on delete set null;

-- invitaciones: referencias a jefe/invitador eliminados
alter table public.invitations drop constraint invitations_manager_id_fkey;
alter table public.invitations
  add constraint invitations_manager_id_fkey
  foreign key (manager_id) references public.profiles(id) on delete set null;
alter table public.invitations drop constraint invitations_invited_by_fkey;
alter table public.invitations
  add constraint invitations_invited_by_fkey
  foreign key (invited_by) references public.profiles(id) on delete set null;
