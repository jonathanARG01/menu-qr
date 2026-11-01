-- ═════════════════════════════════════════════
-- 0022: el dueño del sistema (superadmin) nunca es dueño de un restaurante
--
-- · Si el superadmin crea un restaurante para un cliente (desde /admin), queda como Soporte, no como dueño.
--   Después lo pasa al cliente con "Datos y acceso" o sumándolo como Administrador en Equipo.
-- · Ningún correo @platovi.cl ni ningún superadmin puede quedar como dueño (ni por invitación).
-- Se puede ejecutar más de una vez.
-- ═════════════════════════════════════════════

-- ¿Este usuario es del equipo de Platovi? (superadmin o correo @platovi.cl / @platovi.com)
create or replace function public.es_cuenta_platovi(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.superadmins s where s.user_id = p_user)
      or exists (
        select 1 from auth.users u
        where u.id = p_user and lower(u.email) ~ '@platovi\.(cl|com)$'
      );
$$;
revoke all on function public.es_cuenta_platovi(uuid) from public, anon, authenticated;

create or replace function public.crear_restaurante(p_nombre text, p_slug text)
returns public.restaurantes
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.restaurantes;
  ref text;
  platovi boolean := public.es_cuenta_platovi(auth.uid());
begin
  if auth.uid() is null then
    raise exception 'Necesitas iniciar sesión';
  end if;

  insert into public.restaurantes (nombre, slug, tema, color_primario, color_fondo, ajustes, prueba_inicio, prueba_fin)
  values (
    trim(p_nombre), lower(trim(p_slug)), 'vitrina', '#8bc34a', '#1b231d',
    jsonb_build_object('imagenes_defecto', true),
    now(), now() + interval '14 days'
  )
  returning * into r;

  -- Antes de sumarlo como dueño, para que "ya tenía otro restaurante" no cuente este mismo.
  if not platovi then
    select raw_user_meta_data ->> 'ref' into ref from auth.users where id = auth.uid();
    perform public.anotar_referido(r.id, ref);
  end if;

  -- El equipo de Platovi entra como Soporte (puede editar todo, pero el restaurante no es suyo).
  insert into public.usuarios (user_id, restaurante_id, rol)
  values (auth.uid(), r.id, case when platovi then 'staff' else 'dueno' end);

  return r;
end;
$$;
revoke all on function public.crear_restaurante(text, text) from public, anon;
grant execute on function public.crear_restaurante(text, text) to authenticated;

-- Candado en la base: aunque algo intente ponerlo como dueño, no se puede.
create or replace function public.bloquear_dueno_platovi()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.rol = 'dueno' and public.es_cuenta_platovi(new.user_id) then
    raise exception 'Las cuentas de Platovi no pueden ser dueñas de un restaurante (entran como Soporte).';
  end if;
  return new;
end;
$$;
drop trigger if exists usuarios_sin_dueno_platovi on public.usuarios;
create trigger usuarios_sin_dueno_platovi
  before insert or update of rol, user_id on public.usuarios
  for each row execute function public.bloquear_dueno_platovi();

create or replace function public.bloquear_invitacion_platovi()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.rol = 'dueno' and lower(new.email) ~ '@platovi\.(cl|com)$' then
    raise exception 'Las cuentas de Platovi no pueden ser dueñas de un restaurante.';
  end if;
  return new;
end;
$$;
drop trigger if exists invitaciones_sin_dueno_platovi on public.invitaciones;
create trigger invitaciones_sin_dueno_platovi
  before insert or update on public.invitaciones
  for each row execute function public.bloquear_invitacion_platovi();
