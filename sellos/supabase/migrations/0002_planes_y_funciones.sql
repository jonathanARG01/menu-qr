-- ═════════════════════════════════════════════
-- 0002: Planes (Inicial, Pro, Cadena) y todo lo que pide competir con los mejores:
--   · campañas a los clientes (aviso al celular, Google Wallet y WhatsApp)
--   · métricas (con el costo de los premios entregados)
--   · premios intermedios en la tarjeta de sellos, catálogo de premios administrable y cupones
--   · promociones por fecha (doble puntos), retos con insignias, segmentos y rol "encargado"
--   · referidos ("trae a un amigo") y niveles por visitas
--   · tarjeta de puntos (segundo tipo, con catálogo de premios)
--   · varios locales (sucursales), con su ubicación para Google Wallet
--   · API con clave para cajas y para la IA (Claude, ChatGPT)
--   · diseño a medida (imagen de fondo propia)
-- Ejecutar DESPUÉS de 0001_inicial.sql. Se puede volver a ejecutar sin romper nada.
-- ═════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- Planes
-- ─────────────────────────────────────────────

alter table public.negocios drop constraint if exists negocios_plan_check;
update public.negocios set plan = 'inicial' where plan not in ('inicial', 'pro', 'cadena');
alter table public.negocios alter column plan set default 'inicial';
alter table public.negocios add constraint negocios_plan_check check (plan in ('inicial', 'pro', 'cadena'));
alter table public.negocios alter column prueba_hasta set default (current_date + 30);
-- Locales que permite el plan Cadena (el superadmin lo sube si el cliente paga locales extra).
alter table public.negocios add column if not exists max_locales integer not null default 5 check (max_locales between 1 and 200);
-- Ubicación del local (Google Wallet muestra la tarjeta cuando el cliente pasa cerca).
alter table public.negocios add column if not exists latitud double precision check (latitud between -90 and 90);
alter table public.negocios add column if not exists longitud double precision check (longitud between -180 and 180);
grant update (latitud, longitud) on public.negocios to authenticated;

-- ¿El plan del negocio incluye esta función? Durante la prueba gratis se puede probar todo.
--   Pro:    campanas, metricas, premios (intermedios y catálogo), cupones, referidos, niveles, retos, promociones, puntos
--   Cadena: lo de Pro + sucursales, api (cajas e IA)
create or replace function public.plan_incluye(n uuid, f text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when x.estado = 'prueba' then true
      when f in ('sucursales', 'api') then x.plan = 'cadena'
      when f in ('campanas', 'metricas', 'premios', 'cupones', 'referidos', 'niveles', 'retos', 'promociones', 'puntos') then x.plan in ('pro', 'cadena')
      else true
    end
    from public.negocios x where x.id = n
  ), false);
$$;
grant execute on function public.plan_incluye(uuid, text) to anon, authenticated;

-- Roles: dueño (todo), encargado (opera el programa: campañas, cupones, catálogo, métricas; sin plan, equipo ni API)
-- y empleado (suma sellos y canjea).
alter table public.miembros drop constraint if exists miembros_rol_check;
alter table public.miembros add constraint miembros_rol_check check (rol in ('dueno', 'encargado', 'empleado'));
alter table public.invitaciones drop constraint if exists invitaciones_rol_check;
alter table public.invitaciones add constraint invitaciones_rol_check check (rol in ('dueno', 'encargado', 'empleado'));

create or replace function public.es_gestor(n uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.miembros m where m.negocio_id = n and m.user_id = auth.uid() and m.rol in ('dueno', 'encargado'))
         or public.es_superadmin();
$$;
grant execute on function public.es_gestor(uuid) to authenticated;

create or replace function public.aceptar_invitacion(p_codigo text, p_nombre text default '')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  i public.invitaciones;
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión primero';
  end if;
  select * into i from public.invitaciones where codigo = upper(trim(p_codigo)) for update;
  if i.codigo is null then
    raise exception 'Esa invitación no existe';
  end if;
  if i.usada_at is not null then
    raise exception 'Esa invitación ya se usó. Pide una nueva.';
  end if;
  if i.expira_at < now() then
    raise exception 'Esa invitación venció. Pide una nueva.';
  end if;
  insert into public.miembros (negocio_id, user_id, rol, nombre)
  values (i.negocio_id, auth.uid(), i.rol, left(coalesce(nullif(trim(p_nombre), ''), i.nombre), 60))
  on conflict (negocio_id, user_id) do update set rol = case
    when excluded.rol = 'dueno' or miembros.rol = 'dueno' then 'dueno'
    when excluded.rol = 'encargado' or miembros.rol = 'encargado' then 'encargado'
    else 'empleado' end;
  update public.invitaciones set usada_at = now(), usada_por = auth.uid() where codigo = i.codigo;
  return i.negocio_id;
end;
$$;
grant execute on function public.aceptar_invitacion(text, text) to authenticated;

-- ─────────────────────────────────────────────
-- Locales (sucursales)
-- ─────────────────────────────────────────────

create table if not exists public.sucursales (
  id         uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  nombre     text not null check (char_length(nombre) between 1 and 60),
  direccion  text check (char_length(direccion) <= 160),
  latitud    double precision check (latitud between -90 and 90),
  longitud   double precision check (longitud between -180 and 180),
  created_at timestamptz not null default now()
);
create index if not exists sucursales_negocio_idx on public.sucursales (negocio_id, created_at);
alter table public.sucursales enable row level security;
revoke all on public.sucursales from anon, authenticated;
grant select, insert, update, delete on public.sucursales to authenticated;
drop policy if exists "equipo: ver locales" on public.sucursales;
create policy "equipo: ver locales" on public.sucursales for select to authenticated using (public.es_miembro(negocio_id));
drop policy if exists "dueno: locales" on public.sucursales;
create policy "dueno: locales" on public.sucursales for all to authenticated
  using (public.es_dueno(negocio_id)) with check (public.es_dueno(negocio_id) and public.plan_incluye(negocio_id, 'sucursales'));

create or replace function public.limite_locales()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.sucursales where negocio_id = new.negocio_id)
     >= (select max_locales from public.negocios where id = new.negocio_id) then
    raise exception 'Llegaste al máximo de locales de tu plan. Escríbenos para sumar más.';
  end if;
  return new;
end;
$$;
drop trigger if exists sucursales_limite on public.sucursales;
create trigger sucursales_limite before insert on public.sucursales for each row execute function public.limite_locales();

-- Un empleado puede quedar fijo en un local (null = todos).
alter table public.miembros add column if not exists sucursal_id uuid references public.sucursales (id) on delete set null;
grant update (nombre, sucursal_id) on public.miembros to authenticated;
create or replace function public.solo_dueno_cambia_local()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sucursal_id is distinct from old.sucursal_id and not public.es_dueno(new.negocio_id) then
    raise exception 'Solo el dueño asigna locales';
  end if;
  if new.sucursal_id is not null and not exists (select 1 from public.sucursales where id = new.sucursal_id and negocio_id = new.negocio_id) then
    raise exception 'Ese local no es de este negocio';
  end if;
  return new;
end;
$$;
drop trigger if exists miembros_local on public.miembros;
create trigger miembros_local before update on public.miembros for each row execute function public.solo_dueno_cambia_local();

-- El dueño cambia el rol de alguien del equipo (siempre debe quedar al menos un dueño).
create or replace function public.cambiar_rol(p_negocio uuid, p_usuario uuid, p_rol text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_dueno(p_negocio) then
    raise exception 'Solo el dueño cambia roles';
  end if;
  if p_rol not in ('dueno', 'encargado', 'empleado') then
    raise exception 'Rol no válido';
  end if;
  if p_rol <> 'dueno' and exists (select 1 from public.miembros where negocio_id = p_negocio and user_id = p_usuario and rol = 'dueno')
     and (select count(*) from public.miembros where negocio_id = p_negocio and rol = 'dueno') <= 1 then
    raise exception 'El negocio necesita al menos un dueño';
  end if;
  update public.miembros set rol = p_rol where negocio_id = p_negocio and user_id = p_usuario;
end;
$$;
grant execute on function public.cambiar_rol(uuid, uuid, text) to authenticated;

-- El local donde se hace algo: el fijo del empleado, o el que eligió en el panel (si es de este negocio).
create or replace function public.sucursal_de(p_negocio uuid, p_sucursal uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  fija uuid;
begin
  select m.sucursal_id into fija from public.miembros m where m.negocio_id = p_negocio and m.user_id = auth.uid();
  if fija is not null then
    return fija;
  end if;
  if p_sucursal is null then
    return null;
  end if;
  if not exists (select 1 from public.sucursales s where s.id = p_sucursal and s.negocio_id = p_negocio) then
    raise exception 'Ese local no es de este negocio';
  end if;
  return p_sucursal;
end;
$$;
revoke all on function public.sucursal_de(uuid, uuid) from public, anon, authenticated;

alter table public.movimientos add column if not exists sucursal_id uuid references public.sucursales (id) on delete set null;
alter table public.codigos add column if not exists sucursal_id uuid references public.sucursales (id) on delete set null;
create index if not exists movimientos_sucursal_idx on public.movimientos (sucursal_id, created_at desc) where sucursal_id is not null;

-- ─────────────────────────────────────────────
-- Cupones
-- ─────────────────────────────────────────────

create table if not exists public.cupones (
  id         uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  titulo     text not null check (char_length(titulo) between 1 and 60),
  detalle    text not null default '' check (char_length(detalle) <= 200),
  -- Días que dura desde que se entrega (null = no vence).
  dias       integer check (dias between 1 and 365),
  -- Lo que le cuesta al negocio (para el control de presupuesto).
  costo      numeric(12, 2) check (costo >= 0),
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists cupones_negocio_idx on public.cupones (negocio_id, created_at desc);
alter table public.cupones enable row level security;
revoke all on public.cupones from anon, authenticated;
grant select, insert, update, delete on public.cupones to authenticated;
drop policy if exists "equipo: ver cupones" on public.cupones;
create policy "equipo: ver cupones" on public.cupones for select to authenticated using (public.es_miembro(negocio_id));
drop policy if exists "dueno: cupones" on public.cupones;
create policy "dueno: cupones" on public.cupones for all to authenticated
  using (public.es_gestor(negocio_id)) with check (public.es_gestor(negocio_id));

-- Catálogo de premios (tarjeta de puntos): totalmente administrable, con foto, categoría, stock y fechas.
create table if not exists public.premios (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references public.negocios (id) on delete cascade,
  titulo      text not null check (char_length(titulo) between 1 and 60),
  descripcion text not null default '' check (char_length(descripcion) <= 300),
  imagen_url  text check (imagen_url is null or (imagen_url ~ '^https://' and char_length(imagen_url) <= 500)),
  categoria   text not null default '' check (char_length(categoria) <= 30),
  puntos      integer not null check (puntos between 1 and 10000000),
  -- null = sin límite
  stock       integer check (stock >= 0),
  desde       date,
  hasta       date,
  costo       numeric(12, 2) check (costo >= 0),
  destacado   boolean not null default false,
  activo      boolean not null default true,
  orden       integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists premios_negocio_idx on public.premios (negocio_id, orden, puntos);
alter table public.premios enable row level security;
revoke all on public.premios from anon, authenticated;
grant select, insert, update, delete on public.premios to authenticated;
drop policy if exists "equipo: ver catalogo" on public.premios;
create policy "equipo: ver catalogo" on public.premios for select to authenticated using (public.es_miembro(negocio_id));
drop policy if exists "gestor: catalogo" on public.premios;
create policy "gestor: catalogo" on public.premios for all to authenticated
  using (public.es_gestor(negocio_id)) with check (public.es_gestor(negocio_id));

-- ¿Ese premio del catálogo se puede canjear hoy?
create or replace function public.premio_disponible(r public.premios, zona text)
returns boolean
language sql
stable
as $$
  select r.activo and coalesce(r.stock, 1) > 0
     and (r.desde is null or r.desde <= (now() at time zone zona)::date)
     and (r.hasta is null or r.hasta >= (now() at time zone zona)::date);
$$;

-- Promociones por fecha: "doble puntos este fin de semana" (multiplica lo que suma cada visita).
create table if not exists public.promociones (
  id            uuid primary key default gen_random_uuid(),
  negocio_id    uuid not null references public.negocios (id) on delete cascade,
  titulo        text not null check (char_length(titulo) between 1 and 60),
  multiplicador integer not null default 2 check (multiplicador between 2 and 5),
  desde         date not null,
  hasta         date not null check (hasta >= desde),
  activo        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists promociones_negocio_idx on public.promociones (negocio_id, desde desc);
alter table public.promociones enable row level security;
revoke all on public.promociones from anon, authenticated;
grant select, insert, update, delete on public.promociones to authenticated;
drop policy if exists "equipo: ver promociones" on public.promociones;
create policy "equipo: ver promociones" on public.promociones for select to authenticated using (public.es_miembro(negocio_id));
drop policy if exists "gestor: promociones" on public.promociones;
create policy "gestor: promociones" on public.promociones for all to authenticated
  using (public.es_gestor(negocio_id)) with check (public.es_gestor(negocio_id));

-- La promoción de hoy (la que más multiplica), si el plan las incluye.
create or replace function public.promocion_hoy(p_negocio uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('titulo', x.titulo, 'multiplicador', x.multiplicador, 'hasta', x.hasta)
  from public.promociones x join public.negocios n on n.id = x.negocio_id
  where x.negocio_id = p_negocio and x.activo and public.plan_incluye(p_negocio, 'promociones')
    and (now() at time zone n.zona_horaria)::date between x.desde and x.hasta
  order by x.multiplicador desc, x.hasta
  limit 1;
$$;
grant execute on function public.promocion_hoy(uuid) to anon, authenticated;

-- Retos con insignia: "ven 3 veces en 30 días y gana 1 sello". Se puede volver a ganar después de cada logro.
create table if not exists public.retos (
  id         uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  titulo     text not null check (char_length(titulo) between 1 and 60),
  insignia   text not null default '🏅' check (char_length(insignia) between 1 and 8),
  visitas    integer not null check (visitas between 2 and 100),
  dias       integer not null check (dias between 1 and 365),
  -- Regalo en sellos (en la tarjeta de puntos se convierte con "puntos_regalo").
  regalo     integer not null default 1 check (regalo between 0 and 10),
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists retos_negocio_idx on public.retos (negocio_id);
alter table public.retos enable row level security;
revoke all on public.retos from anon, authenticated;
grant select, insert, update, delete on public.retos to authenticated;
drop policy if exists "equipo: ver retos" on public.retos;
create policy "equipo: ver retos" on public.retos for select to authenticated using (public.es_miembro(negocio_id));
drop policy if exists "gestor: retos" on public.retos;
create policy "gestor: retos" on public.retos for all to authenticated
  using (public.es_gestor(negocio_id)) with check (public.es_gestor(negocio_id));

-- ─────────────────────────────────────────────
-- La tarjeta: puntos, premios intermedios, niveles, referidos, diseño a medida
-- ─────────────────────────────────────────────

alter table public.programas add column if not exists tipo text not null default 'sellos' check (tipo in ('sellos', 'puntos'));
-- Puntos: 1 punto por cada "puntos_cada" de compra.
alter table public.programas add column if not exists puntos_cada numeric(12, 2) not null default 100 check (puntos_cada > 0);
-- Cuántos puntos vale un "sello de regalo" (bienvenida, cumpleaños, te extrañamos, referidos) en la tarjeta de puntos.
alter table public.programas add column if not exists puntos_regalo integer not null default 100 check (puntos_regalo between 1 and 100000);
-- Cómo se llaman los puntos en la tarjeta ("puntos", "estrellas", "pesos" para cashback…).
alter table public.programas add column if not exists nombre_puntos text not null default 'puntos'
  check (char_length(nombre_puntos) between 1 and 20);
-- Lo que le cuesta al negocio el premio de la tarjeta llena (para el control de presupuesto).
alter table public.programas add column if not exists costo_premio numeric(12, 2) check (costo_premio >= 0);
-- Premios intermedios de la tarjeta de sellos: [{"sellos": 5, "premio": "Un café"}]
alter table public.programas add column if not exists hitos jsonb not null default '[]'::jsonb;
-- Niveles por visitas: [{"nombre": "VIP", "visitas": 20, "beneficio": "10% siempre", "doble": false}]
alter table public.programas add column if not exists niveles jsonb not null default '[]'::jsonb;
-- Sellos de regalo para quien invita y para su amigo (cuando el amigo viene por primera vez). 0 = apagado.
alter table public.programas add column if not exists referido_regalo integer not null default 1 check (referido_regalo between 0 and 3);
-- Cupón que se regala el día del cumpleaños (además de los sellos).
alter table public.programas add column if not exists cumple_cupon uuid references public.cupones (id) on delete set null;
-- Diseño a medida: imagen de fondo propia y color del texto.
alter table public.programas add column if not exists fondo_url text check (fondo_url is null or (fondo_url ~ '^https://' and char_length(fondo_url) <= 500));
alter table public.programas add column if not exists texto_claro boolean not null default true;
alter table public.programas drop constraint if exists programas_diseno_check;
alter table public.programas add constraint programas_diseno_check check (diseno ~ '^[a-z]{2,20}$');

-- Revisa y ordena las listas de la tarjeta (premios intermedios y niveles).
create or replace function public.validar_programa()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  e jsonb;
  limpio jsonb;
begin
  if jsonb_typeof(new.hitos) <> 'array' or jsonb_array_length(new.hitos) > 5 then
    raise exception 'Hasta 5 premios intermedios';
  end if;
  limpio := '[]'::jsonb;
  for e in select x from jsonb_array_elements(new.hitos) x order by (x ->> 'sellos')::integer loop
    if (e ->> 'sellos') !~ '^\d{1,2}$' or (e ->> 'sellos')::integer < 1 or (e ->> 'sellos')::integer >= new.meta then
      raise exception 'Cada premio intermedio va entre 1 y % sellos', new.meta - 1;
    end if;
    if char_length(trim(coalesce(e ->> 'premio', ''))) not between 1 and 60 then
      raise exception 'Escribe el premio intermedio (hasta 60 letras)';
    end if;
    if limpio @> jsonb_build_array(jsonb_build_object('sellos', (e ->> 'sellos')::integer)) then
      raise exception 'Hay dos premios intermedios con los mismos sellos';
    end if;
    limpio := limpio || jsonb_build_array(jsonb_build_object('sellos', (e ->> 'sellos')::integer, 'premio', trim(e ->> 'premio')));
  end loop;
  new.hitos := limpio;

  if jsonb_typeof(new.niveles) <> 'array' or jsonb_array_length(new.niveles) > 4 then
    raise exception 'Hasta 4 niveles';
  end if;
  limpio := '[]'::jsonb;
  for e in select x from jsonb_array_elements(new.niveles) x order by (x ->> 'visitas')::integer loop
    if (e ->> 'visitas') !~ '^\d{1,4}$' or (e ->> 'visitas')::integer < 1 then
      raise exception 'Cada nivel necesita sus visitas';
    end if;
    if char_length(trim(coalesce(e ->> 'nombre', ''))) not between 1 and 30 then
      raise exception 'Escribe el nombre del nivel (hasta 30 letras)';
    end if;
    if limpio @> jsonb_build_array(jsonb_build_object('visitas', (e ->> 'visitas')::integer)) then
      raise exception 'Hay dos niveles con las mismas visitas';
    end if;
    limpio := limpio || jsonb_build_array(jsonb_build_object(
      'nombre', trim(e ->> 'nombre'),
      'visitas', (e ->> 'visitas')::integer,
      'beneficio', left(trim(coalesce(e ->> 'beneficio', '')), 80),
      'doble', coalesce((e ->> 'doble')::boolean, false)
    ));
  end loop;
  new.niveles := limpio;

  if new.cumple_cupon is not null and not exists (select 1 from public.cupones c where c.id = new.cumple_cupon and c.negocio_id = new.negocio_id) then
    raise exception 'Ese cupón no es de este negocio';
  end if;
  return new;
end;
$$;
drop trigger if exists programas_validar on public.programas;
create trigger programas_validar before insert or update on public.programas for each row execute function public.validar_programa();

alter table public.tarjetas add column if not exists puntos integer not null default 0 check (puntos >= 0);
alter table public.tarjetas add column if not exists total_puntos integer not null default 0;
alter table public.tarjetas add column if not exists visitas integer not null default 0;
-- Premios intermedios ya canjeados en la vuelta actual (se vacía al completar la tarjeta).
alter table public.tarjetas add column if not exists hitos_canjeados integer[] not null default '{}';
alter table public.tarjetas add column if not exists referido_por uuid references public.tarjetas (id) on delete set null;
alter table public.tarjetas add column if not exists referido_pagado boolean not null default false;
-- Último local donde vino.
alter table public.tarjetas add column if not exists sucursal_id uuid references public.sucursales (id) on delete set null;

alter table public.movimientos add column if not exists unidad text not null default 'sellos' check (unidad in ('sellos', 'puntos'));
alter table public.movimientos drop constraint if exists movimientos_origen_check;
alter table public.movimientos add constraint movimientos_origen_check check (origen in (
  'qr', 'equipo', 'manual', 'bienvenida', 'cumpleanos', 'regreso', 'migracion', 'referido', 'api', 'premio', 'cupon', 'reto'
));
-- Lo que costó al negocio el premio canjeado (control de presupuesto).
alter table public.movimientos add column if not exists costo numeric(12, 2);

create table if not exists public.tarjeta_retos (
  id         uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  tarjeta_id uuid not null references public.tarjetas (id) on delete cascade,
  reto_id    uuid not null references public.retos (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists tarjeta_retos_idx on public.tarjeta_retos (tarjeta_id, reto_id, created_at desc);
alter table public.tarjeta_retos enable row level security;
revoke all on public.tarjeta_retos from anon, authenticated;
grant select on public.tarjeta_retos to authenticated;
drop policy if exists "equipo: ver retos logrados" on public.tarjeta_retos;
create policy "equipo: ver retos logrados" on public.tarjeta_retos for select to authenticated using (public.es_miembro(negocio_id));

-- Cupones entregados a cada tarjeta.
create table if not exists public.tarjeta_cupones (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references public.negocios (id) on delete cascade,
  tarjeta_id  uuid not null references public.tarjetas (id) on delete cascade,
  cupon_id    uuid references public.cupones (id) on delete set null,
  titulo      text not null,
  detalle     text not null default '',
  vence_at    timestamptz,
  usado_at    timestamptz,
  usado_por   uuid references auth.users (id) on delete set null,
  sucursal_id uuid references public.sucursales (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists tarjeta_cupones_tarjeta_idx on public.tarjeta_cupones (tarjeta_id, created_at desc);
create index if not exists tarjeta_cupones_negocio_idx on public.tarjeta_cupones (negocio_id, created_at desc);
alter table public.tarjeta_cupones enable row level security;
revoke all on public.tarjeta_cupones from anon, authenticated;
grant select on public.tarjeta_cupones to authenticated;
drop policy if exists "equipo: ver cupones entregados" on public.tarjeta_cupones;
create policy "equipo: ver cupones entregados" on public.tarjeta_cupones for select to authenticated
  using (public.es_miembro(negocio_id));

-- ─────────────────────────────────────────────
-- Sumar sellos o puntos (uso interno)
-- ─────────────────────────────────────────────

-- Lo que vale un regalo (bienvenida, cumpleaños, te extrañamos, referidos) en la tarjeta del negocio:
-- sellos tal cual, o esa cantidad de "sellos" convertida a puntos.
create or replace function public.regalo(p_negocio uuid, p_sellos integer)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case when p.tipo = 'puntos' then p_sellos * p.puntos_regalo else p_sellos end
  from public.programas p where p.negocio_id = p_negocio;
$$;
revoke all on function public.regalo(uuid, integer) from public, anon, authenticated;

create or replace function public.unidad_de(p_negocio uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select case when p.tipo = 'puntos' and public.plan_incluye(p_negocio, 'puntos') then 'puntos' else 'sellos' end
                   from public.programas p where p.negocio_id = p_negocio), 'sellos');
$$;
revoke all on function public.unidad_de(uuid) from public, anon, authenticated;

-- Suma (o resta) sellos o puntos según el tipo de tarjeta.
create or replace function public.aplicar(p_tarjeta uuid, p_cantidad integer)
returns public.tarjetas
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tarjetas;
  v_meta integer;
  total integer;
begin
  select * into t from public.tarjetas where id = p_tarjeta for update;
  if public.unidad_de(t.negocio_id) = 'puntos' then
    update public.tarjetas
    set puntos = greatest(0, puntos + p_cantidad),
        total_puntos = greatest(0, total_puntos + p_cantidad),
        ultima_at = case when p_cantidad > 0 then now() else ultima_at end
    where id = t.id returning * into t;
    return t;
  end if;
  select p.meta into v_meta from public.programas p where p.negocio_id = t.negocio_id;
  v_meta := coalesce(v_meta, 10);
  if p_cantidad >= 0 then
    total := t.sellos + p_cantidad;
    update public.tarjetas
    set sellos = total % v_meta, premios = premios + total / v_meta, total_sellos = total_sellos + p_cantidad, ultima_at = now(),
        hitos_canjeados = case when total >= v_meta then '{}' else hitos_canjeados end
    where id = t.id returning * into t;
  else
    total := greatest(0, t.premios * v_meta + t.sellos + p_cantidad);
    update public.tarjetas
    set sellos = total % v_meta, premios = total / v_meta, total_sellos = greatest(0, total_sellos + p_cantidad)
    where id = t.id returning * into t;
  end if;
  return t;
end;
$$;
revoke all on function public.aplicar(uuid, integer) from public, anon, authenticated;

-- El nivel de la tarjeta según sus visitas (null si no tiene o el plan no lo incluye).
create or replace function public.nivel_de(t public.tarjetas)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select n
  from public.programas p, jsonb_array_elements(p.niveles) n
  where p.negocio_id = t.negocio_id and public.plan_incluye(t.negocio_id, 'niveles') and t.visitas >= (n ->> 'visitas')::integer
  order by (n ->> 'visitas')::integer desc
  limit 1;
$$;
revoke all on function public.nivel_de(public.tarjetas) from public, anon, authenticated;

-- Cuántos sellos (o puntos) da una visita: regla del negocio, día doble, promoción del día y nivel con "suma el doble".
drop function if exists public.sellos_por(uuid, numeric);
create or replace function public.sellos_por(p_negocio uuid, p_monto numeric, p_tarjeta uuid default null)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p public.programas;
  t public.tarjetas;
  n integer;
begin
  select * into p from public.programas where negocio_id = p_negocio;
  if public.unidad_de(p_negocio) = 'puntos' then
    if p_monto is null then
      raise exception 'Anota el monto de la compra';
    end if;
    n := least(1000000, floor(p_monto / p.puntos_cada)::integer);
    if n < 1 then
      raise exception 'Este monto no alcanza para un punto';
    end if;
  elsif p.regla = 'monto' then
    if p_monto is null then
      raise exception 'Anota el monto de la compra';
    end if;
    n := least(20, floor(p_monto / p.monto_por_sello)::integer);
    if n < 1 then
      raise exception 'Este monto no alcanza para un sello';
    end if;
  else
    n := 1;
  end if;
  if coalesce(public.dia_doble(p_negocio), false) then
    n := n * 2;
  end if;
  n := n * coalesce((public.promocion_hoy(p_negocio) ->> 'multiplicador')::integer, 1);
  if p_tarjeta is not null then
    select * into t from public.tarjetas where id = p_tarjeta;
    if coalesce((public.nivel_de(t) ->> 'doble')::boolean, false) then
      n := n * 2;
    end if;
  end if;
  return n;
end;
$$;
revoke all on function public.sellos_por(uuid, numeric, uuid) from public, anon, authenticated;

-- Si esta tarjeta llegó invitada y es su primera visita, regala a las dos.
create or replace function public.pagar_referido(p_tarjeta uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tarjetas;
  r integer;
begin
  select * into t from public.tarjetas where id = p_tarjeta for update;
  if t.referido_por is null or t.referido_pagado or not public.plan_incluye(t.negocio_id, 'referidos') then
    return 0;
  end if;
  update public.tarjetas set referido_pagado = true where id = t.id;
  select referido_regalo into r from public.programas where negocio_id = t.negocio_id;
  r := public.regalo(t.negocio_id, coalesce(r, 0));
  if coalesce(r, 0) < 1 or not exists (select 1 from public.tarjetas where id = t.referido_por) then
    return 0;
  end if;
  insert into public.movimientos (negocio_id, tarjeta_id, tipo, cantidad, origen, por, nota, unidad)
  values (t.negocio_id, t.id, 'sello', r, 'referido', null, 'Regalo por llegar invitado', public.unidad_de(t.negocio_id)),
         (t.negocio_id, t.referido_por, 'sello', r, 'referido', null, 'Regalo por invitar a ' || split_part(t.nombre, ' ', 1),
          public.unidad_de(t.negocio_id));
  perform public.aplicar(t.id, r);
  perform public.aplicar(t.referido_por, r);
  return r;
end;
$$;
revoke all on function public.pagar_referido(uuid) from public, anon, authenticated;

-- Retos que esta tarjeta acaba de cumplir (y su regalo). Devuelve [{"titulo","insignia","regalo"}].
create or replace function public.revisar_retos(p_tarjeta uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tarjetas;
  r public.retos;
  ultimo timestamptz;
  n integer;
  g integer;
  logrados jsonb := '[]'::jsonb;
begin
  select * into t from public.tarjetas where id = p_tarjeta;
  if not public.plan_incluye(t.negocio_id, 'retos') then
    return logrados;
  end if;
  for r in select * from public.retos where negocio_id = t.negocio_id and activo order by visitas loop
    select max(created_at) into ultimo from public.tarjeta_retos where tarjeta_id = t.id and reto_id = r.id;
    select count(*) into n from public.movimientos m
    where m.tarjeta_id = t.id and m.tipo = 'sello' and m.origen in ('qr', 'equipo', 'api')
      and m.created_at > greatest(now() - make_interval(days => r.dias), coalesce(ultimo, '-infinity'::timestamptz));
    continue when n < r.visitas;
    insert into public.tarjeta_retos (negocio_id, tarjeta_id, reto_id) values (t.negocio_id, t.id, r.id);
    g := public.regalo(t.negocio_id, r.regalo);
    if g > 0 then
      insert into public.movimientos (negocio_id, tarjeta_id, tipo, cantidad, origen, por, nota, unidad)
      values (t.negocio_id, t.id, 'sello', g, 'reto', null, left('Reto: ' || r.titulo, 120), public.unidad_de(t.negocio_id));
      perform public.aplicar(t.id, g);
    end if;
    logrados := logrados || jsonb_build_array(jsonb_build_object('titulo', r.titulo, 'insignia', r.insignia, 'regalo', g));
  end loop;
  return logrados;
end;
$$;
revoke all on function public.revisar_retos(uuid) from public, anon, authenticated;

-- Una visita: suma según la regla, cuenta la visita, recuerda el local, paga el referido y revisa los retos.
create or replace function public.registrar_visita(
  p_tarjeta uuid, p_monto numeric, p_origen text, p_sucursal uuid, p_por uuid, p_autoriza uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tarjetas;
  n integer;
  doble boolean;
  ref integer;
  logrados jsonb;
begin
  select * into t from public.tarjetas where id = p_tarjeta;
  n := public.sellos_por(t.negocio_id, p_monto, t.id);
  doble := coalesce(public.dia_doble(t.negocio_id), false);
  insert into public.movimientos (negocio_id, tarjeta_id, tipo, cantidad, origen, monto, por, autorizado_por, nota, sucursal_id, unidad)
  values (t.negocio_id, t.id, 'sello', n, p_origen, p_monto, p_por, p_autoriza, case when doble then 'Día doble' end, p_sucursal,
          public.unidad_de(t.negocio_id));
  update public.tarjetas set visitas = visitas + 1, sucursal_id = coalesce(p_sucursal, sucursal_id) where id = t.id;
  t := public.aplicar(t.id, n);
  ref := public.pagar_referido(t.id);
  logrados := public.revisar_retos(t.id);
  select * into t from public.tarjetas where id = p_tarjeta;
  return public.estado_tarjeta(t) || jsonb_build_object('sumados', n, 'doble', doble, 'referido', ref, 'retos', logrados,
    'promocion', public.promocion_hoy(t.negocio_id));
end;
$$;
revoke all on function public.registrar_visita(uuid, numeric, text, uuid, uuid, uuid) from public, anon, authenticated;

drop function if exists public.estado_tarjeta(public.tarjetas) cascade;
create or replace function public.estado_tarjeta(t public.tarjetas)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'codigo', t.codigo, 'nombre', t.nombre, 'sellos', t.sellos, 'premios', t.premios,
    'total_sellos', t.total_sellos, 'canjes', t.canjes, 'acepta_avisos', t.acepta_avisos,
    'created_at', t.created_at, 'ultima_at', t.ultima_at,
    'puntos', t.puntos, 'total_puntos', t.total_puntos, 'visitas', t.visitas, 'hitos_canjeados', to_jsonb(t.hitos_canjeados),
    'nivel', public.nivel_de(t)
  );
$$;
revoke all on function public.estado_tarjeta(public.tarjetas) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- Para el cliente (sin sesión)
-- ─────────────────────────────────────────────

-- Lo que el plan apaga no llega a la tarjeta del cliente.
create or replace function public.programa_publico(p_negocio uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(p) - 'negocio_id' - 'updated_at' - 'cumple_cupon' || jsonb_build_object(
    'tipo', public.unidad_de(p_negocio),
    'hitos', case when public.plan_incluye(p_negocio, 'premios') then p.hitos else '[]'::jsonb end,
    'niveles', case when public.plan_incluye(p_negocio, 'niveles') then p.niveles else '[]'::jsonb end,
    'referido_regalo', case when public.plan_incluye(p_negocio, 'referidos') then p.referido_regalo else 0 end
  )
  from public.programas p where p.negocio_id = p_negocio;
$$;
revoke all on function public.programa_publico(uuid) from public, anon, authenticated;

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
    'activa', p.activo and public.vigente(n.id)
  )
  from public.negocios n join public.programas p on p.negocio_id = n.id
  where n.slug = lower(trim(p_slug));
$$;
grant execute on function public.negocio_publico(text) to anon, authenticated;

-- Quién invita (para mostrar "Camila te invitó" al unirse).
create or replace function public.quien_invita(p_slug text, p_codigo text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select split_part(t.nombre, ' ', 1)
  from public.tarjetas t join public.negocios n on n.id = t.negocio_id
  where n.slug = lower(trim(p_slug)) and t.codigo = upper(trim(p_codigo)) and public.plan_incluye(n.id, 'referidos');
$$;
grant execute on function public.quien_invita(text, text) to anon, authenticated;

drop function if exists public.unirse(text, text, text, text, date, boolean);
create or replace function public.unirse(
  p_slug text,
  p_nombre text,
  p_telefono text,
  p_email text default null,
  p_cumpleanos date default null,
  p_acepta boolean default false,
  p_ref text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n public.negocios;
  p public.programas;
  t public.tarjetas;
  ref uuid;
  regalo integer;
begin
  select * into n from public.negocios where slug = lower(trim(p_slug));
  select * into p from public.programas where negocio_id = n.id and activo;
  if n.id is null or p.negocio_id is null or not public.vigente(n.id) then
    raise exception 'Este negocio no tiene la tarjeta activa';
  end if;
  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'Escribe tu nombre';
  end if;
  if public.clave_telefono(p_telefono) is null then
    raise exception 'Escribe un teléfono válido';
  end if;

  select * into t from public.tarjetas where negocio_id = n.id and telefono_clave = public.clave_telefono(p_telefono);
  if t.id is not null then
    if p_acepta and not t.acepta_avisos then
      update public.tarjetas set acepta_avisos = true where id = t.id;
    end if;
    return t.codigo;
  end if;

  if coalesce(p_ref, '') <> '' then
    select id into ref from public.tarjetas where negocio_id = n.id and codigo = upper(trim(p_ref));
  end if;

  insert into public.tarjetas (negocio_id, codigo, nombre, telefono, email, cumpleanos, acepta_avisos, referido_por)
  values (n.id, public.codigo_nuevo(10), left(trim(p_nombre), 60), left(trim(p_telefono), 30),
          nullif(left(trim(coalesce(p_email, '')), 120), ''), p_cumpleanos, coalesce(p_acepta, false), ref)
  returning * into t;

  regalo := public.regalo(n.id, p.bienvenida);
  if regalo > 0 then
    insert into public.movimientos (negocio_id, tarjeta_id, tipo, cantidad, origen, por, unidad)
    values (n.id, t.id, 'sello', regalo, 'bienvenida', null, public.unidad_de(n.id));
    perform public.aplicar(t.id, regalo);
  end if;
  return t.codigo;
end;
$$;
grant execute on function public.unirse(text, text, text, text, date, boolean, text) to anon, authenticated;

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
    'catalogo', case when public.unidad_de(n.id) = 'puntos' then coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'titulo', r.titulo, 'descripcion', r.descripcion, 'imagen_url', r.imagen_url,
                                          'categoria', r.categoria, 'puntos', r.puntos, 'destacado', r.destacado,
                                          'agotado', r.stock is not null and r.stock <= 0, 'hasta', r.hasta)
                       order by r.destacado desc, r.orden, r.puntos)
      from public.premios r
      where r.negocio_id = n.id and r.activo
        and (r.desde is null or r.desde <= (now() at time zone n.zona_horaria)::date)
        and (r.hasta is null or r.hasta >= (now() at time zone n.zona_horaria)::date)
    ), '[]'::jsonb) else '[]'::jsonb end,
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

create or replace function public.sumar_qr(p_tarjeta text, p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  k public.codigos;
  t public.tarjetas;
  p public.programas;
  zona text;
  hoy integer;
  r jsonb;
begin
  select * into k from public.codigos where codigo = upper(trim(p_codigo)) for update;
  if k.codigo is null then
    raise exception 'Ese código de sello no existe';
  end if;
  select * into t from public.tarjetas where codigo = upper(trim(p_tarjeta));
  if t.id is null then
    raise exception 'No encontramos tu tarjeta';
  end if;
  if t.negocio_id <> k.negocio_id then
    raise exception 'Esta tarjeta es de otro negocio';
  end if;
  if k.usado_at is not null then
    raise exception 'Este código ya se usó';
  end if;
  if k.created_at < now() - interval '15 minutes' then
    raise exception 'Este código venció. Pide uno nuevo.';
  end if;
  select * into p from public.programas where negocio_id = t.negocio_id and activo;
  if p.negocio_id is null or not public.vigente(t.negocio_id) then
    raise exception 'La tarjeta de este negocio está pausada';
  end if;

  select zona_horaria into zona from public.negocios where id = t.negocio_id;
  select count(*) into hoy from public.movimientos m
  where m.tarjeta_id = t.id and m.tipo = 'sello' and m.origen in ('qr', 'equipo', 'api')
    and (m.created_at at time zone zona)::date = (now() at time zone zona)::date;
  if hoy >= p.max_por_dia then
    raise exception 'Ya sumaste tu visita de hoy. ¡Te esperamos pronto!';
  end if;

  r := public.registrar_visita(t.id, k.monto, 'qr', k.sucursal_id, null, k.creado_por);
  update public.codigos set usado_at = now(), tarjeta_id = t.id, sumados = (r ->> 'sumados')::integer where codigo = k.codigo;
  return r;
end;
$$;
grant execute on function public.sumar_qr(text, text) to anon, authenticated;

-- ─────────────────────────────────────────────
-- Para el equipo
-- ─────────────────────────────────────────────

drop function if exists public.sellar(text, numeric);
create or replace function public.sellar(p_tarjeta text, p_monto numeric default null, p_sucursal uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tarjetas;
begin
  select * into t from public.tarjetas where codigo = upper(trim(p_tarjeta));
  if t.id is null then
    raise exception 'No encontramos esa tarjeta';
  end if;
  if not public.es_miembro(t.negocio_id) then
    raise exception 'Esa tarjeta es de otro negocio';
  end if;
  if not public.vigente(t.negocio_id) then
    raise exception 'Tu prueba gratis terminó. Escríbenos para activar tu cuenta.';
  end if;
  return public.registrar_visita(t.id, p_monto, 'equipo', public.sucursal_de(t.negocio_id, p_sucursal), auth.uid(), null);
end;
$$;
grant execute on function public.sellar(text, numeric, uuid) to authenticated;

drop function if exists public.ajustar(text, integer, text, text);
create or replace function public.ajustar(
  p_tarjeta text, p_cantidad integer, p_pin text default null, p_motivo text default null, p_sucursal uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tarjetas;
  quien uuid;
  unidad text;
begin
  select * into t from public.tarjetas where codigo = upper(trim(p_tarjeta));
  if t.id is null then
    raise exception 'No encontramos esa tarjeta';
  end if;
  quien := public.exigir_pin(t.negocio_id, p_pin);
  unidad := public.unidad_de(t.negocio_id);
  if coalesce(p_cantidad, 0) = 0 or abs(p_cantidad) > (case when unidad = 'puntos' then 1000000 else 30 end) then
    raise exception 'Cantidad no válida';
  end if;
  if p_cantidad > 0 and not public.vigente(t.negocio_id) then
    raise exception 'Tu prueba gratis terminó. Escríbenos para activar tu cuenta.';
  end if;
  insert into public.movimientos (negocio_id, tarjeta_id, tipo, cantidad, origen, autorizado_por, nota, sucursal_id, unidad)
  values (t.negocio_id, t.id, case when p_cantidad > 0 then 'sello' else 'ajuste' end, p_cantidad, 'manual', quien,
          left(nullif(trim(p_motivo), ''), 120), public.sucursal_de(t.negocio_id, p_sucursal), unidad);
  t := public.aplicar(t.id, p_cantidad);
  return public.estado_tarjeta(t) || jsonb_build_object('sumados', p_cantidad);
end;
$$;
grant execute on function public.ajustar(text, integer, text, text, uuid) to authenticated;

drop function if exists public.canjear(text, text);
create or replace function public.canjear(p_tarjeta text, p_pin text default null, p_sucursal uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tarjetas;
  quien uuid;
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
  select premio, costo_premio into v_premio, v_costo from public.programas where negocio_id = t.negocio_id;
  update public.tarjetas set premios = premios - 1, canjes = canjes + 1, ultima_at = now() where id = t.id returning * into t;
  insert into public.movimientos (negocio_id, tarjeta_id, tipo, cantidad, origen, autorizado_por, nota, sucursal_id, costo)
  values (t.negocio_id, t.id, 'canje', -1, 'manual', quien, v_premio, public.sucursal_de(t.negocio_id, p_sucursal), v_costo);
  return public.estado_tarjeta(t);
end;
$$;
grant execute on function public.canjear(text, text, uuid) to authenticated;

-- Canjea un premio intermedio (tarjeta de sellos): se puede una vez por vuelta, sin descontar sellos.
create or replace function public.canjear_hito(p_tarjeta text, p_sellos integer, p_pin text default null, p_sucursal uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tarjetas;
  quien uuid;
  v_premio text;
begin
  select * into t from public.tarjetas where codigo = upper(trim(p_tarjeta)) for update;
  if t.id is null then
    raise exception 'No encontramos esa tarjeta';
  end if;
  quien := public.exigir_pin(t.negocio_id, p_pin);
  if not public.plan_incluye(t.negocio_id, 'premios') then
    raise exception 'Los premios intermedios son del plan Pro';
  end if;
  select h ->> 'premio' into v_premio
  from public.programas p, jsonb_array_elements(p.hitos) h
  where p.negocio_id = t.negocio_id and (h ->> 'sellos')::integer = p_sellos;
  if v_premio is null then
    raise exception 'Ese premio no existe';
  end if;
  if t.sellos < p_sellos then
    raise exception 'Todavía no llega a ese premio';
  end if;
  if p_sellos = any(t.hitos_canjeados) then
    raise exception 'Ese premio ya se canjeó en esta tarjeta';
  end if;
  update public.tarjetas set hitos_canjeados = hitos_canjeados || p_sellos, canjes = canjes + 1, ultima_at = now()
  where id = t.id returning * into t;
  insert into public.movimientos (negocio_id, tarjeta_id, tipo, cantidad, origen, autorizado_por, nota, sucursal_id)
  values (t.negocio_id, t.id, 'canje', 0, 'premio', quien, v_premio, public.sucursal_de(t.negocio_id, p_sucursal));
  return public.estado_tarjeta(t) || jsonb_build_object('premio', v_premio);
end;
$$;
grant execute on function public.canjear_hito(text, integer, text, uuid) to authenticated;

-- Canjea un premio del catálogo (tarjeta de puntos): descuenta sus puntos y su stock.
create or replace function public.canjear_puntos(p_tarjeta text, p_premio uuid, p_pin text default null, p_sucursal uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tarjetas;
  r public.premios;
  zona text;
  quien uuid;
begin
  select * into t from public.tarjetas where codigo = upper(trim(p_tarjeta)) for update;
  if t.id is null then
    raise exception 'No encontramos esa tarjeta';
  end if;
  quien := public.exigir_pin(t.negocio_id, p_pin);
  if public.unidad_de(t.negocio_id) <> 'puntos' then
    raise exception 'Esta tarjeta no es de puntos';
  end if;
  select * into r from public.premios where id = p_premio and negocio_id = t.negocio_id for update;
  select zona_horaria into zona from public.negocios where id = t.negocio_id;
  if r.id is null then
    raise exception 'Ese premio no existe';
  end if;
  if not public.premio_disponible(r, zona) then
    raise exception 'Ese premio no está disponible (sin stock o fuera de fecha)';
  end if;
  if t.puntos < r.puntos then
    raise exception 'No le alcanzan los puntos';
  end if;
  update public.premios set stock = stock - 1 where id = r.id and stock is not null;
  update public.tarjetas set puntos = puntos - r.puntos, canjes = canjes + 1, ultima_at = now() where id = t.id returning * into t;
  insert into public.movimientos (negocio_id, tarjeta_id, tipo, cantidad, origen, autorizado_por, nota, sucursal_id, unidad, costo)
  values (t.negocio_id, t.id, 'canje', -r.puntos, 'premio', quien, r.titulo, public.sucursal_de(t.negocio_id, p_sucursal), 'puntos', r.costo);
  return public.estado_tarjeta(t) || jsonb_build_object('premio', r.titulo);
end;
$$;
grant execute on function public.canjear_puntos(text, uuid, text, uuid) to authenticated;

drop function if exists public.crear_codigo(uuid, numeric);
create or replace function public.crear_codigo(p_negocio uuid, p_monto numeric default null, p_sucursal uuid default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v text;
begin
  if not public.es_miembro(p_negocio) then
    raise exception 'No tienes acceso a este negocio';
  end if;
  if not public.vigente(p_negocio) then
    raise exception 'Tu prueba gratis terminó. Escríbenos para activar tu cuenta.';
  end if;
  if p_monto is not null and p_monto <= 0 then
    raise exception 'Monto no válido';
  end if;
  delete from public.codigos where negocio_id = p_negocio and usado_at is null and created_at < now() - interval '1 day';
  v := public.codigo_nuevo(8);
  insert into public.codigos (codigo, negocio_id, monto, sucursal_id) values (v, p_negocio, p_monto, public.sucursal_de(p_negocio, p_sucursal));
  return v;
end;
$$;
grant execute on function public.crear_codigo(uuid, numeric, uuid) to authenticated;

-- Cupones: el dueño entrega uno a una tarjeta; el equipo lo canjea.
create or replace function public.dar_cupon(p_cupon uuid, p_tarjeta text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.cupones;
  t public.tarjetas;
  v uuid;
begin
  select * into c from public.cupones where id = p_cupon;
  select * into t from public.tarjetas where codigo = upper(trim(p_tarjeta));
  if c.id is null or t.id is null or c.negocio_id <> t.negocio_id then
    raise exception 'Ese cupón no es de este negocio';
  end if;
  if not public.es_gestor(c.negocio_id) then
    raise exception 'Solo el dueño o un encargado entrega cupones';
  end if;
  if not public.plan_incluye(c.negocio_id, 'cupones') then
    raise exception 'Los cupones son del plan Pro';
  end if;
  if not c.activo then
    raise exception 'Ese cupón está pausado';
  end if;
  insert into public.tarjeta_cupones (negocio_id, tarjeta_id, cupon_id, titulo, detalle, vence_at)
  values (c.negocio_id, t.id, c.id, c.titulo, c.detalle, case when c.dias is not null then now() + make_interval(days => c.dias) end)
  returning id into v;
  return v;
end;
$$;
grant execute on function public.dar_cupon(uuid, text) to authenticated;

create or replace function public.canjear_cupon(p_id uuid, p_pin text default null, p_sucursal uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.tarjeta_cupones;
  quien uuid;
begin
  select * into c from public.tarjeta_cupones where id = p_id for update;
  if c.id is null then
    raise exception 'Ese cupón no existe';
  end if;
  quien := public.exigir_pin(c.negocio_id, p_pin);
  if c.usado_at is not null then
    raise exception 'Ese cupón ya se usó';
  end if;
  if c.vence_at is not null and c.vence_at < now() then
    raise exception 'Ese cupón venció';
  end if;
  update public.tarjeta_cupones set usado_at = now(), usado_por = quien, sucursal_id = public.sucursal_de(c.negocio_id, p_sucursal)
  where id = c.id;
  insert into public.movimientos (negocio_id, tarjeta_id, tipo, cantidad, origen, autorizado_por, nota, sucursal_id, costo)
  values (c.negocio_id, c.tarjeta_id, 'canje', 0, 'cupon', quien, left('Cupón: ' || c.titulo, 120), public.sucursal_de(c.negocio_id, p_sucursal),
          (select x.costo from public.cupones x where x.id = c.cupon_id));
  update public.tarjetas set ultima_at = now() where id = c.tarjeta_id;
  return jsonb_build_object('titulo', c.titulo);
end;
$$;
grant execute on function public.canjear_cupon(uuid, text, uuid) to authenticated;

-- ─────────────────────────────────────────────
-- Campañas: mensaje a todos los clientes o a un grupo (aviso al celular, Google Wallet o WhatsApp)
-- ─────────────────────────────────────────────

create table if not exists public.campanas (
  id            uuid primary key default gen_random_uuid(),
  negocio_id    uuid not null references public.negocios (id) on delete cascade,
  titulo        text not null check (char_length(titulo) between 1 and 60),
  mensaje       text not null check (char_length(mensaje) between 1 and 300),
  segmento      text not null,
  canal         text not null default 'avisos' check (canal in ('avisos', 'whatsapp')),
  cupon_id      uuid references public.cupones (id) on delete set null,
  sucursal_id   uuid references public.sucursales (id) on delete set null,
  destinatarios integer not null default 0,
  avisos        integer not null default 0,
  wallet        integer not null default 0,
  creado_por    uuid references auth.users (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now()
);
create index if not exists campanas_negocio_idx on public.campanas (negocio_id, created_at desc);
alter table public.campanas enable row level security;
revoke all on public.campanas from anon, authenticated;
grant select on public.campanas to authenticated;
drop policy if exists "dueno: ver campanas" on public.campanas;
create policy "dueno: ver campanas" on public.campanas for select to authenticated using (public.es_gestor(negocio_id));

-- Las tarjetas de un grupo (solo de quienes aceptaron avisos).
--   todos · cerca (a 2 sellos o menos, o casi con puntos para un premio) · premio (con premio por canjear)
--   dormidos (sin venir hace p_dias) · nuevos (unidos en los últimos 30 días) · cumple (cumpleaños este mes)
--   frecuentes (4 visitas o más en 60 días) · vip (el 10 % que más viene, con 10 visitas o más)
--   nivel:<nombre> (en ese nivel)
create or replace function public.segmento(p_negocio uuid, p_segmento text, p_dias integer default 30, p_sucursal uuid default null)
returns setof public.tarjetas
language sql
stable
security definer
set search_path = public
as $$
  select t.*
  from public.tarjetas t
  join public.programas p on p.negocio_id = t.negocio_id
  join public.negocios n on n.id = t.negocio_id
  where t.negocio_id = p_negocio
    and t.acepta_avisos
    and (p_sucursal is null or t.sucursal_id = p_sucursal)
    and case
      when p_segmento = 'todos' then true
      when p_segmento = 'cerca' then
        case when public.unidad_de(p_negocio) = 'puntos'
          then exists (select 1 from public.premios r
                       where r.negocio_id = p_negocio and public.premio_disponible(r, n.zona_horaria)
                         and t.puntos < r.puntos and t.puntos >= r.puntos * 0.75)
          else t.sellos > 0 and p.meta - t.sellos <= 2 end
      when p_segmento = 'premio' then
        case when public.unidad_de(p_negocio) = 'puntos'
          then exists (select 1 from public.premios r
                       where r.negocio_id = p_negocio and public.premio_disponible(r, n.zona_horaria) and t.puntos >= r.puntos)
          else t.premios > 0 end
      when p_segmento = 'frecuentes' then (
        select count(*) from public.movimientos m
        where m.tarjeta_id = t.id and m.tipo = 'sello' and m.origen in ('qr', 'equipo', 'api') and m.created_at > now() - interval '60 days'
      ) >= 4
      when p_segmento = 'vip' then t.visitas >= 10 and t.visitas >= (
        select coalesce(percentile_disc(0.9) within group (order by x.visitas), 0) from public.tarjetas x where x.negocio_id = p_negocio
      )
      when p_segmento = 'dormidos' then coalesce(t.ultima_at, t.created_at) < now() - make_interval(days => greatest(1, p_dias))
      when p_segmento = 'nuevos' then t.created_at > now() - interval '30 days'
      when p_segmento = 'cumple' then extract(month from t.cumpleanos) = extract(month from now() at time zone n.zona_horaria)
      when p_segmento like 'nivel:%' then public.nivel_de(t) ->> 'nombre' = substr(p_segmento, 7)
      else false
    end
  order by t.ultima_at desc nulls last
  limit 5000;
$$;
revoke all on function public.segmento(uuid, text, integer, uuid) from public, anon, authenticated;

-- Cuántos recibirían la campaña (para mostrarlo antes de enviar).
create or replace function public.contar_segmento(p_negocio uuid, p_segmento text, p_dias integer default 30, p_sucursal uuid default null)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_gestor(p_negocio) then
    raise exception 'Solo el dueño o un encargado';
  end if;
  return (select count(*) from public.segmento(p_negocio, p_segmento, p_dias, p_sucursal));
end;
$$;
grant execute on function public.contar_segmento(uuid, text, integer, uuid) to authenticated;

-- Crea la campaña, entrega el cupón (si va uno) y devuelve a quiénes avisar. Hasta 3 campañas al día.
create or replace function public.crear_campana(
  p_negocio uuid, p_titulo text, p_mensaje text, p_segmento text, p_canal text default 'avisos',
  p_dias integer default 30, p_cupon uuid default null, p_sucursal uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.cupones;
  v_id uuid;
  codigos jsonb;
  total integer;
begin
  if not public.es_gestor(p_negocio) then
    raise exception 'Solo el dueño o un encargado envía campañas';
  end if;
  if not public.plan_incluye(p_negocio, 'campanas') then
    raise exception 'Las campañas son del plan Pro';
  end if;
  if not public.vigente(p_negocio) then
    raise exception 'Tu prueba gratis terminó. Escríbenos para activar tu cuenta.';
  end if;
  if (select count(*) from public.campanas where negocio_id = p_negocio and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'Puedes enviar hasta 3 campañas al día. Así tus clientes no se cansan.';
  end if;
  if p_cupon is not null then
    select * into c from public.cupones where id = p_cupon and negocio_id = p_negocio and activo;
    if c.id is null then
      raise exception 'Ese cupón no está disponible';
    end if;
    if not public.plan_incluye(p_negocio, 'cupones') then
      raise exception 'Los cupones son del plan Pro';
    end if;
  end if;
  if p_sucursal is not null and not exists (select 1 from public.sucursales where id = p_sucursal and negocio_id = p_negocio) then
    raise exception 'Ese local no es de este negocio';
  end if;

  select coalesce(jsonb_agg(s.codigo), '[]'::jsonb), count(*) into codigos, total
  from public.segmento(p_negocio, p_segmento, p_dias, p_sucursal) s;
  if total = 0 then
    raise exception 'Nadie de ese grupo aceptó recibir avisos todavía';
  end if;

  insert into public.campanas (negocio_id, titulo, mensaje, segmento, canal, cupon_id, sucursal_id, destinatarios)
  values (p_negocio, left(trim(p_titulo), 60), left(trim(p_mensaje), 300), p_segmento,
          case when p_canal = 'whatsapp' then 'whatsapp' else 'avisos' end, p_cupon, p_sucursal, total)
  returning id into v_id;

  if c.id is not null then
    insert into public.tarjeta_cupones (negocio_id, tarjeta_id, cupon_id, titulo, detalle, vence_at)
    select p_negocio, s.id, c.id, c.titulo, c.detalle, case when c.dias is not null then now() + make_interval(days => c.dias) end
    from public.segmento(p_negocio, p_segmento, p_dias, p_sucursal) s;
  end if;
  return jsonb_build_object('id', v_id, 'codigos', codigos);
end;
$$;
grant execute on function public.crear_campana(uuid, text, text, text, text, integer, uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────
-- "Para que vuelvan": cumpleaños (con cupón) y "te extrañamos" (cron diario)
-- ─────────────────────────────────────────────

create or replace function public.campanas_del_dia()
returns table (codigo text, tipo text, regalo integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  f record;
  hoy date;
  r integer;
  c public.cupones;
begin
  for f in
    select t.id, t.codigo, t.negocio_id, t.cumpleanos, t.cumple_anio, p.cumple_sellos, p.cumple_cupon,
           (now() at time zone n.zona_horaria)::date as dia
    from public.tarjetas t
    join public.negocios n on n.id = t.negocio_id
    join public.programas p on p.negocio_id = t.negocio_id and p.activo
    where t.cumpleanos is not null and public.vigente(t.negocio_id)
      and (t.acepta_avisos or exists (select 1 from public.push_tarjetas s where s.tarjeta_id = t.id))
  loop
    hoy := f.dia;
    continue when f.cumple_anio is not distinct from extract(year from hoy)::integer;
    continue when not (
      to_char(f.cumpleanos, 'MM-DD') = to_char(hoy, 'MM-DD')
      or (to_char(f.cumpleanos, 'MM-DD') = '02-29' and to_char(hoy, 'MM-DD') = '02-28'
          and extract(day from (make_date(extract(year from hoy)::integer, 3, 1) - 1))::integer = 28)
    );
    update public.tarjetas set cumple_anio = extract(year from hoy)::integer where id = f.id;
    r := public.regalo(f.negocio_id, f.cumple_sellos);
    if r > 0 then
      insert into public.movimientos (negocio_id, tarjeta_id, tipo, cantidad, origen, por, nota, unidad)
      values (f.negocio_id, f.id, 'sello', r, 'cumpleanos', null, 'Regalo de cumpleaños', public.unidad_de(f.negocio_id));
      perform public.aplicar(f.id, r);
    end if;
    if f.cumple_cupon is not null and public.plan_incluye(f.negocio_id, 'cupones') then
      select * into c from public.cupones where id = f.cumple_cupon and activo;
      if c.id is not null then
        insert into public.tarjeta_cupones (negocio_id, tarjeta_id, cupon_id, titulo, detalle, vence_at)
        values (f.negocio_id, f.id, c.id, c.titulo, c.detalle, case when c.dias is not null then now() + make_interval(days => c.dias) end);
      end if;
    end if;
    codigo := f.codigo; tipo := 'cumpleanos'; regalo := r;
    return next;
  end loop;

  for f in
    select t.id, t.codigo, t.negocio_id, p.extranamos_sellos
    from public.tarjetas t
    join public.programas p on p.negocio_id = t.negocio_id and p.activo and p.extranamos_dias > 0
    cross join lateral (
      select coalesce(max(m.created_at), t.created_at) as visita
      from public.movimientos m
      where m.tarjeta_id = t.id and m.tipo = 'sello' and m.origen in ('qr', 'equipo', 'manual', 'api')
    ) v
    where public.vigente(t.negocio_id)
      and (t.acepta_avisos or exists (select 1 from public.push_tarjetas s where s.tarjeta_id = t.id))
      and v.visita < now() - make_interval(days => p.extranamos_dias)
      and (t.extranamos_at is null or t.extranamos_at < v.visita)
    limit 2000
  loop
    update public.tarjetas set extranamos_at = now() where id = f.id;
    r := public.regalo(f.negocio_id, f.extranamos_sellos);
    if r > 0 then
      insert into public.movimientos (negocio_id, tarjeta_id, tipo, cantidad, origen, por, nota, unidad)
      values (f.negocio_id, f.id, 'sello', r, 'regreso', null, 'Te extrañamos', public.unidad_de(f.negocio_id));
      perform public.aplicar(f.id, r);
    end if;
    codigo := f.codigo; tipo := 'extranamos'; regalo := r;
    return next;
  end loop;
end;
$$;
revoke all on function public.campanas_del_dia() from public, anon, authenticated;
grant execute on function public.campanas_del_dia() to service_role;

-- ─────────────────────────────────────────────
-- Métricas
-- ─────────────────────────────────────────────

create or replace function public.metricas_de(p_negocio uuid, p_dias integer, p_sucursal uuid, p_detalle boolean)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  desde timestamptz := now() - make_interval(days => p_dias);
  antes timestamptz := now() - make_interval(days => p_dias * 2);
  zona text;
  r jsonb;
begin
  select zona_horaria into zona from public.negocios where id = p_negocio;
  with v as (
    select m.tarjeta_id, m.created_at, m.sucursal_id from public.movimientos m
    where m.negocio_id = p_negocio and m.tipo = 'sello' and m.origen in ('qr', 'equipo', 'api') and m.created_at >= antes
      and (p_sucursal is null or m.sucursal_id = p_sucursal)
  ),
  ahora as (select * from v where created_at >= desde),
  previo as (select * from v where created_at < desde),
  por_tarjeta as (select tarjeta_id, count(*) n from ahora group by tarjeta_id)
  select jsonb_build_object(
    'dias', p_dias,
    'clientes', (select count(*) from public.tarjetas where negocio_id = p_negocio),
    'nuevos', (select count(*) from public.tarjetas where negocio_id = p_negocio and created_at >= desde),
    'nuevos_previo', (select count(*) from public.tarjetas where negocio_id = p_negocio and created_at >= antes and created_at < desde),
    'visitas', (select count(*) from ahora),
    'visitas_previo', (select count(*) from previo),
    'activos', (select count(*) from por_tarjeta),
    'volvieron', (select count(*) from por_tarjeta where n >= 2),
    'canjes', (select count(*) from public.movimientos m where m.negocio_id = p_negocio and m.tipo = 'canje' and m.created_at >= desde
               and (p_sucursal is null or m.sucursal_id = p_sucursal)),
    'cupones', (select count(*) from public.tarjeta_cupones c where c.negocio_id = p_negocio and c.usado_at >= desde
                and (p_sucursal is null or c.sucursal_id = p_sucursal)),
    'avisos', (select count(*) from public.tarjetas where negocio_id = p_negocio and acepta_avisos),
    'costo_premios', (select coalesce(sum(m.costo), 0) from public.movimientos m where m.negocio_id = p_negocio and m.tipo = 'canje'
                      and m.created_at >= desde and (p_sucursal is null or m.sucursal_id = p_sucursal))
  ) into r;

  if not p_detalle then
    return r;
  end if;

  return r || jsonb_build_object(
    'semanas', coalesce((
      select jsonb_agg(jsonb_build_object('semana', s.semana, 'visitas', s.visitas, 'nuevos', s.nuevos) order by s.semana)
      from (
        select g.semana::date as semana,
               (select count(*) from public.movimientos m
                where m.negocio_id = p_negocio and m.tipo = 'sello' and m.origen in ('qr', 'equipo', 'api')
                  and (p_sucursal is null or m.sucursal_id = p_sucursal)
                  and date_trunc('week', m.created_at at time zone zona) = g.semana) as visitas,
               (select count(*) from public.tarjetas t
                where t.negocio_id = p_negocio and date_trunc('week', t.created_at at time zone zona) = g.semana) as nuevos
        from generate_series(date_trunc('week', desde at time zone zona), date_trunc('week', now() at time zone zona), interval '1 week') g(semana)
      ) s
    ), '[]'::jsonb),
    'dias_semana', (
      select jsonb_agg(coalesce(x.n, 0) order by d.d)
      from generate_series(0, 6) d(d)
      left join (
        select extract(dow from m.created_at at time zone zona)::integer as d, count(*) n
        from public.movimientos m
        where m.negocio_id = p_negocio and m.tipo = 'sello' and m.origen in ('qr', 'equipo', 'api') and m.created_at >= desde
          and (p_sucursal is null or m.sucursal_id = p_sucursal)
        group by 1
      ) x on x.d = d.d
    ),
    'locales', coalesce((
      select jsonb_agg(jsonb_build_object('nombre', s.nombre, 'visitas', (
        select count(*) from public.movimientos m
        where m.sucursal_id = s.id and m.tipo = 'sello' and m.origen in ('qr', 'equipo', 'api') and m.created_at >= desde
      )) order by s.created_at)
      from public.sucursales s where s.negocio_id = p_negocio
    ), '[]'::jsonb),
    'top', coalesce((
      select jsonb_agg(jsonb_build_object('nombre', t.nombre, 'codigo', t.codigo, 'visitas', x.n) order by x.n desc, t.nombre)
      from (
        select m.tarjeta_id, count(*) n from public.movimientos m
        where m.negocio_id = p_negocio and m.tipo = 'sello' and m.origen in ('qr', 'equipo', 'api') and m.created_at >= desde
          and (p_sucursal is null or m.sucursal_id = p_sucursal)
        group by 1 order by 2 desc limit 10
      ) x join public.tarjetas t on t.id = x.tarjeta_id
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.metricas_de(uuid, integer, uuid, boolean) from public, anon, authenticated;

-- Las del panel: lo básico para todos; gráficos, días, locales y mejores clientes con el plan Pro.
create or replace function public.metricas(p_negocio uuid, p_dias integer default 30, p_sucursal uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_gestor(p_negocio) then
    raise exception 'Solo el dueño o un encargado ve las métricas';
  end if;
  return public.metricas_de(p_negocio, least(730, greatest(1, p_dias)), p_sucursal, public.plan_incluye(p_negocio, 'metricas'));
end;
$$;
grant execute on function public.metricas(uuid, integer, uuid) to authenticated;

-- ─────────────────────────────────────────────
-- API (cajas, sistemas propios e IA): claves por negocio
-- ─────────────────────────────────────────────

create table if not exists public.api_claves (
  id         uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  nombre     text not null check (char_length(nombre) between 1 and 60),
  prefijo    text not null,
  hash       text not null unique,
  creada_por uuid references auth.users (id) on delete set null default auth.uid(),
  ultimo_uso timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists api_claves_negocio_idx on public.api_claves (negocio_id);
alter table public.api_claves enable row level security;
revoke all on public.api_claves from anon, authenticated;
grant select (id, negocio_id, nombre, prefijo, ultimo_uso, created_at), delete on public.api_claves to authenticated;
drop policy if exists "dueno: claves" on public.api_claves;
create policy "dueno: claves" on public.api_claves for select to authenticated using (public.es_dueno(negocio_id));
drop policy if exists "dueno: borrar claves" on public.api_claves;
create policy "dueno: borrar claves" on public.api_claves for delete to authenticated using (public.es_dueno(negocio_id));

-- Crea una clave y la devuelve UNA vez (se guarda solo su huella).
create or replace function public.crear_api_clave(p_negocio uuid, p_nombre text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v text;
begin
  if not public.es_dueno(p_negocio) then
    raise exception 'Solo el dueño crea claves';
  end if;
  if not public.plan_incluye(p_negocio, 'api') then
    raise exception 'La API es del plan Cadena';
  end if;
  if (select count(*) from public.api_claves where negocio_id = p_negocio) >= 10 then
    raise exception 'Hasta 10 claves por negocio';
  end if;
  v := 'tds_' || lower(public.codigo_nuevo(32));
  insert into public.api_claves (negocio_id, nombre, prefijo, hash)
  values (p_negocio, left(coalesce(nullif(trim(p_nombre), ''), 'Clave'), 60), left(v, 10), encode(digest(v, 'sha256'), 'hex'));
  return v;
end;
$$;
grant execute on function public.crear_api_clave(uuid, text) to authenticated;

-- El negocio de una clave (y que su plan esté al día).
create or replace function public.api_negocio(p_clave text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  k public.api_claves;
begin
  select * into k from public.api_claves where hash = encode(digest(coalesce(p_clave, ''), 'sha256'), 'hex');
  if k.id is null then
    raise exception 'Clave de API no válida';
  end if;
  if not public.plan_incluye(k.negocio_id, 'api') or not public.vigente(k.negocio_id) then
    raise exception 'El plan de este negocio no incluye la API';
  end if;
  if k.ultimo_uso is null or k.ultimo_uso < now() - interval '1 minute' then
    update public.api_claves set ultimo_uso = now() where id = k.id;
  end if;
  return k.negocio_id;
end;
$$;
revoke all on function public.api_negocio(text) from public, anon, authenticated;

create or replace function public.api_buscar(p_negocio uuid, p_codigo text, p_telefono text)
returns public.tarjetas
language sql
stable
security definer
set search_path = public
as $$
  select * from public.tarjetas t
  where t.negocio_id = p_negocio
    and ((coalesce(p_codigo, '') <> '' and t.codigo = upper(trim(p_codigo)))
      or (coalesce(p_codigo, '') = '' and public.clave_telefono(p_telefono) is not null and t.telefono_clave = public.clave_telefono(p_telefono)))
  limit 1;
$$;
revoke all on function public.api_buscar(uuid, text, text) from public, anon, authenticated;

-- Sumar una visita desde la caja: por código de tarjeta o por teléfono (si no tiene tarjeta y viene el nombre, se crea).
create or replace function public.api_sellar(
  p_clave text, p_codigo text default null, p_telefono text default null, p_nombre text default null,
  p_monto numeric default null, p_sucursal uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  neg uuid := public.api_negocio(p_clave);
  t public.tarjetas;
  v_codigo text;
begin
  t := public.api_buscar(neg, p_codigo, p_telefono);
  if t.id is null then
    if coalesce(trim(p_nombre), '') = '' or public.clave_telefono(p_telefono) is null then
      raise exception 'No encontramos esa tarjeta (para crearla manda nombre y teléfono)';
    end if;
    select public.unirse(n.slug, p_nombre, p_telefono) into v_codigo from public.negocios n where n.id = neg;
    t := public.api_buscar(neg, v_codigo, null);
  end if;
  if p_sucursal is not null and not exists (select 1 from public.sucursales where id = p_sucursal and negocio_id = neg) then
    raise exception 'Ese local no es de este negocio';
  end if;
  return public.registrar_visita(t.id, p_monto, 'api', p_sucursal, null, null);
end;
$$;
grant execute on function public.api_sellar(text, text, text, text, numeric, uuid) to anon, authenticated;

-- Consultar una tarjeta (para la caja o la IA).
create or replace function public.api_tarjeta(p_clave text, p_codigo text default null, p_telefono text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  neg uuid := public.api_negocio(p_clave);
  t public.tarjetas;
begin
  t := public.api_buscar(neg, p_codigo, p_telefono);
  if t.id is null then
    return null;
  end if;
  return public.ver_tarjeta(t.codigo) || jsonb_build_object('telefono', t.telefono, 'email', t.email, 'cumpleanos', t.cumpleanos);
end;
$$;
grant execute on function public.api_tarjeta(text, text, text) to anon, authenticated;

-- Lista de clientes (para la IA): todos, o un grupo como en las campañas, con búsqueda por nombre.
create or replace function public.api_clientes(
  p_clave text, p_segmento text default 'todos', p_dias integer default 30, p_texto text default null, p_limite integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  neg uuid := public.api_negocio(p_clave);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'nombre', t.nombre, 'codigo', t.codigo, 'telefono', t.telefono, 'sellos', t.sellos, 'puntos', t.puntos, 'premios', t.premios,
      'visitas', t.visitas, 'ultima_visita', t.ultima_at, 'acepta_avisos', t.acepta_avisos, 'nivel', public.nivel_de(t) ->> 'nombre'
    ))
    from (
      select t.* from public.tarjetas t
      where t.negocio_id = neg
        and (coalesce(p_texto, '') = '' or t.nombre ilike '%' || p_texto || '%')
        and (coalesce(p_segmento, 'todos') = 'todos' or t.id in (
          select s.id from public.segmento(neg, p_segmento, p_dias, null) s
          union
          -- el grupo "dormidos" también incluye a quienes no aceptaron avisos (para llamarlos o escribirles)
          select x.id from public.tarjetas x
          where p_segmento = 'dormidos' and x.negocio_id = neg
            and coalesce(x.ultima_at, x.created_at) < now() - make_interval(days => greatest(1, p_dias))
        ))
      order by t.ultima_at desc nulls last
      limit least(500, greatest(1, p_limite))
    ) t
  ), '[]'::jsonb);
end;
$$;
grant execute on function public.api_clientes(text, text, integer, text, integer) to anon, authenticated;

create or replace function public.api_resumen(p_clave text, p_dias integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  neg uuid := public.api_negocio(p_clave);
begin
  return (select jsonb_build_object('negocio', n.nombre) from public.negocios n where n.id = neg)
         || jsonb_build_object('programa', public.programa_publico(neg))
         || public.metricas_de(neg, least(730, greatest(1, p_dias)), null, true);
end;
$$;
grant execute on function public.api_resumen(text, integer) to anon, authenticated;

-- ─────────────────────────────────────────────
-- Superadmin
-- ─────────────────────────────────────────────

drop function if exists public.admin_negocios();
create or replace function public.admin_negocios()
returns table (
  id uuid, slug text, nombre text, rubro text, telefono text, plan text, estado text, prueba_hasta date, notas_admin text,
  created_at timestamptz, dueno_email text, tarjetas bigint, sellos_30d bigint, ultima_actividad timestamptz, max_locales integer,
  locales bigint
)
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
  select n.id, n.slug, n.nombre, n.rubro, n.telefono, n.plan, n.estado, n.prueba_hasta, n.notas_admin, n.created_at,
         (select u.email::text from public.miembros m join auth.users u on u.id = m.user_id
          where m.negocio_id = n.id and m.rol = 'dueno' order by m.created_at limit 1),
         (select count(*) from public.tarjetas t where t.negocio_id = n.id),
         (select count(*)::bigint from public.movimientos m
          where m.negocio_id = n.id and m.tipo = 'sello' and m.origen in ('qr', 'equipo', 'api') and m.created_at > now() - interval '30 days'),
         (select max(m.created_at) from public.movimientos m where m.negocio_id = n.id),
         n.max_locales,
         (select count(*) from public.sucursales s where s.negocio_id = n.id)
  from public.negocios n
  order by n.created_at desc;
end;
$$;
grant execute on function public.admin_negocios() to authenticated;

drop function if exists public.admin_negocio(uuid, text, text, date, text);
create or replace function public.admin_negocio(
  p_id uuid, p_estado text, p_plan text default null, p_prueba_hasta date default null, p_notas text default null,
  p_max_locales integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_superadmin() then
    raise exception 'Solo para administradores';
  end if;
  update public.negocios
  set estado = coalesce(p_estado, estado),
      plan = coalesce(p_plan, plan),
      prueba_hasta = coalesce(p_prueba_hasta, prueba_hasta),
      notas_admin = coalesce(p_notas, notas_admin),
      max_locales = coalesce(p_max_locales, max_locales)
  where id = p_id;
end;
$$;
grant execute on function public.admin_negocio(uuid, text, text, date, text, integer) to authenticated;

-- Imágenes del negocio: fondo del diseño a medida y fotos del catálogo (bucket público "imagenes", carpeta = id del negocio).
insert into storage.buckets (id, name, public) values ('imagenes', 'imagenes', true) on conflict (id) do nothing;
drop policy if exists "gestor: subir imagen" on storage.objects;
create policy "gestor: subir imagen" on storage.objects for insert to authenticated
  with check (bucket_id = 'imagenes' and public.es_gestor(((storage.foldername(name))[1])::uuid));
drop policy if exists "gestor: cambiar imagen" on storage.objects;
create policy "gestor: cambiar imagen" on storage.objects for update to authenticated
  using (bucket_id = 'imagenes' and public.es_gestor(((storage.foldername(name))[1])::uuid));
drop policy if exists "gestor: borrar imagen" on storage.objects;
create policy "gestor: borrar imagen" on storage.objects for delete to authenticated
  using (bucket_id = 'imagenes' and public.es_gestor(((storage.foldername(name))[1])::uuid));

notify pgrst, 'reload schema';
