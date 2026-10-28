-- Mesitto · mejoras del servicio a partir de las reseñas de Fudo, más las de Jonathan.
-- Requiere 0004, 0009 y 0014. Se puede ejecutar más de una vez.
-- Ejecutar en Supabase: SQL Editor > New query > pegar todo y Run.
--
-- Qué agrega:
--   · Opciones por plato (tamaño, acompañamiento, punto de cocción) con precio extra, y precio distinto para llevar.
--   · Tiempos de servicio: una comanda puede quedar "en espera" (dejar para después) hasta que el mesero la marche.
--   · Mover una cuenta a otra mesa, juntar dos mesas y pasar un plato de una mesa a otra.
--   · Perfil de cada persona del equipo (nombre, foto o emoji, color) y mesas asignadas a cada mesero.
--   · El mismo número de mesa en pisos distintos (el QR de esas mesas lleva el id de la mesa).
--   · Gastos de caja (salen del efectivo esperado).
--   · Vista del repartidor por enlace y "pagar al retirar" cuando falla Mercado Pago.

-- ─────────────────────────────────────────────
-- Platos: opciones y precio para llevar
-- opciones: [{"nombre": "Tamaño", "min": 1, "max": 1, "valores": [{"nombre": "Grande", "precio": 2000}]}]
-- ─────────────────────────────────────────────

alter table public.platos
  add column if not exists opciones jsonb not null default '[]',
  add column if not exists precio_llevar numeric(10, 2);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'platos_opciones_check') then
    alter table public.platos add constraint platos_opciones_check
      check (jsonb_typeof(opciones) = 'array' and length(opciones::text) <= 6000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'platos_precio_llevar_check') then
    alter table public.platos add constraint platos_precio_llevar_check check (precio_llevar is null or precio_llevar >= 0);
  end if;
end;
$$;

-- Lo elegido en cada línea: [{"grupo": "Tamaño", "valor": "Grande", "precio": 2000}]
alter table public.pedido_items add column if not exists opciones jsonb not null default '[]';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pedido_items_opciones_check') then
    alter table public.pedido_items add constraint pedido_items_opciones_check
      check (jsonb_typeof(opciones) = 'array' and length(opciones::text) <= 2000);
  end if;
end;
$$;

-- Deja solo opciones que existen en el plato (con su precio de la carta) y respeta el máximo de cada grupo.
create or replace function public.opciones_validas(p public.platos, elegidas jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  g jsonb;
  v jsonb;
  resultado jsonb := '[]';
  n integer;
  maximo integer;
begin
  if elegidas is null or jsonb_typeof(elegidas) <> 'array' or jsonb_typeof(p.opciones) <> 'array' then
    return '[]';
  end if;
  for g in select * from jsonb_array_elements(p.opciones) loop
    n := 0;
    maximo := greatest(coalesce((g ->> 'max')::int, 1), 1);
    for v in select * from jsonb_array_elements(g -> 'valores') loop
      if n < maximo and exists (
        select 1 from jsonb_array_elements(elegidas) e
        where e ->> 'grupo' = g ->> 'nombre' and e ->> 'valor' = v ->> 'nombre'
      ) then
        resultado := resultado || jsonb_build_array(jsonb_build_object(
          'grupo', g ->> 'nombre',
          'valor', v ->> 'nombre',
          'precio', greatest(coalesce(nullif(v ->> 'precio', '')::numeric, 0), 0)
        ));
        n := n + 1;
      end if;
    end loop;
  end loop;
  return resultado;
end;
$$;

-- Cada línea toma el precio vigente (con promo, el de llevar si corresponde y los extras de las opciones).
-- Las funciones que copian líneas (pasar un plato a otra mesa) marcan mesitto.copiar para mantener el precio.
create or replace function public.validar_pedido_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.platos;
  v_tipo text;
begin
  select tipo into v_tipo from public.pedidos x where x.id = new.pedido_id and x.restaurante_id = new.restaurante_id;
  if not found then
    raise exception 'El pedido no pertenece a este restaurante';
  end if;

  if current_setting('mesitto.copiar', true) = 'si' then
    return new;
  end if;

  if tg_op = 'UPDATE' and not public.es_admin(new.restaurante_id) then
    new.plato_id := old.plato_id;
    new.nombre := old.nombre;
    new.precio := old.precio;
    new.opciones := old.opciones;
    return new;
  end if;

  if new.plato_id is not null and (tg_op = 'INSERT' or new.plato_id is distinct from old.plato_id
     or new.opciones is distinct from old.opciones or not public.es_admin(new.restaurante_id)) then
    select * into p from public.platos where id = new.plato_id and restaurante_id = new.restaurante_id;
    if not found then
      raise exception 'Ese plato no es de este restaurante';
    end if;
    if tg_op = 'INSERT' and p.agotado_hasta > now()
       and exists (select 1 from public.pedidos x where x.id = new.pedido_id and x.origen = 'cliente') then
      raise exception '% se agotó. Elige otra cosa, por favor.', p.nombre;
    end if;
    new.opciones := public.opciones_validas(p, new.opciones);
    new.nombre := p.nombre;
    if v_tipo in ('llevar', 'delivery') and p.precio_llevar is not null then
      p.precio := p.precio_llevar;
    end if;
    new.precio := public.precio_vigente(p)
      + coalesce((select sum((o ->> 'precio')::numeric) from jsonb_array_elements(new.opciones) o), 0);
  elsif new.plato_id is null and not public.es_admin(new.restaurante_id) then
    raise exception 'Solo un administrador puede cargar algo fuera de la carta';
  end if;
  return new;
end;
$$;

-- ─────────────────────────────────────────────
-- Tiempos de servicio: "retenido" = la comanda espera a que el mesero la marche (no aparece en cocina).
-- ─────────────────────────────────────────────

alter table public.pedidos drop constraint if exists pedidos_estado_check;
alter table public.pedidos add constraint pedidos_estado_check
  check (estado in ('pendiente', 'retenido', 'nuevo', 'preparando', 'listo', 'entregado', 'cancelado'));

-- ─────────────────────────────────────────────
-- Mesas: mismo número en pisos distintos y mesero asignado
-- ─────────────────────────────────────────────

drop index if exists public.mesas_numero_unico;
create unique index if not exists mesas_numero_piso_unico on public.mesas (
  restaurante_id,
  coalesce(sucursal_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(piso_id, '00000000-0000-0000-0000-000000000000'::uuid),
  numero
);

alter table public.mesas add column if not exists mesero_id uuid references auth.users (id) on delete set null;

-- Mesa del QR: por número y sucursal, o por su id (el QR de las mesas con número repetido lleva el id).
create or replace function public.buscar_mesa(p_restaurante uuid, p_sucursal uuid, p_mesa text)
returns public.mesas
language sql
stable
security definer
set search_path = public
as $$
  select m.* from public.mesas m
  join public.restaurantes r on r.id = m.restaurante_id and r.activo
  where m.restaurante_id = p_restaurante
    and case when trim(p_mesa) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then m.id = trim(p_mesa)::uuid
             else m.numero = trim(p_mesa) end
    and (m.sucursal_id is null or p_sucursal is null or m.sucursal_id = p_sucursal)
  order by (m.sucursal_id is not distinct from p_sucursal) desc, m.created_at
  limit 1;
$$;
revoke all on function public.buscar_mesa(uuid, uuid, text) from public;

-- La cuenta de una mesa asignada queda a cargo de su mesero (si sigue en el equipo).
create or replace function public.cuenta_mesero_asignado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mesero uuid;
begin
  if new.mesa_id is not null then
    select m.mesero_id into v_mesero from public.mesas m
    join public.usuarios u on u.user_id = m.mesero_id and u.restaurante_id = m.restaurante_id
    where m.id = new.mesa_id;
    if v_mesero is not null then
      new.mesero_id := v_mesero;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists cuentas_mesero_asignado on public.cuentas;
create trigger cuentas_mesero_asignado
  before insert on public.cuentas
  for each row execute function public.cuenta_mesero_asignado();

-- El administrador asigna mesas a un mesero (las que no van en la lista dejan de ser suyas).
create or replace function public.asignar_mesas(p_restaurante uuid, p_usuario uuid, p_mesas uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin(p_restaurante) then
    raise exception 'Solo el administrador asigna mesas';
  end if;
  if not exists (select 1 from public.usuarios where restaurante_id = p_restaurante and user_id = p_usuario) then
    raise exception 'Esa persona no es parte del equipo';
  end if;
  update public.mesas set mesero_id = null
  where restaurante_id = p_restaurante and mesero_id = p_usuario and not (id = any(coalesce(p_mesas, '{}')));
  update public.mesas set mesero_id = p_usuario
  where restaurante_id = p_restaurante and id = any(coalesce(p_mesas, '{}'));
end;
$$;
revoke all on function public.asignar_mesas(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.asignar_mesas(uuid, uuid, uuid[]) to authenticated;

-- ─────────────────────────────────────────────
-- Perfil del equipo: nombre visible, foto o emoji y color (todo opcional)
-- ─────────────────────────────────────────────

alter table public.usuarios
  add column if not exists nombre text check (char_length(nombre) <= 40),
  add column if not exists avatar text check (char_length(avatar) <= 500),
  add column if not exists color  text check (color ~ '^#[0-9a-fA-F]{6}$');

-- Lo cambia el administrador para cualquiera, o cada persona el suyo.
create or replace function public.guardar_perfil(p_restaurante uuid, p_usuario uuid, p_nombre text, p_avatar text, p_color text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avatar text := nullif(trim(p_avatar), '');
begin
  if not (public.es_admin(p_restaurante) or (p_usuario = auth.uid() and public.es_miembro(p_restaurante))) then
    raise exception 'Solo puedes cambiar tu propio perfil';
  end if;
  -- Una foto (https) o un emoji corto.
  if v_avatar is not null and v_avatar !~ '^https://' and char_length(v_avatar) > 16 then
    raise exception 'El avatar debe ser una foto o un emoji';
  end if;
  update public.usuarios
  set nombre = nullif(left(trim(p_nombre), 40), ''),
      avatar = v_avatar,
      color = case when p_color ~ '^#[0-9a-fA-F]{6}$' then p_color end
  where restaurante_id = p_restaurante and user_id = p_usuario;
end;
$$;
revoke all on function public.guardar_perfil(uuid, uuid, text, text, text) from public, anon;
grant execute on function public.guardar_perfil(uuid, uuid, text, text, text) to authenticated;

-- Cada persona puede subir su propia foto a <restaurante>/equipo/<su id>-….webp (el resto, solo el administrador).
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
  if public.es_admin(carpeta::uuid) then
    return true;
  end if;
  return split_part(nombre, '/', 2) = 'equipo'
    and auth.uid() is not null
    and split_part(nombre, '/', 3) like auth.uid()::text || '-%'
    and public.es_miembro(carpeta::uuid);
end;
$$;

-- Nombres del equipo, ahora con foto o emoji, color y mesas asignadas.
drop function if exists public.nombres_equipo(uuid);
create function public.nombres_equipo(p_restaurante uuid)
returns table (user_id uuid, nombre text, rol text, avatar text, color text, mesas uuid[])
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_miembro(p_restaurante) then
    raise exception 'No eres parte de este equipo';
  end if;
  return query
  select u.user_id, coalesce(u.nombre, split_part(au.email::text, '@', 1)), u.rol, u.avatar, u.color,
         coalesce((select array_agg(m.id) from public.mesas m where m.restaurante_id = p_restaurante and m.mesero_id = u.user_id), '{}')
  from public.usuarios u join auth.users au on au.id = u.user_id
  where u.restaurante_id = p_restaurante
  order by 2;
end;
$$;
revoke all on function public.nombres_equipo(uuid) from public;
grant execute on function public.nombres_equipo(uuid) to authenticated;

drop function if exists public.equipo(uuid);
create function public.equipo(p_restaurante uuid)
returns table (user_id uuid, email text, rol text, pendiente boolean, soy_yo boolean, nombre text, avatar text, color text, mesas uuid[])
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_admin(p_restaurante) then
    raise exception 'Solo el administrador ve el equipo';
  end if;
  return query
  select u.user_id, au.email::text, u.rol, false, u.user_id = auth.uid(), u.nombre, u.avatar, u.color,
         coalesce((select array_agg(m.id) from public.mesas m where m.restaurante_id = p_restaurante and m.mesero_id = u.user_id), '{}')
  from public.usuarios u join auth.users au on au.id = u.user_id
  where u.restaurante_id = p_restaurante
  union all
  select null::uuid, i.email, i.rol, true, false, null, null, null, '{}'::uuid[]
  from public.invitaciones i where i.restaurante_id = p_restaurante
  order by 4, 2;
end;
$$;
revoke all on function public.equipo(uuid) from public, anon;
grant execute on function public.equipo(uuid) to authenticated;

-- Mi propio perfil (para el menú del panel).
create or replace function public.mi_perfil(p_restaurante uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('nombre', u.nombre, 'avatar', u.avatar, 'color', u.color)
  from public.usuarios u where u.restaurante_id = p_restaurante and u.user_id = auth.uid();
$$;
revoke all on function public.mi_perfil(uuid) from public, anon;
grant execute on function public.mi_perfil(uuid) to authenticated;

-- ─────────────────────────────────────────────
-- Mover y juntar mesas, pasar un plato de una cuenta a otra
-- ─────────────────────────────────────────────

-- Cambia la cuenta abierta a otra mesa libre.
create or replace function public.mover_cuenta(p_cuenta uuid, p_mesa uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.cuentas;
  m public.mesas;
begin
  select * into c from public.cuentas where id = p_cuenta and estado = 'abierta' for update;
  if c.id is null or not public.es_miembro(c.restaurante_id) then
    raise exception 'La cuenta ya no está abierta';
  end if;
  select * into m from public.mesas where id = p_mesa and restaurante_id = c.restaurante_id;
  if m.id is null then
    raise exception 'Esa mesa no es de este restaurante';
  end if;
  if exists (select 1 from public.cuentas where mesa_id = m.id and estado = 'abierta') then
    raise exception 'La mesa % está ocupada: usa "Juntar mesas"', m.numero;
  end if;
  update public.cuentas set mesa_id = m.id, mesa_numero = m.numero, sucursal_id = coalesce(m.sucursal_id, c.sucursal_id)
  where id = c.id;
  update public.pedidos set mesa_numero = m.numero where cuenta_id = c.id;
end;
$$;

-- Junta la cuenta de origen en la de destino: comandas, pagos y comensales. La de origen queda anulada (vacía).
create or replace function public.juntar_cuentas(p_destino uuid, p_origen uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.cuentas;
  o public.cuentas;
begin
  if p_destino = p_origen then
    raise exception 'Elige otra mesa';
  end if;
  select * into d from public.cuentas where id = p_destino and estado = 'abierta' for update;
  select * into o from public.cuentas where id = p_origen and estado = 'abierta' for update;
  if d.id is null or o.id is null or d.restaurante_id <> o.restaurante_id or not public.es_miembro(d.restaurante_id) then
    raise exception 'Las dos cuentas tienen que estar abiertas';
  end if;
  update public.pedidos set cuenta_id = d.id, mesa_numero = d.mesa_numero where cuenta_id = o.id;
  update public.pagos set cuenta_id = d.id where cuenta_id = o.id;
  update public.cuentas set comensales = least(d.comensales + o.comensales, 99) where id = d.id;
  update public.cuentas set estado = 'anulada', cerrada_at = now(), aviso = null where id = o.id;
end;
$$;

-- Pasa un plato (o parte de las unidades) a otra cuenta abierta, con su precio original.
create or replace function public.mover_item(p_item uuid, p_cuenta uuid, p_cantidad integer default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  i public.pedido_items;
  p public.pedidos;
  d public.cuentas;
  n integer;
  nuevo uuid;
begin
  select * into i from public.pedido_items where id = p_item for update;
  select * into p from public.pedidos where id = i.pedido_id;
  select * into d from public.cuentas where id = p_cuenta and estado = 'abierta';
  if i.id is null or d.id is null or d.restaurante_id <> i.restaurante_id or not public.es_miembro(i.restaurante_id) then
    raise exception 'No se pudo mover: revisa que las dos mesas estén abiertas';
  end if;
  if p.cuenta_id = d.id then
    return;
  end if;
  n := least(greatest(coalesce(p_cantidad, i.cantidad), 1), i.cantidad);

  insert into public.pedidos (restaurante_id, cuenta_id, sucursal_id, mesa_numero, estacion, origen, estado, nombre, nota,
                              creado_por, created_at)
  values (p.restaurante_id, d.id, d.sucursal_id, d.mesa_numero, p.estacion, p.origen, p.estado, p.nombre, null,
          p.creado_por, p.created_at)
  returning id into nuevo;

  perform set_config('mesitto.copiar', 'si', true);
  if n = i.cantidad then
    update public.pedido_items set pedido_id = nuevo, comensal = null where id = i.id;
  else
    update public.pedido_items set cantidad = cantidad - n where id = i.id;
    insert into public.pedido_items (pedido_id, restaurante_id, plato_id, nombre, precio, cantidad, nota, listo, opciones)
    values (nuevo, i.restaurante_id, i.plato_id, i.nombre, i.precio, n, i.nota, i.listo, i.opciones);
  end if;
  perform set_config('mesitto.copiar', '', true);

  -- La comanda de origen sin platos ya no tiene nada que mostrar.
  if not exists (select 1 from public.pedido_items where pedido_id = p.id) then
    update public.pedidos set estado = 'cancelado' where id = p.id;
  end if;
end;
$$;

revoke all on function public.mover_cuenta(uuid, uuid) from public, anon;
revoke all on function public.juntar_cuentas(uuid, uuid) from public, anon;
revoke all on function public.mover_item(uuid, uuid, integer) from public, anon;
grant execute on function public.mover_cuenta(uuid, uuid) to authenticated;
grant execute on function public.juntar_cuentas(uuid, uuid) to authenticated;
grant execute on function public.mover_item(uuid, uuid, integer) to authenticated;

-- ─────────────────────────────────────────────
-- Pedidos desde la carta: ahora con opciones
-- p_items: [{"id": "<plato>", "cantidad": 2, "nota": "sin cebolla", "opciones": [{"grupo": "Tamaño", "valor": "Grande"}]}]
-- ─────────────────────────────────────────────

create or replace function public.pedir_desde_mesa(
  p_restaurante uuid,
  p_sucursal uuid,
  p_mesa text,
  p_items jsonb,
  p_nombre text default null,
  p_nota text default null
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
  est text;
  ped uuid;
  confirmar boolean;
  total numeric := 0;
  creados integer := 0;
begin
  select * into r from public.restaurantes where id = p_restaurante and activo;
  if r.id is null or not coalesce((r.ajustes #>> '{modulos,pedidos_mesa}')::boolean, false) then
    raise exception 'Este restaurante no recibe pedidos desde la mesa';
  end if;
  m := public.buscar_mesa(p_restaurante, p_sucursal, p_mesa);
  if m.id is null then
    raise exception 'No encontramos la mesa %', p_mesa;
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    raise exception 'El pedido está vacío o es demasiado largo';
  end if;
  -- Freno contra abusos: como mucho 12 comandas por mesa cada 10 minutos.
  if (select count(*) from public.pedidos p join public.cuentas cu on cu.id = p.cuenta_id
      where cu.mesa_id = m.id and p.origen = 'cliente' and p.created_at > now() - interval '10 minutes') >= 12 then
    raise exception 'Demasiados pedidos seguidos. Llama al mesero, por favor.';
  end if;

  c := public.abrir_cuenta_mesa(m);
  confirmar := coalesce((r.ajustes ->> 'confirmar_pedidos')::boolean, false);

  -- Una comanda por estación (cocina, barra…), así cada pantalla ve solo lo suyo.
  for est in
    select distinct cat.estacion
    from jsonb_array_elements(p_items) it
    join public.platos pl on pl.id = (it ->> 'id')::uuid and pl.restaurante_id = r.id and pl.disponible
    join public.categorias cat on cat.id = pl.categoria_id
  loop
    insert into public.pedidos (restaurante_id, cuenta_id, sucursal_id, mesa_numero, estacion, origen, estado, nombre, nota)
    values (r.id, c.id, m.sucursal_id, m.numero, est, 'cliente', case when confirmar then 'pendiente' else 'nuevo' end,
            nullif(left(trim(p_nombre), 40), ''), nullif(left(trim(p_nota), 200), ''))
    returning id into ped;

    insert into public.pedido_items (pedido_id, restaurante_id, plato_id, nombre, precio, cantidad, nota, opciones)
    select ped, r.id, pl.id, pl.nombre, pl.precio,
           least(greatest(coalesce((it ->> 'cantidad')::int, 1), 1), 99),
           nullif(left(trim(it ->> 'nota'), 120), ''),
           case when jsonb_typeof(it -> 'opciones') = 'array' then it -> 'opciones' else '[]' end
    from jsonb_array_elements(p_items) it
    join public.platos pl on pl.id = (it ->> 'id')::uuid and pl.restaurante_id = r.id and pl.disponible
    join public.categorias cat on cat.id = pl.categoria_id and cat.estacion = est;
    creados := creados + 1;
  end loop;

  if creados = 0 then
    raise exception 'Los platos elegidos ya no están disponibles';
  end if;

  select coalesce(sum(i.precio * i.cantidad), 0) into total
  from public.pedido_items i join public.pedidos p on p.id = i.pedido_id
  where p.cuenta_id = c.id and p.created_at > now() - interval '5 seconds' and p.origen = 'cliente';

  -- También cuenta en las estadísticas como pedido.
  insert into public.eventos (restaurante_id, sucursal_id, tipo, mesa, total, detalle)
  select r.id, m.sucursal_id, 'pedido', m.numero, total,
         (select jsonb_agg(jsonb_build_object('id', pl.id, 'nombre', pl.nombre, 'cantidad', least(greatest(coalesce((it ->> 'cantidad')::int, 1), 1), 99)))
          from jsonb_array_elements(p_items) it join public.platos pl on pl.id = (it ->> 'id')::uuid and pl.restaurante_id = r.id);

  return jsonb_build_object('comandas', creados, 'pendiente', confirmar);
end;
$$;
grant execute on function public.pedir_desde_mesa(uuid, uuid, text, jsonb, text, text) to anon, authenticated;

create or replace function public.pedir_para_llevar(
  p_restaurante uuid,
  p_sucursal uuid,
  p_tipo text,
  p_items jsonb,
  p_nombre text,
  p_telefono text,
  p_direccion text default null,
  p_hora timestamptz default null,
  p_nota text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.restaurantes;
  c public.cuentas;
  est text;
  ped uuid;
  v_estado text;
  v_suc uuid;
  v_envio numeric := 0;
  total numeric := 0;
  creados integer := 0;
begin
  select * into r from public.restaurantes where id = p_restaurante and activo;
  if r.id is null or not coalesce((r.ajustes #>> '{modulos,llevar}')::boolean, true)
     or not coalesce((r.ajustes #>> '{llevar,online}')::boolean, false) then
    raise exception 'Este restaurante no recibe pedidos para llevar por internet';
  end if;
  if p_tipo not in ('llevar', 'delivery') then
    raise exception 'Tipo de pedido no válido';
  end if;
  if p_tipo = 'delivery' and not coalesce((r.ajustes #>> '{llevar,delivery}')::boolean, false) then
    raise exception 'Este restaurante no hace delivery';
  end if;
  if coalesce(trim(p_nombre), '') = '' or public.clave_telefono(p_telefono) is null then
    raise exception 'Faltan tu nombre o tu teléfono';
  end if;
  if p_tipo = 'delivery' and coalesce(trim(p_direccion), '') = '' then
    raise exception 'Falta la dirección de entrega';
  end if;
  if p_hora is not null and (p_hora < now() - interval '10 minutes' or p_hora > now() + interval '3 days') then
    raise exception 'Elige una hora de hoy o de los próximos días';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    raise exception 'El pedido está vacío o es demasiado largo';
  end if;
  -- Freno contra abusos: 60 pedidos por hora en el local y 4 por teléfono.
  if (select count(*) from public.cuentas where restaurante_id = r.id and origen = 'cliente' and tipo <> 'mesa'
      and abierta_at > now() - interval '1 hour') >= 60
     or (select count(*) from public.cuentas where restaurante_id = r.id and origen = 'cliente' and tipo <> 'mesa'
      and public.clave_telefono(cliente_telefono) = public.clave_telefono(p_telefono)
      and abierta_at > now() - interval '1 hour') >= 4 then
    raise exception 'Recibimos muchos pedidos seguidos. Escríbenos por WhatsApp, por favor.';
  end if;

  v_suc := (select id from public.sucursales where id = p_sucursal and restaurante_id = r.id);
  if p_tipo = 'delivery' then
    v_envio := greatest(coalesce(nullif(r.ajustes #>> '{llevar,envio}', '')::numeric, 0), 0);
  end if;
  -- Por confirmar si el local lo revisa antes, o si pide pagar primero (pasa a cocina cuando se paga).
  v_estado := case
    when coalesce((r.ajustes #>> '{llevar,confirmar}')::boolean, true)
      or coalesce((r.ajustes #>> '{llevar,pago_obligatorio}')::boolean, false) then 'pendiente'
    else 'nuevo' end;

  insert into public.cuentas (restaurante_id, sucursal_id, tipo, origen, comensales, cliente_nombre, cliente_telefono,
                              direccion, para_hora, envio, mesero_id)
  values (r.id, v_suc, p_tipo, 'cliente', 1, left(trim(p_nombre), 60), left(trim(p_telefono), 30),
          case when p_tipo = 'delivery' then left(trim(p_direccion), 200) end, p_hora, v_envio, null)
  returning * into c;

  for est in
    select distinct cat.estacion
    from jsonb_array_elements(p_items) it
    join public.platos pl on pl.id = (it ->> 'id')::uuid and pl.restaurante_id = r.id and pl.disponible
    join public.categorias cat on cat.id = pl.categoria_id
  loop
    insert into public.pedidos (restaurante_id, cuenta_id, sucursal_id, estacion, origen, estado, nombre, nota, creado_por)
    values (r.id, c.id, v_suc, est, 'cliente', v_estado, left(trim(p_nombre), 40), nullif(left(trim(p_nota), 200), ''), null)
    returning id into ped;

    insert into public.pedido_items (pedido_id, restaurante_id, plato_id, nombre, precio, cantidad, nota, opciones)
    select ped, r.id, pl.id, pl.nombre, pl.precio,
           least(greatest(coalesce((it ->> 'cantidad')::int, 1), 1), 99),
           nullif(left(trim(it ->> 'nota'), 120), ''),
           case when jsonb_typeof(it -> 'opciones') = 'array' then it -> 'opciones' else '[]' end
    from jsonb_array_elements(p_items) it
    join public.platos pl on pl.id = (it ->> 'id')::uuid and pl.restaurante_id = r.id and pl.disponible
    join public.categorias cat on cat.id = pl.categoria_id and cat.estacion = est;
    creados := creados + 1;
  end loop;

  if creados = 0 then
    raise exception 'Los platos elegidos ya no están disponibles';
  end if;

  select coalesce(sum(i.precio * i.cantidad), 0) into total
  from public.pedido_items i join public.pedidos p on p.id = i.pedido_id
  where p.cuenta_id = c.id;

  insert into public.eventos (restaurante_id, sucursal_id, tipo, total, detalle)
  select r.id, v_suc, 'pedido', total,
         (select jsonb_agg(jsonb_build_object('id', pl.id, 'nombre', pl.nombre, 'cantidad', least(greatest(coalesce((it ->> 'cantidad')::int, 1), 1), 99)))
          from jsonb_array_elements(p_items) it join public.platos pl on pl.id = (it ->> 'id')::uuid and pl.restaurante_id = r.id);

  return jsonb_build_object('id', c.id, 'pendiente', v_estado = 'pendiente');
end;
$$;
grant execute on function public.pedir_para_llevar(uuid, uuid, text, jsonb, text, text, text, timestamptz, text) to anon, authenticated;

-- Lo que el cliente ve de su mesa (ahora con las opciones de cada plato).
create or replace function public.mi_mesa(p_restaurante uuid, p_sucursal uuid, p_mesa text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  m public.mesas;
  c public.cuentas;
begin
  m := public.buscar_mesa(p_restaurante, p_sucursal, p_mesa);
  if m.id is null then
    return null;
  end if;
  select * into c from public.cuentas where mesa_id = m.id and estado = 'abierta';
  return jsonb_build_object(
    'mesa', m.numero,
    'capacidad', m.capacidad,
    'cuenta', case when c.id is null then null else jsonb_build_object(
      'comensales', c.comensales,
      'aviso', c.aviso,
      'pagado', (select coalesce(sum(monto), 0) from public.pagos where cuenta_id = c.id),
      'pedidos', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'numero', p.numero, 'estado', p.estado, 'estacion', p.estacion, 'hora', p.created_at,
          'items', (select coalesce(jsonb_agg(jsonb_build_object(
              'nombre', i.nombre, 'precio', i.precio, 'cantidad', i.cantidad, 'comensal', i.comensal, 'opciones', i.opciones
            ) order by i.created_at), '[]') from public.pedido_items i where i.pedido_id = p.id)
        ) order by p.created_at), '[]')
        from public.pedidos p where p.cuenta_id = c.id and p.estado <> 'cancelado'
      )
    ) end
  );
end;
$$;
grant execute on function public.mi_mesa(uuid, uuid, text) to anon, authenticated;

-- ─────────────────────────────────────────────
-- Delivery: enlace para el repartidor y "pagar al retirar" si falla Mercado Pago
-- ─────────────────────────────────────────────

alter table public.cuentas
  add column if not exists reparto_token   uuid not null default gen_random_uuid(),
  add column if not exists entregado_at    timestamptz,
  add column if not exists paga_al_retirar boolean not null default false;
create unique index if not exists cuentas_reparto_token on public.cuentas (reparto_token);

-- Seguimiento del cliente (igual que en 0014, más las opciones y si pagará al retirar).
create or replace function public.mi_pedido(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'tipo', c.tipo,
    'estado', c.estado,
    'nombre', c.cliente_nombre,
    'direccion', c.direccion,
    'para_hora', c.para_hora,
    'envio', c.envio,
    'desde', c.abierta_at,
    'despachado_at', c.despachado_at,
    'entregado_at', c.entregado_at,
    'cerrada_at', c.cerrada_at,
    'paga_al_retirar', c.paga_al_retirar,
    'zona', public.zona_restaurante(c.restaurante_id),
    'whatsapp', coalesce(s.whatsapp, r.whatsapp),
    'pagado', (select coalesce(sum(monto), 0) from public.pagos where cuenta_id = c.id),
    'pedidos', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'numero', p.numero, 'estado', p.estado,
        'items', (select coalesce(jsonb_agg(jsonb_build_object(
            'nombre', i.nombre, 'precio', i.precio, 'cantidad', i.cantidad, 'opciones', i.opciones
          ) order by i.created_at), '[]') from public.pedido_items i where i.pedido_id = p.id)
      ) order by p.created_at), '[]')
      from public.pedidos p where p.cuenta_id = c.id and p.estado <> 'cancelado'
    )
  )
  from public.cuentas c
  join public.restaurantes r on r.id = c.restaurante_id
  left join public.sucursales s on s.id = c.sucursal_id
  where c.id = p_id and c.tipo <> 'mesa' and c.abierta_at > now() - interval '3 days';
$$;
grant execute on function public.mi_pedido(uuid) to anon, authenticated;

-- Mercado Pago no anduvo: el cliente elige pagar al retirar (o al recibir). Si el local no revisa los pedidos
-- antes, pasa directo a cocina; el panel lo marca "Paga al retirar" y avisa con sonido.
create or replace function public.pagar_al_retirar(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.cuentas;
  r public.restaurantes;
begin
  select * into c from public.cuentas
  where id = p_id and tipo <> 'mesa' and origen = 'cliente' and estado = 'abierta' and abierta_at > now() - interval '1 day';
  if c.id is null then
    raise exception 'El pedido ya no está abierto';
  end if;
  select * into r from public.restaurantes where id = c.restaurante_id;
  update public.cuentas set paga_al_retirar = true where id = c.id;
  if not coalesce((r.ajustes #>> '{llevar,confirmar}')::boolean, true) then
    update public.pedidos set estado = 'nuevo' where cuenta_id = c.id and estado = 'pendiente';
  end if;
end;
$$;
revoke all on function public.pagar_al_retirar(uuid) from public;
grant execute on function public.pagar_al_retirar(uuid) to anon, authenticated;

-- Lo que ve el repartidor con su enlace: a quién, dónde, qué lleva y cuánto cobrar.
create or replace function public.ver_reparto(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'restaurante', r.nombre,
    'moneda', r.moneda,
    'nombre', c.cliente_nombre,
    'telefono', c.cliente_telefono,
    'direccion', c.direccion,
    'para_hora', c.para_hora,
    'envio', c.envio,
    'estado', c.estado,
    'despachado_at', c.despachado_at,
    'entregado_at', c.entregado_at,
    'zona', public.zona_restaurante(c.restaurante_id),
    'pais', r.ajustes ->> 'pais',
    'nota', (select string_agg(p.nota, ' · ') from public.pedidos p where p.cuenta_id = c.id and p.nota is not null),
    'numeros', (select coalesce(jsonb_agg(p.numero order by p.numero), '[]') from public.pedidos p
                where p.cuenta_id = c.id and p.estado <> 'cancelado'),
    'pagado', (select coalesce(sum(monto), 0) from public.pagos where cuenta_id = c.id),
    'total', c.envio + (select coalesce(sum(i.precio * i.cantidad), 0) from public.pedido_items i
                        join public.pedidos p on p.id = i.pedido_id where p.cuenta_id = c.id and p.estado <> 'cancelado'),
    'items', (select coalesce(jsonb_agg(jsonb_build_object('nombre', i.nombre, 'cantidad', i.cantidad, 'opciones', i.opciones)
                                        order by i.created_at), '[]')
              from public.pedido_items i join public.pedidos p on p.id = i.pedido_id
              where p.cuenta_id = c.id and p.estado <> 'cancelado')
  )
  from public.cuentas c join public.restaurantes r on r.id = c.restaurante_id
  where c.reparto_token = p_token and c.tipo = 'delivery' and c.abierta_at > now() - interval '2 days';
$$;

-- El repartidor lo entregó: si cobró, se anota el pago; si quedó pagado, el pedido se cierra.
create or replace function public.entregar_reparto(p_token uuid, p_metodo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.cuentas;
  v_total numeric;
  v_pagado numeric;
begin
  select * into c from public.cuentas
  where reparto_token = p_token and tipo = 'delivery' and estado = 'abierta' and abierta_at > now() - interval '2 days'
  for update;
  if c.id is null then
    raise exception 'Este pedido ya se cerró';
  end if;
  select c.envio + coalesce(sum(i.precio * i.cantidad), 0) into v_total
  from public.pedido_items i join public.pedidos p on p.id = i.pedido_id
  where p.cuenta_id = c.id and p.estado <> 'cancelado';
  select coalesce(sum(monto), 0) into v_pagado from public.pagos where cuenta_id = c.id;

  if v_total > v_pagado and p_metodo in ('Efectivo', 'Tarjeta', 'Transferencia') then
    insert into public.pagos (restaurante_id, cuenta_id, parte, monto, propina, metodo)
    values (c.restaurante_id, c.id, 'Repartidor', v_total - v_pagado, 0, p_metodo);
    v_pagado := v_total;
  end if;

  update public.pedidos set estado = 'entregado' where cuenta_id = c.id and estado in ('nuevo', 'preparando', 'listo');
  update public.cuentas
  set entregado_at = now(), despachado_at = coalesce(despachado_at, now()),
      estado = case when v_pagado >= v_total - 0.009 then 'cerrada' else estado end,
      cerrada_at = case when v_pagado >= v_total - 0.009 then now() else cerrada_at end
  where id = c.id;
  return jsonb_build_object('cerrado', v_pagado >= v_total - 0.009);
end;
$$;
revoke all on function public.ver_reparto(uuid) from public;
revoke all on function public.entregar_reparto(uuid, text) from public;
grant execute on function public.ver_reparto(uuid) to anon, authenticated;
grant execute on function public.entregar_reparto(uuid, text) to anon, authenticated;

-- ─────────────────────────────────────────────
-- Gastos de caja (compras chicas, propinas pagadas, etc.). Los de efectivo se restan del efectivo esperado.
-- ─────────────────────────────────────────────

create table if not exists public.gastos (
  id             uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  sucursal_id    uuid references public.sucursales (id) on delete set null,
  monto          numeric(12, 2) not null check (monto > 0),
  detalle        text not null check (char_length(detalle) between 1 and 120),
  medio          text not null default 'Efectivo' check (char_length(medio) between 1 and 30),
  registrado_por uuid references auth.users (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now()
);
create index if not exists gastos_restaurante_idx on public.gastos (restaurante_id, created_at);
alter table public.gastos enable row level security;
grant select, insert, delete on public.gastos to authenticated;

drop policy if exists "equipo: ver gastos" on public.gastos;
create policy "equipo: ver gastos" on public.gastos
  for select to authenticated using (public.es_miembro(restaurante_id));
drop policy if exists "equipo: anotar gastos" on public.gastos;
create policy "equipo: anotar gastos" on public.gastos
  for insert to authenticated with check (public.es_miembro(restaurante_id) and registrado_por = auth.uid());
drop policy if exists "admin: borrar gastos" on public.gastos;
create policy "admin: borrar gastos" on public.gastos
  for delete to authenticated using (public.es_admin(restaurante_id));
