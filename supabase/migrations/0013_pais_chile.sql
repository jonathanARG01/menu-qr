-- Menús QR · país de cada restaurante, con Chile por defecto (peso chileno y hora de Santiago).
-- Cada restaurante elige su país, moneda y zona horaria en el panel; esto solo cambia los valores por defecto
-- y pasa a Chile lo que se había creado con valores de Argentina. Se puede ejecutar más de una vez.
-- Ejecutar en Supabase: SQL Editor > New query > pegar todo y Run.

-- Moneda de los restaurantes nuevos.
alter table public.restaurantes alter column moneda set default 'CLP';

-- Zona horaria del restaurante cuando no eligió ninguna (promos por horario, agotados y caja del día).
create or replace function public.zona_restaurante(rid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(r.ajustes ->> 'zona_horaria', ''), 'America/Santiago')
  from public.restaurantes r where r.id = rid;
$$;
grant execute on function public.zona_restaurante(uuid) to anon, authenticated;

-- Restaurantes ya creados: los que quedaron en pesos argentinos pasan a pesos chilenos y la hora de Argentina
-- pasa a la de Santiago. El país se deduce de la zona horaria que eligieron (Chile si no eligieron ninguna).
update public.restaurantes set moneda = 'CLP' where moneda = 'ARS';

update public.restaurantes
set ajustes = coalesce(ajustes, '{}'::jsonb) || jsonb_build_object('zona_horaria', 'America/Santiago')
where coalesce(ajustes ->> 'zona_horaria', '') in ('', 'America/Argentina/Buenos_Aires');

update public.restaurantes r
set ajustes = r.ajustes || jsonb_build_object('pais', coalesce(z.pais, 'CL'))
from public.restaurantes x
left join (values
  ('America/La_Paz', 'BO'), ('America/Sao_Paulo', 'BR'), ('America/Bogota', 'CO'), ('America/Costa_Rica', 'CR'),
  ('America/Guayaquil', 'EC'), ('Europe/Madrid', 'ES'), ('America/New_York', 'US'), ('America/Chicago', 'US'),
  ('America/Los_Angeles', 'US'), ('America/Guatemala', 'GT'), ('America/Mexico_City', 'MX'), ('America/Cancun', 'MX'),
  ('America/Tijuana', 'MX'), ('America/Panama', 'PA'), ('America/Asuncion', 'PY'), ('America/Lima', 'PE'),
  ('America/Santo_Domingo', 'DO'), ('America/Montevideo', 'UY'), ('America/Caracas', 'VE')
) as z(zona, pais) on z.zona = x.ajustes ->> 'zona_horaria'
where x.id = r.id and coalesce(r.ajustes ->> 'pais', '') = '';

-- Las demos tenían un WhatsApp de ejemplo de Argentina.
update public.restaurantes set whatsapp = '56900000000' where whatsapp = '5491100000000';
