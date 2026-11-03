-- Máximo 5 sucursales por restaurante, contando la principal (plan Grupo: "hasta 5 sucursales").
-- La carta lista las filas de sucursales (incluida la principal) cuando hay más de una, así que el tope es de 5 filas.
-- Vale para todos, también para el superadmin que entra como soporte. Las que ya existan sobre el tope no se borran.

create or replace function public.limitar_sucursales()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Bloqueo por restaurante para que dos altas simultáneas no pasen el tope.
  perform pg_advisory_xact_lock(hashtext('sucursales:' || new.restaurante_id::text));
  if (select count(*) from public.sucursales where restaurante_id = new.restaurante_id) >= 5 then
    raise exception 'Máximo 5 sucursales por restaurante, contando la principal.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists limitar_sucursales on public.sucursales;
create trigger limitar_sucursales
  before insert on public.sucursales
  for each row execute function public.limitar_sucursales();

-- Plano: color de cada mesa y sillas elegidas a mano (tipo y cantidad por lado: sillas, taburetes, banca o sillón).
-- Los colores y asientos de los demás elementos del plano van dentro de pisos.elementos (jsonb), no necesitan columnas.
alter table public.mesas add column if not exists color text;
alter table public.mesas add column if not exists sillas jsonb;
