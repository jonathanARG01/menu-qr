-- 0031: equipo por sucursal.
-- Cada persona del equipo (y cada invitación pendiente) queda asignada a un local:
--   · todas_sucursales = true  → trabaja en todos los locales (así quedan todos los que ya estaban).
--   · todas_sucursales = false y sucursal_id vacío → local principal.
--   · todas_sucursales = false y sucursal_id = una sucursal → esa sucursal.
-- Con un solo local, Salón, Cocina y Para llevar le muestran solo lo de ese local.
-- Si se borra una sucursal, su gente pasa al local principal.
-- Se puede ejecutar más de una vez.

alter table public.usuarios
  add column if not exists todas_sucursales boolean not null default true,
  add column if not exists sucursal_id uuid references public.sucursales (id) on delete set null;

alter table public.invitaciones
  add column if not exists todas_sucursales boolean not null default true,
  add column if not exists sucursal_id uuid references public.sucursales (id) on delete set null;

create index if not exists usuarios_sucursal_idx on public.usuarios (sucursal_id) where sucursal_id is not null;

-- La sucursal tiene que ser de ese restaurante.
create or replace function public.validar_sucursal_equipo(p_restaurante uuid, p_sucursal uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_sucursal is not null and not exists (
    select 1 from public.sucursales where id = p_sucursal and restaurante_id = p_restaurante
  ) then
    raise exception 'Esa sucursal no es de este restaurante';
  end if;
end;
$$;
revoke all on function public.validar_sucursal_equipo(uuid, uuid) from public, anon, authenticated;

-- El equipo, ahora con el local de cada uno.
drop function if exists public.equipo(uuid);
create function public.equipo(p_restaurante uuid)
returns table (user_id uuid, email text, rol text, pendiente boolean, soy_yo boolean, nombre text, avatar text, color text,
               mesas uuid[], todas_sucursales boolean, sucursal_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_admin(p_restaurante) then
    raise exception 'Solo el administrador ve el equipo';
  end if;
  return query
  select u.user_id, au.email::text, u.rol, false, u.user_id = auth.uid(), u.nombre, u.avatar, u.color,
         coalesce((select array_agg(m.id) from public.mesas m where m.restaurante_id = p_restaurante and m.mesero_id = u.user_id), '{}'),
         u.todas_sucursales, u.sucursal_id
  from public.usuarios u join auth.users au on au.id = u.user_id
  where u.restaurante_id = p_restaurante
  union all
  select null::uuid, i.email, i.rol, true, false, null, null, null, '{}'::uuid[], i.todas_sucursales, i.sucursal_id
  from public.invitaciones i where i.restaurante_id = p_restaurante
  order by 4, 2;
end;
$$;
revoke all on function public.equipo(uuid) from public, anon;
grant execute on function public.equipo(uuid) to authenticated;

-- Sumar a alguien eligiendo también su local (sin local: todas las sucursales, como antes).
drop function if exists public.invitar_miembro(uuid, text, text);
create or replace function public.invitar_miembro(
  p_restaurante uuid, p_email text, p_rol text, p_sucursal uuid default null, p_todas boolean default true
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  correo text := lower(trim(p_email));
  uid uuid;
  v_todas boolean := coalesce(p_todas, true);
  v_sucursal uuid := case when coalesce(p_todas, true) then null else p_sucursal end;
begin
  if not public.es_admin(p_restaurante) then
    raise exception 'Solo el administrador suma personas al equipo';
  end if;
  if p_rol not in ('dueno', 'mesero', 'cocina') then
    raise exception 'Rol no válido';
  end if;
  if correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Ese correo no parece válido';
  end if;
  perform public.validar_sucursal_equipo(p_restaurante, v_sucursal);
  select id into uid from auth.users where lower(email) = correo;
  if uid is null then
    insert into public.invitaciones (restaurante_id, email, rol, todas_sucursales, sucursal_id)
    values (p_restaurante, correo, p_rol, v_todas, v_sucursal)
    on conflict (restaurante_id, email) do update
      set rol = excluded.rol, todas_sucursales = excluded.todas_sucursales, sucursal_id = excluded.sucursal_id;
    return 'invitado';
  end if;
  if exists (select 1 from public.usuarios where user_id = uid and restaurante_id = p_restaurante) then
    perform public.cambiar_rol(p_restaurante, uid, p_rol);
    update public.usuarios set todas_sucursales = v_todas, sucursal_id = v_sucursal
    where user_id = uid and restaurante_id = p_restaurante and rol <> 'staff';
    return 'actualizado';
  end if;
  insert into public.usuarios (user_id, restaurante_id, rol, todas_sucursales, sucursal_id)
  values (uid, p_restaurante, p_rol, v_todas, v_sucursal);
  return 'agregado';
end;
$$;
revoke all on function public.invitar_miembro(uuid, text, text, uuid, boolean) from public, anon;
grant execute on function public.invitar_miembro(uuid, text, text, uuid, boolean) to authenticated;

-- Cambiar el local de alguien del equipo (p_usuario) o de una invitación pendiente (p_email).
create or replace function public.asignar_local(
  p_restaurante uuid, p_usuario uuid, p_email text, p_sucursal uuid, p_todas boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_todas boolean := coalesce(p_todas, true);
  v_sucursal uuid := case when coalesce(p_todas, true) then null else p_sucursal end;
begin
  if not public.es_admin(p_restaurante) then
    raise exception 'Solo el administrador asigna locales';
  end if;
  perform public.validar_sucursal_equipo(p_restaurante, v_sucursal);
  if p_usuario is null then
    update public.invitaciones set todas_sucursales = v_todas, sucursal_id = v_sucursal
    where restaurante_id = p_restaurante and email = lower(trim(p_email));
  else
    update public.usuarios set todas_sucursales = v_todas, sucursal_id = v_sucursal
    where restaurante_id = p_restaurante and user_id = p_usuario and rol <> 'staff';
  end if;
end;
$$;
revoke all on function public.asignar_local(uuid, uuid, text, uuid, boolean) from public, anon;
grant execute on function public.asignar_local(uuid, uuid, text, uuid, boolean) to authenticated;

-- Al entrar, la persona invitada pasa al equipo con el local que se le eligió.
create or replace function public.aceptar_invitaciones()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  correo text;
  n integer;
begin
  select lower(email) into correo from auth.users where id = auth.uid();
  if correo is null then
    return 0;
  end if;
  insert into public.usuarios (user_id, restaurante_id, rol, todas_sucursales, sucursal_id)
  select auth.uid(), i.restaurante_id, i.rol, i.todas_sucursales, i.sucursal_id
  from public.invitaciones i where i.email = correo
  on conflict do nothing;
  get diagnostics n = row_count;
  delete from public.invitaciones where email = correo;
  return n;
end;
$$;
revoke all on function public.aceptar_invitaciones() from public, anon;
grant execute on function public.aceptar_invitaciones() to authenticated;

notify pgrst, 'reload schema';
