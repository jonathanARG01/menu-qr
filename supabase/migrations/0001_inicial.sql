-- Menús QR · esquema inicial (fase 1)
-- Ejecutar en Supabase: SQL Editor > New query > pegar y ejecutar.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────
-- Tablas
-- ─────────────────────────────────────────────

create table public.restaurantes (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  nombre         text not null check (char_length(nombre) between 1 and 80),
  descripcion    text check (char_length(descripcion) <= 300),
  logo_url       text,
  color_primario text not null default '#b45309' check (color_primario ~ '^#[0-9a-fA-F]{6}$'),
  color_fondo    text not null default '#fffbf5' check (color_fondo ~ '^#[0-9a-fA-F]{6}$'),
  moneda         text not null default 'USD' check (moneda ~ '^[A-Z]{3}$'),
  whatsapp       text check (whatsapp ~ '^[0-9]{6,15}$'),
  plan           text not null default 'free' check (plan in ('free', 'carta', 'pro', 'grupo')),
  activo         boolean not null default true,
  created_at     timestamptz not null default now(),
  constraint slug_formato check (slug ~ '^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])$'),
  constraint slug_reservado check (slug not in (
    'admin', 'api', 'auth', 'login', 'logout', 'panel', 'registro', 'recuperar',
    'nueva-clave', 'precios', 'planes', 'ayuda', 'soporte', 'terminos', 'privacidad', 'demo-admin'
  ))
);

-- Quién puede editar cada restaurante (en el plan: tabla "usuarios").
create table public.usuarios (
  user_id        uuid not null references auth.users (id) on delete cascade,
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  rol            text not null default 'dueno' check (rol in ('dueno', 'staff')),
  created_at     timestamptz not null default now(),
  primary key (user_id, restaurante_id)
);
create index usuarios_restaurante_idx on public.usuarios (restaurante_id);

create table public.categorias (
  id             uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  nombre         text not null check (char_length(nombre) between 1 and 60),
  orden          integer not null default 0,
  visible        boolean not null default true,
  created_at     timestamptz not null default now()
);
create index categorias_restaurante_idx on public.categorias (restaurante_id, orden);

create table public.platos (
  id             uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  categoria_id   uuid not null references public.categorias (id) on delete cascade,
  nombre         text not null check (char_length(nombre) between 1 and 80),
  descripcion    text check (char_length(descripcion) <= 300),
  precio         numeric(10, 2) not null default 0 check (precio >= 0),
  foto_url       text,
  disponible     boolean not null default true,
  etiquetas      text[] not null default '{}',
  orden          integer not null default 0,
  created_at     timestamptz not null default now()
);
create index platos_categoria_idx on public.platos (categoria_id, orden);
create index platos_restaurante_idx on public.platos (restaurante_id);

create table public.mesas (
  id             uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  numero         text not null check (char_length(numero) between 1 and 12),
  created_at     timestamptz not null default now(),
  unique (restaurante_id, numero)
);

-- Un plato siempre pertenece al mismo restaurante que su categoría.
create or replace function public.validar_plato_restaurante()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.categorias c
    where c.id = new.categoria_id and c.restaurante_id = new.restaurante_id
  ) then
    raise exception 'La categoría no pertenece a este restaurante';
  end if;
  return new;
end;
$$;

create trigger platos_restaurante_coherente
  before insert or update of categoria_id, restaurante_id on public.platos
  for each row execute function public.validar_plato_restaurante();

-- ─────────────────────────────────────────────
-- Funciones auxiliares
-- ─────────────────────────────────────────────

-- ¿El usuario actual puede editar este restaurante?
create or replace function public.es_miembro(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuarios u
    where u.restaurante_id = rid and u.user_id = auth.uid()
  );
$$;

-- Alta de un restaurante: lo crea y deja al usuario actual como dueño.
create or replace function public.crear_restaurante(p_nombre text, p_slug text)
returns public.restaurantes
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.restaurantes;
begin
  if auth.uid() is null then
    raise exception 'Necesitas iniciar sesión';
  end if;

  insert into public.restaurantes (nombre, slug)
  values (trim(p_nombre), lower(trim(p_slug)))
  returning * into r;

  insert into public.usuarios (user_id, restaurante_id, rol)
  values (auth.uid(), r.id, 'dueno');

  return r;
end;
$$;

revoke all on function public.crear_restaurante(text, text) from public, anon;
grant execute on function public.crear_restaurante(text, text) to authenticated;

-- ─────────────────────────────────────────────
-- Seguridad por fila (RLS)
-- ─────────────────────────────────────────────

alter table public.restaurantes enable row level security;
alter table public.usuarios     enable row level security;
alter table public.categorias   enable row level security;
alter table public.platos       enable row level security;
alter table public.mesas        enable row level security;

-- Restaurantes: la carta pública lee los activos; el dueño lee y edita el suyo.
create policy "carta publica: restaurantes activos" on public.restaurantes
  for select using (activo);
create policy "miembro: ver su restaurante" on public.restaurantes
  for select to authenticated using (public.es_miembro(id));
create policy "miembro: editar su restaurante" on public.restaurantes
  for update to authenticated using (public.es_miembro(id)) with check (public.es_miembro(id));

-- El dueño no puede cambiarse el plan ni reactivarse: eso lo hace el superadmin.
revoke update on public.restaurantes from authenticated;
grant update (nombre, descripcion, logo_url, color_primario, color_fondo, moneda, whatsapp)
  on public.restaurantes to authenticated;

-- Usuarios: cada uno ve sus propias membresías.
create policy "ver mis membresias" on public.usuarios
  for select to authenticated using (user_id = auth.uid());

-- Categorías
create policy "carta publica: categorias visibles" on public.categorias
  for select using (
    visible and exists (select 1 from public.restaurantes r where r.id = restaurante_id and r.activo)
  );
create policy "miembro: todo en categorias" on public.categorias
  for all to authenticated
  using (public.es_miembro(restaurante_id))
  with check (public.es_miembro(restaurante_id));

-- Platos: los agotados no salen en la carta pública.
create policy "carta publica: platos disponibles" on public.platos
  for select using (
    disponible and exists (select 1 from public.restaurantes r where r.id = restaurante_id and r.activo)
  );
create policy "miembro: todo en platos" on public.platos
  for all to authenticated
  using (public.es_miembro(restaurante_id))
  with check (public.es_miembro(restaurante_id));

-- Mesas: solo el dueño.
create policy "miembro: todo en mesas" on public.mesas
  for all to authenticated
  using (public.es_miembro(restaurante_id))
  with check (public.es_miembro(restaurante_id));

-- ─────────────────────────────────────────────
-- Almacenamiento de fotos
-- Ruta de cada archivo: <restaurante_id>/<nombre>.webp
-- ─────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create or replace function public.carpeta_es_mia(nombre text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  carpeta text := split_part(nombre, '/', 1);
begin
  if carpeta !~ '^[0-9a-f-]{36}$' then
    return false;
  end if;
  return public.es_miembro(carpeta::uuid);
end;
$$;

create policy "fotos: subir a mi carpeta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos' and public.carpeta_es_mia(name));
create policy "fotos: actualizar en mi carpeta" on storage.objects
  for update to authenticated
  using (bucket_id = 'fotos' and public.carpeta_es_mia(name));
create policy "fotos: borrar de mi carpeta" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos' and public.carpeta_es_mia(name));
