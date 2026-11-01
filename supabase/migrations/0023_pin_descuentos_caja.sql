-- ═════════════════════════════════════════════
-- 0023: PIN de autorización, descuentos con motivo, gastos por categoría, corte parcial y ranking de productos
--
-- · PIN de 4 a 6 dígitos por persona del equipo (guardado cifrado). Si el restaurante lo activa
--   (Personalizar → "Pedir PIN de encargado"), un mesero necesita el PIN de un encargado para anular una mesa,
--   quitar un plato que ya está en cocina o hacer un descuento. Todo queda registrado (quién pidió, quién autorizó).
-- · Descuentos y cortesías: porcentaje o monto sobre la cuenta o sobre platos elegidos, siempre con motivo.
--   Se guarda el precio original de cada plato para poder quitarlo.
-- · Gastos con categoría y proveedor, y retiros de efectivo a la caja fuerte.
-- · Corte parcial (corte X): se guarda una foto del turno sin cerrarlo.
-- · Ranking de productos vendidos (salón, para llevar y delivery).
-- Se puede ejecutar más de una vez.
-- ═════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────
-- PIN por persona (no se puede leer desde la app: solo se usa a través de las funciones de abajo)
-- ─────────────────────────────────────────────

create table if not exists public.equipo_pines (
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  pin_hash       text,
  -- Puede autorizar con su PIN lo que un mesero no puede hacer solo (los administradores siempre pueden).
  autoriza       boolean not null default false,
  updated_at     timestamptz not null default now(),
  primary key (restaurante_id, user_id)
);
alter table public.equipo_pines enable row level security;
revoke all on public.equipo_pines from anon, authenticated;

-- Intentos fallidos de PIN (para frenar a quien prueba números al azar).
create table if not exists public.pin_intentos (
  id             bigint generated always as identity primary key,
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  user_id        uuid,
  created_at     timestamptz not null default now()
);
create index if not exists pin_intentos_idx on public.pin_intentos (user_id, created_at desc);
alter table public.pin_intentos enable row level security;
revoke all on public.pin_intentos from anon, authenticated;

-- Registro de lo autorizado: anulaciones, platos quitados de cocina y descuentos.
create table if not exists public.autorizaciones (
  id             uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  cuenta_id      uuid references public.cuentas (id) on delete set null,
  accion         text not null check (accion in ('anular_cuenta', 'quitar_item', 'descuento', 'quitar_descuento')),
  detalle        text check (char_length(detalle) <= 200),
  motivo         text check (char_length(motivo) <= 120),
  monto          numeric(12, 2) not null default 0,
  pedido_por     uuid references auth.users (id) on delete set null default auth.uid(),
  autorizado_por uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists autorizaciones_restaurante_idx on public.autorizaciones (restaurante_id, created_at desc);
alter table public.autorizaciones enable row level security;
grant select on public.autorizaciones to authenticated;
drop policy if exists "admin: ver autorizaciones" on public.autorizaciones;
create policy "admin: ver autorizaciones" on public.autorizaciones
  for select to authenticated using (public.es_admin(restaurante_id));

-- ¿Este restaurante pide PIN de encargado a quien no es administrador?
create or replace function public.pide_pin(p_restaurante uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select (r.ajustes ->> 'pin_autorizacion')::boolean from public.restaurantes r where r.id = p_restaurante), false)
     and not public.es_admin(p_restaurante);
$$;
grant execute on function public.pide_pin(uuid) to authenticated;

-- Administrador: pone o borra el PIN de alguien del equipo y dice si puede autorizar.
-- Cada persona puede cambiar su propio PIN (no su permiso de autorizar).
create or replace function public.guardar_pin(p_restaurante uuid, p_user uuid, p_pin text, p_autoriza boolean default null)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  admin boolean := public.es_admin(p_restaurante);
begin
  if not admin and p_user is distinct from auth.uid() then
    raise exception 'Solo un administrador puede cambiar el PIN de otra persona';
  end if;
  if not exists (select 1 from public.usuarios u where u.restaurante_id = p_restaurante and u.user_id = p_user) then
    raise exception 'Esa persona no es del equipo';
  end if;
  if p_pin is not null and p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'El PIN tiene que tener de 4 a 6 números';
  end if;
  if p_pin is not null and exists (
    select 1 from public.equipo_pines e
    where e.restaurante_id = p_restaurante and e.user_id <> p_user and e.pin_hash is not null
      and e.pin_hash = crypt(p_pin, e.pin_hash)
  ) then
    raise exception 'Ese PIN ya lo usa otra persona del equipo. Elige otro.';
  end if;

  insert into public.equipo_pines (restaurante_id, user_id, pin_hash, autoriza)
  values (
    p_restaurante,
    p_user,
    case when p_pin is null then null else crypt(p_pin, gen_salt('bf')) end,
    case when admin then coalesce(p_autoriza, false) else false end
  )
  on conflict (restaurante_id, user_id) do update set
    -- Solo cambiar el permiso (p_pin null y p_autoriza con valor): el PIN queda como estaba.
    pin_hash = case when p_pin is null and p_autoriza is not null then public.equipo_pines.pin_hash else excluded.pin_hash end,
    autoriza = case when admin and p_autoriza is not null then p_autoriza else public.equipo_pines.autoriza end,
    updated_at = now();
end;
$$;
revoke all on function public.guardar_pin(uuid, uuid, text, boolean) from public, anon;
grant execute on function public.guardar_pin(uuid, uuid, text, boolean) to authenticated;

-- Para la pantalla Equipo: quién tiene PIN y quién puede autorizar (nunca el PIN).
create or replace function public.pines_equipo(p_restaurante uuid)
returns table (user_id uuid, tiene_pin boolean, autoriza boolean)
language sql
stable
security definer
set search_path = public
as $$
  select e.user_id, e.pin_hash is not null, e.autoriza
  from public.equipo_pines e
  where e.restaurante_id = p_restaurante and public.es_admin(p_restaurante);
$$;
revoke all on function public.pines_equipo(uuid) from public, anon;
grant execute on function public.pines_equipo(uuid) to authenticated;

-- Quién autoriza con este PIN (un administrador o alguien marcado "puede autorizar"). Cuenta los intentos fallidos.
create or replace function public.autorizador(p_restaurante uuid, p_pin text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  quien uuid;
begin
  if (select count(*) from public.pin_intentos i
      where i.user_id = auth.uid() and i.created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'Demasiados PIN equivocados. Espera 10 minutos o pide a un administrador que lo haga.';
  end if;
  select e.user_id into quien
  from public.equipo_pines e
  join public.usuarios u on u.restaurante_id = e.restaurante_id and u.user_id = e.user_id
  where e.restaurante_id = p_restaurante and e.pin_hash is not null
    and (e.autoriza or u.rol in ('dueno', 'staff'))
    and e.pin_hash = crypt(coalesce(p_pin, ''), e.pin_hash)
  limit 1;
  if quien is null then
    insert into public.pin_intentos (restaurante_id, user_id) values (p_restaurante, auth.uid());
  end if;
  return quien;
end;
$$;
revoke all on function public.autorizador(uuid, text) from public, anon, authenticated;

-- Verifica el PIN si hace falta y devuelve quién autoriza (el mismo usuario si es administrador o no se pide PIN).
create or replace function public.exigir_pin(p_restaurante uuid, p_pin text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  quien uuid;
begin
  if not public.es_miembro(p_restaurante) then
    raise exception 'No tienes acceso a este restaurante';
  end if;
  if not public.pide_pin(p_restaurante) then
    return auth.uid();
  end if;
  quien := public.autorizador(p_restaurante, p_pin);
  if quien is null then
    raise exception 'PIN incorrecto o sin permiso para autorizar';
  end if;
  return quien;
end;
$$;
revoke all on function public.exigir_pin(uuid, text) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- Candados: lo sensible pasa por las funciones de abajo cuando el restaurante pide PIN
-- ─────────────────────────────────────────────

create or replace function public.candado_cuenta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado = 'anulada' and old.estado <> 'anulada'
     and coalesce(current_setting('mesitto.autorizado', true), '') <> 'si'
     and public.pide_pin(new.restaurante_id)
     and exists (
       select 1 from public.pedidos p
       where p.cuenta_id = new.id and p.estado not in ('cancelado', 'pendiente')
     ) then
    raise exception 'Para anular hace falta el PIN de un encargado';
  end if;
  return new;
end;
$$;
drop trigger if exists cuentas_candado on public.cuentas;
create trigger cuentas_candado before update on public.cuentas
  for each row execute function public.candado_cuenta();

create or replace function public.candado_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado = 'cancelado' and old.estado in ('preparando', 'listo', 'entregado')
     and coalesce(current_setting('mesitto.autorizado', true), '') <> 'si'
     and public.pide_pin(new.restaurante_id) then
    raise exception 'Para cancelar algo que ya está en cocina hace falta el PIN de un encargado';
  end if;
  return new;
end;
$$;
drop trigger if exists pedidos_candado on public.pedidos;
create trigger pedidos_candado before update on public.pedidos
  for each row execute function public.candado_pedido();

create or replace function public.candado_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('mesitto.autorizado', true), '') <> 'si'
     and coalesce(current_setting('mesitto.copiar', true), '') <> 'si'
     and public.pide_pin(old.restaurante_id)
     and exists (
       select 1 from public.pedidos p where p.id = old.pedido_id and p.estado in ('preparando', 'listo', 'entregado')
     ) then
    raise exception 'Para quitar un plato que ya está en cocina hace falta el PIN de un encargado';
  end if;
  return old;
end;
$$;
drop trigger if exists pedido_items_candado on public.pedido_items;
create trigger pedido_items_candado before delete on public.pedido_items
  for each row execute function public.candado_item();

-- Bajar la cantidad de algo que ya está en cocina también pide PIN.
create or replace function public.candado_cantidad()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.cantidad < old.cantidad
     and coalesce(current_setting('mesitto.autorizado', true), '') <> 'si'
     and coalesce(current_setting('mesitto.copiar', true), '') <> 'si'
     and public.pide_pin(old.restaurante_id)
     and exists (
       select 1 from public.pedidos p where p.id = old.pedido_id and p.estado in ('preparando', 'listo', 'entregado')
     ) then
    raise exception 'Para quitar un plato que ya está en cocina hace falta el PIN de un encargado';
  end if;
  return new;
end;
$$;
drop trigger if exists pedido_items_candado_cantidad on public.pedido_items;
create trigger pedido_items_candado_cantidad before update of cantidad on public.pedido_items
  for each row execute function public.candado_cantidad();

-- Anular una cuenta o quitar un plato, con PIN si hace falta. Queda en el registro.
drop function if exists public.accion_autorizada(text, uuid, text, text);
-- p_cantidad (quitar_item): cuántas unidades se quitan; vacío = todas.
create or replace function public.accion_autorizada(
  p_accion text,
  p_ref uuid,
  p_pin text default null,
  p_motivo text default null,
  p_cantidad integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.cuentas;
  i public.pedido_items;
  p public.pedidos;
  quien uuid;
  monto numeric := 0;
  n integer;
begin
  if p_accion = 'anular_cuenta' then
    select * into c from public.cuentas where id = p_ref and estado = 'abierta' for update;
    if c.id is null then
      raise exception 'Esa cuenta ya no está abierta';
    end if;
    quien := public.exigir_pin(c.restaurante_id, p_pin);
    select coalesce(sum(x.precio * x.cantidad), 0) into monto
    from public.pedido_items x join public.pedidos y on y.id = x.pedido_id
    where y.cuenta_id = c.id and y.estado <> 'cancelado';
    perform set_config('mesitto.autorizado', 'si', true);
    update public.cuentas set estado = 'anulada', cerrada_at = now(), aviso = null where id = c.id;
    insert into public.autorizaciones (restaurante_id, cuenta_id, accion, detalle, motivo, monto, autorizado_por)
    values (c.restaurante_id, c.id, 'anular_cuenta',
            case when c.tipo in ('llevar', 'delivery') then coalesce(c.cliente_nombre, 'Pedido para llevar')
                 else coalesce('Mesa ' || c.mesa_numero, 'Mostrador') end,
            left(nullif(trim(p_motivo), ''), 120), monto, quien);
  elsif p_accion = 'quitar_item' then
    select * into i from public.pedido_items where id = p_ref;
    if i.id is null then
      raise exception 'Ese plato ya no está en el pedido';
    end if;
    select * into p from public.pedidos where id = i.pedido_id for update;
    quien := public.exigir_pin(i.restaurante_id, p_pin);
    n := least(coalesce(p_cantidad, i.cantidad), i.cantidad);
    if n < 1 then
      raise exception 'Cantidad inválida';
    end if;
    perform set_config('mesitto.autorizado', 'si', true);
    if n < i.cantidad then
      update public.pedido_items set cantidad = cantidad - n where id = i.id;
    else
      delete from public.pedido_items where id = i.id;
    end if;
    if not exists (select 1 from public.pedido_items where pedido_id = p.id) then
      update public.pedidos set estado = 'cancelado' where id = p.id;
    end if;
    insert into public.autorizaciones (restaurante_id, cuenta_id, accion, detalle, motivo, monto, autorizado_por)
    values (i.restaurante_id, p.cuenta_id, 'quitar_item', n || ' × ' || i.nombre,
            left(nullif(trim(p_motivo), ''), 120), i.precio * n, quien);
  else
    raise exception 'Acción desconocida';
  end if;
  return jsonb_build_object('autorizado_por', quien);
end;
$$;
revoke all on function public.accion_autorizada(text, uuid, text, text, integer) from public, anon;
grant execute on function public.accion_autorizada(text, uuid, text, text, integer) to authenticated;

-- ─────────────────────────────────────────────
-- Descuentos y cortesías
-- ─────────────────────────────────────────────

-- Precio de carta antes del descuento (vacío: sin descuento).
alter table public.pedido_items add column if not exists precio_original numeric(10, 2);

-- Aplica un descuento a los platos elegidos (o a toda la cuenta si p_items viene vacío):
-- p_porcentaje de 1 a 100 (100 = cortesía) o p_monto fijo repartido entre esos platos. 0 quita el descuento.
-- Siempre sobre el precio original: aplicar 10 % dos veces deja 10 %, no 19 %.
create or replace function public.aplicar_descuento(
  p_cuenta uuid,
  p_items uuid[],
  p_porcentaje numeric,
  p_monto numeric,
  p_motivo text,
  p_pin text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.cuentas;
  quien uuid;
  base numeric;
  pct numeric;
  antes numeric;
  despues numeric;
  x record;
begin
  select * into c from public.cuentas where id = p_cuenta and estado = 'abierta' for update;
  if c.id is null then
    raise exception 'Esa cuenta ya no está abierta';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Escribe el motivo del descuento';
  end if;
  -- Un mesero siempre necesita el PIN de un encargado para descontar (aunque el PIN no esté activado para anular).
  if not public.es_miembro(c.restaurante_id) then
    raise exception 'No tienes acceso a este restaurante';
  end if;
  if public.es_admin(c.restaurante_id) then
    quien := auth.uid();
  else
    quien := public.autorizador(c.restaurante_id, p_pin);
    if quien is null then
      raise exception 'Un descuento necesita el PIN de un encargado (PIN incorrecto o sin permiso)';
    end if;
  end if;

  create temporary table if not exists _lineas_descuento (id uuid, original numeric, cantidad int) on commit drop;
  truncate _lineas_descuento;
  insert into _lineas_descuento
  select i.id, coalesce(i.precio_original, i.precio), i.cantidad
  from public.pedido_items i join public.pedidos p on p.id = i.pedido_id
  where p.cuenta_id = c.id and p.estado <> 'cancelado'
    and (p_items is null or cardinality(p_items) = 0 or i.id = any (p_items));

  select coalesce(sum(original * cantidad), 0) into base from _lineas_descuento;
  if base <= 0 then
    raise exception 'No hay platos para descontar';
  end if;
  pct := case
    when coalesce(p_monto, 0) > 0 then least(100, p_monto * 100 / base)
    else greatest(0, least(100, coalesce(p_porcentaje, 0)))
  end;

  select coalesce(sum(i.precio * i.cantidad), 0) into antes
  from public.pedido_items i where i.id in (select id from _lineas_descuento);

  perform set_config('mesitto.copiar', 'si', true);
  for x in select * from _lineas_descuento loop
    update public.pedido_items set
      precio = round(x.original * (100 - pct) / 100, case when x.original = trunc(x.original) then 0 else 2 end),
      precio_original = case when pct = 0 then null else x.original end
    where id = x.id;
  end loop;
  perform set_config('mesitto.copiar', '', true);

  select coalesce(sum(i.precio * i.cantidad), 0) into despues
  from public.pedido_items i where i.id in (select id from _lineas_descuento);

  insert into public.autorizaciones (restaurante_id, cuenta_id, accion, detalle, motivo, monto, autorizado_por)
  values (c.restaurante_id, c.id, case when pct = 0 then 'quitar_descuento' else 'descuento' end,
          case when coalesce(p_monto, 0) > 0 then 'Monto fijo' when pct = 100 then 'Cortesía' else round(pct, 1) || ' %' end
            || case when p_items is null or cardinality(p_items) = 0 then ' a toda la cuenta' when cardinality(p_items) = 1 then ' a 1 plato' else ' a ' || cardinality(p_items) || ' platos' end,
          left(trim(p_motivo), 120), base - despues, quien);

  -- descontado: cuánto menos se cobra por esos platos respecto de la carta.
  return jsonb_build_object('descontado', base - despues, 'cambio', antes - despues, 'autorizado_por', quien);
end;
$$;
revoke all on function public.aplicar_descuento(uuid, uuid[], numeric, numeric, text, text) from public, anon;
grant execute on function public.aplicar_descuento(uuid, uuid[], numeric, numeric, text, text) to authenticated;

-- ─────────────────────────────────────────────
-- Gastos con categoría y retiros de efectivo
-- ─────────────────────────────────────────────

alter table public.gastos add column if not exists categoria text not null default 'Otros'
  check (char_length(categoria) between 1 and 40);
alter table public.gastos add column if not exists proveedor text check (char_length(proveedor) <= 80);
-- "retiro": efectivo que sale de la caja a la caja fuerte (no es un gasto, pero baja el efectivo esperado).
alter table public.gastos add column if not exists tipo text not null default 'gasto' check (tipo in ('gasto', 'retiro'));

-- ─────────────────────────────────────────────
-- Corte parcial (corte X): se guarda sin cerrar el turno
-- ─────────────────────────────────────────────

alter table public.cierres_caja add column if not exists tipo text not null default 'total' check (tipo in ('total', 'parcial'));

-- ─────────────────────────────────────────────
-- Ranking de productos vendidos (cuentas cerradas en el período)
-- ─────────────────────────────────────────────

create or replace function public.ranking_productos(p_restaurante uuid, p_desde timestamptz, p_hasta timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  zona text;
  resultado jsonb;
begin
  if not public.es_admin(p_restaurante) then
    raise exception 'Solo el administrador ve el ranking';
  end if;
  select coalesce(nullif(r.ajustes ->> 'zona_horaria', ''), 'America/Santiago') into zona
  from public.restaurantes r where r.id = p_restaurante;

  with lineas as (
    select i.plato_id, i.nombre, i.cantidad, i.precio * i.cantidad as monto,
           coalesce(c.tipo, 'mesa') as tipo, extract(hour from c.cerrada_at at time zone zona)::int as hora
    from public.pedido_items i
    join public.pedidos p on p.id = i.pedido_id
    join public.cuentas c on c.id = p.cuenta_id
    where i.restaurante_id = p_restaurante and c.estado = 'cerrada'
      and c.cerrada_at >= p_desde and c.cerrada_at < p_hasta and p.estado <> 'cancelado'
  )
  select jsonb_build_object(
    'platos', coalesce((
      select jsonb_agg(f) from (
        select plato_id, max(nombre) as nombre, tipo, sum(cantidad)::int as unidades, sum(monto) as monto
        from lineas group by plato_id, case when plato_id is null then nombre end, tipo
      ) f), '[]'::jsonb),
    'horas', coalesce((
      select jsonb_agg(h) from (
        select hora, sum(cantidad)::int as unidades, sum(monto) as monto from lineas group by hora order by hora
      ) h), '[]'::jsonb)
  ) into resultado;
  return resultado;
end;
$$;
revoke all on function public.ranking_productos(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.ranking_productos(uuid, timestamptz, timestamptz) to authenticated;
