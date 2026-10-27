-- Menús QR · programa de referidos entre restaurantes.
-- Ejecutar en Supabase: SQL Editor > New query > pegar todo y ejecutar (se puede repetir sin problema).
--
-- Cómo funciona:
--   · Cada restaurante tiene su link de invitación: /registro?ref=<su-direccion>.
--   · El restaurante que se registra con ese link queda como "referido" (pendiente).
--   · Cuando le pones un plan pago desde /admin, el referido pasa a "confirmado".
--   · Al llegar a cada nivel (por defecto 1, 3 y 10 confirmados) el que invitó gana su descuento:
--       1  → 10 % en el próximo período (mes o año, según cómo pague)
--       3  → 10 % en otro período más
--       10 → 20 % para siempre y acceso prioritario a las mejoras
--     Los niveles se cambian desde /admin/referidos. Los descuentos ya ganados no cambian al editar los niveles.
--   · Al cobrarle, aplicas el descuento vigente y tocas "Cobré un período" para gastar uno de los temporales.

-- ─────────────────────────────────────────────
-- Tablas
-- ─────────────────────────────────────────────

-- Cómo paga cada restaurante (solo para mostrar a qué corresponde un "período").
alter table public.restaurantes
  add column if not exists ciclo text not null default 'mensual' check (ciclo in ('mensual', 'anual'));

-- Una sola fila con los niveles del programa.
create table if not exists public.referidos_config (
  id         boolean primary key default true check (id),
  activo     boolean not null default true,
  niveles    jsonb not null check (jsonb_typeof(niveles) = 'array'),
  updated_at timestamptz not null default now()
);

insert into public.referidos_config (id, niveles)
values (true, '[
  {"referidos": 1,  "porcentaje": 10, "periodos": 1,    "prioridad": false},
  {"referidos": 3,  "porcentaje": 10, "periodos": 1,    "prioridad": false},
  {"referidos": 10, "porcentaje": 20, "periodos": null, "prioridad": true}
]'::jsonb)
on conflict (id) do nothing;

-- Quién invitó a quién. Un restaurante tiene como mucho un referente.
create table if not exists public.referidos (
  referido_id   uuid primary key references public.restaurantes (id) on delete cascade,
  referente_id  uuid not null references public.restaurantes (id) on delete cascade,
  estado        text not null default 'pendiente' check (estado in ('pendiente', 'confirmado', 'anulado')),
  created_at    timestamptz not null default now(),
  confirmado_at timestamptz,
  check (referido_id <> referente_id)
);
create index if not exists referidos_referente_idx on public.referidos (referente_id, estado);

-- Descuentos ganados. Guardan una copia del nivel: si después cambias los niveles, lo ganado se respeta.
-- periodos null = permanente.
create table if not exists public.descuentos_referido (
  id              uuid primary key default gen_random_uuid(),
  restaurante_id  uuid not null references public.restaurantes (id) on delete cascade,
  referidos       integer not null check (referidos > 0),
  porcentaje      numeric(5, 2) not null check (porcentaje > 0 and porcentaje <= 100),
  periodos        integer check (periodos is null or periodos > 0),
  periodos_usados integer not null default 0 check (periodos_usados >= 0),
  prioridad       boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (restaurante_id, referidos)
);

alter table public.referidos_config     enable row level security;
alter table public.referidos            enable row level security;
alter table public.descuentos_referido  enable row level security;

grant select on public.referidos_config, public.descuentos_referido to authenticated;
grant select on public.referidos to authenticated;

-- Los niveles los lee cualquiera con sesión (el panel muestra cuánto falta para el siguiente).
drop policy if exists "leer niveles" on public.referidos_config;
create policy "leer niveles" on public.referidos_config for select to authenticated using (true);

-- Cada administrador ve sus descuentos; el superadmin, todos. Nadie escribe directo: solo las funciones.
drop policy if exists "admin: ver sus descuentos" on public.descuentos_referido;
create policy "admin: ver sus descuentos" on public.descuentos_referido
  for select to authenticated using (public.es_admin(restaurante_id) or public.es_superadmin());

-- La lista de referidos con nombres la da mis_referidos(); directo solo la ve el superadmin.
drop policy if exists "superadmin: ver referidos" on public.referidos;
create policy "superadmin: ver referidos" on public.referidos
  for select to authenticated using (public.es_superadmin());

-- ─────────────────────────────────────────────
-- Lógica
-- ─────────────────────────────────────────────

-- Da los descuentos de los niveles que el restaurante ya alcanzó (los que ya tenía no se repiten).
create or replace function public.otorgar_descuentos_referido(p_restaurante uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.referidos_config;
  confirmados integer;
begin
  select * into cfg from public.referidos_config where id;
  if cfg.id is null or not cfg.activo then
    return;
  end if;
  select count(*) into confirmados from public.referidos where referente_id = p_restaurante and estado = 'confirmado';

  insert into public.descuentos_referido (restaurante_id, referidos, porcentaje, periodos, prioridad)
  select p_restaurante, (n ->> 'referidos')::int, (n ->> 'porcentaje')::numeric,
    nullif(n ->> 'periodos', '')::int, coalesce((n ->> 'prioridad')::boolean, false)
  from jsonb_array_elements(cfg.niveles) n
  where (n ->> 'referidos')::int <= confirmados
  on conflict (restaurante_id, referidos) do nothing;
end;
$$;
revoke all on function public.otorgar_descuentos_referido(uuid) from public, anon, authenticated;

-- Un referido cuenta cuando su restaurante pasa a un plan pago.
create or replace function public.confirmar_referido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ref uuid;
begin
  if new.plan <> 'free' and old.plan is distinct from new.plan then
    update public.referidos set estado = 'confirmado', confirmado_at = now()
    where referido_id = new.id and estado = 'pendiente'
    returning referente_id into ref;
    if ref is not null then
      perform public.otorgar_descuentos_referido(ref);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists confirmar_referido on public.restaurantes;
create trigger confirmar_referido after update of plan on public.restaurantes
  for each row execute function public.confirmar_referido();

-- Anota quién invitó a un restaurante nuevo. Se ignora si:
--   · el link es del mismo dueño (alguien de su equipo o él mismo con otro restaurante),
--   · el usuario ya tenía otro restaurante (un mismo dueño cuenta una sola vez),
--   · el restaurante que invita está pausado o no existe.
create or replace function public.anotar_referido(p_restaurante uuid, p_ref text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  referente uuid;
begin
  if p_ref is null or trim(p_ref) = '' then
    return;
  end if;
  select id into referente from public.restaurantes where slug = lower(trim(p_ref)) and activo;
  if referente is null or referente = p_restaurante then
    return;
  end if;
  if exists (select 1 from public.usuarios where restaurante_id = referente and user_id = auth.uid()) then
    return;
  end if;
  if exists (
    select 1 from public.usuarios
    where user_id = auth.uid() and rol = 'dueno' and restaurante_id <> p_restaurante
  ) then
    return;
  end if;
  insert into public.referidos (referido_id, referente_id) values (p_restaurante, referente)
  on conflict (referido_id) do nothing;
end;
$$;
revoke all on function public.anotar_referido(uuid, text) from public, anon, authenticated;

-- Alta de un restaurante (misma firma de antes). Si la cuenta se creó desde un link de invitación,
-- el código quedó guardado en los datos del usuario ("ref") y se anota aquí, venga del registro o del último paso.
create or replace function public.crear_restaurante(p_nombre text, p_slug text)
returns public.restaurantes
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.restaurantes;
  ref text;
begin
  if auth.uid() is null then
    raise exception 'Necesitas iniciar sesión';
  end if;

  insert into public.restaurantes (nombre, slug)
  values (trim(p_nombre), lower(trim(p_slug)))
  returning * into r;

  -- Antes de sumarlo como dueño, para que "ya tenía otro restaurante" no cuente este mismo.
  if not public.es_superadmin() then
    select raw_user_meta_data ->> 'ref' into ref from auth.users where id = auth.uid();
    perform public.anotar_referido(r.id, ref);
  end if;

  insert into public.usuarios (user_id, restaurante_id, rol)
  values (auth.uid(), r.id, 'dueno');

  return r;
end;
$$;
revoke all on function public.crear_restaurante(text, text) from public, anon;
grant execute on function public.crear_restaurante(text, text) to authenticated;

-- Para la página de invitación: el nombre del restaurante que invita (solo si está activo).
create or replace function public.nombre_referente(p_ref text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nombre from public.restaurantes where slug = lower(trim(p_ref)) and activo;
$$;
grant execute on function public.nombre_referente(text) to anon, authenticated;

-- Panel del restaurante: a quién invitó y en qué estado está cada uno.
create or replace function public.mis_referidos(p_restaurante uuid)
returns table (nombre text, estado text, created_at timestamptz, confirmado_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.es_admin(p_restaurante) or public.es_superadmin()) then
    raise exception 'Solo para administradores del restaurante';
  end if;
  return query
  select r.nombre, x.estado, x.created_at, x.confirmado_at
  from public.referidos x join public.restaurantes r on r.id = x.referido_id
  where x.referente_id = p_restaurante
  order by x.created_at desc;
end;
$$;
revoke all on function public.mis_referidos(uuid) from public, anon;
grant execute on function public.mis_referidos(uuid) to authenticated;

-- ─────────────────────────────────────────────
-- Funciones del superadmin
-- ─────────────────────────────────────────────

-- Todos los restaurantes con lo necesario para la pantalla de referidos de /admin.
create or replace function public.admin_referidos()
returns table (
  id uuid,
  slug text,
  nombre text,
  plan text,
  ciclo text,
  activo boolean,
  referente_id uuid,
  estado text,
  confirmados bigint,
  pendientes bigint
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
  select r.id, r.slug, r.nombre, r.plan, r.ciclo, r.activo, x.referente_id, x.estado,
    (select count(*) from public.referidos y where y.referente_id = r.id and y.estado = 'confirmado'),
    (select count(*) from public.referidos y where y.referente_id = r.id and y.estado = 'pendiente')
  from public.restaurantes r
  left join public.referidos x on x.referido_id = r.id
  order by r.nombre;
end;
$$;

-- Guarda los niveles y si el programa está activo. Valida cada nivel antes de guardar.
create or replace function public.admin_guardar_referidos(p_activo boolean, p_niveles jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n jsonb;
begin
  if not public.es_superadmin() then
    raise exception 'Solo para administradores';
  end if;
  if jsonb_typeof(p_niveles) <> 'array' then
    raise exception 'Los niveles deben ser una lista';
  end if;
  for n in select * from jsonb_array_elements(p_niveles) loop
    if coalesce((n ->> 'referidos')::int, 0) < 1 then
      raise exception 'Cada nivel necesita al menos 1 referido';
    end if;
    if coalesce((n ->> 'porcentaje')::numeric, 0) <= 0 or (n ->> 'porcentaje')::numeric > 100 then
      raise exception 'El descuento de cada nivel va de 1 a 100 %%';
    end if;
    if n ->> 'periodos' is not null and (n ->> 'periodos')::int < 1 then
      raise exception 'Los períodos van de 1 en adelante (vacío = permanente)';
    end if;
  end loop;
  if (select count(distinct n2 ->> 'referidos') <> count(*) from jsonb_array_elements(p_niveles) n2) then
    raise exception 'Dos niveles no pueden pedir la misma cantidad de referidos';
  end if;

  update public.referidos_config set activo = p_activo, niveles = p_niveles, updated_at = now() where id;
end;
$$;

-- Asigna (o quita, con p_ref vacío) quién invitó a un restaurante. Útil para los que das de alta tú.
create or replace function public.admin_asignar_referente(p_id uuid, p_ref text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  referente uuid;
  pago boolean;
begin
  if not public.es_superadmin() then
    raise exception 'Solo para administradores';
  end if;
  if p_ref is null or trim(p_ref) = '' then
    delete from public.referidos where referido_id = p_id;
    return;
  end if;
  select id into referente from public.restaurantes where slug = lower(trim(p_ref));
  if referente is null then
    raise exception 'No hay ningún restaurante con la dirección %', p_ref;
  end if;
  if referente = p_id then
    raise exception 'Un restaurante no puede invitarse a sí mismo';
  end if;
  select plan <> 'free' into pago from public.restaurantes where id = p_id;

  insert into public.referidos (referido_id, referente_id, estado, confirmado_at)
  values (p_id, referente, case when pago then 'confirmado' else 'pendiente' end, case when pago then now() end)
  on conflict (referido_id) do update
    set referente_id = excluded.referente_id, estado = excluded.estado, confirmado_at = excluded.confirmado_at;

  if pago then
    perform public.otorgar_descuentos_referido(referente);
  end if;
end;
$$;

-- Cambia el estado de un referido a mano (por ejemplo, anular uno que no pagó).
-- Anular no quita descuentos ya ganados: si corresponde, quítalos con admin_quitar_descuento.
create or replace function public.admin_estado_referido(p_referido uuid, p_estado text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ref uuid;
begin
  if not public.es_superadmin() then
    raise exception 'Solo para administradores';
  end if;
  update public.referidos
  set estado = p_estado, confirmado_at = case when p_estado = 'confirmado' then coalesce(confirmado_at, now()) end
  where referido_id = p_referido
  returning referente_id into ref;
  if p_estado = 'confirmado' and ref is not null then
    perform public.otorgar_descuentos_referido(ref);
  end if;
end;
$$;

-- Al cobrarle a un restaurante: gasta un período del descuento temporal que se aplicó.
-- Si tiene uno permanente igual o mayor, el temporal no se toca (no le sirve y lo conserva).
create or replace function public.admin_usar_periodo(p_restaurante uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  permanente numeric;
  temporal public.descuentos_referido;
begin
  if not public.es_superadmin() then
    raise exception 'Solo para administradores';
  end if;
  select max(porcentaje) into permanente from public.descuentos_referido
  where restaurante_id = p_restaurante and periodos is null;
  select * into temporal from public.descuentos_referido
  where restaurante_id = p_restaurante and periodos is not null and periodos_usados < periodos
  order by referidos limit 1;
  if temporal.id is null or temporal.porcentaje <= coalesce(permanente, 0) then
    return;
  end if;
  update public.descuentos_referido set periodos_usados = periodos_usados + 1 where id = temporal.id;
end;
$$;

create or replace function public.admin_quitar_descuento(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_superadmin() then
    raise exception 'Solo para administradores';
  end if;
  delete from public.descuentos_referido where id = p_id;
end;
$$;

create or replace function public.admin_ciclo(p_id uuid, p_ciclo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_superadmin() then
    raise exception 'Solo para administradores';
  end if;
  update public.restaurantes set ciclo = p_ciclo where id = p_id;
end;
$$;

revoke all on function public.admin_referidos() from public, anon;
revoke all on function public.admin_guardar_referidos(boolean, jsonb) from public, anon;
revoke all on function public.admin_asignar_referente(uuid, text) from public, anon;
revoke all on function public.admin_estado_referido(uuid, text) from public, anon;
revoke all on function public.admin_usar_periodo(uuid) from public, anon;
revoke all on function public.admin_quitar_descuento(uuid) from public, anon;
revoke all on function public.admin_ciclo(uuid, text) from public, anon;
grant execute on function public.admin_referidos() to authenticated;
grant execute on function public.admin_guardar_referidos(boolean, jsonb) to authenticated;
grant execute on function public.admin_asignar_referente(uuid, text) to authenticated;
grant execute on function public.admin_estado_referido(uuid, text) to authenticated;
grant execute on function public.admin_usar_periodo(uuid) to authenticated;
grant execute on function public.admin_quitar_descuento(uuid) to authenticated;
grant execute on function public.admin_ciclo(uuid, text) to authenticated;
