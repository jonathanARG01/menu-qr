-- 0032: el equipo que ve todo el equipo (nombres_equipo) trae también el local de cada persona.
-- Así, al elegir quién atiende una mesa, solo aparecen las personas de ese local y las de "Todas las sucursales".
-- Requiere la 0031. Se puede ejecutar más de una vez.

drop function if exists public.nombres_equipo(uuid);
create function public.nombres_equipo(p_restaurante uuid)
returns table (user_id uuid, nombre text, rol text, avatar text, color text, mesas uuid[], todas_sucursales boolean, sucursal_id uuid)
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
         coalesce((select array_agg(m.id) from public.mesas m where m.restaurante_id = p_restaurante and m.mesero_id = u.user_id), '{}'),
         u.todas_sucursales, u.sucursal_id
  from public.usuarios u join auth.users au on au.id = u.user_id
  where u.restaurante_id = p_restaurante
  order by 2;
end;
$$;
revoke all on function public.nombres_equipo(uuid) from public;
grant execute on function public.nombres_equipo(uuid) to authenticated;

notify pgrst, 'reload schema';
