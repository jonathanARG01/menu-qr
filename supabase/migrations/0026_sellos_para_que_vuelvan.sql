-- Platovi Sellos: "Para que vuelvan".
--   · Días de sello doble (lunes, martes…): el sello con el QR de la cuenta y el "+1" del equipo valen 2.
--   · Invitación a dejar reseña en Google después de sumar un sello (usa el enlace de Personalizar).
--   · "Te extrañamos": aviso (y sellos de regalo opcionales) a quien no vuelve en N días.
--   · Cumpleaños: sellos de regalo y saludo el día del cumpleaños.
-- Los avisos los manda la ruta /api/sellos/campanas una vez al día (cron de Vercel).
-- Se puede ejecutar más de una vez.

alter table public.sellos_programas
  add column if not exists dias_dobles smallint[] not null default '{}',
  add column if not exists pedir_resena boolean not null default true,
  add column if not exists extranamos_dias integer not null default 30,
  add column if not exists extranamos_sellos integer not null default 0,
  add column if not exists cumple_sellos integer not null default 1;

alter table public.sellos_programas drop constraint if exists sellos_programas_dias_dobles_check;
alter table public.sellos_programas add constraint sellos_programas_dias_dobles_check
  check (dias_dobles <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]);
alter table public.sellos_programas drop constraint if exists sellos_programas_extranamos_check;
alter table public.sellos_programas add constraint sellos_programas_extranamos_check
  check ((extranamos_dias = 0 or extranamos_dias between 14 and 120) and extranamos_sellos between 0 and 2);
alter table public.sellos_programas drop constraint if exists sellos_programas_cumple_check;
alter table public.sellos_programas add constraint sellos_programas_cumple_check check (cumple_sellos between 0 and 3);

-- Cuándo se le mandó el último "te extrañamos" y en qué año recibió su regalo de cumpleaños.
alter table public.sellos_tarjetas
  add column if not exists extranamos_at timestamptz,
  add column if not exists cumple_anio integer;

-- Nuevos orígenes de sellos de regalo.
alter table public.sellos_movimientos drop constraint if exists sellos_movimientos_origen_check;
alter table public.sellos_movimientos add constraint sellos_movimientos_origen_check
  check (origen in ('qr', 'manual', 'bienvenida', 'migracion', 'anulada', 'cumpleanos', 'regreso'));

-- ¿Hoy es día de sello doble en este local? (día de la semana en su zona horaria; 0 = domingo)
create or replace function public.sellos_dia_doble(p_restaurante uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    extract(dow from now() at time zone coalesce(nullif(r.ajustes ->> 'zona_horaria', ''), 'America/Santiago'))::smallint
      = any(p.dias_dobles),
    false)
  from public.restaurantes r
  join public.sellos_programas p on p.restaurante_id = r.id
  where r.id = p_restaurante;
$$;
grant execute on function public.sellos_dia_doble(uuid) to anon, authenticated;

-- La tarjeta para mostrar: igual que en 0024, más el enlace de reseña de Google (si el local lo pide) y si hoy es día doble.
create or replace function public.sellos_tarjeta(p_codigo text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.sellos_estado(t) || jsonb_build_object(
    'activa', r.activo and coalesce(p.activo, false) and public.sellos_contratado(r.id),
    'restaurante', jsonb_build_object('nombre', r.nombre, 'slug', r.slug, 'logo_url', r.logo_url, 'color', r.color_primario,
                                      'restaurante_id', r.id,
                                      'resena_url', case when coalesce(p.pedir_resena, false)
                                                          and coalesce(r.ajustes -> 'resenas' ->> 'google_url', '') ~ '^https://'
                                                         then r.ajustes -> 'resenas' ->> 'google_url' end),
    'programa', to_jsonb(p) - 'restaurante_id' - 'updated_at',
    'dia_doble', coalesce(public.sellos_dia_doble(r.id), false),
    'movimientos', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', m.tipo, 'cantidad', m.cantidad, 'origen', m.origen, 'created_at', m.created_at)
                       order by m.created_at desc)
      from (select * from public.sellos_movimientos x where x.tarjeta_id = t.id order by x.created_at desc limit 10) m
    ), '[]'::jsonb)
  )
  from public.sellos_tarjetas t
  join public.restaurantes r on r.id = t.restaurante_id
  left join public.sellos_programas p on p.restaurante_id = t.restaurante_id
  where t.codigo = upper(trim(p_codigo));
$$;
grant execute on function public.sellos_tarjeta(text) to anon, authenticated;

-- Sello con el QR de la precuenta: igual que en 0024, y en días dobles vale el doble.
create or replace function public.sellos_sumar_qr(p_tarjeta text, p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  k public.sellos_codigos;
  c public.cuentas;
  t public.sellos_tarjetas;
  p public.sellos_programas;
  zona text;
  hoy integer;
  consumo numeric;
  n integer;
  doble boolean;
begin
  select * into k from public.sellos_codigos where codigo = upper(trim(p_codigo)) for update;
  if k.codigo is null then
    raise exception 'Ese código de sello no existe';
  end if;
  select * into t from public.sellos_tarjetas where codigo = upper(trim(p_tarjeta));
  if t.id is null then
    raise exception 'No encontramos tu tarjeta';
  end if;
  if t.restaurante_id <> k.restaurante_id then
    raise exception 'Esta tarjeta es de otro local';
  end if;
  if k.usado_at is not null then
    raise exception 'Este código ya se usó';
  end if;
  if k.created_at < now() - interval '24 hours' then
    raise exception 'Este código venció (dura 24 horas)';
  end if;
  select * into p from public.sellos_programas where restaurante_id = t.restaurante_id and activo;
  if p.restaurante_id is null or not public.sellos_contratado(t.restaurante_id) then
    raise exception 'La tarjeta de sellos de este local está pausada';
  end if;
  select * into c from public.cuentas where id = k.cuenta_id;
  if c.id is null or c.estado = 'anulada' then
    raise exception 'Esa cuenta se anuló';
  end if;

  select coalesce(nullif(r.ajustes ->> 'zona_horaria', ''), 'America/Santiago') into zona
  from public.restaurantes r where r.id = t.restaurante_id;
  select count(*) into hoy from public.sellos_movimientos m
  where m.tarjeta_id = t.id and m.tipo = 'sello' and m.origen = 'qr'
    and (m.created_at at time zone zona)::date = (now() at time zone zona)::date;
  if hoy >= p.max_por_dia then
    raise exception 'Ya sumaste tu sello de hoy. ¡Te esperamos pronto!';
  end if;

  if p.regla = 'monto' then
    select coalesce(sum(i.precio * i.cantidad), 0) into consumo
    from public.pedido_items i join public.pedidos y on y.id = i.pedido_id
    where y.cuenta_id = c.id and y.estado <> 'cancelado';
    consumo := consumo + coalesce(c.envio, 0);
    n := least(20, floor(consumo / p.monto_por_sello)::integer);
    if n < 1 then
      raise exception 'Este consumo no alcanza para un sello';
    end if;
  else
    n := 1;
  end if;
  doble := extract(dow from now() at time zone zona)::smallint = any(p.dias_dobles);
  if doble then
    n := n * 2;
  end if;

  insert into public.sellos_movimientos (restaurante_id, tarjeta_id, tipo, cantidad, origen, cuenta_id, por, nota)
  values (t.restaurante_id, t.id, 'sello', n, 'qr', c.id, null, case when doble then 'Día de sello doble' end);
  t := public.sellos_aplicar(t.id, n);
  update public.sellos_codigos set usado_at = now(), tarjeta_id = t.id where codigo = k.codigo;
  if c.cliente_id is null and t.cliente_id is not null then
    update public.cuentas set cliente_id = t.cliente_id where id = c.id;
  end if;
  return public.sellos_estado(t) || jsonb_build_object('sumados', n, 'doble', doble);
end;
$$;
grant execute on function public.sellos_sumar_qr(text, text) to anon, authenticated;

-- Sumar o quitar a mano: igual que en 0024; el "+1 sello" en día doble suma 2.
create or replace function public.sellos_sumar_manual(p_tarjeta text, p_cantidad integer, p_pin text default null, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.sellos_tarjetas;
  quien uuid;
  n integer := p_cantidad;
  doble boolean := false;
begin
  select * into t from public.sellos_tarjetas where codigo = upper(trim(p_tarjeta));
  if t.id is null then
    raise exception 'No encontramos esa tarjeta';
  end if;
  quien := public.exigir_pin(t.restaurante_id, p_pin);
  if not public.sellos_contratado(t.restaurante_id) then
    raise exception 'Tarjeta de sellos no contratada';
  end if;
  if coalesce(p_cantidad, 0) = 0 or abs(p_cantidad) > 30 then
    raise exception 'Cantidad de sellos no válida';
  end if;
  if p_cantidad = 1 and coalesce(public.sellos_dia_doble(t.restaurante_id), false) then
    n := 2;
    doble := true;
  end if;
  insert into public.sellos_movimientos (restaurante_id, tarjeta_id, tipo, cantidad, origen, autorizado_por, nota)
  values (t.restaurante_id, t.id, case when n > 0 then 'sello' else 'ajuste' end, n, 'manual', quien,
          coalesce(left(nullif(trim(p_motivo), ''), 120), case when doble then 'Día de sello doble' end));
  t := public.sellos_aplicar(t.id, n);
  return public.sellos_estado(t) || jsonb_build_object('sumados', n, 'doble', doble);
end;
$$;
grant execute on function public.sellos_sumar_manual(text, integer, text, text) to authenticated;

-- Regalos del día ("te extrañamos" y cumpleaños). Solo la clave de servicio (cron diario). Marca cada tarjeta para
-- no repetir, suma los sellos de regalo y devuelve a quién avisar. Solo a quien aceptó avisos o los activó en su celular.
create or replace function public.sellos_campanas_del_dia()
returns table (codigo text, tipo text, regalo integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  f record;
  hoy date;
begin
  -- Cumpleaños (en la zona horaria del local; el 29 de febrero se celebra el 28 en años no bisiestos).
  for f in
    select t.id, t.codigo, t.cumpleanos, t.cumple_anio, p.cumple_sellos,
           (now() at time zone coalesce(nullif(r.ajustes ->> 'zona_horaria', ''), 'America/Santiago'))::date as dia
    from public.sellos_tarjetas t
    join public.restaurantes r on r.id = t.restaurante_id and r.activo
    join public.sellos_programas p on p.restaurante_id = t.restaurante_id and p.activo
    where t.cumpleanos is not null
      and public.sellos_contratado(t.restaurante_id)
      and (t.acepta_avisos or exists (select 1 from public.sellos_push s where s.tarjeta_id = t.id))
  loop
    hoy := f.dia;
    continue when f.cumple_anio is not distinct from extract(year from hoy)::integer;
    continue when not (
      to_char(f.cumpleanos, 'MM-DD') = to_char(hoy, 'MM-DD')
      or (to_char(f.cumpleanos, 'MM-DD') = '02-29' and to_char(hoy, 'MM-DD') = '02-28'
          and extract(day from (make_date(extract(year from hoy)::integer, 3, 1) - 1))::integer = 28)
    );
    update public.sellos_tarjetas set cumple_anio = extract(year from hoy)::integer where id = f.id;
    if f.cumple_sellos > 0 then
      insert into public.sellos_movimientos (restaurante_id, tarjeta_id, tipo, cantidad, origen, por, nota)
      select restaurante_id, id, 'sello', f.cumple_sellos, 'cumpleanos', null, 'Regalo de cumpleaños'
      from public.sellos_tarjetas where id = f.id;
      perform public.sellos_aplicar(f.id, f.cumple_sellos);
    end if;
    codigo := f.codigo; tipo := 'cumpleanos'; regalo := f.cumple_sellos;
    return next;
  end loop;

  -- Te extrañamos: sin visitas (sello con QR o del equipo) en N días, una vez por cada ausencia.
  for f in
    select t.id, t.codigo, p.extranamos_sellos
    from public.sellos_tarjetas t
    join public.restaurantes r on r.id = t.restaurante_id and r.activo
    join public.sellos_programas p on p.restaurante_id = t.restaurante_id and p.activo and p.extranamos_dias > 0
    cross join lateral (
      select coalesce(max(m.created_at), t.created_at) as visita
      from public.sellos_movimientos m
      where m.tarjeta_id = t.id and m.tipo = 'sello' and m.origen in ('qr', 'manual')
    ) v
    where public.sellos_contratado(t.restaurante_id)
      and (t.acepta_avisos or exists (select 1 from public.sellos_push s where s.tarjeta_id = t.id))
      and v.visita < now() - make_interval(days => p.extranamos_dias)
      and (t.extranamos_at is null or t.extranamos_at < v.visita)
    limit 2000
  loop
    update public.sellos_tarjetas set extranamos_at = now() where id = f.id;
    if f.extranamos_sellos > 0 then
      insert into public.sellos_movimientos (restaurante_id, tarjeta_id, tipo, cantidad, origen, por, nota)
      select restaurante_id, id, 'sello', f.extranamos_sellos, 'regreso', null, 'Te extrañamos'
      from public.sellos_tarjetas where id = f.id;
      perform public.sellos_aplicar(f.id, f.extranamos_sellos);
    end if;
    codigo := f.codigo; tipo := 'extranamos'; regalo := f.extranamos_sellos;
    return next;
  end loop;
end;
$$;
revoke all on function public.sellos_campanas_del_dia() from public, anon, authenticated;
grant execute on function public.sellos_campanas_del_dia() to service_role;

notify pgrst, 'reload schema';
