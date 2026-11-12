-- Diseños de carta para cafeterías: barista, latte, origen, grano, caramelo, libreta, muro y porteño.
-- Solo amplía la lista de diseños permitidos; no cambia datos.
alter table public.restaurantes drop constraint if exists restaurantes_tema_check;

alter table public.restaurantes
  add constraint restaurantes_tema_check
  check (tema in (
    'clasico', 'noir', 'esmeralda', 'street', 'retro',
    'bistro', 'veggie', 'forno', 'oriente', 'neon',
    'tropical', 'jugos', 'batidos', 'gala', 'vitrina', 'cinta', 'trattoria', 'kraft', 'madera', 'coctel', 'revista',
    'barista', 'latte', 'origen', 'grano', 'caramelo', 'libreta', 'muro', 'porteno'
  ));
