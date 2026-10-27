-- Menús QR · cierre de caja, platos agotados al instante, promos por horario, reseñas, foto de fondo del plano,
-- reservas y lista de espera, y cobro online con Mercado Pago.
-- Requiere 0004 (salón). Se puede ejecutar más de una vez.
-- Ejecutar en Supabase: SQL Editor > New query > pegar todo y Run.

-- Zona horaria del restaurante (para "hasta mañana", promos por horario y la caja del día).
create or replace function public.zona_restaurante(rid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(r.ajustes ->> 'zona_horaria', ''), 'America/Argentina/Buenos_Aires')
  from public.restaurantes r where r.id = rid;
$$;
grant execute on function public.zona_restaurante(uuid) to anon, authenticated;

-- ─────────────────────────────────────────────
-- Plato agotado al instante
-- La cocina o el mesero lo marcan y desaparece de la carta hasta las 6 de la mañana siguiente.
-- ─────────────────────────────────────────────

alter table public.platos add column if not exists agotado_hasta timestamptz;

create or replace function public.marcar_agotado(p_plato uuid, p_agotado boolean)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.platos;
  tz text;
  local timestamp;
  hasta timestamptz;
begin
  select * into p from public.platos where id = p_plato;
  if p.id is null or not public.es_miembro(p.restaurante_id) then
    raise exception 'No tienes acceso a ese plato';
  end if;
  if p_agotado then
    tz := public.zona_restaurante(p.restaurante_id);
    local := now() at time zone tz;
    -- Hasta las 6 de la mañana: si es de madrugada, las 6 de hoy; si no, las 6 de mañana.
    hasta := (date_trunc('day', local) + case when local::time < time '06:00' then interval '6 hours' else interval '30 hours' end)
             at time zone tz;
  end if;
  update public.platos set agotado_hasta = hasta where id = p.id;
  return hasta;
end;
$$;
revoke all on function public.marcar_agotado(uuid, boolean) from public;
grant execute on function public.marcar_agotado(uuid, boolean) to authenticated;

-- ─────────────────────────────────────────────
-- Promos por horario
-- Un descuento (o solo un aviso, con 0 %) que se activa solo ciertos días y horas.
-- Sin categorías ni platos elegidos, vale para toda la carta.
-- ─────────────────────────────────────────────

create table if not exists public.promos (
  id             uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  nombre         text not null check (char_length(nombre) between 1 and 40),
  descripcion    text check (char_length(descripcion) <= 140),
  -- 0 = domingo … 6 = sábado. Vacío = todos los días.
  dias           smallint[] not null default '{}',
  desde          time not null default '18:00',
  -- Si "hasta" es menor que "desde", la promo cruza la medianoche (22:00 a 02:00).
  hasta          time not null default '20:00',
  descuento      integer not null default 0 check (descuento between 0 and 90),
  categorias     uuid[] not null default '{}',
  platos         uuid[] not null default '{}',
  activa         boolean not null default true,
  orden          integer not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists promos_restaurante_idx on public.promos (restaurante_id);

alter table public.promos enable row level security;
grant select on public.promos to anon, authenticated;
grant insert, update, delete on public.promos to authenticated;

drop policy if exists "carta publica: promos" on public.promos;
create policy "carta publica: promos" on public.promos
  for select using (activa and exists (select 1 from public.restaurantes r where r.id = restaurante_id and r.activo));
drop policy if exists "miembro: ver promos" on public.promos;
create policy "miembro: ver promos" on public.promos
  for select to authenticated using (public.es_miembro(restaurante_id));
drop policy if exists "admin: promos" on public.promos;
create policy "admin: promos" on public.promos
  for all to authenticated using (public.es_admin(restaurante_id)) with check (public.es_admin(restaurante_id));

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
  todos boolean := cardinality(p.dias) = 0;
begin
  if p.desde <= p.hasta then
    return (todos or d = any(p.dias)) and t >= p.desde and t < p.hasta;
  end if;
  -- Cruza la medianoche: la parte de la madrugada pertenece al día anterior.
  return ((todos or d = any(p.dias)) and t >= p.desde) or ((todos or ((d + 6) % 7) = any(p.dias)) and t < p.hasta);
end;
$$;

-- Precio del plato en este momento, con el mejor descuento vigente.
create or replace function public.precio_vigente(p public.platos)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case
    when max(pr.descuento) is null then p.precio
    else round(p.precio * (100 - max(pr.descuento)) / 100.0, case when p.precio = trunc(p.precio) then 0 else 2 end)
  end
  from public.promos pr
  where pr.restaurante_id = p.restaurante_id and pr.activa and pr.descuento > 0
    and ((cardinality(pr.categorias) = 0 and cardinality(pr.platos) = 0)
         or p.categoria_id = any(pr.categorias) or p.id = any(pr.platos))
    and public.promo_vigente(pr, public.zona_restaurante(p.restaurante_id));
$$;

-- Cada línea de pedido toma el precio vigente (con promo) y no deja pedir desde la carta un plato agotado.
create or replace function public.validar_pedido_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.platos;
begin
  if not exists (
    select 1 from public.pedidos x where x.id = new.pedido_id and x.restaurante_id = new.restaurante_id
  ) then
    raise exception 'El pedido no pertenece a este restaurante';
  end if;

  if tg_op = 'UPDATE' and not public.es_admin(new.restaurante_id) then
    new.plato_id := old.plato_id;
    new.nombre := old.nombre;
    new.precio := old.precio;
    return new;
  end if;

  if new.plato_id is not null and (tg_op = 'INSERT' or new.plato_id is distinct from old.plato_id or not public.es_admin(new.restaurante_id)) then
    select * into p from public.platos where id = new.plato_id and restaurante_id = new.restaurante_id;
    if not found then
      raise exception 'Ese plato no es de este restaurante';
    end if;
    if tg_op = 'INSERT' and p.agotado_hasta > now()
       and exists (select 1 from public.pedidos x where x.id = new.pedido_id and x.origen = 'cliente') then
      raise exception '% se agotó. Elige otra cosa, por favor.', p.nombre;
    end if;
    new.nombre := p.nombre;
    new.precio := public.precio_vigente(p);
  elsif new.plato_id is null and not public.es_admin(new.restaurante_id) then
    raise exception 'Solo un administrador puede cargar algo fuera de la carta';
  end if;
  return new;
end;
$$;

-- ─────────────────────────────────────────────
-- Cierre de caja
-- Foto de lo cobrado en un turno: totales por medio de pago, propinas por persona y el efectivo contado.
-- ─────────────────────────────────────────────

create table if not exists public.cierres_caja (
  id               uuid primary key default gen_random_uuid(),
  restaurante_id   uuid not null references public.restaurantes (id) on delete cascade,
  sucursal_id      uuid references public.sucursales (id) on delete set null,
  desde            timestamptz not null,
  hasta            timestamptz not null,
  totales          jsonb not null default '{}' check (jsonb_typeof(totales) = 'object'),
  efectivo_inicial numeric(12, 2) not null default 0 check (efectivo_inicial >= 0),
  efectivo_contado numeric(12, 2) check (efectivo_contado >= 0),
  nota             text check (char_length(nota) <= 300),
  cerrado_por      uuid references auth.users (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now()
);
-- Quién cobró cada pago (para las propinas por persona). Se completa solo con quien registra el pago.
alter table public.pagos alter column registrado_por set default auth.uid();

create index if not exists cierres_caja_restaurante_idx on public.cierres_caja (restaurante_id, hasta desc);

alter table public.cierres_caja enable row level security;
grant select, insert, delete on public.cierres_caja to authenticated;
drop policy if exists "equipo: ver cierres" on public.cierres_caja;
create policy "equipo: ver cierres" on public.cierres_caja
  for select to authenticated using (public.es_miembro(restaurante_id));
drop policy if exists "equipo: cerrar caja" on public.cierres_caja;
create policy "equipo: cerrar caja" on public.cierres_caja
  for insert to authenticated with check (public.es_miembro(restaurante_id));
drop policy if exists "admin: borrar cierres" on public.cierres_caja;
create policy "admin: borrar cierres" on public.cierres_caja
  for delete to authenticated using (public.es_admin(restaurante_id));

-- ─────────────────────────────────────────────
-- Opiniones de los clientes (las buenas se invitan a Google; las demás llegan solo al restaurante)
-- ─────────────────────────────────────────────

create table if not exists public.opiniones (
  id             uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  sucursal_id    uuid references public.sucursales (id) on delete set null,
  mesa           text check (char_length(mesa) <= 12),
  estrellas      integer not null check (estrellas between 1 and 5),
  comentario     text check (char_length(comentario) <= 500),
  created_at     timestamptz not null default now()
);
create index if not exists opiniones_restaurante_idx on public.opiniones (restaurante_id, created_at desc);

alter table public.opiniones enable row level security;
grant select, delete on public.opiniones to authenticated;
drop policy if exists "equipo: ver opiniones" on public.opiniones;
create policy "equipo: ver opiniones" on public.opiniones
  for select to authenticated using (public.es_miembro(restaurante_id));
drop policy if exists "admin: borrar opiniones" on public.opiniones;
create policy "admin: borrar opiniones" on public.opiniones
  for delete to authenticated using (public.es_admin(restaurante_id));

create or replace function public.opinar(p_restaurante uuid, p_sucursal uuid, p_mesa text, p_estrellas integer, p_comentario text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_estrellas not between 1 and 5 or not exists (select 1 from public.restaurantes where id = p_restaurante and activo) then
    raise exception 'Opinión no válida';
  end if;
  -- Freno contra abusos: como mucho 60 opiniones por hora en cada restaurante.
  if (select count(*) from public.opiniones where restaurante_id = p_restaurante and created_at > now() - interval '1 hour') >= 60 then
    return;
  end if;
  insert into public.opiniones (restaurante_id, sucursal_id, mesa, estrellas, comentario)
  values (p_restaurante,
          (select id from public.sucursales where id = p_sucursal and restaurante_id = p_restaurante),
          nullif(left(trim(p_mesa), 12), ''), p_estrellas, nullif(left(trim(p_comentario), 500), ''));
end;
$$;
revoke all on function public.opinar(uuid, uuid, text, integer, text) from public;
grant execute on function public.opinar(uuid, uuid, text, integer, text) to anon, authenticated;

-- ─────────────────────────────────────────────
-- Foto o plano dibujado como fondo de cada piso
-- ─────────────────────────────────────────────

alter table public.pisos
  add column if not exists fondo_url      text check (char_length(fondo_url) <= 500),
  add column if not exists fondo_opacidad integer not null default 60 check (fondo_opacidad between 10 and 100);

-- ─────────────────────────────────────────────
-- Reservas y lista de espera
-- ─────────────────────────────────────────────

create table if not exists public.reservas (
  id             uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  sucursal_id    uuid references public.sucursales (id) on delete set null,
  tipo           text not null default 'reserva' check (tipo in ('reserva', 'espera')),
  nombre         text not null check (char_length(nombre) between 1 and 60),
  telefono       text check (char_length(telefono) <= 30),
  personas       integer not null default 2 check (personas between 1 and 99),
  -- Día y hora de la reserva (en la lista de espera queda vacío).
  fecha          timestamptz,
  estado         text not null default 'pendiente'
                 check (estado in ('pendiente', 'confirmada', 'avisada', 'sentada', 'cancelada', 'no_vino')),
  mesa_id        uuid references public.mesas (id) on delete set null,
  nota           text check (char_length(nota) <= 200),
  origen         text not null default 'personal' check (origen in ('cliente', 'personal')),
  avisada_at     timestamptz,
  created_at     timestamptz not null default now(),
  actualizado_at timestamptz not null default now(),
  check (tipo = 'espera' or fecha is not null)
);
create index if not exists reservas_restaurante_idx on public.reservas (restaurante_id, tipo, fecha);
create index if not exists reservas_espera_idx on public.reservas (restaurante_id, created_at) where tipo = 'espera';

create or replace function public.validar_reserva()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.mesa_id is not null and not exists (
    select 1 from public.mesas m where m.id = new.mesa_id and m.restaurante_id = new.restaurante_id
  ) then
    raise exception 'La mesa no pertenece a este restaurante';
  end if;
  if new.estado = 'avisada' and (tg_op = 'INSERT' or old.estado <> 'avisada') then
    new.avisada_at := now();
  end if;
  new.actualizado_at := now();
  return new;
end;
$$;
drop trigger if exists reservas_coherente on public.reservas;
create trigger reservas_coherente
  before insert or update on public.reservas
  for each row execute function public.validar_reserva();

alter table public.reservas enable row level security;
grant select, insert, update, delete on public.reservas to authenticated;
drop policy if exists "equipo: reservas" on public.reservas;
create policy "equipo: reservas" on public.reservas
  for all to authenticated using (public.es_miembro(restaurante_id)) with check (public.es_miembro(restaurante_id));

-- El cliente reserva desde la carta (si el restaurante lo permite). Queda pendiente hasta que la confirmen.
create or replace function public.reservar(
  p_restaurante uuid,
  p_sucursal uuid,
  p_nombre text,
  p_telefono text,
  p_personas integer,
  p_fecha timestamptz,
  p_nota text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.restaurantes;
  nueva uuid;
begin
  select * into r from public.restaurantes where id = p_restaurante and activo;
  if r.id is null or not coalesce((r.ajustes #>> '{modulos,reservas}')::boolean, false)
     or not coalesce((r.ajustes #>> '{reservas,online}')::boolean, false) then
    raise exception 'Este restaurante no toma reservas en línea';
  end if;
  if coalesce(trim(p_nombre), '') = '' or coalesce(trim(p_telefono), '') = '' then
    raise exception 'Faltan tu nombre o tu teléfono';
  end if;
  if p_personas not between 1 and 99 then
    raise exception 'Cantidad de personas no válida';
  end if;
  if p_fecha is null or p_fecha < now() or p_fecha > now() + interval '90 days' then
    raise exception 'Elige un día y una hora de los próximos tres meses';
  end if;
  if (select count(*) from public.reservas where restaurante_id = r.id and origen = 'cliente' and created_at > now() - interval '1 hour') >= 30
     or (select count(*) from public.reservas where restaurante_id = r.id and telefono = trim(p_telefono) and created_at > now() - interval '1 day') >= 3 then
    raise exception 'Recibimos muchas reservas seguidas. Escríbenos por WhatsApp, por favor.';
  end if;
  insert into public.reservas (restaurante_id, sucursal_id, tipo, nombre, telefono, personas, fecha, nota, origen)
  values (r.id, (select id from public.sucursales where id = p_sucursal and restaurante_id = r.id), 'reserva',
          left(trim(p_nombre), 60), left(trim(p_telefono), 30), p_personas, p_fecha, nullif(left(trim(p_nota), 200), ''), 'cliente')
  returning id into nueva;
  return nueva;
end;
$$;

-- El cliente se anota en la lista de espera escaneando el QR de la entrada.
create or replace function public.anotarse_espera(p_restaurante uuid, p_sucursal uuid, p_nombre text, p_telefono text, p_personas integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.restaurantes;
  nueva uuid;
begin
  select * into r from public.restaurantes where id = p_restaurante and activo;
  if r.id is null or not coalesce((r.ajustes #>> '{modulos,reservas}')::boolean, false) then
    raise exception 'Este restaurante no tiene lista de espera';
  end if;
  if coalesce(trim(p_nombre), '') = '' or p_personas not between 1 and 99 then
    raise exception 'Faltan tu nombre o cuántos son';
  end if;
  if (select count(*) from public.reservas where restaurante_id = r.id and tipo = 'espera' and origen = 'cliente'
      and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'La lista está llena. Habla con el personal, por favor.';
  end if;
  insert into public.reservas (restaurante_id, sucursal_id, tipo, nombre, telefono, personas, origen)
  values (r.id, (select id from public.sucursales where id = p_sucursal and restaurante_id = r.id), 'espera',
          left(trim(p_nombre), 60), nullif(left(trim(p_telefono), 30), ''), p_personas, 'cliente')
  returning id into nueva;
  return nueva;
end;
$$;

-- Lo que ve en su teléfono quien está en la lista: su lugar y si ya lo llamaron.
create or replace function public.estado_espera(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'nombre', e.nombre,
    'personas', e.personas,
    'estado', e.estado,
    'avisada_at', e.avisada_at,
    'desde', e.created_at,
    'delante', (
      select count(*) from public.reservas o
      where o.restaurante_id = e.restaurante_id and o.tipo = 'espera' and o.estado = 'pendiente'
        and o.sucursal_id is not distinct from e.sucursal_id
        and o.created_at < e.created_at and o.created_at > now() - interval '12 hours'
    )
  )
  from public.reservas e where e.id = p_id and e.tipo = 'espera';
$$;

create or replace function public.salir_espera(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.reservas set estado = 'cancelada'
  where id = p_id and tipo = 'espera' and estado in ('pendiente', 'avisada');
$$;

revoke all on function public.reservar(uuid, uuid, text, text, integer, timestamptz, text) from public;
revoke all on function public.anotarse_espera(uuid, uuid, text, text, integer) from public;
revoke all on function public.estado_espera(uuid) from public;
revoke all on function public.salir_espera(uuid) from public;
grant execute on function public.reservar(uuid, uuid, text, text, integer, timestamptz, text) to anon, authenticated;
grant execute on function public.anotarse_espera(uuid, uuid, text, text, integer) to anon, authenticated;
grant execute on function public.estado_espera(uuid) to anon, authenticated;
grant execute on function public.salir_espera(uuid) to anon, authenticated;

-- ─────────────────────────────────────────────
-- Cobro online con Mercado Pago
-- Cada restaurante cobra en su propia cuenta de Mercado Pago. Su clave (Access Token) se guarda aquí y
-- nadie puede leerla desde el navegador: solo el servidor, con la clave de servicio de Supabase.
-- ─────────────────────────────────────────────

create table if not exists public.cobro_online (
  restaurante_id  uuid primary key references public.restaurantes (id) on delete cascade,
  mp_access_token text not null check (char_length(mp_access_token) between 20 and 300),
  actualizado_at  timestamptz not null default now()
);
alter table public.cobro_online enable row level security;
-- Sin políticas: ni el panel ni la carta pueden leer la clave.
revoke all on public.cobro_online from anon, authenticated;

create or replace function public.guardar_cobro_online(p_restaurante uuid, p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin(p_restaurante) then
    raise exception 'Solo un administrador puede conectar Mercado Pago';
  end if;
  if coalesce(trim(p_token), '') = '' then
    delete from public.cobro_online where restaurante_id = p_restaurante;
    return false;
  end if;
  insert into public.cobro_online (restaurante_id, mp_access_token)
  values (p_restaurante, trim(p_token))
  on conflict (restaurante_id) do update set mp_access_token = excluded.mp_access_token, actualizado_at = now();
  return true;
end;
$$;

create or replace function public.cobro_online_conectado(p_restaurante uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.cobro_online where restaurante_id = p_restaurante);
$$;

revoke all on function public.guardar_cobro_online(uuid, text) from public;
revoke all on function public.cobro_online_conectado(uuid) from public;
grant execute on function public.guardar_cobro_online(uuid, text) to authenticated;
grant execute on function public.cobro_online_conectado(uuid) to anon, authenticated;

-- Pagos hechos online: de dónde vino y el número de pago de Mercado Pago (no se registra dos veces).
alter table public.pagos
  add column if not exists origen     text not null default 'personal' check (origen in ('personal', 'online')),
  add column if not exists mp_pago_id text unique;

-- Cada intento de pago online (se crea al tocar "Pagar" y se aprueba cuando Mercado Pago confirma).
create table if not exists public.pagos_online (
  id             uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  cuenta_id      uuid not null references public.cuentas (id) on delete cascade,
  parte          text check (char_length(parte) <= 40),
  monto          numeric(12, 2) not null check (monto > 0),
  propina        numeric(12, 2) not null default 0 check (propina >= 0),
  estado         text not null default 'creado' check (estado in ('creado', 'aprobado', 'rechazado')),
  mp_pago_id     text,
  created_at     timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);
create index if not exists pagos_online_cuenta_idx on public.pagos_online (cuenta_id);

alter table public.pagos_online enable row level security;
grant select on public.pagos_online to authenticated;
drop policy if exists "equipo: ver pagos online" on public.pagos_online;
create policy "equipo: ver pagos online" on public.pagos_online
  for select to authenticated using (public.es_miembro(restaurante_id));

-- Prepara un pago desde la carta. El monto sale de la base (lo que falta pagar, o una parte igual), nunca del
-- teléfono. Solo lo usa el servidor (clave de servicio), porque devuelve la clave de Mercado Pago.
create or replace function public.crear_pago_online(
  p_restaurante uuid,
  p_sucursal uuid,
  p_mesa text,
  p_partes integer default 1,
  p_propina numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.restaurantes;
  m public.mesas;
  c public.cuentas;
  v_token text;
  v_total numeric;
  v_falta numeric;
  v_n integer := least(greatest(coalesce(p_partes, 1), 1), 30);
  v_monto numeric;
  v_propina numeric;
  v_id uuid;
begin
  select * into r from public.restaurantes where id = p_restaurante;
  if r.id is null or coalesce(r.ajustes -> 'cobro_online' ->> 'activo', 'false') <> 'true' then
    raise exception 'El restaurante no tiene el pago online activado';
  end if;
  select mp_access_token into v_token from public.cobro_online where restaurante_id = r.id;
  if v_token is null then
    raise exception 'El restaurante no conectó Mercado Pago';
  end if;
  m := public.buscar_mesa(p_restaurante, p_sucursal, p_mesa);
  select * into c from public.cuentas where mesa_id = m.id and estado = 'abierta';
  if c.id is null then
    raise exception 'La mesa no tiene una cuenta abierta';
  end if;

  select coalesce(sum(i.precio * i.cantidad), 0) into v_total
  from public.pedido_items i join public.pedidos p on p.id = i.pedido_id
  where p.cuenta_id = c.id and p.estado <> 'cancelado';
  v_falta := v_total - (select coalesce(sum(monto), 0) from public.pagos where cuenta_id = c.id);
  if v_falta <= 0 then
    raise exception 'La cuenta ya está pagada';
  end if;

  -- Una parte igual del total (la primera, que lleva el redondeo), sin pasarse de lo que falta.
  if v_n > 1 then
    v_monto := case when v_total = trunc(v_total) then ceil(v_total / v_n) else ceil(v_total * 100 / v_n) / 100 end;
    v_monto := least(v_monto, v_falta);
  else
    v_monto := v_falta;
  end if;
  v_propina := least(greatest(round(coalesce(p_propina, 0), 2), 0), round(v_monto / 2, 2));

  insert into public.pagos_online (restaurante_id, cuenta_id, parte, monto, propina)
  values (r.id, c.id, case when v_n > 1 then format('1 de %s', v_n) end, v_monto, v_propina)
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id, 'monto', v_monto, 'propina', v_propina, 'mesa', m.numero,
    'restaurante', r.nombre, 'slug', r.slug, 'moneda', r.moneda, 'token', v_token
  );
end;
$$;

-- La clave de Mercado Pago para consultar un pago (el servidor la usa al recibir el aviso de Mercado Pago).
create or replace function public.token_pago_online(p_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select co.mp_access_token
  from public.pagos_online po join public.cobro_online co on co.restaurante_id = po.restaurante_id
  where po.id = p_id;
$$;

-- Anota el resultado que informó Mercado Pago. Si está aprobado y el monto coincide, registra el pago en la cuenta
-- (una sola vez por número de pago) y avisa al salón.
create or replace function public.registrar_pago_online(p_id uuid, p_mp_pago_id text, p_estado text, p_pagado numeric)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  po public.pagos_online;
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
    return 'aprobado';
  elsif p_estado in ('rejected', 'cancelled', 'refunded', 'charged_back') then
    update public.pagos_online set estado = 'rechazado', mp_pago_id = p_mp_pago_id, actualizado_at = now() where id = po.id;
    return 'rechazado';
  end if;
  return po.estado;
end;
$$;

-- Para la carta: cómo quedó un pago al volver de Mercado Pago (solo el estado, nada más).
create or replace function public.estado_pago_online(p_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select estado from public.pagos_online where id = p_id;
$$;

revoke all on function public.crear_pago_online(uuid, uuid, text, integer, numeric) from public, anon, authenticated;
revoke all on function public.token_pago_online(uuid) from public, anon, authenticated;
revoke all on function public.registrar_pago_online(uuid, text, text, numeric) from public, anon, authenticated;
revoke all on function public.estado_pago_online(uuid) from public;
grant execute on function public.crear_pago_online(uuid, uuid, text, integer, numeric) to service_role;
grant execute on function public.token_pago_online(uuid) to service_role;
grant execute on function public.registrar_pago_online(uuid, text, text, numeric) to service_role;
grant execute on function public.estado_pago_online(uuid) to anon, authenticated, service_role;

-- Tiempo real: las reservas y la lista de espera se actualizan solas en el panel.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reservas'
     ) then
    alter publication supabase_realtime add table public.reservas;
  end if;
end;
$$;
