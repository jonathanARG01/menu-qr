-- Mesitto · pedidos para llevar y delivery, clientes frecuentes, recordatorio de reservas y reportes por mesero.
-- Requiere 0004 (salón), 0008 (avisos push) y 0009 (reservas y cobro online). Se puede ejecutar más de una vez.
-- Ejecutar en Supabase: SQL Editor > New query > pegar todo y Run.

-- ─────────────────────────────────────────────
-- Clientes frecuentes
-- Se guardan solos con el teléfono de las reservas y de los pedidos para llevar (o el mesero los elige en la mesa).
-- Las visitas y lo gastado se calculan de las mesas cerradas, así nunca quedan desfasados.
-- ─────────────────────────────────────────────

-- Los últimos 9 dígitos del teléfono: "+56 9 1234 5678" y "912345678" son el mismo cliente.
create or replace function public.clave_telefono(t text)
returns text
language sql
immutable
as $$
  select case when length(d) >= 6 then right(d, 9) end
  from (select regexp_replace(coalesce(t, ''), '\D', '', 'g') as d) x;
$$;

create table if not exists public.clientes (
  id             uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  nombre         text not null check (char_length(nombre) between 1 and 60),
  telefono       text check (char_length(telefono) <= 30),
  telefono_clave text generated always as (public.clave_telefono(telefono)) stored,
  email          text check (char_length(email) <= 120),
  direccion      text check (char_length(direccion) <= 200),
  -- Alergias, gustos, mesa preferida… Lo ve el equipo al atenderlo.
  nota           text check (char_length(nota) <= 300),
  created_at     timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);
create unique index if not exists clientes_telefono_idx on public.clientes (restaurante_id, telefono_clave)
  where telefono_clave is not null;
create index if not exists clientes_nombre_idx on public.clientes (restaurante_id, lower(nombre));

create or replace function public.validar_cliente()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.nombre := trim(new.nombre);
  new.telefono := nullif(trim(new.telefono), '');
  new.actualizado_at := now();
  return new;
end;
$$;
drop trigger if exists clientes_coherente on public.clientes;
create trigger clientes_coherente
  before insert or update on public.clientes
  for each row execute function public.validar_cliente();

alter table public.clientes enable row level security;
grant select, insert, update, delete on public.clientes to authenticated;
drop policy if exists "equipo: ver clientes" on public.clientes;
create policy "equipo: ver clientes" on public.clientes
  for select to authenticated using (public.es_miembro(restaurante_id));
drop policy if exists "equipo: anotar clientes" on public.clientes;
create policy "equipo: anotar clientes" on public.clientes
  for insert to authenticated with check (public.es_miembro(restaurante_id));
drop policy if exists "equipo: editar clientes" on public.clientes;
create policy "equipo: editar clientes" on public.clientes
  for update to authenticated using (public.es_miembro(restaurante_id)) with check (public.es_miembro(restaurante_id));
drop policy if exists "admin: borrar clientes" on public.clientes;
create policy "admin: borrar clientes" on public.clientes
  for delete to authenticated using (public.es_admin(restaurante_id));

-- Busca al cliente por teléfono y, si no existe, lo crea. Devuelve su id (o nada si no hay teléfono).
create or replace function public.vincular_cliente(p_restaurante uuid, p_nombre text, p_telefono text, p_direccion text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if public.clave_telefono(p_telefono) is null or coalesce(trim(p_nombre), '') = '' then
    return null;
  end if;
  insert into public.clientes (restaurante_id, nombre, telefono, direccion)
  values (p_restaurante, left(trim(p_nombre), 60), left(trim(p_telefono), 30), nullif(left(trim(p_direccion), 200), ''))
  on conflict (restaurante_id, telefono_clave) where telefono_clave is not null
  do update set direccion = coalesce(excluded.direccion, public.clientes.direccion)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.vincular_cliente(uuid, text, text, text) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- Para llevar y delivery: una cuenta sin mesa, con el cliente, la hora de retiro y la dirección.
-- Quién atiende cada mesa (para los reportes por mesero).
-- ─────────────────────────────────────────────

alter table public.cuentas
  add column if not exists tipo             text not null default 'mesa',
  add column if not exists origen           text not null default 'personal',
  add column if not exists cliente_id       uuid references public.clientes (id) on delete set null,
  add column if not exists cliente_nombre   text check (char_length(cliente_nombre) <= 60),
  add column if not exists cliente_telefono text check (char_length(cliente_telefono) <= 30),
  add column if not exists direccion        text check (char_length(direccion) <= 200),
  -- Hora a la que lo retiran o a la que quieren recibirlo (vacío: lo antes posible).
  add column if not exists para_hora        timestamptz,
  add column if not exists envio            numeric(10, 2) not null default 0 check (envio >= 0),
  -- Delivery: cuándo salió el repartidor.
  add column if not exists despachado_at    timestamptz,
  add column if not exists mesero_id        uuid references auth.users (id) on delete set null default auth.uid();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cuentas_tipo_check') then
    alter table public.cuentas add constraint cuentas_tipo_check check (tipo in ('mesa', 'llevar', 'delivery'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cuentas_origen_check') then
    alter table public.cuentas add constraint cuentas_origen_check check (origen in ('personal', 'cliente'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cuentas_llevar_sin_mesa') then
    alter table public.cuentas add constraint cuentas_llevar_sin_mesa check (tipo = 'mesa' or mesa_id is null);
  end if;
end;
$$;
create index if not exists cuentas_cliente_idx on public.cuentas (cliente_id) where cliente_id is not null;
create index if not exists cuentas_cerradas_idx on public.cuentas (restaurante_id, cerrada_at) where estado = 'cerrada';

-- El cliente es del mismo restaurante; con teléfono se anota (o se encuentra) solo.
create or replace function public.cuenta_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.cliente_id is not null and not exists (
    select 1 from public.clientes c where c.id = new.cliente_id and c.restaurante_id = new.restaurante_id
  ) then
    raise exception 'El cliente no pertenece a este restaurante';
  end if;
  if new.cliente_id is null and new.cliente_telefono is not null then
    new.cliente_id := public.vincular_cliente(new.restaurante_id, new.cliente_nombre, new.cliente_telefono, new.direccion);
  end if;
  return new;
end;
$$;
drop trigger if exists cuentas_cliente on public.cuentas;
create trigger cuentas_cliente
  before insert or update of cliente_id, cliente_telefono on public.cuentas
  for each row execute function public.cuenta_cliente();

-- Cada comanda sabe si es de mesa, para llevar o delivery (la cocina lo muestra) y quién la tomó.
alter table public.pedidos add column if not exists tipo text not null default 'mesa';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pedidos_tipo_check') then
    alter table public.pedidos add constraint pedidos_tipo_check check (tipo in ('mesa', 'llevar', 'delivery'));
  end if;
end;
$$;
alter table public.pedidos alter column creado_por set default auth.uid();

-- La mesa queda a cargo de quien la abre; si la abrió el cliente desde el QR, de quien toma el primer pedido o cobra.
create or replace function public.validar_pedido()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  c public.cuentas;
begin
  if new.cuenta_id is not null then
    select * into c from public.cuentas where id = new.cuenta_id and restaurante_id = new.restaurante_id;
    if c.id is null then
      raise exception 'La cuenta no pertenece a este restaurante';
    end if;
    new.tipo := c.tipo;
    if tg_op = 'INSERT' and c.mesero_id is null and auth.uid() is not null and public.es_miembro(new.restaurante_id) then
      update public.cuentas set mesero_id = auth.uid() where id = c.id and mesero_id is null;
    end if;
  end if;
  new.actualizado_at := now();
  return new;
end;
$$;

create or replace function public.validar_pago()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.cuentas c where c.id = new.cuenta_id and c.restaurante_id = new.restaurante_id
  ) then
    raise exception 'La cuenta no pertenece a este restaurante';
  end if;
  if tg_op = 'INSERT' and auth.uid() is not null and public.es_miembro(new.restaurante_id) then
    update public.cuentas set mesero_id = auth.uid() where id = new.cuenta_id and mesero_id is null;
  end if;
  return new;
end;
$$;

-- ─────────────────────────────────────────────
-- Reservas: cliente, recordatorio y respuesta del cliente ("voy" / "no puedo ir")
-- ─────────────────────────────────────────────

alter table public.reservas
  add column if not exists cliente_id      uuid references public.clientes (id) on delete set null,
  add column if not exists recordatorio_at timestamptz,
  -- Cómo se le recordó: aviso al celular ("push") o WhatsApp.
  add column if not exists recordatorio_medio text check (recordatorio_medio in ('push', 'whatsapp')),
  add column if not exists asistencia      text check (asistencia in ('si', 'no')),
  add column if not exists asistencia_at   timestamptz;
create index if not exists reservas_cliente_idx on public.reservas (cliente_id) where cliente_id is not null;

create or replace function public.reserva_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.cliente_id is not null and not exists (
    select 1 from public.clientes c where c.id = new.cliente_id and c.restaurante_id = new.restaurante_id
  ) then
    raise exception 'El cliente no pertenece a este restaurante';
  end if;
  if new.cliente_id is null and new.telefono is not null and new.tipo = 'reserva' then
    new.cliente_id := public.vincular_cliente(new.restaurante_id, new.nombre, new.telefono, null);
  end if;
  return new;
end;
$$;
drop trigger if exists reservas_cliente on public.reservas;
create trigger reservas_cliente
  before insert or update of cliente_id, telefono on public.reservas
  for each row execute function public.reserva_cliente();

-- Lo que ve el cliente en el enlace del recordatorio. El id de la reserva hace de clave: no se puede adivinar.
create or replace function public.ver_reserva(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'nombre', e.nombre,
    'personas', e.personas,
    'fecha', e.fecha,
    'estado', e.estado,
    'asistencia', e.asistencia,
    'zona', public.zona_restaurante(e.restaurante_id),
    'sucursal', s.nombre,
    'direccion', s.direccion,
    'whatsapp', coalesce(s.whatsapp, r.whatsapp)
  )
  from public.reservas e
  join public.restaurantes r on r.id = e.restaurante_id
  left join public.sucursales s on s.id = e.sucursal_id
  where e.id = p_id and e.tipo = 'reserva';
$$;

create or replace function public.responder_reserva(p_id uuid, p_respuesta text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_respuesta not in ('si', 'no') then
    raise exception 'Respuesta no válida';
  end if;
  update public.reservas
  set asistencia = p_respuesta,
      asistencia_at = now(),
      estado = case when p_respuesta = 'no' then 'cancelada' else estado end
  where id = p_id and tipo = 'reserva' and estado in ('pendiente', 'confirmada') and fecha > now() - interval '1 hour';
  return public.ver_reserva(p_id);
end;
$$;

revoke all on function public.ver_reserva(uuid) from public;
revoke all on function public.responder_reserva(uuid, text) from public;
grant execute on function public.ver_reserva(uuid) to anon, authenticated;
grant execute on function public.responder_reserva(uuid, text) to anon, authenticated;

-- Avisos al celular también para una reserva (el recordatorio) o un pedido para llevar.
alter table public.suscripciones_push alter column cuenta_id drop not null;
alter table public.suscripciones_push add column if not exists reserva_id uuid references public.reservas (id) on delete cascade;
create index if not exists suscripciones_push_reserva_idx on public.suscripciones_push (reserva_id) where reserva_id is not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'suscripciones_push_destino') then
    alter table public.suscripciones_push
      add constraint suscripciones_push_destino check (cuenta_id is not null or reserva_id is not null);
  end if;
end;
$$;

create or replace function public.suscribir_avisos_reserva(p_reserva uuid, p_endpoint text, p_claves jsonb, p_idioma text default 'es')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.reservas;
begin
  if p_endpoint is null or p_endpoint not like 'https://%' or char_length(p_endpoint) > 1000
     or jsonb_typeof(p_claves) <> 'object' or length(p_claves::text) > 500 then
    return false;
  end if;
  select * into e from public.reservas
  where id = p_reserva and tipo = 'reserva' and estado in ('pendiente', 'confirmada') and fecha > now();
  if e.id is null then
    return false;
  end if;
  insert into public.suscripciones_push (restaurante_id, reserva_id, endpoint, claves, idioma)
  values (e.restaurante_id, e.id, p_endpoint, p_claves, coalesce(left(p_idioma, 5), 'es'))
  on conflict (endpoint) do update
    set restaurante_id = excluded.restaurante_id, reserva_id = excluded.reserva_id,
        claves = excluded.claves, idioma = excluded.idioma, created_at = now();
  return true;
end;
$$;

create or replace function public.suscribir_avisos_pedido(p_cuenta uuid, p_endpoint text, p_claves jsonb, p_idioma text default 'es')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.cuentas;
begin
  if p_endpoint is null or p_endpoint not like 'https://%' or char_length(p_endpoint) > 1000
     or jsonb_typeof(p_claves) <> 'object' or length(p_claves::text) > 500 then
    return false;
  end if;
  select * into c from public.cuentas where id = p_cuenta and tipo <> 'mesa' and estado = 'abierta';
  if c.id is null or (select count(*) from public.suscripciones_push where cuenta_id = c.id) >= 5 then
    return false;
  end if;
  insert into public.suscripciones_push (restaurante_id, cuenta_id, endpoint, claves, idioma)
  values (c.restaurante_id, c.id, p_endpoint, p_claves, coalesce(left(p_idioma, 5), 'es'))
  on conflict (endpoint) do update
    set restaurante_id = excluded.restaurante_id, cuenta_id = excluded.cuenta_id,
        claves = excluded.claves, idioma = excluded.idioma, created_at = now();
  return true;
end;
$$;

revoke all on function public.suscribir_avisos_reserva(uuid, text, jsonb, text) from public;
revoke all on function public.suscribir_avisos_pedido(uuid, text, jsonb, text) from public;
grant execute on function public.suscribir_avisos_reserva(uuid, text, jsonb, text) to anon, authenticated;
grant execute on function public.suscribir_avisos_pedido(uuid, text, jsonb, text) to anon, authenticated;

-- ─────────────────────────────────────────────
-- Pedido para llevar o delivery desde la carta (si el restaurante lo permite)
-- p_items: [{"id": "<plato>", "cantidad": 2, "nota": "sin cebolla"}]
-- ─────────────────────────────────────────────

create or replace function public.pedir_para_llevar(
  p_restaurante uuid,
  p_sucursal uuid,
  p_tipo text,
  p_items jsonb,
  p_nombre text,
  p_telefono text,
  p_direccion text default null,
  p_hora timestamptz default null,
  p_nota text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.restaurantes;
  c public.cuentas;
  est text;
  ped uuid;
  v_estado text;
  v_suc uuid;
  v_envio numeric := 0;
  total numeric := 0;
  creados integer := 0;
begin
  select * into r from public.restaurantes where id = p_restaurante and activo;
  if r.id is null or not coalesce((r.ajustes #>> '{modulos,llevar}')::boolean, true)
     or not coalesce((r.ajustes #>> '{llevar,online}')::boolean, false) then
    raise exception 'Este restaurante no recibe pedidos para llevar por internet';
  end if;
  if p_tipo not in ('llevar', 'delivery') then
    raise exception 'Tipo de pedido no válido';
  end if;
  if p_tipo = 'delivery' and not coalesce((r.ajustes #>> '{llevar,delivery}')::boolean, false) then
    raise exception 'Este restaurante no hace delivery';
  end if;
  if coalesce(trim(p_nombre), '') = '' or public.clave_telefono(p_telefono) is null then
    raise exception 'Faltan tu nombre o tu teléfono';
  end if;
  if p_tipo = 'delivery' and coalesce(trim(p_direccion), '') = '' then
    raise exception 'Falta la dirección de entrega';
  end if;
  if p_hora is not null and (p_hora < now() - interval '10 minutes' or p_hora > now() + interval '3 days') then
    raise exception 'Elige una hora de hoy o de los próximos días';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    raise exception 'El pedido está vacío o es demasiado largo';
  end if;
  -- Freno contra abusos: 60 pedidos por hora en el local y 4 por teléfono.
  if (select count(*) from public.cuentas where restaurante_id = r.id and origen = 'cliente' and tipo <> 'mesa'
      and abierta_at > now() - interval '1 hour') >= 60
     or (select count(*) from public.cuentas where restaurante_id = r.id and origen = 'cliente' and tipo <> 'mesa'
      and public.clave_telefono(cliente_telefono) = public.clave_telefono(p_telefono)
      and abierta_at > now() - interval '1 hour') >= 4 then
    raise exception 'Recibimos muchos pedidos seguidos. Escríbenos por WhatsApp, por favor.';
  end if;

  v_suc := (select id from public.sucursales where id = p_sucursal and restaurante_id = r.id);
  if p_tipo = 'delivery' then
    v_envio := greatest(coalesce(nullif(r.ajustes #>> '{llevar,envio}', '')::numeric, 0), 0);
  end if;
  -- Por confirmar si el local lo revisa antes, o si pide pagar primero (pasa a cocina cuando se paga).
  v_estado := case
    when coalesce((r.ajustes #>> '{llevar,confirmar}')::boolean, true)
      or coalesce((r.ajustes #>> '{llevar,pago_obligatorio}')::boolean, false) then 'pendiente'
    else 'nuevo' end;

  insert into public.cuentas (restaurante_id, sucursal_id, tipo, origen, comensales, cliente_nombre, cliente_telefono,
                              direccion, para_hora, envio, mesero_id)
  values (r.id, v_suc, p_tipo, 'cliente', 1, left(trim(p_nombre), 60), left(trim(p_telefono), 30),
          case when p_tipo = 'delivery' then left(trim(p_direccion), 200) end, p_hora, v_envio, null)
  returning * into c;

  for est in
    select distinct cat.estacion
    from jsonb_array_elements(p_items) it
    join public.platos pl on pl.id = (it ->> 'id')::uuid and pl.restaurante_id = r.id and pl.disponible
    join public.categorias cat on cat.id = pl.categoria_id
  loop
    insert into public.pedidos (restaurante_id, cuenta_id, sucursal_id, estacion, origen, estado, nombre, nota, creado_por)
    values (r.id, c.id, v_suc, est, 'cliente', v_estado, left(trim(p_nombre), 40), nullif(left(trim(p_nota), 200), ''), null)
    returning id into ped;

    insert into public.pedido_items (pedido_id, restaurante_id, plato_id, nombre, precio, cantidad, nota)
    select ped, r.id, pl.id, pl.nombre, pl.precio,
           least(greatest(coalesce((it ->> 'cantidad')::int, 1), 1), 99),
           nullif(left(trim(it ->> 'nota'), 120), '')
    from jsonb_array_elements(p_items) it
    join public.platos pl on pl.id = (it ->> 'id')::uuid and pl.restaurante_id = r.id and pl.disponible
    join public.categorias cat on cat.id = pl.categoria_id and cat.estacion = est;
    creados := creados + 1;
  end loop;

  if creados = 0 then
    raise exception 'Los platos elegidos ya no están disponibles';
  end if;

  select coalesce(sum(i.precio * i.cantidad), 0) into total
  from public.pedido_items i join public.pedidos p on p.id = i.pedido_id
  where p.cuenta_id = c.id;

  insert into public.eventos (restaurante_id, sucursal_id, tipo, total, detalle)
  select r.id, v_suc, 'pedido', total,
         (select jsonb_agg(jsonb_build_object('id', pl.id, 'nombre', pl.nombre, 'cantidad', least(greatest(coalesce((it ->> 'cantidad')::int, 1), 1), 99)))
          from jsonb_array_elements(p_items) it join public.platos pl on pl.id = (it ->> 'id')::uuid and pl.restaurante_id = r.id);

  return jsonb_build_object('id', c.id, 'pendiente', v_estado = 'pendiente');
end;
$$;

-- Seguimiento del pedido en el teléfono del cliente. El id de la cuenta hace de clave.
create or replace function public.mi_pedido(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'tipo', c.tipo,
    'estado', c.estado,
    'nombre', c.cliente_nombre,
    'direccion', c.direccion,
    'para_hora', c.para_hora,
    'envio', c.envio,
    'desde', c.abierta_at,
    'despachado_at', c.despachado_at,
    'cerrada_at', c.cerrada_at,
    'zona', public.zona_restaurante(c.restaurante_id),
    'whatsapp', coalesce(s.whatsapp, r.whatsapp),
    'pagado', (select coalesce(sum(monto), 0) from public.pagos where cuenta_id = c.id),
    'pedidos', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'numero', p.numero, 'estado', p.estado,
        'items', (select coalesce(jsonb_agg(jsonb_build_object(
            'nombre', i.nombre, 'precio', i.precio, 'cantidad', i.cantidad
          ) order by i.created_at), '[]') from public.pedido_items i where i.pedido_id = p.id)
      ) order by p.created_at), '[]')
      from public.pedidos p where p.cuenta_id = c.id and p.estado <> 'cancelado'
    )
  )
  from public.cuentas c
  join public.restaurantes r on r.id = c.restaurante_id
  left join public.sucursales s on s.id = c.sucursal_id
  where c.id = p_id and c.tipo <> 'mesa' and c.abierta_at > now() - interval '3 days';
$$;

revoke all on function public.pedir_para_llevar(uuid, uuid, text, jsonb, text, text, text, timestamptz, text) from public;
revoke all on function public.mi_pedido(uuid) from public;
grant execute on function public.pedir_para_llevar(uuid, uuid, text, jsonb, text, text, text, timestamptz, text) to anon, authenticated;
grant execute on function public.mi_pedido(uuid) to anon, authenticated;

-- Pago por adelantado de un pedido para llevar (con Mercado Pago). Como crear_pago_online, solo para el servidor.
create or replace function public.crear_pago_pedido(p_cuenta uuid, p_propina numeric default 0)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.restaurantes;
  c public.cuentas;
  v_token text;
  v_falta numeric;
  v_propina numeric;
  v_id uuid;
begin
  select * into c from public.cuentas where id = p_cuenta and tipo <> 'mesa' and estado = 'abierta';
  if c.id is null then
    raise exception 'El pedido ya no está abierto';
  end if;
  select * into r from public.restaurantes where id = c.restaurante_id;
  if coalesce(r.ajustes -> 'cobro_online' ->> 'activo', 'false') <> 'true' then
    raise exception 'El restaurante no tiene el pago online activado';
  end if;
  select mp_access_token into v_token from public.cobro_online where restaurante_id = r.id;
  if v_token is null then
    raise exception 'El restaurante no conectó Mercado Pago';
  end if;

  select coalesce(sum(i.precio * i.cantidad), 0) + c.envio into v_falta
  from public.pedido_items i join public.pedidos p on p.id = i.pedido_id
  where p.cuenta_id = c.id and p.estado <> 'cancelado';
  v_falta := v_falta - (select coalesce(sum(monto), 0) from public.pagos where cuenta_id = c.id);
  if v_falta <= 0 then
    raise exception 'El pedido ya está pagado';
  end if;
  v_propina := least(greatest(round(coalesce(p_propina, 0), 2), 0), round(v_falta / 2, 2));

  insert into public.pagos_online (restaurante_id, cuenta_id, monto, propina)
  values (r.id, c.id, v_falta, v_propina)
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id, 'monto', v_falta, 'propina', v_propina, 'tipo', c.tipo,
    'restaurante', r.nombre, 'slug', r.slug, 'moneda', r.moneda, 'token', v_token
  );
end;
$$;
revoke all on function public.crear_pago_pedido(uuid, numeric) from public, anon, authenticated;
grant execute on function public.crear_pago_pedido(uuid, numeric) to service_role;

-- Igual que en 0009, y además: si el pedido para llevar esperaba el pago para ir a cocina, pasa solo.
create or replace function public.registrar_pago_online(p_id uuid, p_mp_pago_id text, p_estado text, p_pagado numeric)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  po public.pagos_online;
  r public.restaurantes;
begin
  select * into po from public.pagos_online where id = p_id for update;
  if po.id is null then
    return null;
  end if;
  if po.estado = 'aprobado' then
    return 'aprobado';
  end if;

  if p_estado = 'approved' and coalesce(p_pagado, 0) >= po.monto + po.propina - 0.01 then
    insert into public.pagos (restaurante_id, cuenta_id, parte, monto, propina, metodo, propina_metodo, origen, mp_pago_id)
    values (po.restaurante_id, po.cuenta_id, po.parte, po.monto, po.propina, 'Mercado Pago',
            case when po.propina > 0 then 'Mercado Pago' end, 'online', p_mp_pago_id)
    on conflict (mp_pago_id) do nothing;
    update public.pagos_online set estado = 'aprobado', mp_pago_id = p_mp_pago_id, actualizado_at = now() where id = po.id;
    update public.cuentas
    set aviso = jsonb_build_object(
      'tipo', 'pago', 'at', now(),
      'detalle', jsonb_build_object('monto', po.monto, 'propina', po.propina, 'parte', po.parte)
    )
    where id = po.cuenta_id and estado = 'abierta';
    select * into r from public.restaurantes where id = po.restaurante_id;
    if not coalesce((r.ajustes #>> '{llevar,confirmar}')::boolean, true) then
      update public.pedidos set estado = 'nuevo'
      where cuenta_id = po.cuenta_id and estado = 'pendiente' and tipo <> 'mesa';
    end if;
    return 'aprobado';
  elsif p_estado in ('rejected', 'cancelled', 'refunded', 'charged_back') then
    update public.pagos_online set estado = 'rechazado', mp_pago_id = p_mp_pago_id, actualizado_at = now() where id = po.id;
    return 'rechazado';
  end if;
  return po.estado;
end;
$$;
revoke all on function public.registrar_pago_online(uuid, text, text, numeric) from public, anon, authenticated;
grant execute on function public.registrar_pago_online(uuid, text, text, numeric) to service_role;

-- ─────────────────────────────────────────────
-- Clientes con sus números: visitas, lo gastado, la última vez que vinieron, reservas y "no vino".
-- ─────────────────────────────────────────────

create or replace view public.clientes_resumen with (security_invoker = true) as
select
  cl.*,
  coalesce(v.visitas, 0)::integer as visitas,
  coalesce(v.gastado, 0)::numeric(12, 2) as gastado,
  v.ultima_visita,
  coalesce(rs.reservas, 0)::integer as reservas,
  coalesce(rs.no_vino, 0)::integer as no_vino
from public.clientes cl
left join lateral (
  select count(*) as visitas,
         sum((select coalesce(sum(p.monto), 0) from public.pagos p where p.cuenta_id = c.id)) as gastado,
         max(c.cerrada_at) as ultima_visita
  from public.cuentas c
  where c.cliente_id = cl.id and c.estado = 'cerrada'
) v on true
left join lateral (
  select count(*) filter (where r.estado <> 'cancelada') as reservas,
         count(*) filter (where r.estado = 'no_vino') as no_vino
  from public.reservas r
  where r.cliente_id = cl.id and r.tipo = 'reserva'
) rs on true;
grant select on public.clientes_resumen to authenticated;

-- ─────────────────────────────────────────────
-- Equipo: nombres para elegir quién atiende una mesa (lo ve todo el equipo, solo la parte del correo antes de @)
-- ─────────────────────────────────────────────

create or replace function public.nombres_equipo(p_restaurante uuid)
returns table (user_id uuid, nombre text, rol text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_miembro(p_restaurante) then
    raise exception 'No eres parte de este equipo';
  end if;
  return query
  select u.user_id, split_part(au.email::text, '@', 1), u.rol
  from public.usuarios u join auth.users au on au.id = u.user_id
  where u.restaurante_id = p_restaurante
  order by 2;
end;
$$;
revoke all on function public.nombres_equipo(uuid) from public;
grant execute on function public.nombres_equipo(uuid) to authenticated;

-- ─────────────────────────────────────────────
-- Reportes por mesero: mesas atendidas, ventas, propinas y tiempos de cada persona, semana a semana.
-- Solo para el administrador.
-- ─────────────────────────────────────────────

create or replace function public.reporte_equipo(p_restaurante uuid, p_desde timestamptz, p_hasta timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tz text := public.zona_restaurante(p_restaurante);
  v jsonb;
begin
  if not public.es_admin(p_restaurante) then
    raise exception 'Solo el administrador ve los reportes';
  end if;
  if p_hasta - p_desde > interval '400 days' then
    raise exception 'Elige un período de hasta un año';
  end if;

  with base as (
    select c.id, c.tipo, c.comensales, c.abierta_at, c.cerrada_at,
           coalesce(c.mesero_id, (
             select p.registrado_por from public.pagos p
             where p.cuenta_id = c.id and p.registrado_por is not null and p.origen = 'personal'
             order by p.created_at limit 1
           )) as persona,
           (select coalesce(sum(monto), 0) from public.pagos where cuenta_id = c.id) as ventas,
           (select coalesce(sum(propina), 0) from public.pagos where cuenta_id = c.id) as propinas
    from public.cuentas c
    where c.restaurante_id = p_restaurante and c.estado = 'cerrada'
      and c.cerrada_at >= p_desde and c.cerrada_at < p_hasta
  ),
  semanas as (
    select persona, date_trunc('week', cerrada_at at time zone tz)::date as semana,
           count(*) filter (where tipo = 'mesa') as mesas,
           count(*) filter (where tipo <> 'mesa') as llevar,
           coalesce(sum(comensales) filter (where tipo = 'mesa'), 0) as comensales,
           sum(ventas) as ventas,
           sum(propinas) as propinas,
           coalesce(sum(extract(epoch from cerrada_at - abierta_at) / 60) filter (where tipo = 'mesa'), 0) as minutos
    from base group by 1, 2
  ),
  comandas as (
    select creado_por as persona, date_trunc('week', created_at at time zone tz)::date as semana, count(*) as comandas
    from public.pedidos
    where restaurante_id = p_restaurante and origen = 'personal' and estado <> 'cancelado'
      and created_at >= p_desde and created_at < p_hasta
    group by 1, 2
  )
  select jsonb_build_object(
    'filas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'persona', coalesce(s.persona, k.persona),
        'semana', coalesce(s.semana, k.semana),
        'mesas', coalesce(s.mesas, 0),
        'llevar', coalesce(s.llevar, 0),
        'comensales', coalesce(s.comensales, 0),
        'ventas', coalesce(s.ventas, 0),
        'propinas', coalesce(s.propinas, 0),
        'minutos', round(coalesce(s.minutos, 0)),
        'comandas', coalesce(k.comandas, 0)
      ) order by coalesce(s.semana, k.semana))
      from semanas s full join comandas k on k.persona is not distinct from s.persona and k.semana = s.semana
    ), '[]'),
    'canales', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', tipo, 'cuentas', n, 'ventas', ventas))
      from (select tipo, count(*) as n, sum(ventas) as ventas from base group by tipo) x
    ), '[]'),
    'personas', coalesce((
      select jsonb_agg(jsonb_build_object('id', u.user_id, 'nombre', split_part(au.email::text, '@', 1), 'rol', u.rol))
      from public.usuarios u join auth.users au on au.id = u.user_id
      where u.restaurante_id = p_restaurante
    ), '[]'),
    'zona', tz
  ) into v;
  return v;
end;
$$;
revoke all on function public.reporte_equipo(uuid, timestamptz, timestamptz) from public;
grant execute on function public.reporte_equipo(uuid, timestamptz, timestamptz) to authenticated;
