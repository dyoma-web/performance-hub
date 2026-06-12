-- ============================================================
-- Migración 0008: gestión de usuarios por People Ops
-- · admin_create_user: crea la cuenta con contraseña temporal
--   (verifica rol admin EN EL SERVIDOR; no expone service key)
-- · must_change_password: fuerza cambio en el primer ingreso
-- · admin_delete_user: elimina cuenta + todos sus datos (cascada)
--   con registro previo en auditoría
-- ============================================================

alter table public.profiles
  add column must_change_password boolean not null default false;

-- Crear usuario (solo admin). Devuelve el id del nuevo usuario.
create or replace function public.admin_create_user(p_email text, p_name text, p_temp_password text)
returns uuid
language plpgsql security definer set search_path = public, extensions as
$$
declare
  new_id uuid := gen_random_uuid();
begin
  if not public.is_admin() then
    raise exception 'Solo People Ops puede crear usuarios';
  end if;
  if p_email !~ '^\S+@\S+\.\S+$' then
    raise exception 'Email inválido';
  end if;
  if length(trim(coalesce(p_name, ''))) < 3 then
    raise exception 'Nombre y apellidos requeridos';
  end if;
  if length(coalesce(p_temp_password, '')) < 8 then
    raise exception 'La contraseña temporal debe tener al menos 8 caracteres';
  end if;
  if exists (select 1 from auth.users where lower(email) = lower(p_email)) then
    raise exception 'Ya existe un usuario con ese correo';
  end if;

  insert into auth.users
    (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
     raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
     confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current)
  values
    ('00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated',
     lower(p_email), crypt(p_temp_password, gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', jsonb_build_object('name', trim(p_name)),
     now(), now(), '', '', '', '', '');

  insert into auth.identities
    (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values
    (gen_random_uuid(), new_id, new_id::text, 'email',
     jsonb_build_object('sub', new_id::text, 'email', lower(p_email), 'email_verified', true),
     now(), now(), now());

  -- el trigger handle_new_user ya creó el perfil (y aplicó invitación si existía)
  update public.profiles set must_change_password = true where id = new_id;

  return new_id;
end
$$;

revoke all on function public.admin_create_user(text, text, text) from public;
grant execute on function public.admin_create_user(text, text, text) to authenticated;

-- Eliminar usuario (solo admin, nunca a sí mismo). Cascada borra perfil,
-- datos personales, reviews, etc. La auditoría conserva el último estado.
create or replace function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public as
$$
begin
  if not public.is_admin() then
    raise exception 'Solo People Ops puede eliminar usuarios';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'No puedes eliminar tu propia cuenta';
  end if;
  if not exists (select 1 from profiles where id = p_user_id) then
    raise exception 'Usuario no encontrado';
  end if;

  insert into audit_log (actor_id, entity, entity_id, action, before)
  select auth.uid(), 'users', p_user_id, 'delete', to_jsonb(p)
  from profiles p where p.id = p_user_id;

  delete from auth.users where id = p_user_id;
end
$$;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;
