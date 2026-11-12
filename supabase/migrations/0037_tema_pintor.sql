-- Diseño de carta "Pintor" (paredes pintadas del puerto, madera, letreros crema y pizarras).
-- Solo amplía la lista de diseños permitidos; no cambia datos. Incluye los de 0033 por si esa no se ejecutó.
alter table public.restaurantes drop constraint if exists restaurantes_tema_check;

alter table public.restaurantes
  add constraint restaurantes_tema_check
  check (tema in (
    'clasico', 'noir', 'esmeralda', 'street', 'retro',
    'bistro', 'veggie', 'forno', 'oriente', 'neon',
    'tropical', 'jugos', 'batidos', 'gala', 'vitrina', 'cinta', 'trattoria', 'kraft', 'madera', 'coctel', 'revista',
    'barista', 'latte', 'origen', 'grano', 'caramelo', 'libreta', 'muro', 'porteno',
    'pintor'
  ));
