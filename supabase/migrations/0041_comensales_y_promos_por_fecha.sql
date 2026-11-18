-- 0041 · Nombres de comensales, reparto de la cuenta desde la mesa y promos por fecha
--
-- 1. Cada cuenta guarda el nombre de sus comensales ("Ana", "Tío Pedro"…) para no hablar de C1, C2…
-- 2. Desde la carta, al pedir la cuenta "cada uno lo suyo", la mesa puede decir de quién es cada plato.
-- 3. Promos para días puntuales (solo el 26 de diciembre) o para un rango de fechas.
--
-- Se puede ejecutar más de una vez sin problema.

-- ─────────────────────────────────────────────
-- 1. Nombres de los comensales (posición 1 = comensal 1). Vacío = "Comensal 1", "Comensal 2"…
-- ─────────────────────────────────────────────

alter table public.cuentas add column if not exists nombres_comensales text[] not null default '{}';

-- ─────────────────────────────────────────────
-- 2. Lo que ve el cliente de su mesa ahora incluye el id de cada línea y los nombres de los comensales.
-- ─────────────────────────────────────────────

create or replace function public.mi_mesa(p_restaurante uuid, p_sucursal uuid, p_mesa text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  m public.mesas;
  c public.cuentas;
begin
  m := public.buscar_mesa(p_restaurante, p_sucursal, p_mesa);
  if m.id is null then
    return null;
  end if;
  select * into c from public.cuentas where mesa_id = m.id and estado = 'abierta';
  return jsonb_build_object(
    'mesa', m.numero,
    'capacidad', m.capacidad,
    'cuenta', case when c.id is null then null else jsonb_build_object(
      'comensales', c.comensales,
      'nombres', to_jsonb(c.nombres_comensales),
      'aviso', c.aviso,
      'pagado', (select coalesce(sum(monto), 0) from public.pagos where cuenta_id = c.id),
      'pedidos', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', p.id, 'origen', p.origen,
          'numero', p.numero, 'estado', p.estado, 'estacion', p.estacion, 'hora', p.created_at,
          'items', (select coalesce(jsonb_agg(jsonb_build_object(
              'id', i.id, 'nombre', i.nombre, 'precio', i.precio, 'cantidad', i.cantidad, 'comensal', i.comensal,
              'opciones', i.opciones
            ) order by i.created_at), '[]') from public.pedido_items i where i.pedido_id = p.id)
        ) order by p.created_at), '[]')
        from public.pedidos p where p.cuenta_id = c.id and p.estado <> 'cancelado'
      )
    ) end
  );
end;
$$;
grant execute on function public.mi_mesa(uuid, uuid, text) to anon, authenticated;

-- La mesa reparte su cuenta: cuántos son, sus nombres y de quién es cada línea (null = compartido).
-- Solo toca la cuenta abierta de esa mesa y sus propias líneas; no cambia precios ni cantidades.
create or replace function public.repartir_cuenta(
  p_restaurante uuid,
  p_sucursal uuid,
  p_mesa text,
  p_comensales integer,
  p_nombres text[],
  p_reparto jsonb default '[]'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.mesas;
  c public.cuentas;
  n integer := greatest(1, least(30, coalesce(p_comensales, 1)));
  v_nombres text[];
begin
  m := public.buscar_mesa(p_restaurante, p_sucursal, p_mesa);
  if m.id is null then
    return false;
  end if;
  select * into c from public.cuentas where mesa_id = m.id and estado = 'abierta';
  if c.id is null then
    return false;
  end if;
  if p_reparto is null or jsonb_typeof(p_reparto) <> 'array' or jsonb_array_length(p_reparto) > 200 then
    p_reparto := '[]';
  end if;

  select coalesce(array_agg(left(btrim(coalesce(x, '')), 20) order by k), '{}')
  into v_nombres
  from unnest(coalesce(p_nombres, '{}'::text[])) with ordinality as t(x, k)
  where k <= n;

  update public.cuentas set comensales = n, nombres_comensales = v_nombres where id = c.id;

  update public.pedido_items i
  set comensal = case
      when (r ->> 'comensal') is null then null
      when (r ->> 'comensal') ~ '^\d{1,2}$' and (r ->> 'comensal')::integer between 1 and n then (r ->> 'comensal')::integer
      else null
    end
  from jsonb_array_elements(p_reparto) r, public.pedidos p
  where (r ->> 'id') ~ '^[0-9a-fA-F-]{36}$'
    and i.id = (r ->> 'id')::uuid
    and p.id = i.pedido_id
    and p.cuenta_id = c.id;
  return true;
end;
$$;
revoke all on function public.repartir_cuenta(uuid, uuid, text, integer, text[], jsonb) from public;
grant execute on function public.repartir_cuenta(uuid, uuid, text, integer, text[], jsonb) to anon, authenticated;

-- ─────────────────────────────────────────────
-- 3. Promos por fecha
-- fechas: días puntuales (vacío = cualquier fecha). fecha_desde / fecha_hasta: rango (vacío = sin límite).
-- Se suman a los días de la semana y al horario: la promo vale si se cumple todo.
-- ─────────────────────────────────────────────

alter table public.promos add column if not exists fechas date[] not null default '{}';
alter table public.promos add column if not exists fecha_desde date;
alter table public.promos add column if not exists fecha_hasta date;

create or replace function public.promo_vigente(p public.promos, tz text, ahora timestamptz default now())
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  local timestamp := ahora at time zone tz;
  d integer := extract(dow from local)::integer;
  t time := local::time;
  hoy date := local::date;
  ayer date := local::date - 1;
  todos boolean := cardinality(p.dias) = 0;
  hoy_ok boolean;
  ayer_ok boolean;
begin
  hoy_ok := (todos or d = any(p.dias))
    and (cardinality(p.fechas) = 0 or hoy = any(p.fechas))
    and (p.fecha_desde is null or hoy >= p.fecha_desde)
    and (p.fecha_hasta is null or hoy <= p.fecha_hasta);
  if p.desde <= p.hasta then
    return hoy_ok and t >= p.desde and t < p.hasta;
  end if;
  -- Cruza la medianoche: la parte de la madrugada pertenece al día (y la fecha) anterior.
  ayer_ok := (todos or ((d + 6) % 7) = any(p.dias))
    and (cardinality(p.fechas) = 0 or ayer = any(p.fechas))
    and (p.fecha_desde is null or ayer >= p.fecha_desde)
    and (p.fecha_hasta is null or ayer <= p.fecha_hasta);
  return (hoy_ok and t >= p.desde) or (ayer_ok and t < p.hasta);
end;
$$;
