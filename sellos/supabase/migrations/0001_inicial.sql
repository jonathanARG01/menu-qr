-- ═════════════════════════════════════════════
-- 0001: Tarjeta digital de sellos para cualquier negocio (producto independiente de Brote Digital)
--
-- Nace del módulo Loyalty de Platovi (tablas sellos_* de ese proyecto), pero vive en su PROPIO proyecto de Supabase:
-- no depende de restaurantes, mesas ni cuentas. Sirve para cafés, peluquerías, barberías, tiendas, lavados de autos…
--
-- · Cada negocio crea su cuenta (14 días de prueba), arma su tarjeta e invita a su equipo.
-- · El cliente se une con un QR (nombre y teléfono), guarda su tarjeta en el celular (web o Google Wallet).
-- · Suma sellos así: el equipo escanea la tarjeta del cliente y toca "+1 sello", o el equipo muestra un QR de un solo
--   uso ("Cobrar con QR") y el cliente lo escanea con su celular.
-- · Al completar la tarjeta gana un premio; el equipo lo canjea (con PIN del dueño si el negocio lo pide).
-- Ejecutar una sola vez en el SQL Editor de un proyecto de Supabase NUEVO. Se puede volver a ejecutar sin romper nada.
-- ═════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────
-- Utilidades
-- ─────────────────────────────────────────────

-- Los últimos 9 dígitos del teléfono: así "+56 9 1234 5678" y "912345678" son el mismo cliente.
create or replace function public.clave_telefono(t text)
returns text
language sql
immutable
as $$
  select case when length(d) >= 6 then right(d, 9) end
  from (select regexp_replace(coalesce(t, ''), '\D', '', 'g') as d) x;
$$;

-- Código al azar sin letras que se confunden (0/O, 1/I/L).
create or replace function public.codigo_nuevo(n integer default 10)
returns text
language sql
volatile
set search_path = public, extensions
as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 31), 1), '')
  from (select gen_random_bytes(n) as b) x, generate_series(0, n - 1) as i;
$$;
revoke all on function public.codigo_nuevo(integer) from public, anon, authenticated;
-- El equipo lo usa al crear invitaciones (valor por defecto del código).
grant execute on function public.codigo_nuevo(integer) to authenticated;

-- ─────────────────────────────────────────────
-- Superadministradores (tú, en /admin)
-- ─────────────────────────────────────────────

create table if not exists public.superadmins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.superadmins enable row level security;
revoke all on public.superadmins from anon, authenticated;

create or replace function public.es_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.superadmins where user_id = auth.uid());
$$;
grant execute on function public.es_superadmin() to authenticated;

-- ─────────────────────────────────────────────
-- Negocios y su equipo
-- ─────────────────────────────────────────────

create table if not exists public.negocios (
  id            uuid primary key default gen_random_uuid(),
  -- Dirección pública para unirse: /u/<slug>
  slug          text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'),
  nombre        text not null check (char_length(nombre) between 1 and 80),
  rubro         text not null default 'otro' check (rubro ~ '^[a-z]{2,20}$'),
  logo_url      text check (char_length(logo_url) <= 500),
  color         text not null default '#23345c' check (color ~ '^#[0-9a-fA-F]{6}$'),
  telefono      text check (char_length(telefono) <= 30),
  direccion     text check (char_length(direccion) <= 160),
  instagram     text check (char_length(instagram) <= 60),
  -- Enlace para dejar reseña en Google (la tarjeta invita después de sumar un sello).
  resena_url    text check (resena_url is null or resena_url ~ '^https://'),
  pais          text not null default 'CL' check (pais ~ '^[A-Z]{2}$'),
  moneda        text not null default 'CLP' check (moneda ~ '^[A-Z]{3}$'),
  zona_horaria  text not null default 'America/Santiago' check (char_length(zona_horaria) <= 60),
  -- Canjear y quitar sellos pide el PIN del dueño a los empleados.
  pide_pin      boolean not null default false,
  -- Lo de abajo solo lo cambia el superadmin (el dueño no tiene permiso sobre estas columnas).
  plan          text not null default 'local' check (plan in ('local', 'cadena')),
  estado        text not null default 'prueba' check (estado in ('prueba', 'activo', 'pausado')),
  prueba_hasta  date not null default (current_date + 14),
  notas_admin   text check (char_length(notas_admin) <= 1000),
  created_at    timestamptz not null default now()
);
alter table public.negocios drop constraint if exists slug_reservado;
alter table public.negocios add constraint slug_reservado check (slug not in (
  'admin', 'api', 'auth', 'entrar', 'salir', 'panel', 'registro', 'recuperar', 'nueva-clave', 'precios', 'planes',
  'ayuda', 'soporte', 'terminos', 'privacidad', 'equipo', 'demo', 'crear', 'u', 't'
));

create table if not exists public.miembros (
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  rol        text not null default 'empleado' check (rol in ('dueno', 'empleado')),
  nombre     text not null default '' check (char_length(nombre) <= 60),
  -- PIN de 4 a 6 dígitos (solo dueños), guardado cifrado.
  pin_hash   text,
  created_at timestamptz not null default now(),
  primary key (negocio_id, user_id)
);
create index if not exists miembros_usuario_idx on public.miembros (user_id);

create or replace function public.es_miembro(n uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.miembros m where m.negocio_id = n and m.user_id = auth.uid()) or public.es_superadmin();
$$;
grant execute on function public.es_miembro(uuid) to authenticated;

create or replace function public.es_dueno(n uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.miembros m where m.negocio_id = n and m.user_id = auth.uid() and m.rol = 'dueno')
         or public.es_superadmin();
$$;
grant execute on function public.es_dueno(uuid) to authenticated;

-- ¿El negocio está al día? (prueba vigente o activo). Si no, nadie nuevo se une ni suma sellos; lo acumulado se guarda.
create or replace function public.vigente(n uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select x.estado = 'activo' or (x.estado = 'prueba' and x.prueba_hasta >= (now() at time zone x.zona_horaria)::date)
    from public.negocios x where x.id = n
  ), false);
$$;
grant execute on function public.vigente(uuid) to anon, authenticated;

-- Invitaciones para que un empleado (o socio) se sume al negocio: /equipo/<codigo>
create table if not exists public.invitaciones (
  codigo     text primary key default public.codigo_nuevo(12),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  rol        text not null default 'empleado' check (rol in ('dueno', 'empleado')),
  nombre     text not null default '' check (char_length(nombre) <= 60),
  creada_por uuid references auth.users (id) on delete set null default auth.uid(),
  usada_por  uuid references auth.users (id) on delete set null,
  usada_at   timestamptz,
  expira_at  timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);
create index if not exists invitaciones_negocio_idx on public.invitaciones (negocio_id);

-- ─────────────────────────────────────────────
-- La tarjeta de sellos
-- ─────────────────────────────────────────────

-- La tarjeta de cada negocio: cuántos sellos, el premio, cómo se gana un sello y su diseño.
create table if not exists public.programas (
  negocio_id        uuid primary key references public.negocios (id) on delete cascade,
  activo            boolean not null default true,
  meta              integer not null default 10 check (meta between 3 and 30),
  premio            text not null default 'Un regalo de la casa' check (char_length(premio) between 1 and 60),
  -- 'visita': 1 sello por visita o compra. 'monto': 1 sello por cada monto_por_sello gastado (el equipo anota el monto).
  regla             text not null default 'visita' check (regla in ('visita', 'monto')),
  monto_por_sello   numeric(12, 2) not null default 10000 check (monto_por_sello > 0),
  bienvenida        integer not null default 1 check (bienvenida between 0 and 3),
  -- Máximo de veces al día que una tarjeta suma con el QR de un solo uso.
  max_por_dia       integer not null default 1 check (max_por_dia between 1 and 10),
  color             text not null default '#23345c' check (color ~ '^#[0-9a-fA-F]{6}$'),
  icono             text not null default 'estrella' check (char_length(icono) <= 20),
  diseno            text not null default 'clasica' check (diseno ~ '^[a-z]{2,20}$'),
  condiciones       text not null default '' check (char_length(condiciones) <= 300),
  -- "Para que vuelvan"
  dias_dobles       smallint[] not null default '{}' check (dias_dobles <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  pedir_resena      boolean not null default true,
  extranamos_dias   integer not null default 30 check (extranamos_dias = 0 or extranamos_dias between 14 and 120),
  extranamos_sellos integer not null default 0 check (extranamos_sellos between 0 and 2),
  cumple_sellos     integer not null default 1 check (cumple_sellos between 0 and 3),
  updated_at        timestamptz not null default now()
);

create table if not exists public.tarjetas (
  id             uuid primary key default gen_random_uuid(),
  negocio_id     uuid not null references public.negocios (id) on delete cascade,
  -- Lo que va en el enlace y el QR de la tarjeta (/t/CODIGO).
  codigo         text not null unique,
  nombre         text not null check (char_length(nombre) between 1 and 60),
  telefono       text check (char_length(telefono) <= 30),
  telefono_clave text generated always as (public.clave_telefono(telefono)) stored,
  email          text check (char_length(email) <= 120),
  cumpleanos     date,
  acepta_avisos  boolean not null default false,
  sellos         integer not null default 0 check (sellos >= 0),
  premios        integer not null default 0 check (premios >= 0),
  total_sellos   integer not null default 0,
  canjes         integer not null default 0,
  extranamos_at  timestamptz,
  cumple_anio    integer,
  created_at     timestamptz not null default now(),
  ultima_at      timestamptz
);
create unique index if not exists tarjetas_telefono_idx on public.tarjetas (negocio_id, telefono_clave)
  where telefono_clave is not null;
create index if not exists tarjetas_negocio_idx on public.tarjetas (negocio_id, ultima_at desc nulls last);

-- Cada sello, canje o corrección, con quién lo hizo.
create table if not exists public.movimientos (
  id             uuid primary key default gen_random_uuid(),
  negocio_id     uuid not null references public.negocios (id) on delete cascade,
  tarjeta_id     uuid not null references public.tarjetas (id) on delete cascade,
  tipo           text not null check (tipo in ('sello', 'canje', 'ajuste')),
  cantidad       integer not null,
  origen         text not null check (origen in ('qr', 'equipo', 'manual', 'bienvenida', 'cumpleanos', 'regreso', 'migracion')),
  monto          numeric(12, 2),
  por            uuid references auth.users (id) on delete set null default auth.uid(),
  autorizado_por uuid references auth.users (id) on delete set null,
  nota           text check (char_length(nota) <= 120),
  created_at     timestamptz not null default now()
);
create index if not exists movimientos_negocio_idx on public.movimientos (negocio_id, created_at desc);
create index if not exists movimientos_tarjeta_idx on public.movimientos (tarjeta_id, created_at desc);

-- QR de un solo uso que muestra el equipo ("Cobrar con QR"): el cliente lo escanea y suma su sello. Dura 15 minutos.
create table if not exists public.codigos (
  codigo     text primary key,
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  monto      numeric(12, 2) check (monto is null or monto > 0),
  creado_por uuid references auth.users (id) on delete set null default auth.uid(),
  tarjeta_id uuid references public.tarjetas (id) on delete set null,
  sumados    integer,
  usado_at   timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists codigos_negocio_idx on public.codigos (negocio_id, created_at desc);

-- Avisos push al celular del dueño de la tarjeta (tarjeta web).
create table if not exists public.push_tarjetas (
  id         uuid primary key default gen_random_uuid(),
  tarjeta_id uuid not null references public.tarjetas (id) on delete cascade,
  endpoint   text not null unique check (char_length(endpoint) <= 1000),
  claves     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- Permisos
-- ─────────────────────────────────────────────

alter table public.negocios enable row level security;
alter table public.miembros enable row level security;
alter table public.invitaciones enable row level security;
alter table public.programas enable row level security;
alter table public.tarjetas enable row level security;
alter table public.movimientos enable row level security;
alter table public.codigos enable row level security;
alter table public.push_tarjetas enable row level security;

revoke all on public.negocios, public.miembros, public.invitaciones, public.programas, public.tarjetas,
  public.movimientos, public.codigos, public.push_tarjetas from anon, authenticated;

grant select on public.negocios to authenticated;
grant update (nombre, logo_url, color, telefono, direccion, instagram, resena_url, pais, moneda, zona_horaria, pide_pin, rubro)
  on public.negocios to authenticated;
drop policy if exists "equipo: ver negocio" on public.negocios;
create policy "equipo: ver negocio" on public.negocios for select to authenticated using (public.es_miembro(id));
drop policy if exists "dueno: editar negocio" on public.negocios;
create policy "dueno: editar negocio" on public.negocios for update to authenticated
  using (public.es_dueno(id)) with check (public.es_dueno(id));

grant select, delete on public.miembros to authenticated;
grant update (nombre) on public.miembros to authenticated;
drop policy if exists "equipo: ver equipo" on public.miembros;
create policy "equipo: ver equipo" on public.miembros for select to authenticated using (public.es_miembro(negocio_id));
drop policy if exists "dueno: editar equipo" on public.miembros;
create policy "dueno: editar equipo" on public.miembros for update to authenticated
  using (public.es_dueno(negocio_id) or user_id = auth.uid()) with check (public.es_dueno(negocio_id) or user_id = auth.uid());
-- El dueño saca a alguien del equipo; cualquiera puede salirse. Nunca queda un negocio sin dueño (ver trigger).
drop policy if exists "dueno: sacar del equipo" on public.miembros;
create policy "dueno: sacar del equipo" on public.miembros for delete to authenticated
  using (public.es_dueno(negocio_id) or user_id = auth.uid());

create or replace function public.ultimo_dueno()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.rol = 'dueno' and exists (select 1 from public.negocios where id = old.negocio_id)
     and not exists (select 1 from public.miembros where negocio_id = old.negocio_id and rol = 'dueno' and user_id <> old.user_id) then
    raise exception 'El negocio no puede quedar sin dueño';
  end if;
  return old;
end;
$$;
drop trigger if exists miembros_ultimo_dueno on public.miembros;
create trigger miembros_ultimo_dueno before delete on public.miembros for each row execute function public.ultimo_dueno();

grant select, insert, delete on public.invitaciones to authenticated;
drop policy if exists "dueno: invitaciones" on public.invitaciones;
create policy "dueno: invitaciones" on public.invitaciones for all to authenticated
  using (public.es_dueno(negocio_id)) with check (public.es_dueno(negocio_id));

grant select, insert, update on public.programas to authenticated;
drop policy if exists "equipo: ver tarjeta" on public.programas;
create policy "equipo: ver tarjeta" on public.programas for select to authenticated using (public.es_miembro(negocio_id));
drop policy if exists "dueno: crear tarjeta" on public.programas;
create policy "dueno: crear tarjeta" on public.programas for insert to authenticated with check (public.es_dueno(negocio_id));
drop policy if exists "dueno: editar tarjeta" on public.programas;
create policy "dueno: editar tarjeta" on public.programas for update to authenticated
  using (public.es_dueno(negocio_id)) with check (public.es_dueno(negocio_id));

grant select, delete on public.tarjetas to authenticated;
grant update (nombre, telefono, email, cumpleanos) on public.tarjetas to authenticated;
drop policy if exists "equipo: ver tarjetas" on public.tarjetas;
create policy "equipo: ver tarjetas" on public.tarjetas for select to authenticated using (public.es_miembro(negocio_id));
drop policy if exists "dueno: editar tarjetas" on public.tarjetas;
create policy "dueno: editar tarjetas" on public.tarjetas for update to authenticated
  using (public.es_dueno(negocio_id)) with check (public.es_dueno(negocio_id));
drop policy if exists "dueno: borrar tarjetas" on public.tarjetas;
create policy "dueno: borrar tarjetas" on public.tarjetas for delete to authenticated using (public.es_dueno(negocio_id));

grant select on public.movimientos to authenticated;
drop policy if exists "equipo: ver movimientos" on public.movimientos;
create policy "equipo: ver movimientos" on public.movimientos for select to authenticated using (public.es_miembro(negocio_id));

-- Logos de los negocios (bucket público "logos", carpeta = id del negocio).
insert into storage.buckets (id, name, public) values ('logos', 'logos', true) on conflict (id) do nothing;
drop policy if exists "dueno: subir logo" on storage.objects;
create policy "dueno: subir logo" on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and public.es_dueno(((storage.foldername(name))[1])::uuid));
drop policy if exists "dueno: cambiar logo" on storage.objects;
create policy "dueno: cambiar logo" on storage.objects for update to authenticated
  using (bucket_id = 'logos' and public.es_dueno(((storage.foldername(name))[1])::uuid));
drop policy if exists "dueno: borrar logo" on storage.objects;
create policy "dueno: borrar logo" on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and public.es_dueno(((storage.foldername(name))[1])::uuid));

-- ─────────────────────────────────────────────
-- Crear un negocio, sumarse a uno, PIN
-- ─────────────────────────────────────────────

-- Lo llama el registro: crea el negocio (14 días de prueba), deja al usuario como dueño y la tarjeta lista con los
-- valores sugeridos para su rubro. Devuelve el id.
create or replace function public.crear_negocio(
  p_nombre text,
  p_slug text,
  p_rubro text,
  p_tu_nombre text default '',
  p_telefono text default null,
  p_programa jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_slug text := lower(trim(p_slug));
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión primero';
  end if;
  if (select count(*) from public.miembros where user_id = auth.uid() and rol = 'dueno') >= 10 then
    raise exception 'Ya tienes 10 negocios. Escríbenos para sumar más.';
  end if;
  if exists (select 1 from public.negocios where slug = v_slug) then
    raise exception 'Esa dirección ya está en uso. Prueba con otra.';
  end if;
  insert into public.negocios (nombre, slug, rubro, telefono)
  values (left(trim(p_nombre), 80), v_slug, coalesce(nullif(p_rubro, ''), 'otro'), nullif(left(trim(coalesce(p_telefono, '')), 30), ''))
  returning id into v_id;
  insert into public.miembros (negocio_id, user_id, rol, nombre) values (v_id, auth.uid(), 'dueno', left(trim(coalesce(p_tu_nombre, '')), 60));
  insert into public.programas (negocio_id, meta, premio, icono, color)
  values (
    v_id,
    least(30, greatest(3, coalesce((p_programa ->> 'meta')::integer, 10))),
    coalesce(nullif(left(trim(p_programa ->> 'premio'), 60), ''), 'Un regalo de la casa'),
    coalesce(nullif(left(p_programa ->> 'icono', 20), ''), 'estrella'),
    case when coalesce(p_programa ->> 'color', '') ~ '^#[0-9a-fA-F]{6}$' then p_programa ->> 'color' else '#23345c' end
  );
  update public.negocios set color = (select color from public.programas where negocio_id = v_id) where id = v_id;
  return v_id;
end;
$$;
grant execute on function public.crear_negocio(text, text, text, text, text, jsonb) to authenticated;

-- Datos de una invitación (para mostrar a quién invita antes de aceptarla).
create or replace function public.ver_invitacion(p_codigo text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('negocio', n.nombre, 'logo_url', n.logo_url, 'rol', i.rol, 'nombre', i.nombre,
                            'vencida', i.expira_at < now(), 'usada', i.usada_at is not null)
  from public.invitaciones i join public.negocios n on n.id = i.negocio_id
  where i.codigo = upper(trim(p_codigo));
$$;
grant execute on function public.ver_invitacion(text) to anon, authenticated;

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
  on conflict (negocio_id, user_id) do update set rol = case when excluded.rol = 'dueno' then 'dueno' else miembros.rol end;
  update public.invitaciones set usada_at = now(), usada_por = auth.uid() where codigo = i.codigo;
  return i.negocio_id;
end;
$$;
grant execute on function public.aceptar_invitacion(text, text) to authenticated;

-- El dueño pone (o borra, con null) su PIN para autorizar canjes y correcciones.
create or replace function public.poner_pin(p_negocio uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not exists (select 1 from public.miembros where negocio_id = p_negocio and user_id = auth.uid() and rol = 'dueno') then
    raise exception 'Solo el dueño puede tener PIN';
  end if;
  if p_pin is not null and p_pin !~ '^\d{4,6}$' then
    raise exception 'El PIN debe tener de 4 a 6 números';
  end if;
  update public.miembros set pin_hash = case when p_pin is null then null else crypt(p_pin, gen_salt('bf')) end
  where negocio_id = p_negocio and user_id = auth.uid();
end;
$$;
grant execute on function public.poner_pin(uuid, text) to authenticated;

-- ¿A este usuario le piden PIN para canjear o quitar sellos? (a los dueños nunca)
create or replace function public.pide_pin(p_negocio uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select n.pide_pin from public.negocios n where n.id = p_negocio), false) and not public.es_dueno(p_negocio);
$$;
grant execute on function public.pide_pin(uuid) to authenticated;

-- Revisa el PIN si hace falta y devuelve quién autoriza.
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
  if not public.pide_pin(p_negocio) then
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

-- ─────────────────────────────────────────────
-- Sumar y restar sellos (uso interno)
-- ─────────────────────────────────────────────

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
  select p.meta into v_meta from public.programas p where p.negocio_id = t.negocio_id;
  v_meta := coalesce(v_meta, 10);
  if p_cantidad >= 0 then
    total := t.sellos + p_cantidad;
    update public.tarjetas
    set sellos = total % v_meta, premios = premios + total / v_meta, total_sellos = total_sellos + p_cantidad, ultima_at = now()
    where id = t.id returning * into t;
  else
    -- Al quitar se descuenta de los sellos y, si no alcanza, de los premios sin canjear.
    total := greatest(0, t.premios * v_meta + t.sellos + p_cantidad);
    update public.tarjetas
    set sellos = total % v_meta, premios = total / v_meta, total_sellos = greatest(0, total_sellos + p_cantidad)
    where id = t.id returning * into t;
  end if;
  return t;
end;
$$;
revoke all on function public.aplicar(uuid, integer) from public, anon, authenticated;

-- Si el negocio baja la cantidad de sellos de la tarjeta, los que ya la completan pasan a tener su premio.
create or replace function public.meta_cambiada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.meta < old.meta then
    update public.tarjetas
    set premios = premios + sellos / new.meta, sellos = sellos % new.meta
    where negocio_id = new.negocio_id and sellos >= new.meta;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists programas_meta on public.programas;
create trigger programas_meta before update on public.programas for each row execute function public.meta_cambiada();

-- ¿Hoy es día de sello doble en este negocio? (0 = domingo)
create or replace function public.dia_doble(p_negocio uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(extract(dow from now() at time zone n.zona_horaria)::smallint = any(p.dias_dobles), false)
  from public.negocios n join public.programas p on p.negocio_id = n.id
  where n.id = p_negocio;
$$;
grant execute on function public.dia_doble(uuid) to anon, authenticated;

-- Cuántos sellos da una visita según la regla (y el día doble).
create or replace function public.sellos_por(p_negocio uuid, p_monto numeric)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p public.programas;
  n integer;
begin
  select * into p from public.programas where negocio_id = p_negocio;
  if p.regla = 'monto' then
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
  return n;
end;
$$;
revoke all on function public.sellos_por(uuid, numeric) from public, anon, authenticated;

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
    'created_at', t.created_at, 'ultima_at', t.ultima_at
  );
$$;
revoke all on function public.estado_tarjeta(public.tarjetas) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- Para el cliente (sin sesión)
-- ─────────────────────────────────────────────

-- Datos para la página "únete" (/u/<slug>). null si el negocio no existe.
create or replace function public.negocio_publico(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'negocio', jsonb_build_object('nombre', n.nombre, 'slug', n.slug, 'logo_url', n.logo_url, 'color', n.color, 'rubro', n.rubro,
                                  'pais', n.pais),
    'programa', to_jsonb(p) - 'negocio_id' - 'updated_at',
    'activa', p.activo and public.vigente(n.id)
  )
  from public.negocios n join public.programas p on p.negocio_id = n.id
  where n.slug = lower(trim(p_slug));
$$;
grant execute on function public.negocio_publico(text) to anon, authenticated;

-- Se une (o recupera su tarjeta si ese teléfono ya tiene una). Devuelve el código de la tarjeta.
create or replace function public.unirse(
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
  n public.negocios;
  p public.programas;
  t public.tarjetas;
begin
  select * into n from public.negocios where slug = lower(trim(p_slug));
  select * into p from public.programas where negocio_id = n.id and activo;
  if n.id is null or p.negocio_id is null or not public.vigente(n.id) then
    raise exception 'Este negocio no tiene la tarjeta de sellos activa';
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

  insert into public.tarjetas (negocio_id, codigo, nombre, telefono, email, cumpleanos, acepta_avisos)
  values (n.id, public.codigo_nuevo(10), left(trim(p_nombre), 60), left(trim(p_telefono), 30),
          nullif(left(trim(coalesce(p_email, '')), 120), ''), p_cumpleanos, coalesce(p_acepta, false))
  returning * into t;

  if p.bienvenida > 0 then
    insert into public.movimientos (negocio_id, tarjeta_id, tipo, cantidad, origen, por)
    values (n.id, t.id, 'sello', p.bienvenida, 'bienvenida', null);
    perform public.aplicar(t.id, p.bienvenida);
  end if;
  return t.codigo;
end;
$$;
grant execute on function public.unirse(text, text, text, text, date, boolean) to anon, authenticated;

-- La tarjeta para mostrar: estado, la tarjeta del negocio, su marca y los últimos movimientos.
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
                                  'resena_url', case when coalesce(p.pedir_resena, false) then n.resena_url end),
    'programa', to_jsonb(p) - 'negocio_id' - 'updated_at',
    'dia_doble', coalesce(public.dia_doble(n.id), false),
    'movimientos', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', m.tipo, 'cantidad', m.cantidad, 'origen', m.origen, 'created_at', m.created_at)
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

-- El cliente escanea el QR de un solo uso del equipo y suma su sello.
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
  n integer;
  doble boolean;
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
    raise exception 'La tarjeta de sellos de este negocio está pausada';
  end if;

  select zona_horaria into zona from public.negocios where id = t.negocio_id;
  select count(*) into hoy from public.movimientos m
  where m.tarjeta_id = t.id and m.tipo = 'sello' and m.origen in ('qr', 'equipo')
    and (m.created_at at time zone zona)::date = (now() at time zone zona)::date;
  if hoy >= p.max_por_dia then
    raise exception 'Ya sumaste tu sello de hoy. ¡Te esperamos pronto!';
  end if;

  n := public.sellos_por(t.negocio_id, k.monto);
  doble := coalesce(public.dia_doble(t.negocio_id), false);
  insert into public.movimientos (negocio_id, tarjeta_id, tipo, cantidad, origen, monto, por, autorizado_por, nota)
  values (t.negocio_id, t.id, 'sello', n, 'qr', k.monto, null, k.creado_por, case when doble then 'Día de sello doble' end);
  t := public.aplicar(t.id, n);
  update public.codigos set usado_at = now(), tarjeta_id = t.id, sumados = n where codigo = k.codigo;
  return public.estado_tarjeta(t) || jsonb_build_object('sumados', n, 'doble', doble);
end;
$$;
grant execute on function public.sumar_qr(text, text) to anon, authenticated;

create or replace function public.suscribir_tarjeta(p_codigo text, p_endpoint text, p_claves jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.tarjetas where codigo = upper(trim(p_codigo));
  if v_id is null or coalesce(p_endpoint, '') !~ '^https://' then
    return false;
  end if;
  insert into public.push_tarjetas (tarjeta_id, endpoint, claves)
  values (v_id, left(p_endpoint, 1000), coalesce(p_claves, '{}'::jsonb))
  on conflict (endpoint) do update set tarjeta_id = excluded.tarjeta_id, claves = excluded.claves;
  update public.tarjetas set acepta_avisos = true where id = v_id;
  return true;
end;
$$;
grant execute on function public.suscribir_tarjeta(text, text, jsonb) to anon, authenticated;

-- ─────────────────────────────────────────────
-- Para el equipo
-- ─────────────────────────────────────────────

-- "+1 sello" (la acción de todos los días): aplica la regla del negocio y el día doble. Sin PIN.
create or replace function public.sellar(p_tarjeta text, p_monto numeric default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tarjetas;
  n integer;
  doble boolean;
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
  n := public.sellos_por(t.negocio_id, p_monto);
  doble := coalesce(public.dia_doble(t.negocio_id), false);
  insert into public.movimientos (negocio_id, tarjeta_id, tipo, cantidad, origen, monto, nota)
  values (t.negocio_id, t.id, 'sello', n, 'equipo', p_monto, case when doble then 'Día de sello doble' end);
  t := public.aplicar(t.id, n);
  return public.estado_tarjeta(t) || jsonb_build_object('sumados', n, 'doble', doble);
end;
$$;
grant execute on function public.sellar(text, numeric) to authenticated;

-- Corrección a mano: sumar varios o quitar sellos. Pide el PIN del dueño si el negocio lo exige.
create or replace function public.ajustar(p_tarjeta text, p_cantidad integer, p_pin text default null, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tarjetas;
  quien uuid;
begin
  select * into t from public.tarjetas where codigo = upper(trim(p_tarjeta));
  if t.id is null then
    raise exception 'No encontramos esa tarjeta';
  end if;
  quien := public.exigir_pin(t.negocio_id, p_pin);
  if coalesce(p_cantidad, 0) = 0 or abs(p_cantidad) > 30 then
    raise exception 'Cantidad de sellos no válida';
  end if;
  if p_cantidad > 0 and not public.vigente(t.negocio_id) then
    raise exception 'Tu prueba gratis terminó. Escríbenos para activar tu cuenta.';
  end if;
  insert into public.movimientos (negocio_id, tarjeta_id, tipo, cantidad, origen, autorizado_por, nota)
  values (t.negocio_id, t.id, case when p_cantidad > 0 then 'sello' else 'ajuste' end, p_cantidad, 'manual', quien,
          left(nullif(trim(p_motivo), ''), 120));
  t := public.aplicar(t.id, p_cantidad);
  return public.estado_tarjeta(t) || jsonb_build_object('sumados', p_cantidad);
end;
$$;
grant execute on function public.ajustar(text, integer, text, text) to authenticated;

-- Canjea un premio ganado. Pide el PIN del dueño si el negocio lo exige.
create or replace function public.canjear(p_tarjeta text, p_pin text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tarjetas;
  quien uuid;
begin
  select * into t from public.tarjetas where codigo = upper(trim(p_tarjeta)) for update;
  if t.id is null then
    raise exception 'No encontramos esa tarjeta';
  end if;
  quien := public.exigir_pin(t.negocio_id, p_pin);
  if t.premios < 1 then
    raise exception 'Esta tarjeta todavía no tiene un premio para canjear';
  end if;
  update public.tarjetas set premios = premios - 1, canjes = canjes + 1, ultima_at = now() where id = t.id returning * into t;
  insert into public.movimientos (negocio_id, tarjeta_id, tipo, cantidad, origen, autorizado_por)
  values (t.negocio_id, t.id, 'canje', -1, 'manual', quien);
  return public.estado_tarjeta(t);
end;
$$;
grant execute on function public.canjear(text, text) to authenticated;

-- "Cobrar con QR": crea un código de un solo uso (15 minutos) para que el cliente lo escanee.
create or replace function public.crear_codigo(p_negocio uuid, p_monto numeric default null)
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
  -- Limpieza: los códigos viejos sin usar ya no sirven.
  delete from public.codigos where negocio_id = p_negocio and usado_at is null and created_at < now() - interval '1 day';
  v := public.codigo_nuevo(8);
  insert into public.codigos (codigo, negocio_id, monto) values (v, p_negocio, p_monto);
  return v;
end;
$$;
grant execute on function public.crear_codigo(uuid, numeric) to authenticated;

-- ¿Ya lo usaron? (la pantalla "Cobrar con QR" lo consulta para mostrar a quién se le sumó)
create or replace function public.estado_codigo(p_codigo text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('usado', k.usado_at is not null, 'nombre', t.nombre, 'sumados', k.sumados,
                            'vencido', k.usado_at is null and k.created_at < now() - interval '15 minutes')
  from public.codigos k left join public.tarjetas t on t.id = k.tarjeta_id
  where k.codigo = upper(trim(p_codigo)) and public.es_miembro(k.negocio_id);
$$;
grant execute on function public.estado_codigo(text) to authenticated;

-- ─────────────────────────────────────────────
-- "Para que vuelvan": cumpleaños y "te extrañamos" (cron diario, solo con la clave de servicio)
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
begin
  for f in
    select t.id, t.codigo, t.cumpleanos, t.cumple_anio, p.cumple_sellos, (now() at time zone n.zona_horaria)::date as dia
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
    if f.cumple_sellos > 0 then
      insert into public.movimientos (negocio_id, tarjeta_id, tipo, cantidad, origen, por, nota)
      select negocio_id, id, 'sello', f.cumple_sellos, 'cumpleanos', null, 'Regalo de cumpleaños' from public.tarjetas where id = f.id;
      perform public.aplicar(f.id, f.cumple_sellos);
    end if;
    codigo := f.codigo; tipo := 'cumpleanos'; regalo := f.cumple_sellos;
    return next;
  end loop;

  for f in
    select t.id, t.codigo, p.extranamos_sellos
    from public.tarjetas t
    join public.programas p on p.negocio_id = t.negocio_id and p.activo and p.extranamos_dias > 0
    cross join lateral (
      select coalesce(max(m.created_at), t.created_at) as visita
      from public.movimientos m
      where m.tarjeta_id = t.id and m.tipo = 'sello' and m.origen in ('qr', 'equipo', 'manual')
    ) v
    where public.vigente(t.negocio_id)
      and (t.acepta_avisos or exists (select 1 from public.push_tarjetas s where s.tarjeta_id = t.id))
      and v.visita < now() - make_interval(days => p.extranamos_dias)
      and (t.extranamos_at is null or t.extranamos_at < v.visita)
    limit 2000
  loop
    update public.tarjetas set extranamos_at = now() where id = f.id;
    if f.extranamos_sellos > 0 then
      insert into public.movimientos (negocio_id, tarjeta_id, tipo, cantidad, origen, por, nota)
      select negocio_id, id, 'sello', f.extranamos_sellos, 'regreso', null, 'Te extrañamos' from public.tarjetas where id = f.id;
      perform public.aplicar(f.id, f.extranamos_sellos);
    end if;
    codigo := f.codigo; tipo := 'extranamos'; regalo := f.extranamos_sellos;
    return next;
  end loop;
end;
$$;
revoke all on function public.campanas_del_dia() from public, anon, authenticated;
grant execute on function public.campanas_del_dia() to service_role;

-- ─────────────────────────────────────────────
-- Superadmin (/admin): todos los negocios, activar, pausar, extender prueba
-- ─────────────────────────────────────────────

create or replace function public.admin_negocios()
returns table (
  id uuid, slug text, nombre text, rubro text, telefono text, plan text, estado text, prueba_hasta date, notas_admin text,
  created_at timestamptz, dueno_email text, tarjetas bigint, sellos_30d bigint, ultima_actividad timestamptz
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
         (select coalesce(sum(m.cantidad), 0)::bigint from public.movimientos m
          where m.negocio_id = n.id and m.tipo = 'sello' and m.created_at > now() - interval '30 days'),
         (select max(m.created_at) from public.movimientos m where m.negocio_id = n.id)
  from public.negocios n
  order by n.created_at desc;
end;
$$;
grant execute on function public.admin_negocios() to authenticated;

create or replace function public.admin_negocio(
  p_id uuid, p_estado text, p_plan text default null, p_prueba_hasta date default null, p_notas text default null
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
      notas_admin = coalesce(p_notas, notas_admin)
  where id = p_id;
end;
$$;
grant execute on function public.admin_negocio(uuid, text, text, date, text) to authenticated;

notify pgrst, 'reload schema';

-- ─────────────────────────────────────────────
-- DESPUÉS de crear tu cuenta en la app, conviértete en superadmin (cambia el correo):
--   insert into public.superadmins (user_id) select id from auth.users where email = 'tu-correo@ejemplo.cl';
-- ─────────────────────────────────────────────
