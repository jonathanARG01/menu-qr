-- Lista privada de prospectos (restaurantes a los que Jonathan les ofrece Platovi), que se ve en /p/<ruta secreta>.
-- Solo el servidor la lee y escribe con la clave de servicio: RLS activado y SIN políticas, así nadie con la clave
-- pública (anon) ni con sesión de restaurante puede leerla. Los datos se cargan aparte (no van en el repo, que es público).

create table if not exists public.prospectos (
  nombre text primary key,
  orden integer not null default 0,
  datos jsonb not null default '{}'::jsonb,       -- prioridad, tipo, zona, dirección, contacto, sistema, demo, etc.
  estado_contacto text not null default 'Sin contactar',
  notas text not null default '',
  actualizado timestamptz not null default now()
);

-- Textos fijos de la página (por ahora el "anexo": directorio antiguo por verificar y locales cerrados).
create table if not exists public.prospectos_textos (
  clave text primary key,
  valor text not null default '',
  actualizado timestamptz not null default now()
);

alter table public.prospectos enable row level security;
alter table public.prospectos_textos enable row level security;
revoke all on public.prospectos from anon, authenticated;
revoke all on public.prospectos_textos from anon, authenticated;
