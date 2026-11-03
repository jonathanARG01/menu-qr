-- 0030: ícono por plato.
-- Un plato sin foto puede mostrar un ícono elegido de la galería del editor (src/lib/iconos.ts, archivos en
-- public/defecto). Se guarda el id del ícono (ej. "flan", "cerveza", "costilla"); vacío = sin ícono elegido.
-- Se puede ejecutar más de una vez.

alter table public.platos add column if not exists icono text;

alter table public.platos drop constraint if exists platos_icono_check;
alter table public.platos add constraint platos_icono_check
  check (icono is null or icono ~ '^[a-z0-9-]{1,40}$');

notify pgrst, 'reload schema';
