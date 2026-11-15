# Sellito

Tarjeta digital de sellos para cualquier negocio (cafés, peluquerías, barberías, tiendas, lavados de autos…).
Producto de BROTE DIGITAL SpA, **independiente de Platovi**: nace del módulo Platovi Loyalty, pero tiene su propia
app, su propia base de datos (otro proyecto de Supabase), su propio proyecto en Vercel y su propio dominio.
Platovi Loyalty sigue igual dentro de Platovi.

El código vive en esta carpeta (`sellos/`) del repositorio de Platovi solo por comodidad. No importa nada de fuera de
ella, así que se puede mover a un repositorio propio cuando se quiera (`git subtree split --prefix=sellos`).

## Qué hace

- **Negocios**: se registran solos (`/registro`), con 14 días gratis y la tarjeta lista según su rubro.
- **Panel** (`/panel`): clientes, escanear tarjeta, "+ Sumar sello", canjear, corregir (con PIN del dueño si lo pide),
  "Sumar con QR" (QR de un solo uso que el cliente escanea), diseño de la tarjeta (12 diseños), cartel para imprimir,
  datos del negocio y logo, equipo con invitaciones por enlace, plan.
- **Clientes**: se unen en `/u/<negocio>`, ven su tarjeta en `/t/<código>`, la guardan en Google Wallet o en el
  inicio del iPhone, y reciben avisos (sello, premio, cumpleaños, "te extrañamos").
- **Admin** (`/admin`): todos los negocios, activar plan Local o Cadena, pausar, extender la prueba.

## Publicarlo (una sola vez)

1. **Supabase**: crea un proyecto NUEVO (no el de Platovi). En *SQL Editor* ejecuta
   `supabase/migrations/0001_inicial.sql`. En *Authentication → URL Configuration* pon el dominio como *Site URL* y
   agrega `https://<dominio>/auth/confirm` en *Redirect URLs*.
2. **Vercel**: *Add New → Project* → este mismo repositorio → **Root Directory: `sellos`**. Variables de entorno: las
   de `.env.example`. Agrega el dominio en *Settings → Domains*.
3. Crea tu cuenta en la app y conviértete en superadmin (al final del SQL está la línea para hacerlo).

## Desarrollo

```bash
cd sellos
npm install
cp .env.example .env.local   # y completa las variables
npm run dev
```

Marca, dominio, correo, WhatsApp y precios se cambian en `src/lib/marca.ts`. Los rubros y su tarjeta sugerida, en
`src/lib/rubros.ts`.
