-- Mesitto · prueba de 14 días automática, cuenta nueva con carta de ejemplo, inicio del plan pago y avisos.
-- Requiere 0004 (salón), 0012 (referidos) y 0013 (país). Se puede ejecutar más de una vez.
-- Ejecutar en Supabase: SQL Editor > New query > pegar todo y Run.
--
-- Cómo funciona:
--   · Cada restaurante nuevo empieza una prueba de 14 días (prueba_inicio / prueba_fin), con el diseño Vitrina,
--     imágenes por defecto y 12 platos de ejemplo que se borran con un botón.
--   · Todos los días (Vercel Cron, /api/recordatorios) procesar_pruebas() avisa cuando quedan 4 días y 1 día,
--     y al vencer pausa la carta (activo = false, pausa_motivo = 'prueba').
--   · Al ponerle un plan pago desde /admin se anota el día de inicio (plan_inicio) y, si estaba pausado por la
--     prueba, la carta vuelve a verse.
--   · Las demos sin dueño (cargadas con los seed) no tienen prueba: nunca se pausan solas.

-- ─────────────────────────────────────────────
-- Columnas nuevas
-- ─────────────────────────────────────────────

alter table public.restaurantes
  add column if not exists prueba_inicio timestamptz,
  add column if not exists prueba_fin    timestamptz,
  -- Último aviso de la prueba ya enviado, en días que quedaban (4, 1 o 0 = venció). Evita repetirlos.
  add column if not exists prueba_aviso  integer,
  -- Día en que empezó el plan pago (lo anota /admin al elegir el plan; se puede corregir).
  add column if not exists plan_inicio   date,
  -- Por qué está pausado: 'prueba' (venció sola) o 'manual' (lo pausaste tú).
  add column if not exists pausa_motivo  text;

alter table public.restaurantes drop constraint if exists restaurantes_pausa_motivo_check;
alter table public.restaurantes add constraint restaurantes_pausa_motivo_check
  check (pausa_motivo is null or pausa_motivo in ('prueba', 'manual'));

-- Diseño por defecto de las cartas nuevas.
alter table public.restaurantes alter column tema set default 'vitrina';

-- Platos y categorías de ejemplo de una cuenta nueva (se borran juntos desde el panel).
alter table public.categorias add column if not exists ejemplo boolean not null default false;
alter table public.platos     add column if not exists ejemplo boolean not null default false;

-- Los restaurantes que ya estaban en prueba y tienen dueño: 14 días desde el alta, y al menos 7 desde hoy
-- para que nadie se pause de golpe al ejecutar esto. Las demos sin dueño quedan sin vencimiento.
update public.restaurantes r
set prueba_inicio = r.created_at,
    prueba_fin = greatest(r.created_at + interval '14 days', now() + interval '7 days')
where r.plan = 'free'
  and r.prueba_fin is null
  and exists (select 1 from public.usuarios u where u.restaurante_id = r.id and u.rol = 'dueno');

-- ─────────────────────────────────────────────
-- Carta de ejemplo
-- ─────────────────────────────────────────────

-- Precio de ejemplo en otra moneda: p_factor es cuánto vale 1 peso chileno en esa moneda (aprox.), redondeado
-- a un precio de carta (14.390, 129, 8,99…).
create or replace function public.precio_ejemplo(p_clp numeric, p_factor numeric)
returns numeric
language sql
immutable
as $$
  select case
    when p_factor = 1 then p_clp
    when v >= 1000 then round(v / 100) * 100 - 10
    when v >= 100 then round(v / 10) * 10 - 1
    else ceil(v) - 0.01
  end
  from (select p_clp * p_factor as v) x;
$$;

-- Carga 12 platos de ejemplo (si el restaurante todavía no tiene ninguno). Devuelve cuántos cargó.
create or replace function public.cargar_carta_ejemplo(p_restaurante uuid, p_factor numeric default 1)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c uuid;
  f numeric := coalesce(nullif(p_factor, 0), 1);
begin
  if not (public.es_admin(p_restaurante) or public.es_superadmin()) then
    raise exception 'Solo el administrador del restaurante';
  end if;
  if exists (select 1 from public.platos where restaurante_id = p_restaurante) then
    return 0;
  end if;

  insert into public.categorias (restaurante_id, nombre, orden, ejemplo)
  values (p_restaurante, 'Entradas', 0, true) returning id into c;
  insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden, destacado, ejemplo) values
    (p_restaurante, c, 'Empanadas de pino (3)', 'Carne cortada a cuchillo, cebolla, huevo y aceituna', public.precio_ejemplo(6990, f), '{recomendado}', 0, true, true),
    (p_restaurante, c, 'Provoleta', 'Queso provolone a la parrilla con orégano y aceite de oliva', public.precio_ejemplo(7490, f), '{vegetariano}', 1, false, true),
    (p_restaurante, c, 'Ensalada chilena', 'Tomate, cebolla en pluma y cilantro', public.precio_ejemplo(4990, f), '{vegano,sin gluten}', 2, false, true);

  insert into public.categorias (restaurante_id, nombre, orden, ejemplo)
  values (p_restaurante, 'Principales', 1, true) returning id into c;
  insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden, destacado, ejemplo) values
    (p_restaurante, c, 'Bife a lo pobre', 'Con papas fritas, cebolla caramelizada y dos huevos', public.precio_ejemplo(14990, f), '{}', 0, true, true),
    (p_restaurante, c, 'Pollo al limón', 'Trutro deshuesado al horno con puré rústico', public.precio_ejemplo(10990, f), '{}', 1, false, true),
    (p_restaurante, c, 'Salmón a la plancha', 'Con arroz primavera y salsa de alcaparras', public.precio_ejemplo(13990, f), '{sin gluten}', 2, false, true),
    (p_restaurante, c, 'Hamburguesa de la casa', 'Carne de 180 g, cheddar, tocino y papas fritas', public.precio_ejemplo(9990, f), '{nuevo}', 3, false, true);

  insert into public.categorias (restaurante_id, nombre, orden, ejemplo)
  values (p_restaurante, 'Postres', 2, true) returning id into c;
  insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden, destacado, ejemplo) values
    (p_restaurante, c, 'Flan casero', 'Con salsa de caramelo', public.precio_ejemplo(3990, f), '{vegetariano}', 0, false, true),
    (p_restaurante, c, 'Torta de chocolate', 'Tibia, con helado de vainilla', public.precio_ejemplo(4990, f), '{vegetariano}', 1, false, true);

  insert into public.categorias (restaurante_id, nombre, orden, ejemplo)
  values (p_restaurante, 'Bebidas', 3, true) returning id into c;
  insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden, destacado, ejemplo) values
    (p_restaurante, c, 'Limonada menta jengibre', 'Natural, 500 ml', public.precio_ejemplo(3490, f), '{vegano}', 0, false, true),
    (p_restaurante, c, 'Café espresso', 'Doble, de grano recién molido', public.precio_ejemplo(2490, f), '{}', 1, false, true),
    (p_restaurante, c, 'Cerveza artesanal', 'Rubia o roja, 500 ml', public.precio_ejemplo(4490, f), '{}', 2, false, true);

  return 12;
end;
$$;
revoke all on function public.cargar_carta_ejemplo(uuid, numeric) from public, anon;
grant execute on function public.cargar_carta_ejemplo(uuid, numeric) to authenticated;

-- Borra los platos de ejemplo que el restaurante no tocó y las categorías de ejemplo que queden vacías.
create or replace function public.borrar_carta_ejemplo(p_restaurante uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not (public.es_admin(p_restaurante) or public.es_superadmin()) then
    raise exception 'Solo el administrador del restaurante';
  end if;
  delete from public.platos where restaurante_id = p_restaurante and ejemplo;
  get diagnostics n = row_count;
  delete from public.categorias c
  where c.restaurante_id = p_restaurante and c.ejemplo
    and not exists (select 1 from public.platos p where p.categoria_id = c.id);
  return n;
end;
$$;
revoke all on function public.borrar_carta_ejemplo(uuid) from public, anon;
grant execute on function public.borrar_carta_ejemplo(uuid) to authenticated;

-- Un plato de ejemplo que el restaurante edita (nombre, precio, descripción o foto) pasa a ser suyo.
create or replace function public.plato_deja_de_ser_ejemplo()
returns trigger
language plpgsql
as $$
begin
  if old.ejemplo and (new.nombre, new.descripcion, new.precio, new.foto_url)
      is distinct from (old.nombre, old.descripcion, old.precio, old.foto_url) then
    new.ejemplo := false;
  end if;
  return new;
end;
$$;
drop trigger if exists plato_deja_de_ser_ejemplo on public.platos;
create trigger plato_deja_de_ser_ejemplo before update on public.platos
  for each row execute function public.plato_deja_de_ser_ejemplo();

-- ─────────────────────────────────────────────
-- Alta de un restaurante (misma firma): ahora empieza la prueba, con Vitrina e imágenes por defecto.
-- La carta de ejemplo y el país los agrega la app justo después (cargar_carta_ejemplo, con la moneda del país).
-- ─────────────────────────────────────────────

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

  insert into public.restaurantes (nombre, slug, tema, color_primario, color_fondo, ajustes, prueba_inicio, prueba_fin)
  values (
    trim(p_nombre), lower(trim(p_slug)), 'vitrina', '#8bc34a', '#1b231d',
    jsonb_build_object('imagenes_defecto', true),
    now(), now() + interval '14 days'
  )
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

-- ─────────────────────────────────────────────
-- Carta pausada: la página pública muestra un mensaje amable con el nombre y el logo (nada más).
-- ─────────────────────────────────────────────

create or replace function public.carta_pausada(p_slug text)
returns table (nombre text, logo_url text, color_primario text)
language sql
stable
security definer
set search_path = public
as $$
  select r.nombre, r.logo_url, r.color_primario
  from public.restaurantes r
  where r.slug = lower(trim(p_slug))
    and (not r.activo or (r.plan = 'free' and r.prueba_fin is not null and r.prueba_fin <= now()));
$$;
grant execute on function public.carta_pausada(text) to anon, authenticated;

-- ─────────────────────────────────────────────
-- Funciones del superadmin
-- ─────────────────────────────────────────────

-- Cambia la firma (devuelve más columnas): hay que borrarla antes.
drop function if exists public.admin_restaurantes();
create function public.admin_restaurantes()
returns table (
  id uuid,
  slug text,
  nombre text,
  plan text,
  ciclo text,
  activo boolean,
  pausa_motivo text,
  created_at timestamptz,
  prueba_inicio timestamptz,
  prueba_fin timestamptz,
  plan_inicio date,
  whatsapp text,
  moneda text,
  duenos text,
  platos bigint,
  ejemplos bigint,
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
  select r.id, r.slug, r.nombre, r.plan, r.ciclo, r.activo, r.pausa_motivo, r.created_at,
    r.prueba_inicio, r.prueba_fin, r.plan_inicio, r.whatsapp, r.moneda,
    (select string_agg(au.email::text, ', ') from public.usuarios u join auth.users au on au.id = u.user_id
      where u.restaurante_id = r.id and u.rol = 'dueno'),
    (select count(*) from public.platos p where p.restaurante_id = r.id),
    (select count(*) from public.platos p where p.restaurante_id = r.id and p.ejemplo),
    (select count(*) from public.sucursales s where s.restaurante_id = r.id),
    (select count(*) from public.eventos e where e.restaurante_id = r.id and e.tipo = 'visita' and e.created_at > now() - interval '30 days'),
    (select count(*) from public.eventos e where e.restaurante_id = r.id and e.tipo = 'pedido' and e.created_at > now() - interval '30 days'),
    exists (select 1 from public.usuarios u where u.restaurante_id = r.id and u.user_id = auth.uid() and u.rol = 'staff')
  from public.restaurantes r
  order by r.created_at desc;
end;
$$;
revoke all on function public.admin_restaurantes() from public, anon;
grant execute on function public.admin_restaurantes() to authenticated;

-- Plan y pausa (misma firma de antes). Además:
--   · al pasar a un plan pago anota el día de inicio (si no tenía) y, si la prueba lo había pausado, lo reactiva;
--   · si reactivas a mano uno en prueba ya vencida, le da 7 días más (si no, mañana se pausaría de nuevo).
create or replace function public.admin_actualizar_restaurante(p_id uuid, p_plan text, p_activo boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.restaurantes;
begin
  if not public.es_superadmin() then
    raise exception 'Solo para administradores';
  end if;
  select * into r from public.restaurantes where id = p_id for update;
  if not found then
    raise exception 'No existe ese restaurante';
  end if;

  if p_plan is not null and p_plan <> r.plan then
    update public.restaurantes set plan = p_plan where id = p_id;
    if p_plan <> 'free' then
      update public.restaurantes
      set plan_inicio = coalesce(plan_inicio, (now() at time zone public.zona_restaurante(p_id))::date),
          activo = case when pausa_motivo = 'prueba' then true else activo end,
          pausa_motivo = case when pausa_motivo = 'prueba' then null else pausa_motivo end
      where id = p_id;
    end if;
  end if;

  if p_activo is not null and p_activo <> r.activo then
    update public.restaurantes
    set activo = p_activo,
        pausa_motivo = case when p_activo then null else 'manual' end,
        prueba_fin = case
          when p_activo and plan = 'free' and prueba_fin is not null and prueba_fin <= now()
            then now() + interval '7 days'
          else prueba_fin end,
        prueba_aviso = case
          when p_activo and plan = 'free' and prueba_fin is not null and prueba_fin <= now() then null
          else prueba_aviso end
    where id = p_id;
  end if;
end;
$$;
revoke all on function public.admin_actualizar_restaurante(uuid, text, boolean) from public, anon;
grant execute on function public.admin_actualizar_restaurante(uuid, text, boolean) to authenticated;

-- Fin de la prueba (null = sin vencimiento). Si la prueba lo había pausado y la nueva fecha es futura, lo reactiva.
create or replace function public.admin_prueba(p_id uuid, p_fin timestamptz)
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
  set prueba_fin = p_fin,
      prueba_inicio = coalesce(prueba_inicio, created_at),
      prueba_aviso = null,
      activo = case when pausa_motivo = 'prueba' and (p_fin is null or p_fin > now()) then true else activo end,
      pausa_motivo = case when pausa_motivo = 'prueba' and (p_fin is null or p_fin > now()) then null else pausa_motivo end
  where id = p_id;
end;
$$;
revoke all on function public.admin_prueba(uuid, timestamptz) from public, anon;
grant execute on function public.admin_prueba(uuid, timestamptz) to authenticated;

-- Día en que empezó el plan pago (para el contador de /admin).
create or replace function public.admin_plan_inicio(p_id uuid, p_fecha date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_superadmin() then
    raise exception 'Solo para administradores';
  end if;
  update public.restaurantes set plan_inicio = p_fecha where id = p_id;
end;
$$;
revoke all on function public.admin_plan_inicio(uuid, date) from public, anon;
grant execute on function public.admin_plan_inicio(uuid, date) to authenticated;

-- ─────────────────────────────────────────────
-- Avisos al celular o computador de una cuenta (el superadmin y los dueños en prueba)
-- ─────────────────────────────────────────────

create table if not exists public.avisos_cuenta (
  endpoint   text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  claves     jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists avisos_cuenta_usuario_idx on public.avisos_cuenta (user_id);
alter table public.avisos_cuenta enable row level security;
-- Nadie la lee directo: se escribe con suscribir_cuenta() y la lee el envío diario con la clave de servicio.

create or replace function public.suscribir_cuenta(p_endpoint text, p_claves jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or coalesce(p_endpoint, '') !~ '^https://' then
    return false;
  end if;
  insert into public.avisos_cuenta (endpoint, user_id, claves) values (p_endpoint, auth.uid(), p_claves)
  on conflict (endpoint) do update set user_id = excluded.user_id, claves = excluded.claves, created_at = now();
  return true;
end;
$$;
revoke all on function public.suscribir_cuenta(text, jsonb) from public, anon;
grant execute on function public.suscribir_cuenta(text, jsonb) to authenticated;

-- ─────────────────────────────────────────────
-- Envío diario (solo con la clave de servicio): pausa las pruebas vencidas y devuelve los avisos a mandar.
-- Cada aviso se entrega una vez: 4 días antes, 1 día antes y al vencer.
-- ─────────────────────────────────────────────

create or replace function public.procesar_pruebas()
returns table (
  restaurante_id uuid,
  nombre text,
  slug text,
  dias integer,
  vencida boolean,
  whatsapp text,
  correos text[],
  usuarios uuid[]
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidatos as (
    select r.id,
      greatest(0, ceil(extract(epoch from (r.prueba_fin - now())) / 86400))::int as quedan
    from public.restaurantes r
    where r.plan = 'free' and r.activo and r.prueba_fin is not null
      and exists (select 1 from public.usuarios u where u.restaurante_id = r.id and u.rol = 'dueno')
  ),
  umbral as (
    select c.id, c.quedan, case when c.quedan = 0 then 0 when c.quedan <= 1 then 1 when c.quedan <= 4 then 4 end as aviso
    from candidatos c
  ),
  marcados as (
    update public.restaurantes r
    set prueba_aviso = u.aviso,
        activo = case when u.aviso = 0 then false else r.activo end,
        pausa_motivo = case when u.aviso = 0 then 'prueba' else r.pausa_motivo end
    from umbral u
    where r.id = u.id and u.aviso is not null and coalesce(r.prueba_aviso, 99) > u.aviso
    returning r.id, r.nombre, r.slug, u.quedan, u.aviso = 0 as vencio, r.whatsapp
  )
  select m.id, m.nombre, m.slug, m.quedan, m.vencio, m.whatsapp,
    array(select au.email::text from public.usuarios us join auth.users au on au.id = us.user_id
      where us.restaurante_id = m.id and us.rol = 'dueno' and au.email is not null),
    array(select us.user_id from public.usuarios us where us.restaurante_id = m.id and us.rol = 'dueno')
  from marcados m;
end;
$$;
revoke all on function public.procesar_pruebas() from public, anon, authenticated;
grant execute on function public.procesar_pruebas() to service_role;

notify pgrst, 'reload schema';
