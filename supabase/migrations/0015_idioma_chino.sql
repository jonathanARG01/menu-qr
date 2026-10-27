-- Mesitto · chino (simplificado) como idioma extra de la carta.
-- La lista de idiomas permitidos estaba fija en 0003; se rehace la restricción sumando 'zh'.
-- Las redes sociales del local no necesitan SQL: se guardan en restaurantes.ajustes.redes.

do $$
declare
  r record;
begin
  -- Borra la restricción vieja sobre "idiomas", se llame como se llame.
  for r in
    select conname from pg_constraint
    where conrelid = 'public.restaurantes'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%idiomas%'
  loop
    execute format('alter table public.restaurantes drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.restaurantes
  add constraint restaurantes_idiomas_check check (idiomas <@ array['en', 'pt', 'fr', 'it', 'de', 'zh']::text[]);
