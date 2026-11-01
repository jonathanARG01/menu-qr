-- Platovi Sellos: diseño de la tarjeta (12 estilos, ver DISENOS_SELLO en src/lib/sellos/tipos.ts).
-- Se puede ejecutar más de una vez. Las funciones de 0024 devuelven el programa completo (to_jsonb), así que
-- la tarjeta del cliente recibe el diseño sin cambiar nada más.

alter table public.sellos_programas
  add column if not exists diseno text not null default 'clasica';

alter table public.sellos_programas drop constraint if exists sellos_programas_diseno_check;
alter table public.sellos_programas
  add constraint sellos_programas_diseno_check check (diseno ~ '^[a-z]{2,20}$');

notify pgrst, 'reload schema';
