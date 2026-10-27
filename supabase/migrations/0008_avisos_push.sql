-- Avisos al celular del comensal aunque haya cerrado la carta (notificaciones push del navegador).
-- El cliente se suscribe desde la carta de su mesa y la suscripción queda atada a la cuenta abierta;
-- cuando la cocina empieza, termina o se entrega su pedido, el panel le manda el aviso.
-- Se puede ejecutar más de una vez.

create table if not exists public.suscripciones_push (
  id             uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  cuenta_id      uuid not null references public.cuentas (id) on delete cascade,
  endpoint       text not null unique check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  claves         jsonb not null,
  idioma         text not null default 'es' check (char_length(idioma) <= 5),
  created_at     timestamptz not null default now()
);
create index if not exists suscripciones_push_cuenta_idx on public.suscripciones_push (cuenta_id);

alter table public.suscripciones_push enable row level security;
grant select, delete on public.suscripciones_push to authenticated;

-- El equipo las lee para mandar los avisos y borra las que el navegador ya dio de baja.
drop policy if exists "equipo: suscripciones push" on public.suscripciones_push;
create policy "equipo: suscripciones push" on public.suscripciones_push
  for all to authenticated using (public.es_miembro(restaurante_id)) with check (public.es_miembro(restaurante_id));

-- El cliente (sin cuenta de usuario) se suscribe solo a través de esta función: la ata a la cuenta abierta de su mesa.
create or replace function public.suscribir_avisos(
  p_restaurante uuid,
  p_sucursal uuid,
  p_mesa text,
  p_endpoint text,
  p_claves jsonb,
  p_idioma text default 'es'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.mesas;
  c public.cuentas;
begin
  if p_endpoint is null or p_endpoint not like 'https://%' or char_length(p_endpoint) > 1000
     or jsonb_typeof(p_claves) <> 'object' or length(p_claves::text) > 500 then
    return false;
  end if;
  m := public.buscar_mesa(p_restaurante, p_sucursal, p_mesa);
  if m.id is null then
    return false;
  end if;
  select * into c from public.cuentas where mesa_id = m.id and estado = 'abierta';
  if c.id is null then
    return false;
  end if;
  if (select count(*) from public.suscripciones_push where cuenta_id = c.id) >= 30 then
    return false;
  end if;
  insert into public.suscripciones_push (restaurante_id, cuenta_id, endpoint, claves, idioma)
  values (m.restaurante_id, c.id, p_endpoint, p_claves, coalesce(left(p_idioma, 5), 'es'))
  on conflict (endpoint) do update
    set restaurante_id = excluded.restaurante_id, cuenta_id = excluded.cuenta_id,
        claves = excluded.claves, idioma = excluded.idioma, created_at = now();
  return true;
end;
$$;

revoke all on function public.suscribir_avisos(uuid, uuid, text, text, jsonb, text) from public;
grant execute on function public.suscribir_avisos(uuid, uuid, text, text, jsonb, text) to anon, authenticated;
