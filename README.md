# Mesitto

Plataforma multi-restaurante de cartas digitales con QR. Cada restaurante tiene su carta pública en `/<slug>` y un panel en `/panel` donde el dueño edita categorías, platos, precios, fotos, marca y descarga los QR.

Stack: Next.js 15 (App Router) + Supabase (Postgres, Auth, Storage, RLS) + Vercel.

## Qué incluye (fase 1 · MVP)

- **Carta pública** `/<slug>?mesa=7`: rápida, pensada para el móvil, cacheada y regenerada al guardar en el panel. Muestra la mesa y un botón de WhatsApp.
- **Panel del dueño** `/panel`: categorías y platos con foto, precio, descripción y etiquetas; precio editable en línea; interruptor de agotado; reordenar arrastrando; ocultar categorías.
- **Marca** `/panel/marca`: logo, colores con vista previa, moneda, WhatsApp. El país (moneda, zona horaria y código de WhatsApp sugeridos) se elige al crear el restaurante y se cambia en Personalizar; por defecto, Chile (CLP, America/Santiago).
- **Códigos QR** `/panel/qr`: QR general (PNG y SVG), QR por mesa (PNG) y hoja PDF A4 con 6 tarjetas para imprimir.
- **Cuentas**: registro, login, recuperar contraseña. Las fotos se comprimen en el navegador a WebP de 1200 px antes de subirlas.
- **Diseños de carta**: Clásico, Noche, Esmeralda, Comida rápida y Retro, elegibles en Marca con vista previa.
- **Idiomas**: la carta se escribe en español y se puede ofrecer en inglés, portugués, francés, italiano y alemán. Se abre sola en el idioma del teléfono y tiene un botón para cambiarlo. Las traducciones de platos y categorías se cargan en el panel.
- **Pedidos por WhatsApp**: el cliente arma su pedido en la carta y lo envía al WhatsApp del local (o de la sucursal) con mesa, total y notas.
- **Sucursales** `/panel/sucursales`: misma carta, con dirección, horario, WhatsApp y QR de mesa propios (`/<slug>?s=centro&mesa=4`).
- **Estadísticas** `/panel/estadisticas`: visitas por día, hora, mesa e idioma, pedidos y lo más pedido.
- **QR con logo**: logo al centro y color de la marca en PNG, SVG y PDF.
- **Administración** `/admin`: todos los restaurantes, plan, pausar/reactivar, entrar a editar la carta de un cliente y crear restaurantes para clientes.
- **Seguridad**: RLS en todas las tablas. Cada dueño solo ve y edita su restaurante; la carta pública solo lee restaurantes activos, categorías visibles y platos disponibles. El dueño no puede cambiar su plan ni su dirección.

## Puesta en marcha

1. Crea un proyecto en [Supabase](https://supabase.com).
2. En **SQL Editor**, ejecuta en orden todos los archivos de `supabase/migrations/` (de 0001 a 0013). Opcional: `supabase/seed.sql` crea la carta de ejemplo `/la-esquina` y `supabase/seed_cafe.sql` la cafetería `/aroma-cafe` con 36 bebidas, fotos y traducciones. `supabase/seed_disenos.sql` (después de 0006) crea una carta demo por cada diseño nuevo: `/la-esquina-verde` (Bistró), `/jardin-veggie` (Dorado), `/forno-pizzeria` (Forno), `/warung-oriente` (Oriente) y `/neon-tokio` (Neón). `supabase/seed_disenos_2.sql` (después de 0007) suma 11 cartas demo más, una por diseño nuevo (Tropical, Natural, Soleado, Gala, Vitrina, Cinta, Trattoria, Kraft, Madera, Cóctel y Revista), y marca algunos platos como destacados.
3. Para entrar a `/admin`, date permiso de superadmin con tu correo:
   ```sql
   insert into public.superadmins (user_id) select id from auth.users where email = 'tu@correo.com';
   ```
4. En **Authentication → URL Configuration**:
   - *Site URL*: la URL pública de la app (por ejemplo `https://tumenu.com`).
   - *Redirect URLs*: añade `https://tumenu.com/auth/confirm` (y `http://localhost:3000/auth/confirm` para desarrollo).
5. Copia `.env.example` a `.env.local` y rellena las variables (Supabase → Project Settings → API).
6. `npm install` y `npm run dev`. Abre http://localhost:3000.

## Publicar en Vercel

1. Importa el repositorio en Vercel.
2. Añade las tres variables de `.env.example` en *Settings → Environment Variables*. Los QR y los correos usan la dirección desde la que se abre el panel; `NEXT_PUBLIC_SITE_URL` solo se usa en el servidor. Antes de imprimir QR, entra al panel desde el dominio final.
3. Deploy. Recuerda que el plan gratis de Vercel no permite uso comercial: pasa a Pro al empezar a cobrar.

## Dar de alta un restaurante

- **El dueño solo**: entra a `/registro`, pone el nombre del local y su correo.
- **Tú por él**: en `/admin` → "Restaurante para un cliente". Quedas como dueño y lo eliges arriba en el panel para armarle la carta.
- **Editar la carta de un cliente**: en `/admin` → "Editar carta" te suma como staff de ese restaurante.
- Para darle el restaurante a su dueño, añade una fila en `public.usuarios` con su `user_id`, el `restaurante_id` y `rol = 'dueno'`.
- Plan y pausa (`plan`, `activo`) se cambian en `/admin`. Pausar un restaurante oculta su carta al momento.

Las fotos de `public/demo/cafe` salen de una infografía de terceros y son solo para la demo: para clientes reales usa fotos propias o libres de derechos.

## Estructura

```
src/app/[slug]/          carta pública
src/app/panel/           panel del dueño (carta, marca, qr, sucursales, estadísticas)
src/app/admin/           administración del servicio (superadmin)
src/components/carta/    diseños de la carta, idiomas, pedidos y barra inferior
src/app/login|registro|recuperar|nueva-clave/
src/app/auth/confirm/    enlaces de correo (confirmar cuenta, recuperar contraseña)
src/lib/                 clientes de Supabase, tipos, QR/PDF, fotos
supabase/                migración SQL y datos de ejemplo
```

## Imágenes por defecto

Si el restaurante activa **Marca → Imágenes por defecto**, los platos sin foto muestran una ilustración según su nombre o descripción (pizza, café, cerveza, etc.). Se guarda en `restaurantes.ajustes.imagenes_defecto`, así que no necesita SQL. Las imágenes de `public/defecto` son [Fluent Emoji](https://github.com/microsoft/fluentui-emoji) de Microsoft, con licencia MIT (ver `public/defecto/LICENSE.txt`), que permite el uso comercial.
