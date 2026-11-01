-- ═════════════════════════════════════════════
-- 0024: Platovi Sellos · tarjeta digital de sellos (complemento pagado aparte)
--
-- · El cliente se une con un QR (nombre y teléfono), guarda su tarjeta en el celular (web o Google Wallet) y suma
--   sellos escaneando el QR de un solo uso que sale en la precuenta, o el mesero se los suma a mano.
-- · Al completar la tarjeta gana un premio; el mesero lo canjea (con PIN de encargado si el local lo pide).
-- · Se contrata aparte del plan: restaurantes.complementos.sellos.activo (solo lo cambia el superadmin).
-- · Reemplaza el "premio cada N visitas" de Clientes frecuentes: los locales que lo tenían pasan a una tarjeta con
--   ese premio y sus clientes con teléfono parten con los sellos que llevaban.
-- · Todo lo de sellos vive en tablas sellos_* y se toca solo por las funciones de abajo, para poder separarlo
--   más adelante como producto independiente.
-- Se puede ejecutar más de una vez. Requiere 0014 (clientes) y 0023 (PIN).
-- ═════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────
-- Complementos contratados aparte del plan (el dueño no puede cambiarlos: no tiene permiso sobre esta columna)
-- ─────────────────────────────────────────────

alter table public.restaurantes add column if not exists complementos jsonb not null default '{}'::jsonb;

-- /s/… son las tarjetas de sellos: ningún restaurante puede usar esa dirección.
alter table public.restaurantes drop constraint if exists slug_reservado;
alter table public.restaurantes add constraint slug_reservado check (slug not in (
  'admin', 'api', 'auth', 'login', 'logout', 'panel', 'registro', 'recuperar',
  'nueva-clave', 'precios', 'planes', 'ayuda', 'soporte', 'terminos', 'privacidad', 'demo-admin', 'unirse', 's'
));

create or replace function public.sellos_contratado(p_restaurante uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select (r.complementos -> 'sellos' ->> 'activo')::boolean from public.restaurantes r where r.id = p_restaurante), false);
$$;
grant execute on function public.sellos_contratado(uuid) to anon, authenticated;

-- Código al azar sin letras que se confunden (0/O, 1/I/L).
create or replace function public.sellos_codigo_nuevo(n integer default 10)
returns text
language sql
volatile
set search_path = public, extensions
as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 31), 1), '')
  from (select gen_random_bytes(n) as b) x, generate_series(0, n - 1) as i;
$$;
revoke all on function public.sellos_codigo_nuevo(integer) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- Tablas
-- ─────────────────────────────────────────────

-- La tarjeta de cada local: cuántos sellos, el premio y cómo se gana un sello.
create table if not exists public.sellos_programas (
  restaurante_id  uuid primary key references public.restaurantes (id) on delete cascade,
  activo          boolean not null default true,
  meta            integer not null default 10 check (meta between 3 and 30),
  premio          text not null default 'Un café de regalo' check (char_length(premio) between 1 and 60),
  -- 'visita': 1 sello por mesa o pedido. 'monto': 1 sello por cada monto_por_sello de consumo.
  regla           text not null default 'visita' check (regla in ('visita', 'monto')),
  monto_por_sello numeric(12, 2) not null default 10000 check (monto_por_sello > 0),
  -- Sellos de regalo al unirse (la tarjeta no parte vacía).
  bienvenida      integer not null default 1 check (bienvenida between 0 and 3),
  -- Máximo de veces al día que una tarjeta suma con el QR de la precuenta.
  max_por_dia     integer not null default 1 check (max_por_dia between 1 and 10),
  color           text not null default '#23345c' check (color ~ '^#[0-9a-fA-F]{6}$'),
  icono           text not null default 'cafe' check (char_length(icono) <= 20),
  condiciones     text not null default '' check (char_length(condiciones) <= 300),
  updated_at      timestamptz not null default now()
);

create table if not exists public.sellos_tarjetas (
  id             uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  cliente_id     uuid references public.clientes (id) on delete set null,
  -- Lo que va en el enlace y el QR de la tarjeta (/s/CODIGO).
  codigo         text not null unique,
  nombre         text not null check (char_length(nombre) between 1 and 60),
  telefono       text check (char_length(telefono) <= 30),
  telefono_clave text generated always as (public.clave_telefono(telefono)) stored,
  email          text check (char_length(email) <= 120),
  cumpleanos     date,
  -- Aceptó recibir avisos y promociones del local (aparte de los términos).
  acepta_avisos  boolean not null default false,
  -- Sellos hacia el próximo premio y premios ganados sin canjear.
  sellos         integer not null default 0 check (sellos >= 0),
  premios        integer not null default 0 check (premios >= 0),
  total_sellos   integer not null default 0,
  canjes         integer not null default 0,
  created_at     timestamptz not null default now(),
  ultima_at      timestamptz
);
create unique index if not exists sellos_tarjetas_telefono_idx on public.sellos_tarjetas (restaurante_id, telefono_clave)
  where telefono_clave is not null;
create index if not exists sellos_tarjetas_restaurante_idx on public.sellos_tarjetas (restaurante_id, ultima_at desc nulls last);
create index if not exists sellos_tarjetas_cliente_idx on public.sellos_tarjetas (cliente_id);

-- Cada sello, canje o corrección, con quién lo hizo.
create table if not exists public.sellos_movimientos (
  id             uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  tarjeta_id     uuid not null references public.sellos_tarjetas (id) on delete cascade,
  tipo           text not null check (tipo in ('sello', 'canje', 'ajuste')),
  cantidad       integer not null,
  origen         text not null check (origen in ('qr', 'manual', 'bienvenida', 'migracion', 'anulada')),
  cuenta_id      uuid references public.cuentas (id) on delete set null,
  por            uuid references auth.users (id) on delete set null default auth.uid(),
  autorizado_por uuid references auth.users (id) on delete set null,
  nota           text check (char_length(nota) <= 120),
  created_at     timestamptz not null default now()
);
create index if not exists sellos_movimientos_restaurante_idx on public.sellos_movimientos (restaurante_id, created_at desc);
create index if not exists sellos_movimientos_tarjeta_idx on public.sellos_movimientos (tarjeta_id, created_at desc);
create unique index if not exists sellos_movimientos_cuenta_idx on public.sellos_movimientos (cuenta_id)
  where tipo = 'sello' and origen = 'qr';

-- Código de un solo uso que sale en la precuenta de cada mesa o pedido.
create table if not exists public.sellos_codigos (
  codigo         text primary key,
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  cuenta_id      uuid not null unique references public.cuentas (id) on delete cascade,
  tarjeta_id     uuid references public.sellos_tarjetas (id) on delete set null,
  usado_at       timestamptz,
  created_at     timestamptz not null default now()
);

-- Avisos push al celular del dueño de la tarjeta (tarjeta web).
create table if not exists public.sellos_push (
  id         uuid primary key default gen_random_uuid(),
  tarjeta_id uuid not null references public.sellos_tarjetas (id) on delete cascade,
  endpoint   text not null unique check (char_length(endpoint) <= 1000),
  claves     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- Permisos: el equipo ve; el administrador configura la tarjeta; lo demás pasa por las funciones
-- ─────────────────────────────────────────────

alter table public.sellos_programas enable row level security;
alter table public.sellos_tarjetas enable row level security;
alter table public.sellos_movimientos enable row level security;
alter table public.sellos_codigos enable row level security;
alter table public.sellos_push enable row level security;

revoke all on public.sellos_programas, public.sellos_tarjetas, public.sellos_movimientos, public.sellos_codigos,
  public.sellos_push from anon, authenticated;
grant select, insert, update on public.sellos_programas to authenticated;
grant select on public.sellos_tarjetas, public.sellos_movimientos to authenticated;
grant update (nombre, telefono, email, cumpleanos) on public.sellos_tarjetas to authenticated;
grant delete on public.sellos_tarjetas to authenticated;

drop policy if exists "equipo: ver tarjeta de sellos" on public.sellos_programas;
create policy "equipo: ver tarjeta de sellos" on public.sellos_programas
  for select to authenticated using (public.es_miembro(restaurante_id));
drop policy if exists "admin: crear tarjeta de sellos" on public.sellos_programas;
create policy "admin: crear tarjeta de sellos" on public.sellos_programas
  for insert to authenticated with check (public.es_admin(restaurante_id));
drop policy if exists "admin: editar tarjeta de sellos" on public.sellos_programas;
create policy "admin: editar tarjeta de sellos" on public.sellos_programas
  for update to authenticated using (public.es_admin(restaurante_id)) with check (public.es_admin(restaurante_id));

drop policy if exists "equipo: ver tarjetas" on public.sellos_tarjetas;
create policy "equipo: ver tarjetas" on public.sellos_tarjetas
  for select to authenticated using (public.es_miembro(restaurante_id));
drop policy if exists "admin: editar tarjetas" on public.sellos_tarjetas;
create policy "admin: editar tarjetas" on public.sellos_tarjetas
  for update to authenticated using (public.es_admin(restaurante_id)) with check (public.es_admin(restaurante_id));
drop policy if exists "admin: borrar tarjetas" on public.sellos_tarjetas;
create policy "admin: borrar tarjetas" on public.sellos_tarjetas
  for delete to authenticated using (public.es_admin(restaurante_id));

drop policy if exists "equipo: ver movimientos de sellos" on public.sellos_movimientos;
create policy "equipo: ver movimientos de sellos" on public.sellos_movimientos
  for select to authenticated using (public.es_miembro(restaurante_id));

-- ─────────────────────────────────────────────
-- Sumar y restar sellos (uso interno)
-- ─────────────────────────────────────────────

create or replace function public.sellos_aplicar(p_tarjeta uuid, p_cantidad integer)
returns public.sellos_tarjetas
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.sellos_tarjetas;
  v_meta integer;
  total integer;
begin
  select * into t from public.sellos_tarjetas where id = p_tarjeta for update;
  select p.meta into v_meta from public.sellos_programas p where p.restaurante_id = t.restaurante_id;
  v_meta := coalesce(v_meta, 10);
  if p_cantidad >= 0 then
    total := t.sellos + p_cantidad;
    update public.sellos_tarjetas
    set sellos = total % v_meta, premios = premios + total / v_meta,
        total_sellos = total_sellos + p_cantidad, ultima_at = now()
    where id = t.id returning * into t;
  else
    -- Al quitar se descuenta de los sellos y, si no alcanza, de los premios sin canjear.
    total := greatest(0, t.premios * v_meta + t.sellos + p_cantidad);
    update public.sellos_tarjetas
    set sellos = total % v_meta, premios = total / v_meta, total_sellos = greatest(0, total_sellos + p_cantidad)
    where id = t.id returning * into t;
  end if;
  return t;
end;
$$;
revoke all on function public.sellos_aplicar(uuid, integer) from public, anon, authenticated;

-- Si el local baja la cantidad de sellos de la tarjeta, los que ya la completan pasan a tener su premio.
create or replace function public.sellos_meta_cambiada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.meta < old.meta then
    update public.sellos_tarjetas
    set premios = premios + sellos / new.meta, sellos = sellos % new.meta
    where restaurante_id = new.restaurante_id and sellos >= new.meta;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists sellos_programas_meta on public.sellos_programas;
create trigger sellos_programas_meta before update on public.sellos_programas
  for each row execute function public.sellos_meta_cambiada();

-- Estado de una tarjeta para mostrar (sin ids internos).
create or replace function public.sellos_estado(t public.sellos_tarjetas)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'codigo', t.codigo, 'nombre', t.nombre, 'sellos', t.sellos, 'premios', t.premios,
    'total_sellos', t.total_sellos, 'canjes', t.canjes, 'acepta_avisos', t.acepta_avisos,
    'created_at', t.created_at, 'ultima_at', t.ultima_at
  );
$$;
revoke all on function public.sellos_estado(public.sellos_tarjetas) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- Para el cliente (sin sesión)
-- ─────────────────────────────────────────────

-- Datos para la página de "únete": marca del local y su tarjeta. null si el local no tiene Sellos activo.
create or replace function public.sellos_publico(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'restaurante', jsonb_build_object('nombre', r.nombre, 'slug', r.slug, 'logo_url', r.logo_url, 'color', r.color_primario),
    'programa', to_jsonb(p) - 'restaurante_id' - 'updated_at'
  )
  from public.restaurantes r
  join public.sellos_programas p on p.restaurante_id = r.id
  where r.slug = lower(p_slug) and r.activo and p.activo and public.sellos_contratado(r.id);
$$;
grant execute on function public.sellos_publico(text) to anon, authenticated;

-- Se une al programa (o recupera su tarjeta si ese teléfono ya tiene una). Devuelve el código de la tarjeta.
create or replace function public.sellos_unirse(
  p_slug text,
  p_nombre text,
  p_telefono text,
  p_email text default null,
  p_cumpleanos date default null,
  p_acepta boolean default false
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.restaurantes;
  p public.sellos_programas;
  t public.sellos_tarjetas;
  v_cliente uuid;
begin
  select * into r from public.restaurantes where slug = lower(p_slug) and activo;
  select * into p from public.sellos_programas where restaurante_id = r.id and activo;
  if r.id is null or p.restaurante_id is null or not public.sellos_contratado(r.id) then
    raise exception 'Este local no tiene tarjeta de sellos';
  end if;
  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'Escribe tu nombre';
  end if;
  if public.clave_telefono(p_telefono) is null then
    raise exception 'Escribe un teléfono válido';
  end if;

  select * into t from public.sellos_tarjetas
  where restaurante_id = r.id and telefono_clave = public.clave_telefono(p_telefono);
  if t.id is not null then
    if p_acepta and not t.acepta_avisos then
      update public.sellos_tarjetas set acepta_avisos = true where id = t.id;
    end if;
    return t.codigo;
  end if;

  v_cliente := public.vincular_cliente(r.id, p_nombre, p_telefono, null);
  insert into public.sellos_tarjetas (restaurante_id, cliente_id, codigo, nombre, telefono, email, cumpleanos, acepta_avisos)
  values (r.id, v_cliente, public.sellos_codigo_nuevo(10), left(trim(p_nombre), 60), left(trim(p_telefono), 30),
          nullif(left(trim(coalesce(p_email, '')), 120), ''), p_cumpleanos, coalesce(p_acepta, false))
  returning * into t;

  if p.bienvenida > 0 then
    insert into public.sellos_movimientos (restaurante_id, tarjeta_id, tipo, cantidad, origen, por)
    values (r.id, t.id, 'sello', p.bienvenida, 'bienvenida', null);
    perform public.sellos_aplicar(t.id, p.bienvenida);
  end if;
  return t.codigo;
end;
$$;
grant execute on function public.sellos_unirse(text, text, text, text, date, boolean) to anon, authenticated;

-- La tarjeta para mostrar: estado, la tarjeta del local, su marca y los últimos movimientos.
create or replace function public.sellos_tarjeta(p_codigo text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.sellos_estado(t) || jsonb_build_object(
    'activa', r.activo and coalesce(p.activo, false) and public.sellos_contratado(r.id),
    'restaurante', jsonb_build_object('nombre', r.nombre, 'slug', r.slug, 'logo_url', r.logo_url, 'color', r.color_primario,
                                      'restaurante_id', r.id),
    'programa', to_jsonb(p) - 'restaurante_id' - 'updated_at',
    'movimientos', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', m.tipo, 'cantidad', m.cantidad, 'origen', m.origen, 'created_at', m.created_at)
                       order by m.created_at desc)
      from (select * from public.sellos_movimientos x where x.tarjeta_id = t.id order by x.created_at desc limit 10) m
    ), '[]'::jsonb)
  )
  from public.sellos_tarjetas t
  join public.restaurantes r on r.id = t.restaurante_id
  left join public.sellos_programas p on p.restaurante_id = t.restaurante_id
  where t.codigo = upper(trim(p_codigo));
$$;
grant execute on function public.sellos_tarjeta(text) to anon, authenticated;

-- Suma el sello con el QR de la precuenta. Cada código sirve una vez y por 24 horas; si la mesa se anula, se quita.
create or replace function public.sellos_sumar_qr(p_tarjeta text, p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  k public.sellos_codigos;
  c public.cuentas;
  t public.sellos_tarjetas;
  p public.sellos_programas;
  zona text;
  hoy integer;
  consumo numeric;
  n integer;
begin
  select * into k from public.sellos_codigos where codigo = upper(trim(p_codigo)) for update;
  if k.codigo is null then
    raise exception 'Ese código de sello no existe';
  end if;
  select * into t from public.sellos_tarjetas where codigo = upper(trim(p_tarjeta));
  if t.id is null then
    raise exception 'No encontramos tu tarjeta';
  end if;
  if t.restaurante_id <> k.restaurante_id then
    raise exception 'Esta tarjeta es de otro local';
  end if;
  if k.usado_at is not null then
    raise exception 'Este código ya se usó';
  end if;
  if k.created_at < now() - interval '24 hours' then
    raise exception 'Este código venció (dura 24 horas)';
  end if;
  select * into p from public.sellos_programas where restaurante_id = t.restaurante_id and activo;
  if p.restaurante_id is null or not public.sellos_contratado(t.restaurante_id) then
    raise exception 'La tarjeta de sellos de este local está pausada';
  end if;
  select * into c from public.cuentas where id = k.cuenta_id;
  if c.id is null or c.estado = 'anulada' then
    raise exception 'Esa cuenta se anuló';
  end if;

  select coalesce(nullif(r.ajustes ->> 'zona_horaria', ''), 'America/Santiago') into zona
  from public.restaurantes r where r.id = t.restaurante_id;
  select count(*) into hoy from public.sellos_movimientos m
  where m.tarjeta_id = t.id and m.tipo = 'sello' and m.origen = 'qr'
    and (m.created_at at time zone zona)::date = (now() at time zone zona)::date;
  if hoy >= p.max_por_dia then
    raise exception 'Ya sumaste tu sello de hoy. ¡Te esperamos pronto!';
  end if;

  if p.regla = 'monto' then
    select coalesce(sum(i.precio * i.cantidad), 0) into consumo
    from public.pedido_items i join public.pedidos y on y.id = i.pedido_id
    where y.cuenta_id = c.id and y.estado <> 'cancelado';
    consumo := consumo + coalesce(c.envio, 0);
    n := least(20, floor(consumo / p.monto_por_sello)::integer);
    if n < 1 then
      raise exception 'Este consumo no alcanza para un sello';
    end if;
  else
    n := 1;
  end if;

  insert into public.sellos_movimientos (restaurante_id, tarjeta_id, tipo, cantidad, origen, cuenta_id, por)
  values (t.restaurante_id, t.id, 'sello', n, 'qr', c.id, null);
  t := public.sellos_aplicar(t.id, n);
  update public.sellos_codigos set usado_at = now(), tarjeta_id = t.id where codigo = k.codigo;
  -- La visita queda a nombre del cliente (Clientes frecuentes).
  if c.cliente_id is null and t.cliente_id is not null then
    update public.cuentas set cliente_id = t.cliente_id where id = c.id;
  end if;
  return public.sellos_estado(t) || jsonb_build_object('sumados', n);
end;
$$;
grant execute on function public.sellos_sumar_qr(text, text) to anon, authenticated;

-- Guarda el celular del dueño de la tarjeta para avisarle (tarjeta web).
create or replace function public.sellos_suscribir(p_codigo text, p_endpoint text, p_claves jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.sellos_tarjetas where codigo = upper(trim(p_codigo));
  if v_id is null or coalesce(p_endpoint, '') !~ '^https://' then
    return false;
  end if;
  insert into public.sellos_push (tarjeta_id, endpoint, claves)
  values (v_id, left(p_endpoint, 1000), coalesce(p_claves, '{}'::jsonb))
  on conflict (endpoint) do update set tarjeta_id = excluded.tarjeta_id, claves = excluded.claves;
  update public.sellos_tarjetas set acepta_avisos = true where id = v_id;
  return true;
end;
$$;
grant execute on function public.sellos_suscribir(text, text, jsonb) to anon, authenticated;

-- ─────────────────────────────────────────────
-- Para el equipo
-- ─────────────────────────────────────────────

-- Código de sello para la precuenta de una cuenta (el mismo si se vuelve a imprimir). null si el local no tiene Sellos.
create or replace function public.sellos_codigo_cuenta(p_cuenta uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.cuentas;
  v text;
begin
  select * into c from public.cuentas where id = p_cuenta;
  if c.id is null or not public.es_miembro(c.restaurante_id) then
    raise exception 'No tienes acceso a esa cuenta';
  end if;
  if c.estado = 'anulada' or not public.sellos_contratado(c.restaurante_id)
     or not exists (select 1 from public.sellos_programas p where p.restaurante_id = c.restaurante_id and p.activo) then
    return null;
  end if;
  select codigo into v from public.sellos_codigos where cuenta_id = c.id;
  if v is null then
    insert into public.sellos_codigos (codigo, restaurante_id, cuenta_id)
    values (public.sellos_codigo_nuevo(8), c.restaurante_id, c.id)
    on conflict (cuenta_id) do nothing;
    select codigo into v from public.sellos_codigos where cuenta_id = c.id;
  end if;
  return v;
end;
$$;
grant execute on function public.sellos_codigo_cuenta(uuid) to authenticated;

-- Suma (o quita, con cantidad negativa) sellos a mano. Pide el PIN de un encargado si el local lo exige.
create or replace function public.sellos_sumar_manual(p_tarjeta text, p_cantidad integer, p_pin text default null, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.sellos_tarjetas;
  quien uuid;
begin
  select * into t from public.sellos_tarjetas where codigo = upper(trim(p_tarjeta));
  if t.id is null then
    raise exception 'No encontramos esa tarjeta';
  end if;
  quien := public.exigir_pin(t.restaurante_id, p_pin);
  if not public.sellos_contratado(t.restaurante_id) then
    raise exception 'Tarjeta de sellos no contratada';
  end if;
  if coalesce(p_cantidad, 0) = 0 or abs(p_cantidad) > 30 then
    raise exception 'Cantidad de sellos no válida';
  end if;
  insert into public.sellos_movimientos (restaurante_id, tarjeta_id, tipo, cantidad, origen, autorizado_por, nota)
  values (t.restaurante_id, t.id, case when p_cantidad > 0 then 'sello' else 'ajuste' end, p_cantidad, 'manual', quien,
          left(nullif(trim(p_motivo), ''), 120));
  t := public.sellos_aplicar(t.id, p_cantidad);
  return public.sellos_estado(t);
end;
$$;
grant execute on function public.sellos_sumar_manual(text, integer, text, text) to authenticated;

-- Canjea un premio ganado. Pide el PIN de un encargado si el local lo exige.
create or replace function public.sellos_canjear(p_tarjeta text, p_pin text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.sellos_tarjetas;
  quien uuid;
begin
  select * into t from public.sellos_tarjetas where codigo = upper(trim(p_tarjeta)) for update;
  if t.id is null then
    raise exception 'No encontramos esa tarjeta';
  end if;
  quien := public.exigir_pin(t.restaurante_id, p_pin);
  if t.premios < 1 then
    raise exception 'Esta tarjeta todavía no tiene un premio para canjear';
  end if;
  update public.sellos_tarjetas set premios = premios - 1, canjes = canjes + 1, ultima_at = now()
  where id = t.id returning * into t;
  insert into public.sellos_movimientos (restaurante_id, tarjeta_id, tipo, cantidad, origen, autorizado_por)
  values (t.restaurante_id, t.id, 'canje', -1, 'manual', quien);
  return public.sellos_estado(t);
end;
$$;
grant execute on function public.sellos_canjear(text, text) to authenticated;

-- Si se anula una mesa que ya había dado sello, el sello se quita.
create or replace function public.sellos_cuenta_anulada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
begin
  if new.estado = 'anulada' and old.estado <> 'anulada' then
    for m in select * from public.sellos_movimientos where cuenta_id = new.id and tipo = 'sello' and origen = 'qr' loop
      insert into public.sellos_movimientos (restaurante_id, tarjeta_id, tipo, cantidad, origen, cuenta_id, por)
      values (m.restaurante_id, m.tarjeta_id, 'ajuste', -m.cantidad, 'anulada', new.id, auth.uid());
      perform public.sellos_aplicar(m.tarjeta_id, -m.cantidad);
    end loop;
  end if;
  return new;
end;
$$;
drop trigger if exists cuentas_sellos_anulada on public.cuentas;
create trigger cuentas_sellos_anulada after update on public.cuentas
  for each row execute function public.sellos_cuenta_anulada();

-- ─────────────────────────────────────────────
-- Superadmin: activar o pausar el complemento
-- ─────────────────────────────────────────────

create or replace function public.admin_complementos()
returns table (id uuid, complementos jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_superadmin() then
    raise exception 'Solo para administradores';
  end if;
  return query select r.id, r.complementos from public.restaurantes r;
end;
$$;
grant execute on function public.admin_complementos() to authenticated;

create or replace function public.admin_complemento(p_id uuid, p_clave text, p_activo boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_superadmin() then
    raise exception 'Solo para administradores';
  end if;
  if p_clave not in ('sellos') then
    raise exception 'Complemento desconocido';
  end if;
  update public.restaurantes
  set complementos = jsonb_set(
    coalesce(complementos, '{}'::jsonb), array[p_clave],
    jsonb_build_object('activo', coalesce(p_activo, false),
                       'desde', case when p_activo then coalesce(complementos -> p_clave ->> 'desde', to_char(now(), 'YYYY-MM-DD')) end))
  where id = p_id;
  -- Al activarlo por primera vez, la tarjeta queda creada con valores de ejemplo para que el local solo la ajuste.
  if p_activo then
    insert into public.sellos_programas (restaurante_id, color)
    select r.id, case when r.color_primario ~ '^#[0-9a-fA-F]{6}$' then r.color_primario else '#23345c' end
    from public.restaurantes r where r.id = p_id
    on conflict (restaurante_id) do nothing;
  end if;
end;
$$;
grant execute on function public.admin_complemento(uuid, text, boolean) to authenticated;

-- ─────────────────────────────────────────────
-- Adiós al "premio cada N visitas": pasa a una tarjeta de sellos con el mismo premio
-- ─────────────────────────────────────────────

insert into public.sellos_programas (restaurante_id, meta, premio, bienvenida, color)
select r.id,
       least(30, greatest(3, (r.ajustes -> 'clientes' ->> 'premio_cada')::integer)),
       coalesce(nullif(left(trim(r.ajustes -> 'clientes' ->> 'premio'), 60), ''), 'Un premio de la casa'),
       0,
       case when r.color_primario ~ '^#[0-9a-fA-F]{6}$' then r.color_primario else '#23345c' end
from public.restaurantes r
where coalesce((r.ajustes -> 'clientes' ->> 'premio_cada')::integer, 0) >= 2
on conflict (restaurante_id) do nothing;

-- Sus clientes con teléfono parten con las visitas que llevaban desde el último premio.
insert into public.sellos_tarjetas (restaurante_id, cliente_id, codigo, nombre, telefono, email, sellos, total_sellos)
select cr.restaurante_id, cr.id, public.sellos_codigo_nuevo(10), cr.nombre, cr.telefono, cr.email,
       cr.visitas % p.meta, cr.visitas
from public.clientes_resumen cr
join public.sellos_programas p on p.restaurante_id = cr.restaurante_id
where cr.telefono_clave is not null
  and coalesce((select (r.ajustes -> 'clientes' ->> 'premio_cada')::integer from public.restaurantes r where r.id = cr.restaurante_id), 0) >= 2
on conflict (restaurante_id, telefono_clave) where telefono_clave is not null do nothing;

update public.restaurantes set ajustes = ajustes - 'clientes' where ajustes ? 'clientes';
