-- Restaurante de demostración "La Esquina" (sin dueño).
-- Opcional: ejecútalo después de la migración para tener una carta de ejemplo en /la-esquina.
-- Para que alguien pueda editarlo, agrega una fila en public.usuarios con su user_id.

do $$
declare
  rid uuid;
  c_entradas uuid;
  c_principales uuid;
  c_postres uuid;
  c_bebidas uuid;
begin
  insert into public.restaurantes (slug, nombre, descripcion, color_primario, color_fondo, moneda, whatsapp)
  values ('la-esquina', 'La Esquina', 'Cocina de barrio desde 1998', '#9a3412', '#fffaf3', 'USD', '56900000000')
  on conflict (slug) do nothing
  returning id into rid;

  if rid is null then
    raise notice 'La Esquina ya existe, no se modifica';
    return;
  end if;

  insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Entradas', 0) returning id into c_entradas;
  insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Principales', 1) returning id into c_principales;
  insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Postres', 2) returning id into c_postres;
  insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Bebidas', 3) returning id into c_bebidas;

  insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden) values
    (rid, c_entradas, 'Empanadas (3)', 'Carne cortada a cuchillo', 8.50, '{picante}', 0),
    (rid, c_entradas, 'Ceviche clásico', 'Pesca del día, leche de tigre', 12.00, '{sin gluten}', 1),
    (rid, c_entradas, 'Provoleta', 'Orégano y aceite de oliva', 9.00, '{vegetariano}', 2),
    (rid, c_principales, 'Risotto de hongos', 'Parmesano, trufa', 15.90, '{vegetariano}', 0),
    (rid, c_principales, 'Bife de chorizo', '350 g, papas rústicas', 22.00, '{}', 1),
    (rid, c_principales, 'Milanesa napolitana', 'Con puré de papas', 16.50, '{}', 2),
    (rid, c_postres, 'Flan casero', 'Con dulce de leche', 6.00, '{vegetariano}', 0),
    (rid, c_postres, 'Tiramisú', 'Receta de la nonna', 7.50, '{}', 1),
    (rid, c_bebidas, 'Limonada', 'Menta y jengibre', 4.00, '{vegano}', 0),
    (rid, c_bebidas, 'Copa de Malbec', 'Mendoza', 6.50, '{}', 1);

  insert into public.mesas (restaurante_id, numero)
  select rid, n::text from generate_series(1, 6) n;
end;
$$;
