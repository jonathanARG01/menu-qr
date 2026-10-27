-- Cinco diseños nuevos de carta: bistro, veggie (dorado), forno, oriente y neon.
-- Se puede ejecutar más de una vez.
do $$
declare
  restriccion text;
begin
  -- Borra la regla vieja que solo aceptaba los cinco primeros diseños, se llame como se llame.
  for restriccion in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public' and rel.relname = 'restaurantes' and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%tema%'
  loop
    execute format('alter table public.restaurantes drop constraint %I', restriccion);
  end loop;
end $$;

alter table public.restaurantes
  add constraint restaurantes_tema_check
  check (tema in ('clasico', 'noir', 'esmeralda', 'street', 'retro', 'bistro', 'veggie', 'forno', 'oriente', 'neon'));
