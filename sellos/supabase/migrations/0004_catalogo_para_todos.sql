-- ═════════════════════════════════════════════
-- 0004: Catálogo de premios para todas las tarjetas, con interruptor del dueño.
--   · programas.mostrar_catalogo: el dueño (o encargado) decide si sus clientes ven el catálogo.
--   · Con tarjeta de SELLOS, al completarla el cliente puede elegir su premio del catálogo
--     (o llevarse el premio de siempre). Con PUNTOS sigue igual: cada premio cuesta sus puntos.
--   · El catálogo se ve en la tarjeta del cliente (/t/…) y en la página para unirse (/u/…).
-- Ejecutar DESPUÉS de 0003_permisos.sql. Se puede volver a ejecutar sin romper nada.
-- ═════════════════════════════════════════════

alter table public.programas add column if not exists mostrar_catalogo boolean not null default true;

-- El dueño y el encargado lo prenden o apagan desde "Premios y cupones" (el encargado no edita la tarjeta completa).
create or replace function public.mostrar_catalogo(p_negocio uuid, p_valor boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_gestor(p_negocio) then
    raise exception 'No tienes permiso para cambiar esto';
  end if;
  update public.programas set mostrar_catalogo = p_valor, updated_at = now() where negocio_id = p_negocio;
end;
$$;
revoke all on function public.mostrar_catalogo(uuid, boolean) from public, anon;
grant execute on function public.mostrar_catalogo(uuid, boolean) to authenticated;

-- Los premios del catálogo que ve el cliente: vacío si el dueño lo apagó o si su plan no incluye el catálogo.
create or replace function public.catalogo_publico(p_negocio uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when coalesce(p.mostrar_catalogo, true) and public.plan_incluye(n.id, 'premios') then coalesce((
    select jsonb_agg(jsonb_build_object('id', r.id, 'titulo', r.titulo, 'descripcion', r.descripcion, 'imagen_url', r.imagen_url,
                                        'categoria', r.categoria, 'puntos', r.puntos, 'destacado', r.destacado,
                                        'agotado', r.stock is not null and r.stock <= 0, 'hasta', r.hasta)
                     order by r.destacado desc, r.orden, r.puntos)
    from public.premios r
    where r.negocio_id = n.id and r.activo
      and (r.desde is null or r.desde <= (now() at time zone n.zona_horaria)::date)
      and (r.hasta is null or r.hasta >= (now() at time zone n.zona_horaria)::date)
  ), '[]'::jsonb) else '[]'::jsonb end
  from public.negocios n left join public.programas p on p.negocio_id = n.id
  where n.id = p_negocio;
$$;
revoke all on function public.catalogo_publico(uuid) from public, anon, authenticated;

create or replace function public.ver_tarjeta(p_codigo text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.estado_tarjeta(t) || jsonb_build_object(
    'activa', coalesce(p.activo, false) and public.vigente(n.id),
    'negocio', jsonb_build_object('id', n.id, 'nombre', n.nombre, 'slug', n.slug, 'logo_url', n.logo_url, 'color', n.color,
                                  'rubro', n.rubro, 'telefono', n.telefono, 'instagram', n.instagram, 'pais', n.pais,
                                  'moneda', n.moneda, 'latitud', n.latitud, 'longitud', n.longitud,
                                  'resena_url', case when coalesce(p.pedir_resena, false) then n.resena_url end),
    'programa', public.programa_publico(n.id),
    'dia_doble', coalesce(public.dia_doble(n.id), false),
    'promocion', public.promocion_hoy(n.id),
    'catalogo', public.catalogo_publico(n.id),
    'retos', case when public.plan_incluye(n.id, 'retos') then coalesce((
      select jsonb_agg(jsonb_build_object(
        'titulo', r.titulo, 'insignia', r.insignia, 'visitas', r.visitas, 'dias', r.dias, 'regalo', public.regalo(n.id, r.regalo),
        'logrados', (select count(*) from public.tarjeta_retos x where x.tarjeta_id = t.id and x.reto_id = r.id),
        'avance', (select count(*) from public.movimientos m
                   where m.tarjeta_id = t.id and m.tipo = 'sello' and m.origen in ('qr', 'equipo', 'api')
                     and m.created_at > greatest(now() - make_interval(days => r.dias),
                       coalesce((select max(x.created_at) from public.tarjeta_retos x where x.tarjeta_id = t.id and x.reto_id = r.id),
                                '-infinity'::timestamptz)))
      ) order by r.visitas)
      from public.retos r where r.negocio_id = n.id and r.activo
    ), '[]'::jsonb) else '[]'::jsonb end,
    'locales', coalesce((
      select jsonb_agg(jsonb_build_object('nombre', s.nombre, 'latitud', s.latitud, 'longitud', s.longitud) order by s.created_at)
      from public.sucursales s where s.negocio_id = n.id and public.plan_incluye(n.id, 'sucursales')
    ), '[]'::jsonb),
    'cupones', coalesce((
      select jsonb_agg(jsonb_build_object('titulo', c.titulo, 'detalle', c.detalle, 'vence_at', c.vence_at) order by c.created_at desc)
      from public.tarjeta_cupones c
      where c.tarjeta_id = t.id and c.usado_at is null and (c.vence_at is null or c.vence_at > now())
    ), '[]'::jsonb),
    'movimientos', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', m.tipo, 'cantidad', m.cantidad, 'origen', m.origen, 'created_at', m.created_at,
                                          'unidad', m.unidad, 'nota', m.nota)
                       order by m.created_at desc)
      from (select * from public.movimientos x where x.tarjeta_id = t.id order by x.created_at desc limit 10) m
    ), '[]'::jsonb)
  )
  from public.tarjetas t
  join public.negocios n on n.id = t.negocio_id
  left join public.programas p on p.negocio_id = t.negocio_id
  where t.codigo = upper(trim(p_codigo));
$$;
grant execute on function public.ver_tarjeta(text) to anon, authenticated;

create or replace function public.negocio_publico(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'negocio', jsonb_build_object('id', n.id, 'nombre', n.nombre, 'slug', n.slug, 'logo_url', n.logo_url, 'color', n.color,
                                  'rubro', n.rubro, 'pais', n.pais),
    'programa', public.programa_publico(n.id),
    'activa', p.activo and public.vigente(n.id),
    'catalogo', public.catalogo_publico(n.id)
  )
  from public.negocios n join public.programas p on p.negocio_id = n.id
  where n.slug = lower(trim(p_slug));
$$;
grant execute on function public.negocio_publico(text) to anon, authenticated;

-- Canjear el premio de una tarjeta de sellos completa. Con p_premio, el cliente eligió un premio del catálogo
-- (descuenta su stock); sin él, se lleva el premio de siempre.
drop function if exists public.canjear(text, text, uuid);
create or replace function public.canjear(p_tarjeta text, p_pin text default null, p_sucursal uuid default null, p_premio uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tarjetas;
  r public.premios;
  quien uuid;
  zona text;
  v_premio text;
  v_costo numeric;
begin
  select * into t from public.tarjetas where codigo = upper(trim(p_tarjeta)) for update;
  if t.id is null then
    raise exception 'No encontramos esa tarjeta';
  end if;
  quien := public.exigir_pin(t.negocio_id, p_pin);
  if t.premios < 1 then
    raise exception 'Esta tarjeta todavía no tiene un premio para canjear';
  end if;
  if p_premio is null then
    select premio, costo_premio into v_premio, v_costo from public.programas where negocio_id = t.negocio_id;
  else
    if not public.plan_incluye(t.negocio_id, 'premios') then
      raise exception 'El catálogo de premios es del plan Pro';
    end if;
    if not coalesce((select mostrar_catalogo from public.programas where negocio_id = t.negocio_id), true) then
      raise exception 'El catálogo de premios está apagado';
    end if;
    select * into r from public.premios where id = p_premio and negocio_id = t.negocio_id for update;
    select zona_horaria into zona from public.negocios where id = t.negocio_id;
    if r.id is null then
      raise exception 'Ese premio no existe';
    end if;
    if not public.premio_disponible(r, zona) then
      raise exception 'Ese premio no está disponible (sin stock o fuera de fecha)';
    end if;
    update public.premios set stock = stock - 1 where id = r.id and stock is not null;
    v_premio := r.titulo;
    v_costo := r.costo;
  end if;
  update public.tarjetas set premios = premios - 1, canjes = canjes + 1, ultima_at = now() where id = t.id returning * into t;
  insert into public.movimientos (negocio_id, tarjeta_id, tipo, cantidad, origen, autorizado_por, nota, sucursal_id, costo)
  values (t.negocio_id, t.id, 'canje', -1, case when p_premio is null then 'manual' else 'premio' end, quien, v_premio,
          public.sucursal_de(t.negocio_id, p_sucursal), v_costo);
  return public.estado_tarjeta(t) || jsonb_build_object('premio', v_premio);
end;
$$;
revoke all on function public.canjear(text, text, uuid, uuid) from public, anon;
grant execute on function public.canjear(text, text, uuid, uuid) to authenticated;
