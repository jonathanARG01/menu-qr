-- Sitio de venta (platovi.cl): datos de contacto y redes sociales que el superadmin edita en /admin/sitio,
-- y los mensajes que llegan desde el formulario de contacto.

create table if not exists public.sitio_ajustes (
  id int primary key default 1 check (id = 1),
  contacto jsonb not null default '{}'::jsonb,
  redes jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.sitio_ajustes (id, contacto, redes)
values (
  1,
  jsonb_build_object(
    'whatsapp', '56941497083',
    'correo', 'hola@platovi.cl',
    'telefono', '+56 9 4149 7083',
    'ubicacion', 'Chile · atendemos en todo el país y el extranjero',
    'horario', 'Todos los días, las 24 horas',
    'aviso_correo', 'hola@platovi.cl'
  ),
  '{}'::jsonb
)
on conflict (id) do nothing;

alter table public.sitio_ajustes enable row level security;

drop policy if exists "sitio: lectura publica" on public.sitio_ajustes;
create policy "sitio: lectura publica" on public.sitio_ajustes for select using (true);

drop policy if exists "sitio: superadmin edita" on public.sitio_ajustes;
create policy "sitio: superadmin edita" on public.sitio_ajustes
  for update using (public.es_superadmin()) with check (public.es_superadmin());

create table if not exists public.mensajes_contacto (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  correo text not null,
  telefono text,
  negocio text,
  mensaje text not null,
  leido boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists mensajes_contacto_fecha on public.mensajes_contacto (created_at desc);

alter table public.mensajes_contacto enable row level security;

drop policy if exists "contacto: superadmin lee" on public.mensajes_contacto;
create policy "contacto: superadmin lee" on public.mensajes_contacto for select using (public.es_superadmin());

drop policy if exists "contacto: superadmin marca" on public.mensajes_contacto;
create policy "contacto: superadmin marca" on public.mensajes_contacto
  for update using (public.es_superadmin()) with check (public.es_superadmin());

drop policy if exists "contacto: superadmin borra" on public.mensajes_contacto;
create policy "contacto: superadmin borra" on public.mensajes_contacto for delete using (public.es_superadmin());

-- El formulario guarda con esta función (cualquiera puede llamarla), con límites para frenar el spam:
-- largo de cada campo, máximo 3 mensajes por correo cada hora y 60 en total cada hora.
create or replace function public.enviar_contacto(
  p_nombre text,
  p_correo text,
  p_telefono text,
  p_negocio text,
  p_mensaje text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_correo text := lower(trim(coalesce(p_correo, '')));
begin
  if length(trim(coalesce(p_nombre, ''))) < 2 or length(trim(coalesce(p_mensaje, ''))) < 5 then
    raise exception 'Faltan tu nombre o el mensaje.' using errcode = 'P0001';
  end if;
  if v_correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Revisa tu correo.' using errcode = 'P0001';
  end if;
  if (select count(*) from mensajes_contacto where correo = v_correo and created_at > now() - interval '1 hour') >= 3
     or (select count(*) from mensajes_contacto where created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Recibimos muchos mensajes seguidos. Escríbenos por WhatsApp o inténtalo en un rato.' using errcode = 'P0001';
  end if;
  insert into mensajes_contacto (nombre, correo, telefono, negocio, mensaje)
  values (
    left(trim(p_nombre), 80),
    left(v_correo, 120),
    nullif(left(trim(coalesce(p_telefono, '')), 30), ''),
    nullif(left(trim(coalesce(p_negocio, '')), 80), ''),
    left(trim(p_mensaje), 2000)
  )
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.enviar_contacto(text, text, text, text, text) to anon, authenticated;
