-- Menús QR · gestión de salón: roles del equipo, plano de mesas por pisos, comandas en tiempo real,
-- cuentas divididas, propinas y panel a medida.
-- Requiere 0001, 0002 y 0003. Ejecutar en Supabase: SQL Editor > New query > pegar y ejecutar.

-- ─────────────────────────────────────────────
-- Roles del equipo
--   dueno   → administrador: carta, precios, marca, plano, equipo y ajustes
--   staff   → soporte del servicio (superadmin): igual que el administrador
--   mesero  → toma y modifica pedidos, abre y cobra mesas
--   cocina  → ve las comandas y las marca en preparación o listas
-- ─────────────────────────────────────────────

alter table public.usuarios drop constraint if exists usuarios_rol_check;
alter table public.usuarios add constraint usuarios_rol_check check (rol in ('dueno', 'staff', 'mesero', 'cocina'));

create or replace function public.es_admin(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuarios u
    where u.restaurante_id = rid and u.user_id = auth.uid() and u.rol in ('dueno', 'staff')
  );
$$;
grant execute on function public.es_admin(uuid) to anon, authenticated;

-- Solo el administrador cambia la carta, los precios, la marca, las sucursales y el plano.
-- Todo el equipo puede leerlos (el mesero necesita la carta para tomar pedidos).
drop policy if exists "miembro: editar su restaurante" on public.restaurantes;
drop policy if exists "admin: editar su restaurante" on public.restaurantes;
create policy "admin: editar su restaurante" on public.restaurantes
  for update to authenticated using (public.es_admin(id)) with check (public.es_admin(id));

do $$
declare
  t text;
begin
  foreach t in array array['categorias', 'platos', 'mesas', 'sucursales'] loop
    execute format('drop policy if exists "miembro: todo en %1$s" on public.%1$I', t);
    execute format('drop policy if exists "miembro: ver %1$s" on public.%1$I', t);
    execute format('drop policy if exists "admin: crear %1$s" on public.%1$I', t);
    execute format('drop policy if exists "admin: editar %1$s" on public.%1$I', t);
    execute format('drop policy if exists "admin: borrar %1$s" on public.%1$I', t);
    execute format('create policy "miembro: ver %1$s" on public.%1$I for select to authenticated using (public.es_miembro(restaurante_id))', t);
    execute format('create policy "admin: crear %1$s" on public.%1$I for insert to authenticated with check (public.es_admin(restaurante_id))', t);
    execute format('create policy "admin: editar %1$s" on public.%1$I for update to authenticated using (public.es_admin(restaurante_id)) with check (public.es_admin(restaurante_id))', t);
    execute format('create policy "admin: borrar %1$s" on public.%1$I for delete to authenticated using (public.es_admin(restaurante_id))', t);
  end loop;
end;
$$;

-- Las fotos también las sube solo el administrador.
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
  return public.es_admin(carpeta::uuid);
end;
$$;

-- /unirse es la página de alta del equipo: ningún restaurante puede usar esa dirección.
alter table public.restaurantes drop constraint if exists slug_reservado;
alter table public.restaurantes add constraint slug_reservado check (slug not in (
  'admin', 'api', 'auth', 'login', 'logout', 'panel', 'registro', 'recuperar',
  'nueva-clave', 'precios', 'planes', 'ayuda', 'soporte', 'terminos', 'privacidad', 'demo-admin', 'unirse'
));

-- ─────────────────────────────────────────────
-- Ajustes del panel (qué secciones se usan, propinas, medios de pago, estaciones)
-- y estación de cada categoría (cocina, barra…): cada comanda va a su pantalla.
-- ─────────────────────────────────────────────

alter table public.restaurantes
  add column if not exists ajustes jsonb not null default '{}' check (jsonb_typeof(ajustes) = 'object');
grant update (ajustes) on public.restaurantes to authenticated;

alter table public.categorias
  add column if not exists estacion text not null default 'Cocina' check (char_length(estacion) between 1 and 30);

-- ─────────────────────────────────────────────
-- Plano: pisos (o salones) con su cuadrícula, y la posición de cada mesa
-- "elementos" guarda pasillos, paredes, barra, baños, etc.:
--   [{"id": "...", "tipo": "pasillo", "x": 0, "y": 5, "ancho": 20, "alto": 2, "texto": "Pasillo"}]
-- ─────────────────────────────────────────────

create table if not exists public.pisos (
  id             uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  sucursal_id    uuid references public.sucursales (id) on delete cascade,
  nombre         text not null check (char_length(nombre) between 1 and 40),
  orden          integer not null default 0,
  columnas       integer not null default 24 check (columnas between 8 and 60),
  filas          integer not null default 16 check (filas between 6 and 40),
  norte          text not null default 'arriba' check (norte in ('arriba', 'derecha', 'abajo', 'izquierda')),
  elementos      jsonb not null default '[]' check (jsonb_typeof(elementos) = 'array'),
  created_at     timestamptz not null default now()
);
create index if not exists pisos_restaurante_idx on public.pisos (restaurante_id, orden);

alter table public.mesas
  add column if not exists piso_id   uuid references public.pisos (id) on delete set null,
  add column if not exists x         integer not null default 0 check (x between 0 and 59),
  add column if not exists y         integer not null default 0 check (y between 0 and 39),
  add column if not exists ancho     integer not null default 2 check (ancho between 1 and 12),
  add column if not exists alto      integer not null default 2 check (alto between 1 and 12),
  add column if not exists forma     text not null default 'cuadrada' check (forma in ('cuadrada', 'redonda', 'rectangular')),
  add column if not exists capacidad integer not null default 4 check (capacidad between 1 and 40);

-- La sucursal y el piso de una mesa son del mismo restaurante.
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
  if new.piso_id is not null and not exists (
    select 1 from public.pisos p where p.id = new.piso_id and p.restaurante_id = new.restaurante_id
  ) then
    raise exception 'El piso no pertenece a este restaurante';
  end if;
  return new;
end;
$$;

drop trigger if exists mesas_sucursal_coherente on public.mesas;
create trigger mesas_sucursal_coherente
  before insert or update of sucursal_id, piso_id, restaurante_id on public.mesas
  for each row execute function public.validar_mesa_sucursal();

create or replace function public.validar_piso_sucursal()
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

drop trigger if exists pisos_sucursal_coherente on public.pisos;
create trigger pisos_sucursal_coherente
  before insert or update of sucursal_id, restaurante_id on public.pisos
  for each row execute function public.validar_piso_sucursal();

alter table public.pisos enable row level security;
grant select, insert, update, delete on public.pisos to authenticated;
drop policy if exists "miembro: ver pisos" on public.pisos;
create policy "miembro: ver pisos" on public.pisos for select to authenticated using (public.es_miembro(restaurante_id));
drop policy if exists "admin: todo en pisos" on public.pisos;
create policy "admin: todo en pisos" on public.pisos
  for all to authenticated using (public.es_admin(restaurante_id)) with check (public.es_admin(restaurante_id));

-- ─────────────────────────────────────────────
-- Cuentas (una por mesa ocupada), pedidos (comandas) y pagos
-- ─────────────────────────────────────────────

create table if not exists public.cuentas (
  id             uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  sucursal_id    uuid references public.sucursales (id) on delete set null,
  mesa_id        uuid references public.mesas (id) on delete set null,
  mesa_numero    text check (char_length(mesa_numero) <= 12),
  estado         text not null default 'abierta' check (estado in ('abierta', 'cerrada', 'anulada')),
  comensales     integer not null default 1 check (comensales between 1 and 99),
  -- Aviso desde la carta: {"tipo": "cuenta" | "mozo", "detalle": {...}, "at": "..."}
  aviso          jsonb check (aviso is null or jsonb_typeof(aviso) = 'object'),
  abierta_por    uuid references auth.users (id) on delete set null,
  abierta_at     timestamptz not null default now(),
  cerrada_at     timestamptz
);
create unique index if not exists cuentas_mesa_abierta on public.cuentas (mesa_id) where estado = 'abierta';
create index if not exists cuentas_restaurante_idx on public.cuentas (restaurante_id, estado, abierta_at);

create table if not exists public.pedidos (
  id             uuid primary key default gen_random_uuid(),
  numero         bigint generated always as identity,
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  cuenta_id      uuid references public.cuentas (id) on delete cascade,
  sucursal_id    uuid references public.sucursales (id) on delete set null,
  mesa_numero    text check (char_length(mesa_numero) <= 12),
  estacion       text not null default 'Cocina' check (char_length(estacion) between 1 and 30),
  origen         text not null default 'personal' check (origen in ('cliente', 'personal')),
  -- pendiente: lo pidió el cliente y espera que el mesero lo confirme (si así lo eligió el restaurante)
  estado         text not null default 'nuevo'
                 check (estado in ('pendiente', 'nuevo', 'preparando', 'listo', 'entregado', 'cancelado')),
  nombre         text check (char_length(nombre) <= 40),
  nota           text check (char_length(nota) <= 200),
  creado_por     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);
create index if not exists pedidos_restaurante_idx on public.pedidos (restaurante_id, estado, created_at);
create index if not exists pedidos_cuenta_idx on public.pedidos (cuenta_id);

create table if not exists public.pedido_items (
  id             uuid primary key default gen_random_uuid(),
  pedido_id      uuid not null references public.pedidos (id) on delete cascade,
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  plato_id       uuid references public.platos (id) on delete set null,
  nombre         text not null check (char_length(nombre) between 1 and 80),
  precio         numeric(10, 2) not null default 0 check (precio >= 0),
  cantidad       integer not null default 1 check (cantidad between 1 and 99),
  nota           text check (char_length(nota) <= 120),
  -- Quién lo consumió (1, 2, 3…) para dividir por consumo; vacío = compartido.
  comensal       integer check (comensal between 1 and 99),
  listo          boolean not null default false,
  created_at     timestamptz not null default now()
);
create index if not exists pedido_items_pedido_idx on public.pedido_items (pedido_id);

create table if not exists public.pagos (
  id             uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  cuenta_id      uuid not null references public.cuentas (id) on delete cascade,
  parte          text check (char_length(parte) <= 40),
  monto          numeric(12, 2) not null default 0 check (monto >= 0),
  propina        numeric(12, 2) not null default 0 check (propina >= 0),
  metodo         text not null check (char_length(metodo) between 1 and 30),
  propina_metodo text check (char_length(propina_metodo) <= 30),
  registrado_por uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists pagos_cuenta_idx on public.pagos (cuenta_id);
create index if not exists pagos_restaurante_idx on public.pagos (restaurante_id, created_at);

-- Coherencia: la cuenta, el pedido y el plato son del mismo restaurante.
create or replace function public.validar_pedido()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.cuenta_id is not null and not exists (
    select 1 from public.cuentas c where c.id = new.cuenta_id and c.restaurante_id = new.restaurante_id
  ) then
    raise exception 'La cuenta no pertenece a este restaurante';
  end if;
  new.actualizado_at := now();
  return new;
end;
$$;

drop trigger if exists pedidos_coherente on public.pedidos;
create trigger pedidos_coherente
  before insert or update on public.pedidos
  for each row execute function public.validar_pedido();

-- El precio y el nombre de cada línea salen siempre de la carta: un mesero no puede cambiarlos.
-- Solo el administrador puede cargar algo fuera de la carta o corregir un precio.
create or replace function public.validar_pedido_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.platos;
begin
  if not exists (
    select 1 from public.pedidos x where x.id = new.pedido_id and x.restaurante_id = new.restaurante_id
  ) then
    raise exception 'El pedido no pertenece a este restaurante';
  end if;

  if tg_op = 'UPDATE' and not public.es_admin(new.restaurante_id) then
    new.plato_id := old.plato_id;
    new.nombre := old.nombre;
    new.precio := old.precio;
    return new;
  end if;

  if new.plato_id is not null and (tg_op = 'INSERT' or new.plato_id is distinct from old.plato_id or not public.es_admin(new.restaurante_id)) then
    select * into p from public.platos where id = new.plato_id and restaurante_id = new.restaurante_id;
    if not found then
      raise exception 'Ese plato no es de este restaurante';
    end if;
    new.nombre := p.nombre;
    new.precio := p.precio;
  elsif new.plato_id is null and not public.es_admin(new.restaurante_id) then
    raise exception 'Solo un administrador puede cargar algo fuera de la carta';
  end if;
  return new;
end;
$$;

drop trigger if exists pedido_items_coherente on public.pedido_items;
create trigger pedido_items_coherente
  before insert or update on public.pedido_items
  for each row execute function public.validar_pedido_item();

create or replace function public.validar_pago()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.cuentas c where c.id = new.cuenta_id and c.restaurante_id = new.restaurante_id
  ) then
    raise exception 'La cuenta no pertenece a este restaurante';
  end if;
  return new;
end;
$$;

drop trigger if exists pagos_coherente on public.pagos;
create trigger pagos_coherente
  before insert or update on public.pagos
  for each row execute function public.validar_pago();

alter table public.cuentas      enable row level security;
alter table public.pedidos      enable row level security;
alter table public.pedido_items enable row level security;
alter table public.pagos        enable row level security;

grant select, insert, update on public.cuentas, public.pedidos, public.pedido_items, public.pagos to authenticated;
grant delete on public.pedido_items, public.pagos to authenticated;

-- Todo el equipo trabaja con cuentas y pedidos. Borrar un pago solo lo hace el administrador.
drop policy if exists "equipo: cuentas" on public.cuentas;
create policy "equipo: cuentas" on public.cuentas
  for all to authenticated using (public.es_miembro(restaurante_id)) with check (public.es_miembro(restaurante_id));
drop policy if exists "equipo: pedidos" on public.pedidos;
create policy "equipo: pedidos" on public.pedidos
  for all to authenticated using (public.es_miembro(restaurante_id)) with check (public.es_miembro(restaurante_id));
drop policy if exists "equipo: lineas de pedido" on public.pedido_items;
create policy "equipo: lineas de pedido" on public.pedido_items
  for all to authenticated using (public.es_miembro(restaurante_id)) with check (public.es_miembro(restaurante_id));
drop policy if exists "equipo: ver pagos" on public.pagos;
create policy "equipo: ver pagos" on public.pagos
  for select to authenticated using (public.es_miembro(restaurante_id));
drop policy if exists "equipo: cobrar" on public.pagos;
create policy "equipo: cobrar" on public.pagos
  for insert to authenticated with check (public.es_miembro(restaurante_id));
drop policy if exists "admin: corregir pagos" on public.pagos;
create policy "admin: corregir pagos" on public.pagos
  for delete to authenticated using (public.es_admin(restaurante_id));

-- Tiempo real: la pantalla de cocina y el salón se actualizan solos.
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['pedidos', 'pedido_items', 'cuentas'] loop
      if not exists (
        select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end;
$$;

-- ─────────────────────────────────────────────
-- Desde la carta (cliente con el QR de la mesa)
-- ─────────────────────────────────────────────

-- Mesa del QR: por número y sucursal (si la mesa no tiene sucursal, vale para todas).
create or replace function public.buscar_mesa(p_restaurante uuid, p_sucursal uuid, p_mesa text)
returns public.mesas
language sql
stable
security definer
set search_path = public
as $$
  select m.* from public.mesas m
  join public.restaurantes r on r.id = m.restaurante_id and r.activo
  where m.restaurante_id = p_restaurante and m.numero = trim(p_mesa)
    and (m.sucursal_id is null or p_sucursal is null or m.sucursal_id = p_sucursal)
  order by (m.sucursal_id is not distinct from p_sucursal) desc
  limit 1;
$$;

-- Lo que el cliente ve de su mesa: lo pedido, el estado de cada comanda y lo ya pagado.
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
              'nombre', i.nombre, 'precio', i.precio, 'cantidad', i.cantidad, 'comensal', i.comensal
            ) order by i.created_at), '[]') from public.pedido_items i where i.pedido_id = p.id)
        ) order by p.created_at), '[]')
        from public.pedidos p where p.cuenta_id = c.id and p.estado <> 'cancelado'
      )
    ) end
  );
end;
$$;

-- Abre la cuenta de la mesa si no hay una abierta.
create or replace function public.abrir_cuenta_mesa(m public.mesas, p_comensales integer default null)
returns public.cuentas
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.cuentas;
begin
  select * into c from public.cuentas where mesa_id = m.id and estado = 'abierta';
  if c.id is null then
    insert into public.cuentas (restaurante_id, sucursal_id, mesa_id, mesa_numero, comensales)
    values (m.restaurante_id, m.sucursal_id, m.id, m.numero, least(greatest(coalesce(p_comensales, m.capacidad), 1), 99))
    on conflict (mesa_id) where estado = 'abierta' do nothing
    returning * into c;
    if c.id is null then
      select * into c from public.cuentas where mesa_id = m.id and estado = 'abierta';
    end if;
  end if;
  return c;
end;
$$;
revoke all on function public.abrir_cuenta_mesa(public.mesas, integer) from public, anon, authenticated;

-- El cliente manda su pedido a cocina desde la carta. Los precios salen de la carta, no del teléfono.
-- p_items: [{"id": "<plato>", "cantidad": 2, "nota": "sin cebolla"}]
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

    insert into public.pedido_items (pedido_id, restaurante_id, plato_id, nombre, precio, cantidad, nota)
    select ped, r.id, pl.id, pl.nombre, pl.precio,
           least(greatest(coalesce((it ->> 'cantidad')::int, 1), 1), 99),
           nullif(left(trim(it ->> 'nota'), 120), '')
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

-- El cliente pide la cuenta (con cómo quiere dividirla y la propina) o llama al mozo.
create or replace function public.avisar_desde_mesa(p_restaurante uuid, p_sucursal uuid, p_mesa text, p_tipo text, p_detalle jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.mesas;
  c public.cuentas;
begin
  if p_tipo not in ('cuenta', 'mozo') then
    raise exception 'Aviso no válido';
  end if;
  if p_detalle is not null and (jsonb_typeof(p_detalle) <> 'object' or length(p_detalle::text) > 2000) then
    p_detalle := null;
  end if;
  m := public.buscar_mesa(p_restaurante, p_sucursal, p_mesa);
  if m.id is null then
    raise exception 'No encontramos la mesa %', p_mesa;
  end if;
  c := public.abrir_cuenta_mesa(m);
  update public.cuentas
  set aviso = jsonb_build_object('tipo', p_tipo, 'detalle', p_detalle, 'at', now())
  where id = c.id;
end;
$$;

revoke all on function public.buscar_mesa(uuid, uuid, text) from public;
grant execute on function public.mi_mesa(uuid, uuid, text) to anon, authenticated;
grant execute on function public.pedir_desde_mesa(uuid, uuid, text, jsonb, text, text) to anon, authenticated;
grant execute on function public.avisar_desde_mesa(uuid, uuid, text, text, jsonb) to anon, authenticated;

-- ─────────────────────────────────────────────
-- Equipo: el administrador suma personas por correo
-- Si la persona aún no tiene cuenta, queda invitada y entra sola al registrarse con ese correo.
-- ─────────────────────────────────────────────

create table if not exists public.invitaciones (
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  email          text not null check (email = lower(email) and char_length(email) between 3 and 200),
  rol            text not null check (rol in ('dueno', 'mesero', 'cocina')),
  created_at     timestamptz not null default now(),
  primary key (restaurante_id, email)
);
-- Sin políticas: solo se usa a través de las funciones de abajo.
alter table public.invitaciones enable row level security;

create or replace function public.equipo(p_restaurante uuid)
returns table (user_id uuid, email text, rol text, pendiente boolean, soy_yo boolean)
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
  select u.user_id, au.email::text, u.rol, false, u.user_id = auth.uid()
  from public.usuarios u join auth.users au on au.id = u.user_id
  where u.restaurante_id = p_restaurante
  union all
  select null::uuid, i.email, i.rol, true, false
  from public.invitaciones i where i.restaurante_id = p_restaurante
  order by 4, 2;
end;
$$;

create or replace function public.invitar_miembro(p_restaurante uuid, p_email text, p_rol text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  correo text := lower(trim(p_email));
  uid uuid;
begin
  if not public.es_admin(p_restaurante) then
    raise exception 'Solo el administrador suma personas al equipo';
  end if;
  if p_rol not in ('dueno', 'mesero', 'cocina') then
    raise exception 'Rol no válido';
  end if;
  if correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Ese correo no parece válido';
  end if;
  select id into uid from auth.users where lower(email) = correo;
  if uid is null then
    insert into public.invitaciones (restaurante_id, email, rol) values (p_restaurante, correo, p_rol)
    on conflict (restaurante_id, email) do update set rol = excluded.rol;
    return 'invitado';
  end if;
  if exists (select 1 from public.usuarios where user_id = uid and restaurante_id = p_restaurante) then
    perform public.cambiar_rol(p_restaurante, uid, p_rol);
    return 'actualizado';
  end if;
  insert into public.usuarios (user_id, restaurante_id, rol) values (uid, p_restaurante, p_rol);
  return 'agregado';
end;
$$;

create or replace function public.cambiar_rol(p_restaurante uuid, p_usuario uuid, p_rol text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin(p_restaurante) then
    raise exception 'Solo el administrador cambia roles';
  end if;
  if p_rol not in ('dueno', 'mesero', 'cocina') then
    raise exception 'Rol no válido';
  end if;
  if p_rol <> 'dueno' and not exists (
    select 1 from public.usuarios
    where restaurante_id = p_restaurante and rol = 'dueno' and user_id <> p_usuario
  ) then
    raise exception 'El restaurante tiene que quedar con al menos un administrador';
  end if;
  update public.usuarios set rol = p_rol
  where restaurante_id = p_restaurante and user_id = p_usuario and rol <> 'staff';
end;
$$;

create or replace function public.quitar_miembro(p_restaurante uuid, p_usuario uuid, p_email text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin(p_restaurante) then
    raise exception 'Solo el administrador quita personas del equipo';
  end if;
  if p_usuario is null then
    delete from public.invitaciones where restaurante_id = p_restaurante and email = lower(trim(p_email));
    return;
  end if;
  if not exists (
    select 1 from public.usuarios
    where restaurante_id = p_restaurante and rol = 'dueno' and user_id <> p_usuario
  ) and exists (
    select 1 from public.usuarios where restaurante_id = p_restaurante and user_id = p_usuario and rol = 'dueno'
  ) then
    raise exception 'El restaurante tiene que quedar con al menos un administrador';
  end if;
  delete from public.usuarios where restaurante_id = p_restaurante and user_id = p_usuario and rol <> 'staff';
end;
$$;

-- Al entrar, la persona invitada pasa a ser parte del equipo.
create or replace function public.aceptar_invitaciones()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  correo text;
  n integer;
begin
  select lower(email) into correo from auth.users where id = auth.uid();
  if correo is null then
    return 0;
  end if;
  insert into public.usuarios (user_id, restaurante_id, rol)
  select auth.uid(), i.restaurante_id, i.rol from public.invitaciones i where i.email = correo
  on conflict do nothing;
  get diagnostics n = row_count;
  delete from public.invitaciones where email = correo;
  return n;
end;
$$;

revoke all on function public.equipo(uuid) from public, anon;
revoke all on function public.invitar_miembro(uuid, text, text) from public, anon;
revoke all on function public.cambiar_rol(uuid, uuid, text) from public, anon;
revoke all on function public.quitar_miembro(uuid, uuid, text) from public, anon;
revoke all on function public.aceptar_invitaciones() from public, anon;
grant execute on function public.equipo(uuid) to authenticated;
grant execute on function public.invitar_miembro(uuid, text, text) to authenticated;
grant execute on function public.cambiar_rol(uuid, uuid, text) to authenticated;
grant execute on function public.quitar_miembro(uuid, uuid, text) to authenticated;
grant execute on function public.aceptar_invitaciones() to authenticated;
