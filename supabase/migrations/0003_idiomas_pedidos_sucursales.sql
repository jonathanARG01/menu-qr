-- Menús QR · idiomas, pedidos por WhatsApp, sucursales, estadísticas y superadmin.
-- Requiere 0001 y 0002. Ejecutar en Supabase: SQL Editor > New query > pegar y ejecutar.

-- ─────────────────────────────────────────────
-- Idiomas y pedidos
-- ─────────────────────────────────────────────

-- La carta se escribe en español; "idiomas" son los idiomas extra que se ofrecen.
-- "traducciones" guarda los textos traducidos: {"en": {"nombre": "...", "descripcion": "..."}, "pt": {...}}
alter table public.restaurantes
  add column if not exists idiomas text[] not null default '{}'
    check (idiomas <@ array['en', 'pt', 'fr', 'it', 'de']::text[]),
  add column if not exists traducciones jsonb not null default '{}' check (jsonb_typeof(traducciones) = 'object'),
  add column if not exists pedidos_whatsapp boolean not null default false;

alter table public.categorias
  add column if not exists traducciones jsonb not null default '{}' check (jsonb_typeof(traducciones) = 'object');
alter table public.platos
  add column if not exists traducciones jsonb not null default '{}' check (jsonb_typeof(traducciones) = 'object');

grant update (idiomas, traducciones, pedidos_whatsapp) on public.restaurantes to authenticated;

-- ─────────────────────────────────────────────
-- Sucursales
-- Todas comparten la carta; cada una tiene su dirección, horario, WhatsApp y mesas.
-- ─────────────────────────────────────────────

create table if not exists public.sucursales (
  id             uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  slug           text not null check (slug ~ '^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$'),
  nombre         text not null check (char_length(nombre) between 1 and 60),
  direccion      text check (char_length(direccion) <= 160),
  horario        text check (char_length(horario) <= 120),
  whatsapp       text check (whatsapp ~ '^[0-9]{6,15}$'),
  orden          integer not null default 0,
  activa         boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (restaurante_id, slug)
);
create index if not exists sucursales_restaurante_idx on public.sucursales (restaurante_id, orden);

alter table public.mesas add column if not exists sucursal_id uuid references public.sucursales (id) on delete cascade;
alter table public.mesas drop constraint if exists mesas_restaurante_id_numero_key;
create unique index if not exists mesas_numero_unico on public.mesas
  (restaurante_id, coalesce(sucursal_id, '00000000-0000-0000-0000-000000000000'::uuid), numero);

-- La sucursal de una mesa es del mismo restaurante.
create or replace function public.validar_mesa_sucursal()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.sucursal_id is not null and not exists (
    select 1 from public.sucursales s where s.id = new.sucursal_id and s.restaurante_id = new.restaurante_id
  ) then
    raise exception 'La sucursal no pertenece a este restaurante';
  end if;
  return new;
end;
$$;

drop trigger if exists mesas_sucursal_coherente on public.mesas;
create trigger mesas_sucursal_coherente
  before insert or update of sucursal_id, restaurante_id on public.mesas
  for each row execute function public.validar_mesa_sucursal();

alter table public.sucursales enable row level security;
grant select on public.sucursales to anon;
grant select, insert, update, delete on public.sucursales to authenticated;

drop policy if exists "carta publica: sucursales activas" on public.sucursales;
create policy "carta publica: sucursales activas" on public.sucursales
  for select using (
    activa and exists (select 1 from public.restaurantes r where r.id = restaurante_id and r.activo)
  );
drop policy if exists "miembro: todo en sucursales" on public.sucursales;
create policy "miembro: todo en sucursales" on public.sucursales
  for all to authenticated
  using (public.es_miembro(restaurante_id))
  with check (public.es_miembro(restaurante_id));

-- ─────────────────────────────────────────────
-- Superadmin (el dueño del servicio)
-- Para darte acceso, ejecuta una vez con tu correo:
--   insert into public.superadmins (user_id) select id from auth.users where email = 'tu@correo.com';
-- ─────────────────────────────────────────────

create table if not exists public.superadmins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
-- Sin políticas: nadie la lee directamente, solo a través de es_superadmin().
alter table public.superadmins enable row level security;

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
-- Estadísticas: visitas a la carta y pedidos enviados por WhatsApp
-- ─────────────────────────────────────────────

create table if not exists public.eventos (
  id             bigint generated always as identity primary key,
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  sucursal_id    uuid references public.sucursales (id) on delete set null,
  tipo           text not null check (tipo in ('visita', 'pedido')),
  mesa           text check (char_length(mesa) <= 12),
  idioma         text check (char_length(idioma) <= 5),
  total          numeric(12, 2),
  detalle        jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists eventos_restaurante_fecha_idx on public.eventos (restaurante_id, created_at);

alter table public.eventos enable row level security;
grant select on public.eventos to authenticated;
drop policy if exists "miembro: ver eventos" on public.eventos;
create policy "miembro: ver eventos" on public.eventos
  for select to authenticated using (public.es_miembro(restaurante_id));

-- La carta pública registra eventos solo a través de esta función, que valida los datos.
create or replace function public.registrar_evento(
  p_restaurante uuid,
  p_tipo text,
  p_sucursal uuid default null,
  p_mesa text default null,
  p_idioma text default null,
  p_total numeric default null,
  p_detalle jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_tipo not in ('visita', 'pedido') then
    return;
  end if;
  if not exists (select 1 from public.restaurantes where id = p_restaurante and activo) then
    return;
  end if;
  if p_sucursal is not null and not exists (
    select 1 from public.sucursales where id = p_sucursal and restaurante_id = p_restaurante
  ) then
    p_sucursal := null;
  end if;
  -- Detalle del pedido: [{"id": "...", "nombre": "...", "cantidad": 2}], como mucho 50 líneas.
  if p_detalle is not null and (jsonb_typeof(p_detalle) <> 'array' or jsonb_array_length(p_detalle) > 50) then
    p_detalle := null;
  end if;

  insert into public.eventos (restaurante_id, sucursal_id, tipo, mesa, idioma, total, detalle)
  values (
    p_restaurante,
    p_sucursal,
    p_tipo,
    nullif(left(trim(p_mesa), 12), ''),
    nullif(left(p_idioma, 5), ''),
    case when p_total between 0 and 100000000 then p_total end,
    case when p_tipo = 'pedido' then p_detalle end
  );
end;
$$;
grant execute on function public.registrar_evento(uuid, text, uuid, text, text, numeric, jsonb) to anon, authenticated;

-- Resumen para el panel de estadísticas (zona horaria de Argentina por defecto).
create or replace function public.estadisticas(p_restaurante uuid, p_dias integer default 30, p_zona text default 'America/Argentina/Buenos_Aires')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  desde timestamptz;
  resultado jsonb;
begin
  if not (public.es_miembro(p_restaurante) or public.es_superadmin()) then
    raise exception 'Sin acceso a este restaurante';
  end if;
  p_dias := least(greatest(coalesce(p_dias, 30), 1), 365);
  desde := date_trunc('day', now() at time zone p_zona) at time zone p_zona - make_interval(days => p_dias - 1);

  with ev as (
    select e.*, (e.created_at at time zone p_zona) as local
    from public.eventos e
    where e.restaurante_id = p_restaurante and e.created_at >= desde
  )
  select jsonb_build_object(
    'visitas', (select count(*) from ev where tipo = 'visita'),
    'pedidos', (select count(*) from ev where tipo = 'pedido'),
    'monto_pedidos', (select coalesce(sum(total), 0) from ev where tipo = 'pedido'),
    'por_dia', (
      select coalesce(jsonb_agg(jsonb_build_object('dia', d.dia, 'visitas', d.visitas, 'pedidos', d.pedidos) order by d.dia), '[]')
      from (
        select g::date as dia,
          (select count(*) from ev where tipo = 'visita' and local::date = g::date) as visitas,
          (select count(*) from ev where tipo = 'pedido' and local::date = g::date) as pedidos
        from generate_series((desde at time zone p_zona)::date, (now() at time zone p_zona)::date, interval '1 day') g
      ) d
    ),
    'por_hora', (
      select coalesce(jsonb_agg(jsonb_build_object('hora', h, 'visitas', (select count(*) from ev where tipo = 'visita' and extract(hour from local) = h)) order by h), '[]')
      from generate_series(0, 23) h
    ),
    'por_mesa', (
      select coalesce(jsonb_agg(jsonb_build_object('mesa', mesa, 'visitas', n) order by n desc), '[]')
      from (select mesa, count(*) as n from ev where tipo = 'visita' and mesa is not null group by mesa order by n desc limit 10) m
    ),
    'por_idioma', (
      select coalesce(jsonb_agg(jsonb_build_object('idioma', idioma, 'visitas', n) order by n desc), '[]')
      from (select coalesce(idioma, 'es') as idioma, count(*) as n from ev where tipo = 'visita' group by 1) i
    ),
    'por_sucursal', (
      select coalesce(jsonb_agg(jsonb_build_object('sucursal', nombre, 'visitas', visitas, 'pedidos', pedidos) order by visitas desc), '[]')
      from (
        select coalesce(s.nombre, 'Sin sucursal') as nombre,
          count(*) filter (where ev.tipo = 'visita') as visitas,
          count(*) filter (where ev.tipo = 'pedido') as pedidos
        from ev left join public.sucursales s on s.id = ev.sucursal_id
        group by 1
      ) s
    ),
    'mas_pedidos', (
      select coalesce(jsonb_agg(jsonb_build_object('nombre', nombre, 'cantidad', cantidad) order by cantidad desc), '[]')
      from (
        select linea->>'nombre' as nombre, sum(least(greatest(coalesce((linea->>'cantidad')::int, 1), 1), 99)) as cantidad
        from ev, jsonb_array_elements(coalesce(ev.detalle, '[]')) linea
        where ev.tipo = 'pedido' and linea ? 'nombre'
        group by 1 order by 2 desc limit 10
      ) p
    )
  ) into resultado;

  return resultado;
end;
$$;
grant execute on function public.estadisticas(uuid, integer, text) to authenticated;

-- ─────────────────────────────────────────────
-- Funciones del superadmin
-- ─────────────────────────────────────────────

create or replace function public.admin_restaurantes()
returns table (
  id uuid,
  slug text,
  nombre text,
  plan text,
  activo boolean,
  created_at timestamptz,
  duenos text,
  platos bigint,
  sucursales bigint,
  visitas_30d bigint,
  pedidos_30d bigint,
  soy_staff boolean
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
  select r.id, r.slug, r.nombre, r.plan, r.activo, r.created_at,
    (select string_agg(au.email::text, ', ') from public.usuarios u join auth.users au on au.id = u.user_id
      where u.restaurante_id = r.id and u.rol = 'dueno'),
    (select count(*) from public.platos p where p.restaurante_id = r.id),
    (select count(*) from public.sucursales s where s.restaurante_id = r.id),
    (select count(*) from public.eventos e where e.restaurante_id = r.id and e.tipo = 'visita' and e.created_at > now() - interval '30 days'),
    (select count(*) from public.eventos e where e.restaurante_id = r.id and e.tipo = 'pedido' and e.created_at > now() - interval '30 days'),
    exists (select 1 from public.usuarios u where u.restaurante_id = r.id and u.user_id = auth.uid() and u.rol = 'staff')
  from public.restaurantes r
  order by r.created_at desc;
end;
$$;

create or replace function public.admin_actualizar_restaurante(p_id uuid, p_plan text, p_activo boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_superadmin() then
    raise exception 'Solo para administradores';
  end if;
  update public.restaurantes
  set plan = coalesce(p_plan, plan), activo = coalesce(p_activo, activo)
  where id = p_id;
end;
$$;

-- Te suma como "staff" de un restaurante para poder editar su carta desde tu panel (o te quita).
create or replace function public.admin_unirse(p_id uuid, p_unirse boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_superadmin() then
    raise exception 'Solo para administradores';
  end if;
  if p_unirse then
    insert into public.usuarios (user_id, restaurante_id, rol) values (auth.uid(), p_id, 'staff')
    on conflict do nothing;
  else
    delete from public.usuarios where user_id = auth.uid() and restaurante_id = p_id and rol = 'staff';
  end if;
end;
$$;

revoke all on function public.admin_restaurantes() from public, anon;
revoke all on function public.admin_actualizar_restaurante(uuid, text, boolean) from public, anon;
revoke all on function public.admin_unirse(uuid, boolean) from public, anon;
grant execute on function public.admin_restaurantes() to authenticated;
grant execute on function public.admin_actualizar_restaurante(uuid, text, boolean) to authenticated;
grant execute on function public.admin_unirse(uuid, boolean) to authenticated;

-- El superadmin también puede crear restaurantes para sus clientes con crear_restaurante().
