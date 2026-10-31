# Correos de Supabase Auth con el diseño de Platovi

Estos HTML reemplazan los correos en inglés que Supabase manda por defecto (confirmar cuenta, recuperar
contraseña, etc.). Se arman con `node scripts/correos-supabase.mjs` a partir de `src/lib/correo.ts`, el mismo
diseño de los correos que manda la app. Si cambias el diseño, vuelve a correr el script y a pegarlos.

## Cómo pegarlos (5 minutos)

1. Entra a Supabase → tu proyecto → **Authentication** → **Emails** → pestaña **Templates**.
2. Para cada plantilla de la tabla: elígela, copia el asunto en **Subject**, abre el archivo, copia **todo** su
   contenido y pégalo en **Body** (modo *Source* / código, reemplazando lo que había). Luego **Save changes**.

| Plantilla en Supabase | Asunto | Archivo |
| --- | --- | --- |
| Confirm signup | Confirma tu correo para empezar con Platovi | `confirmar-registro.html` |
| Invite user | Te invitaron a Platovi | `invitacion.html` |
| Magic Link | Tu enlace para entrar a Platovi | `enlace-magico.html` |
| Change Email Address | Confirma tu nuevo correo en Platovi | `cambiar-correo.html` |
| Reset Password | Crea una contraseña nueva para Platovi | `recuperar-clave.html` |
| Reauthentication | Tu código de seguridad de Platovi | `codigo-seguridad.html` |

3. Revisa en **Authentication → URL Configuration** que **Site URL** sea la dirección de la app
   (hoy `https://menu-qr-ivory.vercel.app`; con el dominio propio, `https://platovi.cl`).
   El logo del correo se carga desde `{{ .SiteURL }}/correo/logo.png`.

## Remitente: que diga "Platovi" y no "Supabase Auth"

El remitente y el límite de envío no se cambian con las plantillas. Con el correo de prueba de Supabase:

- el remitente siempre es `Supabase Auth <noreply@mail.app.supabase.io>`,
- manda muy pocos correos por hora,
- y **solo llega a correos del equipo de tu organización en Supabase**, no a tus clientes.

Para producción conecta tu propio SMTP. Con Resend (gratis hasta 3.000 correos al mes):

1. En resend.com agrega y verifica tu dominio (por ejemplo `platovi.cl`) con los registros DNS que te indica.
2. Crea una API key.
3. En Supabase → **Authentication** → **Emails** → **SMTP Settings** → activa **Custom SMTP**:
   - Sender email: `hola@platovi.cl` · Sender name: `Platovi`
   - Host: `smtp.resend.com` · Port: `465` · Username: `resend` · Password: la API key
4. Usa la misma key en Vercel como `RESEND_API_KEY` y `AVISOS_CORREO_DE="Platovi <hola@platovi.cl>"` para los
   avisos de la prueba de 14 días.
