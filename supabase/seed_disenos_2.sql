-- Cartas de demostración para los 11 diseños de la migración 0007 (ejecutar 0007_destacados_y_temas.sql antes).
-- Los platos salen de las cartas de ejemplo que inspiraron cada diseño; los nombres de los locales y los precios son inventados.
-- No traen fotos: cada diseño muestra un emoji hasta que subas fotos propias.
-- Se puede ejecutar más de una vez: si una carta ya existe, solo le vuelve a poner su diseño.

-- Destacados de ejemplo en Aroma Café (tiene fotos) y en las cartas demo anteriores.
update public.platos set destacado = true
where nombre in ('Espresso', 'Flat white', 'Mocha', 'Espresso tonic')
  and restaurante_id = (select id from public.restaurantes where slug = 'aroma-cafe');
update public.platos set destacado = true
where (restaurante_id, nombre) in (
  select r.id, v.nombre from public.restaurantes r
  join (values ('la-esquina-verde', 'Pizza'), ('jardin-veggie', 'Biryani de vegetales'), ('forno-pizzeria', 'Prosciutto y rúcula'),
               ('warung-oriente', 'Mie kuah kaldu'), ('neon-tokio', 'Ramen'), ('neon-tokio', 'Dragon roll')) v(slug, nombre)
    on v.slug = r.slug
);


-- Palmera Tragos · diseño tropical
do $$
declare
  rid uuid;
  cid uuid;
begin
  select id into rid from public.restaurantes where slug = 'palmera-tragos';

  if rid is null then
    insert into public.restaurantes (slug, nombre, descripcion, color_primario, color_fondo, moneda, whatsapp)
    values ('palmera-tragos', 'Palmera Tragos', 'Tragos frescos para la noche', '#ff3fa4', '#0b0d0c', 'CLP', '56900000000')
    returning id into rid;

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Caipis y clásicos', 0) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden, destacado) values
      (rid, cid, 'Caipiriña', 'Limón, almíbar, cachaza, hielo', 6500, '{recomendado}', 0, true),
      (rid, cid, 'Caipiroska', 'Limón, almíbar, vodka, hielo', 6500, '{}', 1, false),
      (rid, cid, 'Caipiruva', 'Limón, almíbar, cachaza, vino, hielo', 6900, '{}', 2, false),
      (rid, cid, 'A lo paraguayo', 'Jugo de pomelo, guaripola, miel de caña, hielo', 6200, '{}', 3, false),
      (rid, cid, 'Fernet', 'Fernet, cola, hielo', 5500, '{}', 4, false);

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Frozen', 1) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden, destacado) values
      (rid, cid, 'Daiquiri de frutilla', 'Frutilla, azúcar, ron blanco, hielo', 7200, '{}', 0, false),
      (rid, cid, 'Daiquiri de durazno', 'Durazno, azúcar, ron blanco, hielo', 7200, '{}', 1, false),
      (rid, cid, 'Piña colada', 'Piña, azúcar, leche condensada, ron de coco, hielo', 7800, '{}', 2, true),
      (rid, cid, 'Orgasmo de pitufo', 'Piña, azúcar, leche condensada, blue curaçao, ron de coco, hielo', 7900, '{nuevo}', 3, false);

    insert into public.mesas (restaurante_id, numero)
    select rid, n::text from generate_series(1, 8) n;
  end if;

  update public.restaurantes set tema = 'tropical', color_primario = '#ff3fa4' where id = rid;
end;
$$;

-- Jugos del Huerto · diseño jugos
do $$
declare
  rid uuid;
  cid uuid;
begin
  select id into rid from public.restaurantes where slug = 'jugos-del-huerto';

  if rid is null then
    insert into public.restaurantes (slug, nombre, descripcion, color_primario, color_fondo, moneda, whatsapp)
    values ('jugos-del-huerto', 'Jugos del Huerto', 'Todos nuestros jugos son 100% naturales', '#8cc63f', '#0f2a17', 'CLP', '56900000000')
    returning id into rid;

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Jugos especiales', 0) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden, destacado) values
      (rid, cid, 'Verde', 'Naranja, pepino, apio, espinaca, piña', 4800, '{vegano}', 0, true),
      (rid, cid, 'Conga', 'Naranja, zanahoria, piña', 4500, '{vegano}', 1, false),
      (rid, cid, 'Tropical', 'Naranja, piña, frutilla, banana', 4900, '{vegano}', 2, false),
      (rid, cid, 'Puracé', 'Naranja, guayaba, toque de miel', 4700, '{}', 3, false),
      (rid, cid, 'Detox', 'Naranja, manzana, espinaca, jengibre', 5200, '{vegano,recomendado}', 4, true),
      (rid, cid, 'Rojo', 'Naranja, remolacha, manzana, zanahoria', 4900, '{vegano}', 5, false);

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Clásicos', 1) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden, destacado) values
      (rid, cid, 'Mixto', 'Naranja, zanahoria', 3900, '{vegano}', 0, false),
      (rid, cid, 'Naranja', 'Naranja exprimida en el momento', 3500, '{vegano}', 1, false),
      (rid, cid, 'Zanahoria', 'Zanahoria recién licuada', 3500, '{vegano}', 2, false);

    insert into public.mesas (restaurante_id, numero)
    select rid, n::text from generate_series(1, 8) n;
  end if;

  update public.restaurantes set tema = 'jugos', color_primario = '#8cc63f' where id = rid;
end;
$$;

-- Batido Feliz · diseño batidos
do $$
declare
  rid uuid;
  cid uuid;
begin
  select id into rid from public.restaurantes where slug = 'batido-feliz';

  if rid is null then
    insert into public.restaurantes (slug, nombre, descripcion, color_primario, color_fondo, moneda, whatsapp)
    values ('batido-feliz', 'Batido Feliz', 'Buenos ingredientes + gran sabor', '#3b1f0e', '#ffc62a', 'CLP', '56900000000')
    returning id into rid;

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Batidos saludables', 0) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden, destacado) values
      (rid, cid, 'Batido de frutilla', 'Frutillas + yogur + miel + leche', 4500, '{vegetariano}', 0, true),
      (rid, cid, 'Batido de banana y avena', 'Banana + avena + leche + canela', 4300, '{vegetariano}', 1, false),
      (rid, cid, 'Batido de frutos rojos', 'Frutos rojos + yogur + miel + leche', 4900, '{vegetariano}', 2, false),
      (rid, cid, 'Batido de mango', 'Mango + yogur + leche + miel', 4800, '{vegetariano}', 3, true),
      (rid, cid, 'Batido de maní', 'Mantequilla de maní + banana + leche + miel', 4900, '{vegetariano}', 4, false),
      (rid, cid, 'Batido de chocolate', 'Cacao + banana + leche + miel', 4600, '{vegetariano}', 5, false),
      (rid, cid, 'Batido verde', 'Espinaca + banana + manzana + leche', 4700, '{vegetariano}', 6, false),
      (rid, cid, 'Batido de coco', 'Coco + banana + leche + miel', 4800, '{vegetariano}', 7, false),
      (rid, cid, 'Batido de café', 'Café + banana + leche + miel', 4600, '{vegetariano}', 8, false),
      (rid, cid, 'Batido energía de dátiles', 'Dátiles + almendras + leche + miel', 5200, '{vegetariano,nuevo}', 9, false);

    insert into public.mesas (restaurante_id, numero)
    select rid, n::text from generate_series(1, 8) n;
  end if;

  update public.restaurantes set tema = 'batidos', color_primario = '#3b1f0e' where id = rid;
end;
$$;

-- Casa Verdi · diseño gala
do $$
declare
  rid uuid;
  cid uuid;
begin
  select id into rid from public.restaurantes where slug = 'casa-verdi';

  if rid is null then
    insert into public.restaurantes (slug, nombre, descripcion, color_primario, color_fondo, moneda, whatsapp)
    values ('casa-verdi', 'Casa Verdi', 'Alta cocina en cada momento del día', '#c9a96a', '#12302a', 'CLP', '56900000000')
    returning id into rid;

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Brunch', 0) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden, destacado) values
      (rid, cid, 'Desayuno elevado', 'Quesadillas doradas con guacamole, salsa y hojas verdes', 14500, '{}', 0, true),
      (rid, cid, 'Torre de panqueques', 'Panqueques con almíbar y frutas frescas', 11900, '{vegetariano}', 1, false);

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Principales', 1) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden, destacado) values
      (rid, cid, 'Hamburguesa de carne', 'Pan brioche, carne madurada, papas y salsas de la casa', 16900, '{recomendado}', 0, true),
      (rid, cid, 'Pancho gourmet', 'Salchicha artesanal, papas y salsa de queso', 12500, '{}', 1, false);

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Café y postres', 2) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden, destacado) values
      (rid, cid, 'Café V60', 'Filtrado a mano con granos de especialidad', 5200, '{}', 0, false),
      (rid, cid, 'Mil hojas', 'Hojaldre, crema pastelera y azúcar impalpable', 8900, '{vegetariano}', 1, false);

    insert into public.mesas (restaurante_id, numero)
    select rid, n::text from generate_series(1, 8) n;
  end if;

  update public.restaurantes set tema = 'gala', color_primario = '#c9a96a' where id = rid;
end;
$$;

-- Vivero Hoja · diseño vitrina
do $$
declare
  rid uuid;
  cid uuid;
begin
  select id into rid from public.restaurantes where slug = 'vivero-hoja';

  if rid is null then
    insert into public.restaurantes (slug, nombre, descripcion, color_primario, color_fondo, moneda, whatsapp)
    values ('vivero-hoja', 'Vivero Hoja', 'Plantas de interior con maceta incluida', '#8bc34a', '#1b231d', 'CLP', '56900000000')
    returning id into rid;

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Más vendidas', 0) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden, destacado) values
      (rid, cid, 'Croton', 'Hojas manchadas de amarillo, maceta de cerámica', 18900, '{}', 0, false),
      (rid, cid, 'Pothos de escritorio', 'Ideal para la oficina, aguanta poca luz', 21900, '{recomendado}', 1, false),
      (rid, cid, 'Haworthia', 'Suculenta de poco riego, maceta blanca', 24900, '{}', 2, false);

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Novedades', 1) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden, destacado) values
      (rid, cid, 'Cactus', 'Maceta de barro, casi no necesita riego', 15900, '{}', 0, false),
      (rid, cid, 'Monstera', 'Con base de madera, para living', 45900, '{nuevo}', 1, true),
      (rid, cid, 'Dracaena', 'Maceta blanca, le gusta mucha luz', 39900, '{}', 2, false);

    insert into public.mesas (restaurante_id, numero)
    select rid, n::text from generate_series(1, 8) n;
  end if;

  update public.restaurantes set tema = 'vitrina', color_primario = '#8bc34a' where id = rid;
end;
$$;

-- Pizzería Don Ciro · diseño cinta
do $$
declare
  rid uuid;
  cid uuid;
begin
  select id into rid from public.restaurantes where slug = 'don-ciro';

  if rid is null then
    insert into public.restaurantes (slug, nombre, descripcion, color_primario, color_fondo, moneda, whatsapp)
    values ('don-ciro', 'Pizzería Don Ciro', 'Menú especial · Delivery gratis', '#d62828', '#efe6d3', 'CLP', '56900000000')
    returning id into rid;

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Pizzas saladas', 0) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden, destacado) values
      (rid, cid, 'Muzzarella', 'Masa, salsa especial de tomate, muzzarella, tomate y albahaca', 9900, '{vegetariano}', 0, true),
      (rid, cid, 'Pepperoni', 'Masa, salsa especial de tomate, muzzarella, pepperoni, panceta y cebolla', 11500, '{picante}', 1, false),
      (rid, cid, 'Calabresa', 'Masa, salsa especial de tomate, muzzarella y calabresa', 11500, '{}', 2, false),
      (rid, cid, 'Panceta', 'Masa, salsa especial de tomate, muzzarella y panceta picada', 11900, '{}', 3, false),
      (rid, cid, 'Caprese', 'Masa, salsa especial de tomate, muzzarella, champiñones, aceitunas negras y pollo', 12900, '{}', 4, false),
      (rid, cid, 'Camarón', 'Masa, salsa especial de tomate, muzzarella y camarones frescos', 16900, '{nuevo}', 5, true);

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Pizzas dulces', 1) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden, destacado) values
      (rid, cid, 'Banana', 'Masa, dulce de leche, muzzarella, banana y canela', 11900, '{vegetariano}', 0, false),
      (rid, cid, 'Frutilla', 'Masa, chocolate blanco, frutillas y salsa de chocolate', 11900, '{vegetariano}', 1, false);

    insert into public.mesas (restaurante_id, numero)
    select rid, n::text from generate_series(1, 8) n;
  end if;

  update public.restaurantes set tema = 'cinta', color_primario = '#d62828' where id = rid;
end;
$$;

-- Trattoria Roma · diseño trattoria
do $$
declare
  rid uuid;
  cid uuid;
begin
  select id into rid from public.restaurantes where slug = 'trattoria-roma';

  if rid is null then
    insert into public.restaurantes (slug, nombre, descripcion, color_primario, color_fondo, moneda, whatsapp)
    values ('trattoria-roma', 'Trattoria Roma', 'El sabor de Italia en tu mesa', '#d7263d', '#151515', 'CLP', '56900000000')
    returning id into rid;

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Pizzas', 0) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden, destacado) values
      (rid, cid, 'Margarita', 'Tomate, mozzarella y albahaca', 10500, '{vegetariano}', 0, true),
      (rid, cid, 'Marinara', 'Tomate, ajo y orégano', 9500, '{vegano}', 1, false),
      (rid, cid, 'Diavola', 'Tomate, mozzarella y salame picante', 11900, '{picante}', 2, false),
      (rid, cid, 'Calzone', 'Tomate, mozzarella, jamón y champiñones', 12500, '{}', 3, false),
      (rid, cid, 'Capricciosa', 'Tomate, mozzarella, jamón, champiñones, alcauciles y aceitunas', 12900, '{recomendado}', 4, false),
      (rid, cid, 'Vegetariana', 'Tomate, mozzarella, morrones, zucchini, berenjena y cebolla', 11500, '{vegetariano}', 5, false),
      (rid, cid, 'Prosciutto e funghi', 'Tomate, mozzarella, jamón crudo y champiñones', 12500, '{}', 6, false),
      (rid, cid, 'Mozzarella', 'Tomate, mozzarella y albahaca', 9900, '{vegetariano}', 7, false);

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Entradas', 1) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden, destacado) values
      (rid, cid, 'Gazpacho', 'Sopa fría de tomate', 5500, '{vegano}', 0, false),
      (rid, cid, 'Pan de ajo', '4 piezas', 4500, '{vegetariano}', 1, false),
      (rid, cid, 'Affogato', 'Helado de vainilla con espresso', 5200, '{vegetariano}', 2, false);

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Bebidas', 2) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden, destacado) values
      (rid, cid, 'Gaseosa cola', null, 2800, '{}', 0, false),
      (rid, cid, 'Gaseosa lima-limón', null, 2800, '{}', 1, false),
      (rid, cid, 'Cola light', null, 2800, '{}', 2, false),
      (rid, cid, 'Capuchino', null, 3500, '{}', 3, false);

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Postres', 3) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden, destacado) values
      (rid, cid, 'Tiramisú', 'Receta de la nonna', 6500, '{vegetariano}', 0, true),
      (rid, cid, 'Helado', 'Dos bochas a elección', 4800, '{vegetariano}', 1, false);

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Menús', 4) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden, destacado) values
      (rid, cid, 'Menú clásico', '1 pizza a elección + 1 bebida', 12900, '{}', 0, false),
      (rid, cid, 'Menú gourmet', '3 pizzas a elección, 6 bebidas y 3 postres', 45900, '{}', 1, false),
      (rid, cid, 'Menú familia', '5 pizzas, 5 entradas, 5 postres y 10 bebidas', 89900, '{recomendado}', 2, false);

    insert into public.mesas (restaurante_id, numero)
    select rid, n::text from generate_series(1, 8) n;
  end if;

  update public.restaurantes set tema = 'trattoria', color_primario = '#d7263d' where id = rid;
end;
$$;

-- La Porción · diseño kraft
do $$
declare
  rid uuid;
  cid uuid;
begin
  select id into rid from public.restaurantes where slug = 'la-porcion';

  if rid is null then
    insert into public.restaurantes (slug, nombre, descripcion, color_primario, color_fondo, moneda, whatsapp)
    values ('la-porcion', 'La Porción', 'Pizza por porción, recién salida del horno', '#c0392b', '#f4ede1', 'CLP', '56900000000')
    returning id into rid;

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Porciones', 0) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden, destacado) values
      (rid, cid, 'Margarita', 'Tomate, muzzarella y albahaca', 3200, '{vegetariano}', 0, false),
      (rid, cid, 'Pepperoni', 'Muzzarella y pepperoni', 3600, '{}', 1, true),
      (rid, cid, 'Hawaiana', 'Muzzarella, jamón y ananá', 3600, '{}', 2, false),
      (rid, cid, 'Vegetariana', 'Muzzarella, hongos, morrón, aceitunas y cebolla', 3500, '{vegetariano}', 3, false),
      (rid, cid, 'Carnívora', 'Muzzarella, pepperoni, carne y salchicha', 3900, '{recomendado}', 4, true),
      (rid, cid, 'Pizza blanca', 'Muzzarella, ricota y ajo', 3400, '{vegetariano}', 5, false),
      (rid, cid, 'Pizza de pollo BBQ', 'Muzzarella, pollo, salsa barbacoa y cebolla morada', 3800, '{}', 6, false),
      (rid, cid, 'Hongos', 'Muzzarella y champiñones', 3500, '{vegetariano}', 7, false),
      (rid, cid, 'Suprema', 'Muzzarella, pepperoni, morrón, aceitunas y cebolla', 3900, '{}', 8, false);

    insert into public.mesas (restaurante_id, numero)
    select rid, n::text from generate_series(1, 8) n;
  end if;

  update public.restaurantes set tema = 'kraft', color_primario = '#c0392b' where id = rid;
end;
$$;

-- Horno de Barrio · diseño madera
do $$
declare
  rid uuid;
  cid uuid;
begin
  select id into rid from public.restaurantes where slug = 'horno-de-barrio';

  if rid is null then
    insert into public.restaurantes (slug, nombre, descripcion, color_primario, color_fondo, moneda, whatsapp)
    values ('horno-de-barrio', 'Horno de Barrio', 'Pizzas a la piedra, como las de antes', '#f4a261', '#6b4423', 'CLP', '56900000000')
    returning id into rid;

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Pizzas', 0) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden, destacado) values
      (rid, cid, 'Margarita', 'Tomate, muzzarella y albahaca', 10500, '{vegetariano}', 0, true),
      (rid, cid, 'Pepperoni', 'Muzzarella y pepperoni', 11900, '{}', 1, false),
      (rid, cid, 'Hawaiana', 'Muzzarella, jamón y ananá', 11900, '{}', 2, false),
      (rid, cid, 'Vegetariana', 'Muzzarella, hongos, morrón, aceitunas y tomate', 11500, '{vegetariano}', 3, false),
      (rid, cid, 'Pizza de pollo BBQ', 'Muzzarella, pollo, salsa barbacoa y verdeo', 12500, '{}', 4, false),
      (rid, cid, 'Carnívora', 'Muzzarella, pepperoni, jamón y carne', 12900, '{recomendado}', 5, false),
      (rid, cid, 'Cuatro quesos', 'Muzzarella, azul, parmesano y provolone', 12500, '{vegetariano}', 6, true),
      (rid, cid, 'Suprema', 'Muzzarella, pepperoni, hongos, morrón y aceitunas', 12900, '{}', 7, false),
      (rid, cid, 'Muzzarella', 'Salsa de tomate y mucha muzzarella', 9900, '{vegetariano}', 8, false);

    insert into public.mesas (restaurante_id, numero)
    select rid, n::text from generate_series(1, 8) n;
  end if;

  update public.restaurantes set tema = 'madera', color_primario = '#f4a261' where id = rid;
end;
$$;

-- Bar Medianoche · diseño coctel
do $$
declare
  rid uuid;
  cid uuid;
begin
  select id into rid from public.restaurantes where slug = 'bar-medianoche';

  if rid is null then
    insert into public.restaurantes (slug, nombre, descripcion, color_primario, color_fondo, moneda, whatsapp)
    values ('bar-medianoche', 'Bar Medianoche', 'Cócteles de autor', '#ff5fa2', '#0d0d0d', 'CLP', '56900000000')
    returning id into rid;

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Cócteles', 0) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden, destacado) values
      (rid, cid, 'Strawberry fizz', 'Licor de frutilla, gin, jugo de limón', 7900, '{}', 0, false),
      (rid, cid, 'Margarita', 'Tequila, cointreau, jugo de limón', 7900, '{}', 1, true),
      (rid, cid, 'Whisky sour', 'Whisky, almíbar, jugo de limón, clara de huevo (opcional)', 8500, '{}', 2, false),
      (rid, cid, 'Negroni', 'Campari, vermut, gin', 8200, '{recomendado}', 3, false),
      (rid, cid, 'Tequila sunrise', 'Tequila, jugo de naranja, jugo de limón, granadina', 7900, '{}', 4, false),
      (rid, cid, 'Piña colada', 'Ananá, jugo de ananá, crema de coco, almíbar de coco, jugo de naranja, ron', 8200, '{}', 5, false),
      (rid, cid, 'Sex on the beach', 'Almíbar de durazno, jugo de naranja, jugo de arándano, jugo de limón, vodka', 7900, '{}', 6, false),
      (rid, cid, 'Cosmopolitan', 'Vodka, cointreau, jugo de arándano, jugo de limón', 8200, '{}', 7, false),
      (rid, cid, 'Sex in the jungle', 'Ron, vodka, maracuyá, licor de melón, blue curaçao, jugo de limón', 8500, '{}', 8, false),
      (rid, cid, 'Daiquiri de frutilla', 'Puré de frutilla, licor de frutilla, frutillas frescas, jugo de naranja, ron', 8200, '{}', 9, false),
      (rid, cid, 'Espresso martini', 'Espresso frío, almíbar de vainilla, licor de café, almíbar', 8500, '{nuevo}', 10, true),
      (rid, cid, 'Blue lagoon', 'Ron, vodka, blue curaçao, malibú, jugo de naranja', 8200, '{}', 11, false),
      (rid, cid, 'Pink panther', 'Crema, granadina, jugo de limón, almíbar de menta, malibú, triple sec', 8200, '{}', 12, false),
      (rid, cid, 'Mojito', 'Almíbar de menta, jugo de limón, hojas de menta, ron, almíbar', 7500, '{}', 13, false);

    insert into public.mesas (restaurante_id, numero)
    select rid, n::text from generate_series(1, 8) n;
  end if;

  update public.restaurantes set tema = 'coctel', color_primario = '#ff5fa2' where id = rid;
end;
$$;

-- Café Folio · diseño revista
do $$
declare
  rid uuid;
  cid uuid;
begin
  select id into rid from public.restaurantes where slug = 'cafe-folio';

  if rid is null then
    insert into public.restaurantes (slug, nombre, descripcion, color_primario, color_fondo, moneda, whatsapp)
    values ('cafe-folio', 'Café Folio', 'Cocina de estación', '#b8452f', '#f5efe6', 'CLP', '56900000000')
    returning id into rid;

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Entradas', 0) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden, destacado) values
      (rid, cid, 'Provoleta a la parrilla', 'Con orégano, ají molido y aceite de oliva', 7900, '{vegetariano}', 0, false),
      (rid, cid, 'Empanadas de carne cortada a cuchillo', 'Dos unidades, horneadas en barro', 5800, '{}', 1, false),
      (rid, cid, 'Burrata con tomates asados', 'Pesto de albahaca y pan de masa madre', 9800, '{vegetariano}', 2, true);

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Principales', 1) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden, destacado) values
      (rid, cid, 'Bife de chorizo', '400 g a la parrilla con papas rústicas', 21900, '{recomendado}', 0, true),
      (rid, cid, 'Sorrentinos de calabaza', 'Con manteca de salvia y nueces', 14500, '{vegetariano}', 1, false),
      (rid, cid, 'Pollo al limón', 'Con puré de papas y verdes', 13900, '{}', 2, false),
      (rid, cid, 'Risotto de hongos', 'Hongos de pino, parmesano y perejil', 15500, '{vegetariano}', 3, false);

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Postres', 2) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden, destacado) values
      (rid, cid, 'Flan casero', 'Con dulce de leche y crema', 5500, '{vegetariano}', 0, false),
      (rid, cid, 'Tiramisú', 'Receta clásica italiana', 6500, '{vegetariano}', 1, false),
      (rid, cid, 'Panqueques con dulce de leche', 'Caramelizados con azúcar', 5900, '{vegetariano}', 2, false);

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Vinos por copa', 3) returning id into cid;
    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, etiquetas, orden, destacado) values
      (rid, cid, 'Malbec reserva', 'Valle de Uco, Mendoza', 6500, '{}', 0, false),
      (rid, cid, 'Torrontés', 'Cafayate, Salta', 5500, '{}', 1, false),
      (rid, cid, 'Espumante extra brut', 'Método tradicional', 5900, '{}', 2, false);

    insert into public.mesas (restaurante_id, numero)
    select rid, n::text from generate_series(1, 8) n;
  end if;

  update public.restaurantes set tema = 'revista', color_primario = '#b8452f' where id = rid;
end;
$$;
