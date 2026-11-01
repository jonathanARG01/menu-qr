-- ═════════════════════════════════════════════
-- 0021: la lista de espera desde el celular muestra la mesa asignada
--
-- Cuando el restaurante sienta al cliente, su teléfono muestra "Tu mesa: 7" en vez del botón "Anotarme".
-- Solo cambia la función estado_espera (agrega el número de mesa). Se puede ejecutar más de una vez.
-- ═════════════════════════════════════════════

create or replace function public.estado_espera(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'nombre', e.nombre,
    'personas', e.personas,
    'estado', e.estado,
    'avisada_at', e.avisada_at,
    'desde', e.created_at,
    'mesa', (select m.numero from public.mesas m where m.id = e.mesa_id),
    'delante', (
      select count(*) from public.reservas o
      where o.restaurante_id = e.restaurante_id and o.tipo = 'espera' and o.estado = 'pendiente'
        and o.sucursal_id is not distinct from e.sucursal_id
        and o.created_at < e.created_at and o.created_at > now() - interval '12 hours'
    )
  )
  from public.reservas e where e.id = p_id and e.tipo = 'espera';
$$;

revoke all on function public.estado_espera(uuid) from public;
grant execute on function public.estado_espera(uuid) to anon, authenticated;
