-- ═════════════════════════════════════════════
-- 0020: "para después" desde la carta del cliente
--
-- El cliente marca platos "para después" (el postre, el café): llegan al mesero como comanda en espera
-- y no pasan a cocina hasta que el cliente toca "Pedir ahora" en Mi mesa (o el mesero los marcha).
-- Se puede ejecutar más de una vez.
-- ═════════════════════════════════════════════

-- p_items: [{"id": "<plato>", "cantidad": 2, "opciones": [...], "despues": true}]
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
  luego boolean;
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

  -- Una comanda por estación (cocina, barra…), así cada pantalla ve solo lo suyo. Lo que el cliente marcó
  -- "para después" va en otra comanda que queda en espera hasta que él (o el mesero) la pida.
  for est, luego in
    select distinct cat.estacion, coalesce((it ->> 'despues')::boolean, false)
    from jsonb_array_elements(p_items) it
    join public.platos pl on pl.id = (it ->> 'id')::uuid and pl.restaurante_id = r.id and pl.disponible
    join public.categorias cat on cat.id = pl.categoria_id
  loop
    insert into public.pedidos (restaurante_id, cuenta_id, sucursal_id, mesa_numero, estacion, origen, estado, nombre, nota)
    values (r.id, c.id, m.sucursal_id, m.numero, est, 'cliente',
            case when luego then 'retenido' when confirmar then 'pendiente' else 'nuevo' end,
            nullif(left(trim(p_nombre), 40), ''), nullif(left(trim(p_nota), 200), ''))
    returning id into ped;

    insert into public.pedido_items (pedido_id, restaurante_id, plato_id, nombre, precio, cantidad, nota, opciones)
    select ped, r.id, pl.id, pl.nombre, pl.precio,
           least(greatest(coalesce((it ->> 'cantidad')::int, 1), 1), 99),
           nullif(left(trim(it ->> 'nota'), 120), ''),
           case when jsonb_typeof(it -> 'opciones') = 'array' then it -> 'opciones' else '[]' end
    from jsonb_array_elements(p_items) it
    join public.platos pl on pl.id = (it ->> 'id')::uuid and pl.restaurante_id = r.id and pl.disponible
    join public.categorias cat on cat.id = pl.categoria_id and cat.estacion = est
    where coalesce((it ->> 'despues')::boolean, false) = luego;
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
grant execute on function public.pedir_desde_mesa(uuid, uuid, text, jsonb, text, text) to anon, authenticated;

-- Mi mesa: ahora con el id de cada comanda y quién la hizo (para que el cliente pida lo que dejó para después).
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
          'id', p.id, 'origen', p.origen,
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

-- El cliente pide ahora lo que había dejado para después (solo comandas suyas de su mesa).
create or replace function public.pedir_ahora(p_restaurante uuid, p_sucursal uuid, p_mesa text, p_pedido uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.restaurantes;
  m public.mesas;
  c public.cuentas;
begin
  select * into r from public.restaurantes where id = p_restaurante and activo;
  m := public.buscar_mesa(p_restaurante, p_sucursal, p_mesa);
  if r.id is null or m.id is null then
    return false;
  end if;
  select * into c from public.cuentas where mesa_id = m.id and estado = 'abierta';
  if c.id is null then
    return false;
  end if;
  update public.pedidos
  set estado = case when coalesce((r.ajustes ->> 'confirmar_pedidos')::boolean, false) then 'pendiente' else 'nuevo' end,
      created_at = now()
  where id = p_pedido and cuenta_id = c.id and origen = 'cliente' and estado = 'retenido';
  return found;
end;
$$;
revoke all on function public.pedir_ahora(uuid, uuid, text, uuid) from public;
grant execute on function public.pedir_ahora(uuid, uuid, text, uuid) to anon, authenticated;
