-- Carta de demostración "Aroma Café" (cafetería, 36 bebidas con foto y precios en pesos chilenos).
-- Las fotos están en public/demo/cafe del propio sitio, así que no hace falta subir nada.
-- Se puede ejecutar más de una vez: si la carta ya existe, solo actualiza las traducciones.
-- Las traducciones necesitan la migración 0003; si aún no la ejecutaste, vuelve a correr este archivo después.

do $$
declare
  rid uuid;
  cats jsonb := '{}';
  cid uuid;
begin
  select id into rid from public.restaurantes where slug = 'aroma-cafe';

  if rid is null then
    insert into public.restaurantes (slug, nombre, descripcion, color_primario, color_fondo, moneda, whatsapp)
    values ('aroma-cafe', 'Aroma Café', 'Café de especialidad tostado en casa', '#c8894a', '#fffbf5', 'CLP', '56900000000')
    returning id into rid;

    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Clásicos', 0) returning id into cid;
    cats := cats || jsonb_build_object('clasicos', cid);
    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Con leche', 1) returning id into cid;
    cats := cats || jsonb_build_object('con-leche', cid);
    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Especiales de la casa', 2) returning id into cid;
    cats := cats || jsonb_build_object('especiales', cid);
    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Fríos', 3) returning id into cid;
    cats := cats || jsonb_build_object('frios', cid);
    insert into public.categorias (restaurante_id, nombre, orden) values (rid, 'Con alcohol', 4) returning id into cid;
    cats := cats || jsonb_build_object('con-alcohol', cid);

    insert into public.platos (restaurante_id, categoria_id, nombre, descripcion, precio, foto_url, etiquetas, orden) values
      (rid, (cats->>'clasicos')::uuid, 'Espresso', 'Shot corto e intenso de nuestro blend de la casa', 2600, '/demo/cafe/espresso.webp', '{recomendado}', 0),
      (rid, (cats->>'clasicos')::uuid, 'Ristretto', 'Más corto y concentrado que un espresso', 2600, '/demo/cafe/ristretto.webp', '{}', 1),
      (rid, (cats->>'clasicos')::uuid, 'Doppio', 'Doble espresso para los que necesitan energía', 3300, '/demo/cafe/doppio.webp', '{}', 2),
      (rid, (cats->>'clasicos')::uuid, 'Lungo', 'Espresso largo, más suave y aromático', 2800, '/demo/cafe/lungo.webp', '{}', 3),
      (rid, (cats->>'clasicos')::uuid, 'Americano', 'Espresso alargado con agua caliente', 3000, '/demo/cafe/americano.webp', '{}', 4),
      (rid, (cats->>'clasicos')::uuid, 'Red Eye', 'Café de filtro con un shot de espresso', 3600, '/demo/cafe/red-eye.webp', '{}', 5),
      (rid, (cats->>'clasicos')::uuid, 'Café con achicoria', 'Receta de Nueva Orleans, suave y tostado', 3200, '/demo/cafe/chicory-coffee.webp', '{vegano}', 6),
      (rid, (cats->>'clasicos')::uuid, 'Café turco', 'Molienda extra fina hervida en cezve, con cardamomo', 3800, '/demo/cafe/turkish-coffee.webp', '{vegano}', 7),
      (rid, (cats->>'con-leche')::uuid, 'Cortado', 'Espresso con un toque de leche texturizada', 3000, '/demo/cafe/cortado.webp', '{recomendado}', 0),
      (rid, (cats->>'con-leche')::uuid, 'Macchiato', 'Espresso manchado con espuma de leche', 3000, '/demo/cafe/macchiato.webp', '{}', 1),
      (rid, (cats->>'con-leche')::uuid, 'Piccolo latte', 'Un latte chiquito, ristretto y leche sedosa', 3300, '/demo/cafe/piccolo-latte.webp', '{}', 2),
      (rid, (cats->>'con-leche')::uuid, 'Flat white', 'Doble ristretto con microespuma fina', 3900, '/demo/cafe/flat-white.webp', '{recomendado}', 3),
      (rid, (cats->>'con-leche')::uuid, 'Cappuccino', 'Espresso, leche y abundante espuma con cacao', 3900, '/demo/cafe/cappuccino.webp', '{}', 4),
      (rid, (cats->>'con-leche')::uuid, 'Latte', 'Espresso con mucha leche y arte latte', 4100, '/demo/cafe/latte.webp', '{}', 5),
      (rid, (cats->>'con-leche')::uuid, 'Café con leche', 'Café de filtro y leche caliente, mitad y mitad', 3500, '/demo/cafe/cafe-au-lait.webp', '{}', 6),
      (rid, (cats->>'con-leche')::uuid, 'Breve', 'Latte preparado con crema de leche, extra cremoso', 4300, '/demo/cafe/breve.webp', '{}', 7),
      (rid, (cats->>'con-leche')::uuid, 'Espresso con panna', 'Espresso coronado con crema batida', 3400, '/demo/cafe/con-panna.webp', '{vegetariano}', 8),
      (rid, (cats->>'con-leche')::uuid, 'Latte descafeinado', 'Todo el sabor, sin cafeína', 4100, '/demo/cafe/decaf-latte.webp', '{}', 9),
      (rid, (cats->>'especiales')::uuid, 'Mocha', 'Espresso, chocolate amargo, leche y crema', 4700, '/demo/cafe/mocha.webp', '{recomendado}', 0),
      (rid, (cats->>'especiales')::uuid, 'Caramel macchiato', 'Leche vainillada, espresso y salsa de caramelo', 4800, '/demo/cafe/caramel-macchiato.webp', '{}', 1),
      (rid, (cats->>'especiales')::uuid, 'Latte de vainilla', 'Con almíbar de vainilla natural', 4500, '/demo/cafe/vanilla-latte.webp', '{}', 2),
      (rid, (cats->>'especiales')::uuid, 'Pumpkin spice latte', 'Calabaza, canela, nuez moscada y crema', 5200, '/demo/cafe/pumpkin-spice-latte.webp', '{nuevo}', 3),
      (rid, (cats->>'especiales')::uuid, 'Dirty chai', 'Chai latte especiado con un shot de espresso', 4900, '/demo/cafe/dirty-chai.webp', '{picante}', 4),
      (rid, (cats->>'especiales')::uuid, 'Café vienés', 'Doble espresso con crema batida y cacao', 4400, '/demo/cafe/vienna-coffee.webp', '{}', 5),
      (rid, (cats->>'especiales')::uuid, 'Café cubano', 'Espresso endulzado con espumita de azúcar', 3400, '/demo/cafe/cuban-coffee.webp', '{}', 6),
      (rid, (cats->>'especiales')::uuid, 'Café bombón', 'Espresso sobre leche condensada', 3800, '/demo/cafe/cafe-bombon.webp', '{vegetariano}', 7),
      (rid, (cats->>'frios')::uuid, 'Cold brew', 'Infusionado en frío durante 18 horas', 4500, '/demo/cafe/cold-brew.webp', '{vegano}', 0),
      (rid, (cats->>'frios')::uuid, 'Nitro cold brew', 'Cold brew con nitrógeno, textura de cerveza negra', 5200, '/demo/cafe/nitro-cold-brew.webp', '{nuevo}', 1),
      (rid, (cats->>'frios')::uuid, 'Americano helado', 'Espresso, agua fría y mucho hielo', 3600, '/demo/cafe/iced-americano.webp', '{vegano}', 2),
      (rid, (cats->>'frios')::uuid, 'Latte helado', 'Espresso sobre leche fría y hielo', 4300, '/demo/cafe/iced-latte.webp', '{}', 3),
      (rid, (cats->>'frios')::uuid, 'Espresso tonic', 'Agua tónica, hielo, limón y espresso', 4600, '/demo/cafe/espresso-tonic.webp', '{recomendado}', 4),
      (rid, (cats->>'frios')::uuid, 'Frappuccino', 'Licuado de café con hielo, crema y chocolate', 5400, '/demo/cafe/frappuccino.webp', '{}', 5),
      (rid, (cats->>'frios')::uuid, 'Frappé', 'Café instantáneo batido con hielo, bien espumoso', 4400, '/demo/cafe/frappe.webp', '{}', 6),
      (rid, (cats->>'frios')::uuid, 'Affogato', 'Bocha de helado de vainilla ahogada en espresso', 4900, '/demo/cafe/affogato.webp', '{vegetariano}', 7),
      (rid, (cats->>'con-alcohol')::uuid, 'Irish coffee', 'Whisky irlandés, café, azúcar y crema', 7200, '/demo/cafe/irish-coffee.webp', '{}', 0),
      (rid, (cats->>'con-alcohol')::uuid, 'Caffè corretto', 'Espresso «corregido» con grappa o anís', 5600, '/demo/cafe/caffe-corretto.webp', '{}', 1);

    insert into public.mesas (restaurante_id, numero)
    select rid, n::text from generate_series(1, 8) n;

    -- Diseño "Retro" si ya está la migración 0002.
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'restaurantes' and column_name = 'tema') then
      update public.restaurantes set tema = 'retro' where id = rid;
    end if;
  end if;

  -- Traducciones al inglés y portugués (migración 0003).
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'platos' and column_name = 'traducciones') then
    update public.restaurantes set idiomas = '{en,pt}',
      traducciones = '{"en": {"descripcion": "Specialty coffee roasted in house"}, "pt": {"descripcion": "Café especial torrado na casa"}}'
    where id = rid;

    update public.categorias c set traducciones = t.tr from (values
      ('Clásicos', '{"en": {"nombre": "Classics"}, "pt": {"nombre": "Clássicos"}}'::jsonb),
      ('Con leche', '{"en": {"nombre": "With milk"}, "pt": {"nombre": "Com leite"}}'::jsonb),
      ('Especiales de la casa', '{"en": {"nombre": "House specials"}, "pt": {"nombre": "Especiais da casa"}}'::jsonb),
      ('Fríos', '{"en": {"nombre": "Iced & cold"}, "pt": {"nombre": "Gelados"}}'::jsonb),
      ('Con alcohol', '{"en": {"nombre": "Spiked"}, "pt": {"nombre": "Com álcool"}}'::jsonb)
    ) t(nombre, tr) where c.restaurante_id = rid and c.nombre = t.nombre;

    update public.platos p set traducciones = t.tr from (values
      ('Espresso', '{"en": {"nombre": "Espresso", "descripcion": "A short, intense shot of our house blend"}, "pt": {"nombre": "Espresso", "descripcion": "Dose curta e intensa do nosso blend da casa"}}'::jsonb),
      ('Ristretto', '{"en": {"nombre": "Ristretto", "descripcion": "Shorter and more concentrated than an espresso"}, "pt": {"nombre": "Ristretto", "descripcion": "Mais curto e concentrado que um espresso"}}'::jsonb),
      ('Doppio', '{"en": {"nombre": "Doppio", "descripcion": "Double espresso for an extra kick"}, "pt": {"nombre": "Doppio", "descripcion": "Espresso duplo para quem precisa de energia"}}'::jsonb),
      ('Lungo', '{"en": {"nombre": "Lungo", "descripcion": "A long espresso, smoother and more aromatic"}, "pt": {"nombre": "Lungo", "descripcion": "Espresso longo, mais suave e aromático"}}'::jsonb),
      ('Americano', '{"en": {"nombre": "Americano", "descripcion": "Espresso topped up with hot water"}, "pt": {"nombre": "Americano", "descripcion": "Espresso com água quente"}}'::jsonb),
      ('Red Eye', '{"en": {"nombre": "Red Eye", "descripcion": "Filter coffee with a shot of espresso"}, "pt": {"nombre": "Red Eye", "descripcion": "Café coado com uma dose de espresso"}}'::jsonb),
      ('Café con achicoria', '{"en": {"nombre": "Chicory coffee", "descripcion": "New Orleans style, mellow and toasty"}, "pt": {"nombre": "Café com chicória", "descripcion": "Receita de Nova Orleans, suave e tostado"}}'::jsonb),
      ('Café turco', '{"en": {"nombre": "Turkish coffee", "descripcion": "Extra-fine grind brewed in a cezve, with cardamom"}, "pt": {"nombre": "Café turco", "descripcion": "Moagem extrafina fervida no cezve, com cardamomo"}}'::jsonb),
      ('Cortado', '{"en": {"nombre": "Cortado", "descripcion": "Espresso cut with a little steamed milk"}, "pt": {"nombre": "Cortado", "descripcion": "Espresso com um toque de leite vaporizado"}}'::jsonb),
      ('Macchiato', '{"en": {"nombre": "Macchiato", "descripcion": "Espresso marked with milk foam"}, "pt": {"nombre": "Macchiato", "descripcion": "Espresso manchado com espuma de leite"}}'::jsonb),
      ('Piccolo latte', '{"en": {"nombre": "Piccolo latte", "descripcion": "A tiny latte: ristretto and silky milk"}, "pt": {"nombre": "Piccolo latte", "descripcion": "Um latte pequeno: ristretto e leite sedoso"}}'::jsonb),
      ('Flat white', '{"en": {"nombre": "Flat white", "descripcion": "Double ristretto with velvety microfoam"}, "pt": {"nombre": "Flat white", "descripcion": "Ristretto duplo com microespuma fina"}}'::jsonb),
      ('Cappuccino', '{"en": {"nombre": "Cappuccino", "descripcion": "Espresso, milk and plenty of foam dusted with cocoa"}, "pt": {"nombre": "Cappuccino", "descripcion": "Espresso, leite e muita espuma com cacau"}}'::jsonb),
      ('Latte', '{"en": {"nombre": "Latte", "descripcion": "Espresso with lots of milk and latte art"}, "pt": {"nombre": "Latte", "descripcion": "Espresso com bastante leite e latte art"}}'::jsonb),
      ('Café con leche', '{"en": {"nombre": "Café au lait", "descripcion": "Filter coffee and hot milk, half and half"}, "pt": {"nombre": "Café com leite", "descripcion": "Café coado e leite quente, meio a meio"}}'::jsonb),
      ('Breve', '{"en": {"nombre": "Breve", "descripcion": "A latte made with half-and-half, extra creamy"}, "pt": {"nombre": "Breve", "descripcion": "Latte feito com creme de leite, extra cremoso"}}'::jsonb),
      ('Espresso con panna', '{"en": {"nombre": "Espresso con panna", "descripcion": "Espresso topped with whipped cream"}, "pt": {"nombre": "Espresso con panna", "descripcion": "Espresso coberto com chantilly"}}'::jsonb),
      ('Latte descafeinado', '{"en": {"nombre": "Decaf latte", "descripcion": "All the flavour, none of the caffeine"}, "pt": {"nombre": "Latte descafeinado", "descripcion": "Todo o sabor, sem cafeína"}}'::jsonb),
      ('Mocha', '{"en": {"nombre": "Mocha", "descripcion": "Espresso, dark chocolate, milk and cream"}, "pt": {"nombre": "Mocha", "descripcion": "Espresso, chocolate amargo, leite e chantilly"}}'::jsonb),
      ('Caramel macchiato', '{"en": {"nombre": "Caramel macchiato", "descripcion": "Vanilla milk, espresso and caramel drizzle"}, "pt": {"nombre": "Caramel macchiato", "descripcion": "Leite com baunilha, espresso e calda de caramelo"}}'::jsonb),
      ('Latte de vainilla', '{"en": {"nombre": "Vanilla latte", "descripcion": "With natural vanilla syrup"}, "pt": {"nombre": "Latte de baunilha", "descripcion": "Com calda de baunilha natural"}}'::jsonb),
      ('Pumpkin spice latte', '{"en": {"nombre": "Pumpkin spice latte", "descripcion": "Pumpkin, cinnamon, nutmeg and cream"}, "pt": {"nombre": "Pumpkin spice latte", "descripcion": "Abóbora, canela, noz-moscada e chantilly"}}'::jsonb),
      ('Dirty chai', '{"en": {"nombre": "Dirty chai", "descripcion": "Spiced chai latte with a shot of espresso"}, "pt": {"nombre": "Dirty chai", "descripcion": "Chai latte especiado com uma dose de espresso"}}'::jsonb),
      ('Café vienés', '{"en": {"nombre": "Vienna coffee", "descripcion": "Double espresso with whipped cream and cocoa"}, "pt": {"nombre": "Café vienense", "descripcion": "Espresso duplo com chantilly e cacau"}}'::jsonb),
      ('Café cubano', '{"en": {"nombre": "Cuban coffee", "descripcion": "Espresso sweetened with a sugar foam"}, "pt": {"nombre": "Café cubano", "descripcion": "Espresso adoçado com espuminha de açúcar"}}'::jsonb),
      ('Café bombón', '{"en": {"nombre": "Café bombón", "descripcion": "Espresso layered over condensed milk"}, "pt": {"nombre": "Café bombom", "descripcion": "Espresso sobre leite condensado"}}'::jsonb),
      ('Cold brew', '{"en": {"nombre": "Cold brew", "descripcion": "Steeped cold for 18 hours"}, "pt": {"nombre": "Cold brew", "descripcion": "Extraído a frio por 18 horas"}}'::jsonb),
      ('Nitro cold brew', '{"en": {"nombre": "Nitro cold brew", "descripcion": "Nitrogen-infused cold brew, stout-like texture"}, "pt": {"nombre": "Nitro cold brew", "descripcion": "Cold brew com nitrogênio, textura de cerveja preta"}}'::jsonb),
      ('Americano helado', '{"en": {"nombre": "Iced americano", "descripcion": "Espresso, cold water and lots of ice"}, "pt": {"nombre": "Americano gelado", "descripcion": "Espresso, água gelada e muito gelo"}}'::jsonb),
      ('Latte helado', '{"en": {"nombre": "Iced latte", "descripcion": "Espresso over cold milk and ice"}, "pt": {"nombre": "Latte gelado", "descripcion": "Espresso sobre leite gelado e gelo"}}'::jsonb),
      ('Espresso tonic', '{"en": {"nombre": "Espresso tonic", "descripcion": "Tonic water, ice, lemon and espresso"}, "pt": {"nombre": "Espresso tônica", "descripcion": "Água tônica, gelo, limão e espresso"}}'::jsonb),
      ('Frappuccino', '{"en": {"nombre": "Frappuccino", "descripcion": "Blended iced coffee with cream and chocolate"}, "pt": {"nombre": "Frappuccino", "descripcion": "Café batido com gelo, chantilly e chocolate"}}'::jsonb),
      ('Frappé', '{"en": {"nombre": "Frappé", "descripcion": "Shaken instant coffee over ice, extra foamy"}, "pt": {"nombre": "Frappé", "descripcion": "Café solúvel batido com gelo, bem espumoso"}}'::jsonb),
      ('Affogato', '{"en": {"nombre": "Affogato", "descripcion": "A scoop of vanilla ice cream drowned in espresso"}, "pt": {"nombre": "Affogato", "descripcion": "Bola de sorvete de baunilha afogada no espresso"}}'::jsonb),
      ('Irish coffee', '{"en": {"nombre": "Irish coffee", "descripcion": "Irish whiskey, coffee, sugar and cream"}, "pt": {"nombre": "Irish coffee", "descripcion": "Uísque irlandês, café, açúcar e creme"}}'::jsonb),
      ('Caffè corretto', '{"en": {"nombre": "Caffè corretto", "descripcion": "Espresso “corrected” with grappa or anise"}, "pt": {"nombre": "Caffè corretto", "descripcion": "Espresso «corrigido» com grappa ou anis"}}'::jsonb)
    ) t(nombre, tr) where p.restaurante_id = rid and p.nombre = t.nombre;
  end if;
end;
$$;
