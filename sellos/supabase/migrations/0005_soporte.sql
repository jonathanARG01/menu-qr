-- ═════════════════════════════════════════════
-- 0005: Modo soporte para el superadmin (tú, el desarrollador del sistema).
--   · Entras al panel de cualquier negocio como si fueras su dueño (el resto de permisos ya te dejan pasar).
--   · Al canjear o quitar sellos no te pide el PIN del dueño.
--   · Ves el equipo de cada negocio con sus correos y puedes borrar un negocio de prueba.
-- Ejecutar DESPUÉS de 0004_catalogo_para_todos.sql. Se puede volver a ejecutar sin romper nada.
-- ═════════════════════════════════════════════

-- El PIN del dueño no se le pide al superadmin (soporte).
create or replace function public.exigir_pin(p_negocio uuid, p_pin text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  quien uuid;
begin
  if not public.es_miembro(p_negocio) then
    raise exception 'No tienes acceso a este negocio';
  end if;
  if not public.pide_pin(p_negocio) or public.es_superadmin() then
    return auth.uid();
  end if;
  select m.user_id into quien from public.miembros m
  where m.negocio_id = p_negocio and m.rol = 'dueno' and m.pin_hash is not null and m.pin_hash = crypt(coalesce(p_pin, ''), m.pin_hash)
  limit 1;
  if quien is null then
    raise exception 'PIN incorrecto';
  end if;
  return quien;
end;
$$;
revoke all on function public.exigir_pin(uuid, text) from public, anon, authenticated;

-- El equipo de un negocio con sus correos (solo superadmin).
create or replace function public.admin_miembros(p_negocio uuid)
returns table (user_id uuid, email text, nombre text, rol text, desde timestamptz, ultimo_ingreso timestamptz, confirmado boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_superadmin() then
    raise exception 'Solo para administradores';
  end if;
  return query
  select m.user_id, u.email::text, coalesce(nullif(m.nombre, ''), u.raw_user_meta_data ->> 'nombre', '')::text, m.rol, m.created_at,
         u.last_sign_in_at, u.email_confirmed_at is not null
  from public.miembros m join auth.users u on u.id = m.user_id
  where m.negocio_id = p_negocio
  order by case m.rol when 'dueno' then 0 when 'encargado' then 1 else 2 end, m.created_at;
end;
$$;
revoke all on function public.admin_miembros(uuid) from public, anon;
grant execute on function public.admin_miembros(uuid) to authenticated;

-- Borrar un negocio con todo lo suyo (clientes, sellos, premios…). Hay que escribir su dirección para confirmar.
-- Las cuentas de las personas no se borran.
create or replace function public.admin_borrar_negocio(p_id uuid, p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_superadmin() then
    raise exception 'Solo para administradores';
  end if;
  if not exists (select 1 from public.negocios where id = p_id and slug = lower(trim(p_slug))) then
    raise exception 'La dirección no coincide: escribe la dirección exacta del negocio para borrarlo';
  end if;
  delete from public.negocios where id = p_id;
end;
$$;
revoke all on function public.admin_borrar_negocio(uuid, text) from public, anon;
grant execute on function public.admin_borrar_negocio(uuid, text) to authenticated;

-- Editar los datos básicos de un negocio desde Admin.
create or replace function public.admin_datos_negocio(p_id uuid, p_nombre text, p_slug text, p_telefono text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text := lower(trim(p_slug));
begin
  if not public.es_superadmin() then
    raise exception 'Solo para administradores';
  end if;
  if exists (select 1 from public.negocios where slug = v_slug and id <> p_id) then
    raise exception 'Esa dirección ya la usa otro negocio';
  end if;
  update public.negocios
  set nombre = left(trim(p_nombre), 80), slug = v_slug, telefono = nullif(left(trim(coalesce(p_telefono, '')), 30), '')
  where id = p_id;
end;
$$;
revoke all on function public.admin_datos_negocio(uuid, text, text, text) from public, anon;
grant execute on function public.admin_datos_negocio(uuid, text, text, text) to authenticated;

notify pgrst, 'reload schema';
