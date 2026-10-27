-- Cartas de demostración para los 5 diseños nuevos (necesita antes la migración 0006_temas_nuevos.sql).
-- Los platos salen de las cartas de ejemplo que inspiraron cada diseño; los precios son inventados.
-- No traen fotos: cada diseño muestra un plato con un emoji hasta que subas fotos propias.
-- Se puede ejecutar más de una vez: si una carta ya existe, solo le vuelve a poner su diseño.


-- La Esquina Verde · diseño bistro
do $$
declare
  rid uuid;
  cid uuid;
begin
  select id into rid from public.restaurantes where slug = 'la-esquina-verde';

  if rid is null then
    insert into public.restaurantes (slug, nombre, descripcion, color_primario, color_fondo, moneda, whatsapp)
    values ('la-esquina-verde', 'La Esquina Verde', 'Buena comida, buen humor', '#f5c518', '#1d4a2f', 'CLP', '56900000000')
    returning id into rid;

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Nuestra carta', 0) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden) values
      (rid, cid, 'Pizza', 'Extra queso y bien cargada, masa fresca y borde bien horneado', 12900, '{recomendado}', 0),
      (rid, cid, 'Hamburguesa', 'Medallón jugoso con vegetales frescos, pan suave y salsas cremosas', 11500, '{}', 1),
      (rid, cid, 'Papas fritas', 'Crocantes y doradas por fuera, apenas saladas', 5900, '{vegetariano}', 2),
      (rid, cid, 'Fideos chinos', 'Salteados al wok con vegetales y salsas intensas, picantes estilo callejero', 10900, '{picante}', 3);

    insert into public.mesas (restaurante_id, numero)
    select rid, n::text from generate_series(1, 8) n;
  end if;

  update public.restaurantes set tema = 'bistro', color_primario = '#f5c518' where id = rid;
end;
$$;

-- Jardín Veggie · diseño veggie
do $$
declare
  rid uuid;
  cid uuid;
begin
  select id into rid from public.restaurantes where slug = 'jardin-veggie';

  if rid is null then
    insert into public.restaurantes (slug, nombre, descripcion, color_primario, color_fondo, moneda, whatsapp)
    values ('jardin-veggie', 'Jardín Veggie', 'Cocina vegetariana con sabores de la India', '#d9b25f', '#14291b', 'CLP', '56900000000')
    returning id into rid;

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Entradas', 0) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden) values
      (rid, cid, 'Bruschetta', 'Pan tostado con queso cremoso y parmesano', 6500, '{vegetariano}', 0),
      (rid, cid, 'Paneer tikka', 'Queso paneer marinado y grillado', 7800, '{vegetariano,picante}', 1),
      (rid, cid, 'Hara bhara kabab', 'Medallones de espinaca y arvejas', 6900, '{vegano}', 2);

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Principales', 1) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden) values
      (rid, cid, 'Biryani de vegetales', 'Arroz basmati aromático con vegetales', 11900, '{vegano,recomendado}', 0),
      (rid, cid, 'Paneer butter masala', 'Paneer en salsa cremosa de tomate', 12500, '{vegetariano}', 1),
      (rid, cid, 'Fideos con vegetales', 'Fideos salteados con vegetales', 9900, '{vegano}', 2);

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Postres', 2) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden) values
      (rid, cid, 'Gulab jamun (2 u.)', 'Bolitas dulces en almíbar', 4500, '{vegetariano}', 0),
      (rid, cid, 'Rasmalai', 'Bocados de paneer esponjosos en leche con azafrán', 5200, '{vegetariano}', 1);

    insert into public.mesas (restaurante_id, numero)
    select rid, n::text from generate_series(1, 8) n;
  end if;

  update public.restaurantes set tema = 'veggie', color_primario = '#d9b25f' where id = rid;
end;
$$;

-- Forno · diseño forno
do $$
declare
  rid uuid;
  cid uuid;
begin
  select id into rid from public.restaurantes where slug = 'forno-pizzeria';

  if rid is null then
    insert into public.restaurantes (slug, nombre, descripcion, color_primario, color_fondo, moneda, whatsapp)
    values ('forno-pizzeria', 'Forno', 'El verdadero sabor de Italia · Horno a leña', '#c8302b', '#f3f2ee', 'CLP', '56900000000')
    returning id into rid;

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Pizzas', 0) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden) values
      (rid, cid, 'Margarita', 'Salsa de tomate, mozzarella, albahaca fresca y aceite de oliva', 11900, '{vegetariano}', 0),
      (rid, cid, 'Pepperoni', 'Salsa de tomate, mozzarella, pepperoni, cebolla morada y orégano', 13900, '{picante}', 1),
      (rid, cid, 'Prosciutto y rúcula', 'Salsa de tomate, mozzarella, prosciutto, rúcula, parmesano y aceite de oliva', 15900, '{recomendado}', 2),
      (rid, cid, 'Hongos', 'Salsa blanca, mozzarella, champiñones, aceite de trufa y perejil', 14500, '{vegetariano}', 3),
      (rid, cid, 'Carnes', 'Salsa de tomate, mozzarella, jamón, panceta, salchicha y carne', 15500, '{}', 4),
      (rid, cid, 'Cuatro quesos', 'Mozzarella, queso azul, parmesano, gouda y aceite de oliva', 14900, '{vegetariano}', 5);

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Agregados', 1) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden) values
      (rid, cid, 'Mozzarella', null, 1800, '{}', 0),
      (rid, cid, 'Pepperoni', null, 2200, '{}', 1),
      (rid, cid, 'Hongos', null, 2000, '{}', 2),
      (rid, cid, 'Jamón', null, 2000, '{}', 3),
      (rid, cid, 'Rúcula', null, 1500, '{}', 4);

    insert into public.mesas (restaurante_id, numero)
    select rid, n::text from generate_series(1, 8) n;
  end if;

  update public.restaurantes set tema = 'forno', color_primario = '#c8302b' where id = rid;
end;
$$;

-- Warung Oriente · diseño oriente
do $$
declare
  rid uuid;
  cid uuid;
begin
  select id into rid from public.restaurantes where slug = 'warung-oriente';

  if rid is null then
    insert into public.restaurantes (slug, nombre, descripcion, color_primario, color_fondo, moneda, whatsapp)
    values ('warung-oriente', 'Warung Oriente', 'Sabores de Indonesia y Tailandia', '#2f6b4f', '#f3eedd', 'CLP', '56900000000')
    returning id into rid;

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Entradas', 0) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden) values
      (rid, cid, 'Lumpia goreng', 'Rollitos crocantes rellenos de vegetales y carne picada', 7500, '{}', 0);

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Sopas y fideos', 1) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden) values
      (rid, cid, 'Mie kuah kaldu', 'Fideos en caldo casero con vegetales y albóndigas', 10500, '{recomendado}', 0),
      (rid, cid, 'Tom yum', 'Sopa tailandesa agria y picante', 9800, '{picante}', 1),
      (rid, cid, 'Ramen de langostinos', 'Sin caldo, con langostinos salteados y ajo', 13900, '{}', 2);

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Principales', 2) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden) values
      (rid, cid, 'Daging lada hitam', 'Carne tierna en salsa de pimienta negra', 14500, '{picante}', 0),
      (rid, cid, 'Ayam saus', 'Pollo frito bañado en salsa', 11900, '{}', 1);

    insert into public.mesas (restaurante_id, numero)
    select rid, n::text from generate_series(1, 8) n;
  end if;

  update public.restaurantes set tema = 'oriente', color_primario = '#2f6b4f' where id = rid;
end;
$$;

-- Neón Tokio · diseño neon
do $$
declare
  rid uuid;
  cid uuid;
begin
  select id into rid from public.restaurantes where slug = 'neon-tokio';

  if rid is null then
    insert into public.restaurantes (slug, nombre, descripcion, color_primario, color_fondo, moneda, whatsapp)
    values ('neon-tokio', 'Neón Tokio', 'Cocina asiática · Abierto hasta tarde', '#ff2bd6', '#07070b', 'CLP', '56900000000')
    returning id into rid;

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Sopas', 0) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden) values
      (rid, cid, 'Tom yam', 'Con langostinos, picante y ácida', 9500, '{picante}', 0),
      (rid, cid, 'Sopa miso', 'Con tofu y algas', 6500, '{vegano}', 1),
      (rid, cid, 'Ramen', 'Con cerdo, huevo marinado y verdeo', 11500, '{recomendado}', 2);

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Entradas', 1) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden) values
      (rid, cid, 'Alitas picantes', 'Bañadas en salsa picante y sésamo', 8500, '{picante}', 0),
      (rid, cid, 'Spring rolls', 'Rollitos crocantes de vegetales', 6900, '{vegano}', 1),
      (rid, cid, 'Edamame', 'Con sal marina', 5500, '{vegano}', 2);

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Fideos y arroz', 2) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden) values
      (rid, cid, 'Fideos de arroz con pollo', 'Salteados al wok con vegetales', 10500, '{}', 0),
      (rid, cid, 'Soba con carne', 'Fideos de trigo sarraceno con carne salteada', 11900, '{}', 1),
      (rid, cid, 'Arroz frito con langostinos', 'Con huevo, verdeo y salsa de soja', 12500, '{}', 2);

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Calientes', 3) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden) values
      (rid, cid, 'Pollo agridulce', 'Pollo crocante en salsa agridulce', 11500, '{}', 0),
      (rid, cid, 'Carne teriyaki', 'Con vegetales salteados', 13500, '{recomendado}', 1),
      (rid, cid, 'Tofu con vegetales', 'Salteado al wok con salsa de soja', 9900, '{vegano}', 2);

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Rolls', 4) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden) values
      (rid, cid, 'Philadelphia roll', 'Salmón, queso crema y palta (8 piezas)', 12900, '{}', 0),
      (rid, cid, 'California roll', 'Kanikama, palta y pepino (8 piezas)', 10900, '{}', 1),
      (rid, cid, 'Spicy tuna roll', 'Atún picante y verdeo (8 piezas)', 13500, '{picante}', 2),
      (rid, cid, 'Dragon roll', 'Langostino tempura, palta y salsa unagi (8 piezas)', 14900, '{nuevo}', 3),
      (rid, cid, 'Veggie roll', 'Palta, pepino y zanahoria (8 piezas)', 9500, '{vegano}', 4);

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Postres', 5) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden) values
      (rid, cid, 'Mochi de mango', 'Dos unidades', 5900, '{vegetariano}', 0),
      (rid, cid, 'Cheesecake de yuzu', 'Con base de galletas', 6500, '{vegetariano}', 1),
      (rid, cid, 'Helado de matcha', 'Dos bochas', 5200, '{vegetariano}', 2);

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Bebidas', 6) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden) values
      (rid, cid, 'Matcha latte', 'Frío o caliente', 4900, '{}', 0),
      (rid, cid, 'Bubble tea', 'Té con leche y perlas de tapioca', 5500, '{nuevo}', 1),
      (rid, cid, 'Limonada de lichi', 'Con menta y hielo', 4500, '{vegano}', 2);

    insert into public.mesas (restaurante_id, numero)
    select rid, n::text from generate_series(1, 8) n;
  end if;

  update public.restaurantes set tema = 'neon', color_primario = '#ff2bd6' where id = rid;
end;
$$;
