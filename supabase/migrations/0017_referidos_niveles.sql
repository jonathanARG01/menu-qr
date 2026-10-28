-- Mesitto · referidos con 5 niveles con nombre y descuentos medidos en meses.
-- Requiere 0012 (referidos). Se puede ejecutar más de una vez.
-- Ejecutar en Supabase: SQL Editor > New query > pegar todo y Run.
--
-- Cómo funciona ahora:
--   · Cada nivel tiene nombre: Bronce (1), Plata (5), Oro (10), Diamante (50) y Platino (100 referidos).
--   · Los descuentos temporales se cuentan en MESES (antes eran "períodos", que en un pago anual valían un año).
--       Mensual  → el descuento se resta del próximo cobro mensual y gasta 1 mes.
--       3, 6 o 12 meses → primero va el descuento del período (5 %, 10 % o 15 %) y después el de referidos,
--                 solo sobre los meses que cubre ese cobro. Un cobro anual gasta hasta 12 meses de descuento.
--       Permanente → se resta de todos los meses, pague como pague.
--   · Al cobrar, tocas "Cobré" en /admin/referidos y se gastan los meses de ese cobro (admin_registrar_cobro).
--   · ATENCIÓN: esto reemplaza los niveles guardados por los 5 nuevos. Los descuentos ya ganados se respetan.

-- ─────────────────────────────────────────────
-- Columnas
-- ─────────────────────────────────────────────

-- Además de mensual y anual, ahora se puede pagar cada 3 o 6 meses (como en la lista de precios).
alter table public.restaurantes drop constraint if exists restaurantes_ciclo_check;
alter table public.restaurantes add constraint restaurantes_ciclo_check
  check (ciclo in ('mensual', 'trimestral', 'semestral', 'anual'));

-- Nombre del nivel con que se ganó cada descuento. periodos = meses con descuento (null = permanente).
alter table public.descuentos_referido add column if not exists nombre text;

-- ─────────────────────────────────────────────
-- Niveles nuevos
-- ─────────────────────────────────────────────

update public.referidos_config set niveles = '[
  {"nombre": "Bronce",   "referidos": 1,   "porcentaje": 10,  "periodos": 1,    "prioridad": false},
  {"nombre": "Plata",    "referidos": 5,   "porcentaje": 15,  "periodos": 1,    "prioridad": false},
  {"nombre": "Oro",      "referidos": 10,  "porcentaje": 20,  "periodos": null, "prioridad": true},
  {"nombre": "Diamante", "referidos": 50,  "porcentaje": 100, "periodos": 12,   "prioridad": true},
  {"nombre": "Platino",  "referidos": 100, "porcentaje": 100, "periodos": null, "prioridad": true}
]'::jsonb, updated_at = now()
where id and not (niveles @> '[{"nombre": "Platino"}]'::jsonb);

-- Pone nombre a los descuentos ya ganados según su cantidad de referidos.
update public.descuentos_referido d set nombre = n ->> 'nombre'
from public.referidos_config c, jsonb_array_elements(c.niveles) n
where c.id and d.nombre is null and (n ->> 'referidos')::int = d.referidos;

-- ─────────────────────────────────────────────
-- Lógica
-- ─────────────────────────────────────────────

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

  insert into public.descuentos_referido (restaurante_id, nombre, referidos, porcentaje, periodos, prioridad)
  select p_restaurante, nullif(trim(n ->> 'nombre'), ''), (n ->> 'referidos')::int, (n ->> 'porcentaje')::numeric,
    nullif(n ->> 'periodos', '')::int, coalesce((n ->> 'prioridad')::boolean, false)
  from jsonb_array_elements(cfg.niveles) n
  where (n ->> 'referidos')::int <= confirmados
  on conflict (restaurante_id, referidos) do nothing;
end;
$$;
revoke all on function public.otorgar_descuentos_referido(uuid) from public, anon, authenticated;

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
    if coalesce(trim(n ->> 'nombre'), '') = '' or length(n ->> 'nombre') > 30 then
      raise exception 'Cada nivel necesita un nombre (hasta 30 letras)';
    end if;
    if coalesce((n ->> 'referidos')::int, 0) < 1 then
      raise exception 'Cada nivel necesita al menos 1 referido';
    end if;
    if coalesce((n ->> 'porcentaje')::numeric, 0) <= 0 or (n ->> 'porcentaje')::numeric > 100 then
      raise exception 'El descuento de cada nivel va de 1 a 100 %%';
    end if;
    if n ->> 'periodos' is not null and (n ->> 'periodos')::int < 1 then
      raise exception 'Los meses van de 1 en adelante (vacío = para siempre)';
    end if;
  end loop;
  if (select count(distinct n2 ->> 'referidos') <> count(*) from jsonb_array_elements(p_niveles) n2) then
    raise exception 'Dos niveles no pueden pedir la misma cantidad de referidos';
  end if;

  update public.referidos_config set activo = p_activo, niveles = p_niveles, updated_at = now() where id;
end;
$$;

-- Al cobrarle a un restaurante: gasta los meses de descuento temporal que cubre ese cobro
-- (1 si paga mensual, 3, 6 o 12 según su ciclo). Mes a mes usa el primer temporal que le quede y que sea
-- mayor que su permanente; si el permanente es igual o mayor, el temporal no se toca y lo conserva.
-- Devuelve cuántos meses de descuento temporal se gastaron.
create or replace function public.admin_registrar_cobro(p_restaurante uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  meses integer;
  permanente numeric;
  temporal uuid;
  gastados integer := 0;
begin
  if not public.es_superadmin() then
    raise exception 'Solo para administradores';
  end if;
  select case ciclo when 'trimestral' then 3 when 'semestral' then 6 when 'anual' then 12 else 1 end
  into meses from public.restaurantes where id = p_restaurante;
  select max(porcentaje) into permanente from public.descuentos_referido
  where restaurante_id = p_restaurante and periodos is null;

  for i in 1 .. coalesce(meses, 1) loop
    select id into temporal from public.descuentos_referido
    where restaurante_id = p_restaurante and periodos is not null and periodos_usados < periodos
      and porcentaje > coalesce(permanente, 0)
    order by referidos limit 1;
    exit when temporal is null;
    update public.descuentos_referido set periodos_usados = periodos_usados + 1 where id = temporal;
    gastados := gastados + 1;
  end loop;
  return gastados;
end;
$$;
revoke all on function public.admin_registrar_cobro(uuid) from public, anon;
grant execute on function public.admin_registrar_cobro(uuid) to authenticated;

-- Reemplazada por admin_registrar_cobro (gastaba un "período" sin mirar si era mes o año).
drop function if exists public.admin_usar_periodo(uuid);
