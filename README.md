# Menús QR

Plataforma multi-restaurante de cartas digitales con QR. Cada restaurante tiene su carta pública en `/<slug>` y un panel en `/panel` donde el dueño edita categorías, platos, precios, fotos, marca y descarga los QR.

Stack: Next.js 15 (App Router) + Supabase (Postgres, Auth, Storage, RLS) + Vercel.

## Qué incluye (fase 1 · MVP)

- **Carta pública** `/<slug>?mesa=7`: rápida, pensada para el móvil, cacheada y regenerada al guardar en el panel. Muestra la mesa y un botón de WhatsApp.
- **Panel del dueño** `/panel`: categorías y platos con foto, precio, descripción y etiquetas; precio editable en línea; interruptor de agotado; reordenar arrastrando; ocultar categorías.
- **Marca** `/panel/marca`: logo, colores con vista previa, moneda, WhatsApp.
- **Códigos QR** `/panel/qr`: QR general (PNG y SVG), QR por mesa (PNG) y hoja PDF A4 con 6 tarjetas para imprimir.
- **Cuentas**: registro, login, recuperar contraseña. Las fotos se comprimen en el navegador a WebP de 1200 px antes de subirlas.
- **Seguridad**: RLS en todas las tablas. Cada dueño solo ve y edita su restaurante; la carta pública solo lee restaurantes activos, categorías visibles y platos disponibles. El dueño no puede cambiar su plan ni su dirección.

## Puesta en marcha

1. Crea un proyecto en [Supabase](https://supabase.com).
2. En **SQL Editor**, ejecuta `supabase/migrations/0001_inicial.sql`. Opcional: `supabase/seed.sql` crea la carta de ejemplo `/la-esquina`.
3. En **Authentication → URL Configuration**:
   - *Site URL*: la URL pública de la app (por ejemplo `https://tumenu.com`).
   - *Redirect URLs*: añade `https://tumenu.com/auth/confirm` (y `http://localhost:3000/auth/confirm` para desarrollo).
4. Copia `.env.example` a `.env.local` y rellena las variables (Supabase → Project Settings → API).
5. `npm install` y `npm run dev`. Abre http://localhost:3000.

## Publicar en Vercel

1. Importa el repositorio en Vercel.
2. Añade las tres variables de `.env.example` en *Settings → Environment Variables*. Los QR y los correos usan la dirección desde la que se abre el panel; `NEXT_PUBLIC_SITE_URL` solo se usa en el servidor. Antes de imprimir QR, entra al panel desde el dominio final.
3. Deploy. Recuerda que el plan gratis de Vercel no permite uso comercial: pasa a Pro al empezar a cobrar.

## Dar de alta un restaurante

- **El dueño solo**: entra a `/registro`, pone el nombre del local y su correo.
- **Tú por él**: créale el usuario en Supabase (Authentication → Add user). Al entrar por primera vez el panel le pide el nombre del restaurante y su dirección.
- Para que un usuario edite un restaurante existente (por ejemplo la demo), añade una fila en `public.usuarios` con su `user_id` y el `restaurante_id`.
- Planes y altas/bajas (`plan`, `activo`) se cambian por ahora desde el Table Editor de Supabase. El panel de superadmin queda para una fase siguiente.

## Estructura

```
src/app/[slug]/          carta pública
src/app/panel/           panel del dueño (carta, marca, qr)
src/app/login|registro|recuperar|nueva-clave/
src/app/auth/confirm/    enlaces de correo (confirmar cuenta, recuperar contraseña)
src/lib/                 clientes de Supabase, tipos, QR/PDF, fotos
supabase/                migración SQL y datos de ejemplo
```
