-- 0029: más espacio para las opciones de cada línea del pedido.
-- Ahora un grupo puede permitir varias opciones (ej. hasta 3 ingredientes) o todas. El tope de 2000 caracteres
-- de pedido_items.opciones alcanzaba para ~25 opciones marcadas; se sube a 8000 (el mismo orden que platos.opciones).
-- Se puede ejecutar más de una vez.

alter table public.pedido_items drop constraint if exists pedido_items_opciones_check;
alter table public.pedido_items add constraint pedido_items_opciones_check
  check (jsonb_typeof(opciones) = 'array' and length(opciones::text) <= 8000);

alter table public.platos drop constraint if exists platos_opciones_check;
alter table public.platos add constraint platos_opciones_check
  check (jsonb_typeof(opciones) = 'array' and length(opciones::text) <= 12000);
