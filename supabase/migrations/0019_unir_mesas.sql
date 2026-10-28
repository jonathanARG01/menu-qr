-- ═════════════════════════════════════════════
-- 0019: unir mesas (mesas pegadas que comparten una sola cuenta)
--
-- "Juntar" ahora tiene dos casos:
--   · Se pasan a esta mesa: la otra cuenta se suma aquí y esa mesa queda libre (juntar_cuentas, de 0018).
--   · Unir las mesas: la otra mesa queda ocupada y unida a esta cuenta. En el plano se pega al lado y se puede
--     arrastrar (posición solo mientras dure la cuenta). Al cerrar o anular la cuenta, quedan libres y en su lugar.
-- Quien escanea el QR de una mesa unida pide, ve y paga en la cuenta de la mesa principal.
-- Se puede ejecutar más de una vez.
-- ═════════════════════════════════════════════

alter table public.cuentas add column if not exists mesas_unidas uuid[] not null default '{}';
-- Dónde quedó cada mesa unida en el plano mientras dura la cuenta: {"<mesa>": {"x": 4, "y": 2}}.
alter table public.cuentas add column if not exists posiciones jsonb not null default '{}';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cuentas_posiciones_check') then
    alter table public.cuentas add constraint cuentas_posiciones_check
      check (jsonb_typeof(posiciones) = 'object' and length(posiciones::text) <= 4000);
  end if;
end;
$$;
create index if not exists cuentas_mesas_unidas_idx on public.cuentas using gin (mesas_unidas) where estado = 'abierta';

-- La cuenta abierta que ocupa una mesa: la suya o aquella a la que está unida.
create or replace function public.cuenta_de_mesa(p_mesa uuid)
returns public.cuentas
language sql
stable
security definer
set search_path = public
as $$
  select * from public.cuentas
  where estado = 'abierta' and (mesa_id = p_mesa or p_mesa = any (mesas_unidas))
  order by (mesa_id = p_mesa) desc
  limit 1;
$$;
revoke all on function public.cuenta_de_mesa(uuid) from public, anon, authenticated;

-- El QR de una mesa unida lleva a la mesa principal: así pedir, "mi mesa", llamar al mesero y pagar
-- usan la misma cuenta sin cambiar cada función.
create or replace function public.buscar_mesa(p_restaurante uuid, p_sucursal uuid, p_mesa text)
returns public.mesas
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  m public.mesas;
  principal public.mesas;
begin
  select m2.* into m from public.mesas m2
  join public.restaurantes r on r.id = m2.restaurante_id and r.activo
  where m2.restaurante_id = p_restaurante
    and case when trim(p_mesa) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then m2.id = trim(p_mesa)::uuid
             else m2.numero = trim(p_mesa) end
    and (m2.sucursal_id is null or p_sucursal is null or m2.sucursal_id = p_sucursal)
  order by (m2.sucursal_id is not distinct from p_sucursal) desc, m2.created_at
  limit 1;
  if m.id is null then
    return m;
  end if;
  select x.* into principal from public.mesas x
  join public.cuentas c on c.mesa_id = x.id and c.estado = 'abierta' and m.id = any (c.mesas_unidas)
  limit 1;
  if principal.id is not null then
    return principal;
  end if;
  return m;
end;
$$;
revoke all on function public.buscar_mesa(uuid, uuid, text) from public;

-- Una mesa unida a otra cuenta no se puede abrir por separado (ni cambiar una cuenta hacia ella).
create or replace function public.cuenta_mesa_libre()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_numero text;
begin
  if new.estado = 'abierta' and new.mesa_id is not null
     and (tg_op = 'INSERT' or new.mesa_id is distinct from old.mesa_id) then
    select c.mesa_numero into v_numero from public.cuentas c
    where c.estado = 'abierta' and c.id <> new.id and new.mesa_id = any (c.mesas_unidas)
    limit 1;
    if found then
      raise exception 'Esa mesa está unida a la Mesa %', v_numero;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists cuentas_mesa_libre on public.cuentas;
create trigger cuentas_mesa_libre
  before insert or update of mesa_id, estado on public.cuentas
  for each row execute function public.cuenta_mesa_libre();

-- Une otra mesa a esta cuenta. Si esa mesa tenía su propia cuenta, se suma aquí (comandas, pagos y comensales)
-- junto con las mesas que ya tuviera unidas.
create or replace function public.unir_mesa(p_cuenta uuid, p_mesa uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.cuentas;
  m public.mesas;
  otra public.cuentas;
  extra uuid[] := '{}';
begin
  select * into c from public.cuentas where id = p_cuenta and estado = 'abierta' for update;
  if c.id is null or c.mesa_id is null or not public.es_miembro(c.restaurante_id) then
    raise exception 'La cuenta ya no está abierta';
  end if;
  select * into m from public.mesas where id = p_mesa and restaurante_id = c.restaurante_id;
  if m.id is null then
    raise exception 'Esa mesa no es de este restaurante';
  end if;
  if m.id = c.mesa_id or m.id = any (c.mesas_unidas) then
    return;
  end if;

  otra := public.cuenta_de_mesa(m.id);
  if otra.id is not null then
    if otra.mesa_id <> m.id then
      raise exception 'La Mesa % ya está unida a la Mesa %', m.numero, otra.mesa_numero;
    end if;
    extra := otra.mesas_unidas;
    perform public.juntar_cuentas(c.id, otra.id);
    update public.cuentas set mesas_unidas = '{}', posiciones = '{}' where id = otra.id;
  end if;

  update public.cuentas
  set mesas_unidas = (select array_agg(distinct x) from unnest(c.mesas_unidas || m.id || extra) x where x <> c.mesa_id)
  where id = c.id;
end;
$$;

-- Separa una mesa unida: vuelve a quedar libre y a su lugar (lo pedido sigue en la cuenta principal).
create or replace function public.separar_mesa(p_cuenta uuid, p_mesa uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.cuentas;
begin
  select * into c from public.cuentas where id = p_cuenta and estado = 'abierta' for update;
  if c.id is null or not public.es_miembro(c.restaurante_id) then
    raise exception 'La cuenta ya no está abierta';
  end if;
  update public.cuentas set mesas_unidas = array_remove(mesas_unidas, p_mesa), posiciones = posiciones - p_mesa::text
  where id = c.id;
end;
$$;

-- Cambiar de mesa: la de destino tampoco puede estar unida a otra cuenta, y la nueva mesa deja de figurar como unida.
create or replace function public.mover_cuenta(p_cuenta uuid, p_mesa uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.cuentas;
  m public.mesas;
  ocupa public.cuentas;
begin
  select * into c from public.cuentas where id = p_cuenta and estado = 'abierta' for update;
  if c.id is null or not public.es_miembro(c.restaurante_id) then
    raise exception 'La cuenta ya no está abierta';
  end if;
  select * into m from public.mesas where id = p_mesa and restaurante_id = c.restaurante_id;
  if m.id is null then
    raise exception 'Esa mesa no es de este restaurante';
  end if;
  ocupa := public.cuenta_de_mesa(m.id);
  if ocupa.id is not null and ocupa.id <> c.id then
    raise exception 'La mesa % está ocupada: usa "Juntar con otra"', m.numero;
  end if;
  update public.cuentas
  set mesa_id = m.id, mesa_numero = m.numero, sucursal_id = coalesce(m.sucursal_id, c.sucursal_id),
      mesas_unidas = array_remove(mesas_unidas, m.id), posiciones = posiciones - m.id::text
  where id = c.id;
  update public.pedidos set mesa_numero = m.numero where cuenta_id = c.id;
end;
$$;

revoke all on function public.unir_mesa(uuid, uuid) from public, anon;
revoke all on function public.separar_mesa(uuid, uuid) from public, anon;
grant execute on function public.unir_mesa(uuid, uuid) to authenticated;
grant execute on function public.separar_mesa(uuid, uuid) to authenticated;
