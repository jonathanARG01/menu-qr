-- Platovi · campanita de notificaciones en /admin (solo superadmin).
-- Registra lo que hacen los restaurantes: alta de cuenta, cambios en la carta, cambios de diseño/marca,
-- clics en "Quiero el plan…", "Quiero Platovi Loyalty", pedir ayuda y abrir funciones bloqueadas por el plan.
-- Requiere 0003 (superadmins), 0004 (roles) y 0016 (platos/categorías de ejemplo). Se puede ejecutar más de una vez.
--
-- Para no llenar la campanita, los cambios seguidos del mismo restaurante y del mismo tipo se juntan en una sola
-- notificación (con un contador) mientras sigan sin leer y no pasen 3 horas desde el último cambio.
-- Lo que haces tú como superadmin (o el equipo Platovi como "staff" o con correo @platovi.cl) no se registra.

create table if not exists public.notificaciones_admin (
  id             uuid primary key default gen_random_uuid(),
  -- Sin llave foránea a propósito: si el restaurante se elimina, la notificación queda con su nombre.
  restaurante_id uuid,
  restaurante    text not null default '',
  slug           text not null default '',
  tipo           text not null check (tipo in ('registro', 'carta', 'marca', 'plan', 'loyalty', 'interes', 'ayuda')),
  detalle        text not null default '' check (char_length(detalle) <= 300),
  -- Últimos cambios (el más nuevo primero, hasta 8), para ver el detalle al abrir la notificación.
  cambios        jsonb not null default '[]'::jsonb check (jsonb_typeof(cambios) = 'array'),
  veces          integer not null default 1,
  usuario_id     uuid,
  usuario_correo text,
  leida          boolean not null default false,
  creado         timestamptz not null default now(),
  actualizado    timestamptz not null default now()
);
create index if not exists notificaciones_admin_fecha_idx on public.notificaciones_admin (actualizado desc);
create index if not exists notificaciones_admin_juntar_idx
  on public.notificaciones_admin (restaurante_id, tipo, actualizado desc) where not leida;

alter table public.notificaciones_admin enable row level security;
grant select, update, delete on public.notificaciones_admin to authenticated;

drop policy if exists "superadmin: ver notificaciones" on public.notificaciones_admin;
create policy "superadmin: ver notificaciones" on public.notificaciones_admin
  for select to authenticated using (public.es_superadmin());
drop policy if exists "superadmin: marcar notificaciones" on public.notificaciones_admin;
create policy "superadmin: marcar notificaciones" on public.notificaciones_admin
  for update to authenticated using (public.es_superadmin()) with check (public.es_superadmin());
drop policy if exists "superadmin: borrar notificaciones" on public.notificaciones_admin;
create policy "superadmin: borrar notificaciones" on public.notificaciones_admin
  for delete to authenticated using (public.es_superadmin());

-- ─────────────────────────────────────────────
-- Guardar (o juntar) una notificación. Devuelve true si es nueva (para mandar el aviso al celular solo una vez).
-- Uso interno: la llaman los triggers y registrar_notificacion_admin().
-- ─────────────────────────────────────────────
create or replace function public._notificar_admin(p_restaurante uuid, p_tipo text, p_detalle text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_correo text;
  v_nombre text;
  v_slug   text;
  v_id     uuid;
  v_det    text := left(coalesce(nullif(trim(p_detalle), ''), ''), 300);
begin
  -- Sin sesión (tareas automáticas, clave de servicio) o el equipo Platovi: no se registra.
  if v_uid is null or p_restaurante is null then return false; end if;
  if exists (select 1 from public.superadmins s where s.user_id = v_uid) then return false; end if;
  if exists (select 1 from public.usuarios u where u.user_id = v_uid and u.restaurante_id = p_restaurante and u.rol = 'staff') then
    return false;
  end if;
  select email into v_correo from auth.users where id = v_uid;
  if v_correo ilike '%@platovi.cl' or v_correo ilike '%@platovi.com' then return false; end if;

  -- Si el restaurante se está eliminando (borrado en cascada de su carta), no hay nada que avisar.
  select r.nombre, r.slug into v_nombre, v_slug from public.restaurantes r where r.id = p_restaurante;
  if not found then return false; end if;

  select n.id into v_id
  from public.notificaciones_admin n
  where n.restaurante_id = p_restaurante
    and n.tipo = p_tipo
    and not n.leida
    and n.actualizado > now() - interval '3 hours'
  order by n.actualizado desc
  limit 1
  for update;

  if v_id is not null then
    update public.notificaciones_admin n
    set veces = n.veces + 1,
        detalle = case when v_det = '' then n.detalle else v_det end,
        cambios = case
          when v_det = '' or n.cambios -> 0 = to_jsonb(v_det) then n.cambios
          else (select coalesce(jsonb_agg(x), '[]'::jsonb)
                from (select x from jsonb_array_elements(jsonb_build_array(v_det) || n.cambios) with ordinality as t(x, i)
                      order by i limit 8) s)
        end,
        usuario_id = v_uid,
        usuario_correo = v_correo,
        restaurante = v_nombre,
        slug = v_slug,
        actualizado = now()
    where n.id = v_id;
    return false;
  end if;

  insert into public.notificaciones_admin (restaurante_id, restaurante, slug, tipo, detalle, cambios, usuario_id, usuario_correo)
  values (p_restaurante, v_nombre, v_slug, p_tipo, v_det,
          case when v_det = '' then '[]'::jsonb else jsonb_build_array(v_det) end, v_uid, v_correo);
  return true;
exception when others then
  -- Una notificación nunca debe impedir que el restaurante guarde su carta.
  return false;
end;
$$;
revoke all on function public._notificar_admin(uuid, text, text) from public, anon, authenticated;

-- Desde el panel (botones "Quiero el plan…", "Quiero Platovi Loyalty", ayuda, funciones bloqueadas).
-- Solo alguien del equipo de ese restaurante puede registrar algo de él.
create or replace function public.registrar_notificacion_admin(p_restaurante uuid, p_tipo text, p_detalle text default '')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_tipo not in ('plan', 'loyalty', 'interes', 'ayuda') then
    raise exception 'Tipo de notificación no permitido';
  end if;
  if not public.es_miembro(p_restaurante) then return false; end if;
  return public._notificar_admin(p_restaurante, p_tipo, p_detalle);
end;
$$;
revoke all on function public.registrar_notificacion_admin(uuid, text, text) from public, anon;
grant execute on function public.registrar_notificacion_admin(uuid, text, text) to authenticated;

-- ─────────────────────────────────────────────
-- Cambios en la carta: platos y categorías
-- ─────────────────────────────────────────────
create or replace function public._precio_texto(p numeric)
returns text language sql immutable as $$
  select '$' || replace(to_char(round(p)::bigint, 'FM999,999,999,990'), ',', '.')
$$;

create or replace function public.trg_notificar_plato()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_det text;
  v_vieja jsonb;
  v_nueva jsonb;
begin
  if tg_op = 'INSERT' then
    if new.ejemplo then return null; end if;
    v_det := format('Agregó el plato «%s» (%s)', new.nombre, public._precio_texto(new.precio));
    perform public._notificar_admin(new.restaurante_id, 'carta', v_det);
  elsif tg_op = 'DELETE' then
    if old.ejemplo then return null; end if;
    v_det := format('Eliminó el plato «%s»', old.nombre);
    perform public._notificar_admin(old.restaurante_id, 'carta', v_det);
  else
    -- Lo del día a día (agotado por hoy) no es un cambio de carta.
    v_vieja := to_jsonb(old) - 'agotado_hasta';
    v_nueva := to_jsonb(new) - 'agotado_hasta';
    if v_vieja = v_nueva then return null; end if;
    if new.precio is distinct from old.precio then
      v_det := format('Cambió el precio de «%s»: %s → %s', new.nombre, public._precio_texto(old.precio), public._precio_texto(new.precio));
    elsif new.nombre is distinct from old.nombre then
      v_det := format('Renombró «%s» a «%s»', old.nombre, new.nombre);
    elsif new.disponible is distinct from old.disponible then
      v_det := format('%s «%s»', case when new.disponible then 'Volvió a mostrar' else 'Ocultó' end, new.nombre);
    elsif new.foto_url is distinct from old.foto_url then
      v_det := format('Cambió la foto de «%s»', new.nombre);
    elsif new.descripcion is distinct from old.descripcion then
      v_det := format('Cambió la descripción de «%s»', new.nombre);
    elsif (v_vieja - 'orden' - 'categoria_id') = (v_nueva - 'orden' - 'categoria_id') then
      v_det := 'Reordenó los platos';
    else
      v_det := format('Editó «%s»', new.nombre);
    end if;
    perform public._notificar_admin(new.restaurante_id, 'carta', v_det);
  end if;
  return null;
end;
$$;

drop trigger if exists notificar_admin_platos on public.platos;
create trigger notificar_admin_platos
  after insert or update or delete on public.platos
  for each row execute function public.trg_notificar_plato();

create or replace function public.trg_notificar_categoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_det text;
begin
  if tg_op = 'INSERT' then
    if new.ejemplo then return null; end if;
    v_det := format('Agregó la categoría «%s»', new.nombre);
    perform public._notificar_admin(new.restaurante_id, 'carta', v_det);
  elsif tg_op = 'DELETE' then
    if old.ejemplo then return null; end if;
    v_det := format('Eliminó la categoría «%s»', old.nombre);
    perform public._notificar_admin(old.restaurante_id, 'carta', v_det);
  else
    if to_jsonb(old) = to_jsonb(new) then return null; end if;
    if new.nombre is distinct from old.nombre then
      v_det := format('Renombró la categoría «%s» a «%s»', old.nombre, new.nombre);
    elsif new.visible is distinct from old.visible then
      v_det := format('%s la categoría «%s»', case when new.visible then 'Volvió a mostrar' else 'Ocultó' end, new.nombre);
    elsif (to_jsonb(old) - 'orden') = (to_jsonb(new) - 'orden') then
      v_det := 'Reordenó las categorías';
    else
      v_det := format('Editó la categoría «%s»', new.nombre);
    end if;
    perform public._notificar_admin(new.restaurante_id, 'carta', v_det);
  end if;
  return null;
end;
$$;

drop trigger if exists notificar_admin_categorias on public.categorias;
create trigger notificar_admin_categorias
  after insert or update or delete on public.categorias
  for each row execute function public.trg_notificar_categoria();

-- ─────────────────────────────────────────────
-- Restaurantes: alta de cuenta nueva y cambios de diseño o marca
-- ─────────────────────────────────────────────
create or replace function public.trg_notificar_restaurante()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cambios text[] := '{}';
begin
  if new.tema is distinct from old.tema then v_cambios := v_cambios || format('cambió el diseño a «%s»', new.tema); end if;
  if new.logo_url is distinct from old.logo_url then v_cambios := v_cambios || 'cambió el logo'::text; end if;
  if new.color_primario is distinct from old.color_primario or new.color_fondo is distinct from old.color_fondo then
    v_cambios := v_cambios || 'cambió los colores'::text;
  end if;
  if new.nombre is distinct from old.nombre then v_cambios := v_cambios || format('cambió el nombre a «%s»', new.nombre); end if;
  if new.descripcion is distinct from old.descripcion then v_cambios := v_cambios || 'cambió la descripción'::text; end if;
  if new.idiomas is distinct from old.idiomas then v_cambios := v_cambios || 'cambió los idiomas de la carta'::text; end if;
  if cardinality(v_cambios) = 0 then return null; end if;
  perform public._notificar_admin(new.id, 'marca', upper(left(array_to_string(v_cambios, ', '), 1)) || substr(array_to_string(v_cambios, ', '), 2));
  return null;
end;
$$;

drop trigger if exists notificar_admin_restaurantes on public.restaurantes;
create trigger notificar_admin_restaurantes
  after update on public.restaurantes
  for each row execute function public.trg_notificar_restaurante();

-- Alta: cuando una cuenta queda como dueña de un restaurante nuevo (los primeros 10 minutos desde su creación).
create or replace function public.trg_notificar_registro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_correo text;
begin
  if new.rol <> 'dueno' or new.user_id is distinct from auth.uid() then return null; end if;
  if not exists (select 1 from public.restaurantes r where r.id = new.restaurante_id and r.created_at > now() - interval '10 minutes') then
    return null;
  end if;
  select email into v_correo from auth.users where id = new.user_id;
  perform public._notificar_admin(new.restaurante_id, 'registro', format('Se registró con %s', coalesce(v_correo, 'una cuenta nueva')));
  return null;
end;
$$;

drop trigger if exists notificar_admin_registro on public.usuarios;
create trigger notificar_admin_registro
  after insert on public.usuarios
  for each row execute function public.trg_notificar_registro();
