-- Orden manual de las comandas en la pantalla de cocina (arrastrar y soltar).
-- Sin valor, la comanda va por hora de llegada; al moverla se guarda un número entre sus vecinas,
-- así todas las pantallas del local ven el mismo orden. Se puede ejecutar más de una vez.
alter table public.pedidos add column if not exists orden double precision;
