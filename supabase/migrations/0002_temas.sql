-- Diseño de la carta pública elegido por cada restaurante.
alter table public.restaurantes
  add column if not exists tema text not null default 'clasico'
  check (tema in ('clasico', 'noir', 'esmeralda', 'street', 'retro'));

grant update (tema) on public.restaurantes to authenticated;
