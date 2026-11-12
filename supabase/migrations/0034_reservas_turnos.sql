-- Platovi · reservas con horarios fijos por turno, adultos y niños, ubicación (salón, terraza…) y correo.
-- Requiere 0009 (reservas) y 0014 (recordatorios). Se puede ejecutar más de una vez.
--
-- Lo que se configura (turnos, cupo, ubicaciones, si se pide correo o niños, aviso de tolerancia) vive en
-- restaurantes.ajustes.reservas y no necesita SQL. Aquí solo van las columnas nuevas y las funciones que validan.
--   turnos: [{"nombre":"Almuerzo","desde":"12:30","hasta":"15:30","cada":30,"dias":[1,2,3,4,5,6],"cupo":40}]
--           dias: 0 = domingo … 6 = sábado (vacío = todos). cupo: personas por turno (0 = sin tope).
--   ubicaciones: ["Salón interior","Terraza exterior"] · ninos: true · correo: "no" | "opcional" | "obligatorio"

alter table public.reservas add column if not exists ninos integer not null default 0;
alter table public.reservas add column if not exists ubicacion text;
alter table public.reservas add column if not exists correo text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reservas_ninos_check') then
    alter table public.reservas add constraint reservas_ninos_check check (ninos >= 0 and ninos < personas);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reservas_ubicacion_check') then
    alter table public.reservas add constraint reservas_ubicacion_check check (char_length(ubicacion) <= 40);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reservas_correo_check') then
    alter table public.reservas add constraint reservas_correo_check check (char_length(correo) <= 120);
  end if;
end $$;

-- Turno de las reservas en el que cae un día y hora del local (null si no cae en ninguno).
create or replace function public.turno_reserva(p_turnos jsonb, p_dia date, p_hora time)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select t.x
  from jsonb_array_elements(coalesce(p_turnos, '[]'::jsonb)) t(x)
  where (jsonb_array_length(coalesce(t.x -> 'dias', '[]'::jsonb)) = 0
         or t.x -> 'dias' @> to_jsonb(extract(dow from p_dia)::int))
    and p_hora between (t.x ->> 'desde')::time and (t.x ->> 'hasta')::time
  limit 1;
$$;

-- Personas ya reservadas en un turno (para el cupo). Cuenta pendientes y confirmadas, no las canceladas.
create or replace function public.ocupado_turno(p_restaurante uuid, p_sucursal uuid, p_turno jsonb, p_dia date)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(e.personas), 0)::int
  from public.reservas e
  where e.restaurante_id = p_restaurante
    and e.tipo = 'reserva'
    and e.estado not in ('cancelada', 'no_vino')
    and (p_sucursal is null or e.sucursal_id = p_sucursal)
    and (e.fecha at time zone public.zona_restaurante(p_restaurante))::date = p_dia
    and (e.fecha at time zone public.zona_restaurante(p_restaurante))::time
        between (p_turno ->> 'desde')::time and (p_turno ->> 'hasta')::time;
$$;
revoke all on function public.ocupado_turno(uuid, uuid, jsonb, date) from public;

-- Lo que ve el cliente al elegir el día: cuántos lugares quedan en cada turno (solo números, nada personal).
create or replace function public.cupos_reserva(p_restaurante uuid, p_dia date, p_sucursal uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r public.restaurantes;
  resultado jsonb := '[]';
  t jsonb;
  cupo int;
begin
  select * into r from public.restaurantes where id = p_restaurante and activo;
  if r.id is null then
    return resultado;
  end if;
  for t in select x from jsonb_array_elements(coalesce(r.ajustes #> '{reservas,turnos}', '[]'::jsonb)) x loop
    cupo := coalesce(nullif(t ->> 'cupo', '')::int, 0);
    resultado := resultado || jsonb_build_array(
      case when cupo > 0
        then greatest(0, cupo - public.ocupado_turno(r.id, p_sucursal, t, p_dia))
        else null
      end
    );
  end loop;
  return resultado;
end;
$$;
revoke all on function public.cupos_reserva(uuid, date, uuid) from public;
grant execute on function public.cupos_reserva(uuid, date, uuid) to anon, authenticated;

-- Pedir una reserva desde la carta. Reemplaza a la de 0009: ahora recibe día y hora del local (no del celular),
-- adultos/niños, ubicación y correo, y respeta los turnos y el cupo configurados.
drop function if exists public.reservar(uuid, uuid, text, text, integer, timestamptz, text);

create or replace function public.reservar(
  p_restaurante uuid,
  p_sucursal uuid,
  p_nombre text,
  p_telefono text,
  p_personas integer,
  p_fecha timestamptz default null,
  p_nota text default null,
  p_dia date default null,
  p_hora text default null,
  p_ninos integer default 0,
  p_ubicacion text default null,
  p_correo text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.restaurantes;
  ajustes jsonb;
  zona text;
  v_fecha timestamptz;
  v_dia date;
  v_hora time;
  turnos jsonb;
  turno jsonb;
  cupo int;
  ubicaciones jsonb;
  pide_correo text;
  v_correo text := nullif(lower(trim(coalesce(p_correo, ''))), '');
  v_ubicacion text := nullif(trim(coalesce(p_ubicacion, '')), '');
  v_ninos int := coalesce(p_ninos, 0);
  v_sucursal uuid;
  nueva uuid;
begin
  select * into r from public.restaurantes where id = p_restaurante and activo;
  ajustes := coalesce(r.ajustes, '{}');
  if r.id is null or not coalesce((ajustes #>> '{modulos,reservas}')::boolean, false)
     or not coalesce((ajustes #>> '{reservas,online}')::boolean, false) then
    raise exception 'Este restaurante no toma reservas en línea';
  end if;
  if coalesce(trim(p_nombre), '') = '' or coalesce(trim(p_telefono), '') = '' then
    raise exception 'Faltan tu nombre o tu teléfono';
  end if;
  if p_personas is null or p_personas not between 1 and 99 then
    raise exception 'Cantidad de personas no válida';
  end if;
  if v_ninos < 0 or v_ninos >= p_personas then
    raise exception 'Tiene que venir al menos un adulto';
  end if;

  zona := public.zona_restaurante(r.id);
  if p_dia is not null and p_hora is not null then
    v_fecha := (p_dia + p_hora::time) at time zone zona;
  else
    v_fecha := p_fecha;
  end if;
  if v_fecha is null or v_fecha < now() or v_fecha > now() + interval '90 days' then
    raise exception 'Elige un día y una hora de los próximos tres meses';
  end if;
  v_dia := (v_fecha at time zone zona)::date;
  v_hora := (v_fecha at time zone zona)::time;
  v_sucursal := (select id from public.sucursales where id = p_sucursal and restaurante_id = r.id);

  -- Horarios fijos: solo se puede reservar dentro de un turno, y sin pasar el cupo.
  turnos := coalesce(ajustes #> '{reservas,turnos}', '[]'::jsonb);
  if jsonb_typeof(turnos) = 'array' and jsonb_array_length(turnos) > 0 then
    turno := public.turno_reserva(turnos, v_dia, v_hora);
    if turno is null then
      raise exception 'Ese horario no está disponible. Elige otro, por favor.';
    end if;
    cupo := coalesce(nullif(turno ->> 'cupo', '')::int, 0);
    if cupo > 0 and public.ocupado_turno(r.id, v_sucursal, turno, v_dia) + p_personas > cupo then
      raise exception 'Ese horario ya está completo. Elige otro, por favor.';
    end if;
  end if;

  ubicaciones := coalesce(ajustes #> '{reservas,ubicaciones}', '[]'::jsonb);
  if v_ubicacion is not null and jsonb_typeof(ubicaciones) = 'array' and jsonb_array_length(ubicaciones) > 0
     and not ubicaciones @> to_jsonb(v_ubicacion) then
    raise exception 'Elige una de las ubicaciones del local';
  end if;

  pide_correo := coalesce(ajustes #>> '{reservas,correo}', 'no');
  if pide_correo = 'obligatorio' and v_correo is null then
    raise exception 'Falta tu correo';
  end if;
  if v_correo is not null and v_correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'El correo no es válido';
  end if;

  if (select count(*) from public.reservas where restaurante_id = r.id and origen = 'cliente' and created_at > now() - interval '1 hour') >= 30
     or (select count(*) from public.reservas where restaurante_id = r.id and telefono = trim(p_telefono) and created_at > now() - interval '1 day') >= 3 then
    raise exception 'Recibimos muchas reservas seguidas. Escríbenos por WhatsApp, por favor.';
  end if;

  insert into public.reservas (restaurante_id, sucursal_id, tipo, nombre, telefono, personas, ninos, ubicacion, correo, fecha, nota, origen)
  values (r.id, v_sucursal, 'reserva', left(trim(p_nombre), 60), left(trim(p_telefono), 30), p_personas, v_ninos,
          left(v_ubicacion, 40), left(v_correo, 120), v_fecha, nullif(left(trim(p_nota), 200), ''), 'cliente')
  returning id into nueva;
  return nueva;
end;
$$;

revoke all on function public.reservar(uuid, uuid, text, text, integer, timestamptz, text, date, text, integer, text, text) from public;
grant execute on function public.reservar(uuid, uuid, text, text, integer, timestamptz, text, date, text, integer, text, text) to anon, authenticated;

-- El enlace de la reserva también muestra niños y ubicación.
create or replace function public.ver_reserva(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'nombre', e.nombre,
    'personas', e.personas,
    'ninos', e.ninos,
    'ubicacion', e.ubicacion,
    'fecha', e.fecha,
    'estado', e.estado,
    'asistencia', e.asistencia,
    'zona', public.zona_restaurante(e.restaurante_id),
    'sucursal', s.nombre,
    'direccion', s.direccion,
    'whatsapp', coalesce(s.whatsapp, r.whatsapp)
  )
  from public.reservas e
  join public.restaurantes r on r.id = e.restaurante_id
  left join public.sucursales s on s.id = e.sucursal_id
  where e.id = p_id and e.tipo = 'reserva';
$$;

-- Holandés como idioma extra de la carta (se rehace la lista de idiomas permitidos sumando 'nl').
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.restaurantes'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%idiomas%'
  loop
    execute format('alter table public.restaurantes drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.restaurantes
  add constraint restaurantes_idiomas_check check (idiomas <@ array['en', 'pt', 'fr', 'it', 'de', 'zh', 'nl']::text[]);
