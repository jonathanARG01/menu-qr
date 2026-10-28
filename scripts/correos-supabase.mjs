// Arma las plantillas de correo de Supabase Auth con el mismo diseño de los correos de la app.
// Uso: node scripts/correos-supabase.mjs  → escribe supabase/correos/*.html
// Después se pegan en Supabase → Authentication → Emails (ver supabase/correos/LEEME.md).
import { writeFileSync } from "node:fs";
import { htmlCorreo } from "../src/lib/correo.ts";

const sitio = "{{ .SiteURL }}";
const enlace = "{{ .ConfirmationURL }}";
const ignorar = "Si no fuiste tú, puedes ignorar este correo: no se hará ningún cambio.";

const plantillas = {
  "confirmar-registro": {
    asunto: "Confirma tu correo para empezar con Mesitto",
    titulo: "¡Bienvenido a Mesitto!",
    resumen: "Confirma tu correo y entra a tu panel para armar tu carta.",
    parrafos: [
      "Gracias por crear tu cuenta. Solo falta confirmar que este correo es tuyo para entrar a tu panel.",
      // Los meseros y cocineros invitados no traen restaurante: entran al de quien los invitó.
      "{{ if .Data.restaurante_nombre }}Apenas confirmes, empieza la prueba gratis de 14 días de <strong>{{ .Data.restaurante_nombre }}</strong>, sin tarjeta: arma tu carta, tu salón y tus códigos QR.{{ else }}Apenas confirmes, entras al panel del restaurante que te invitó.{{ end }}",
    ],
    boton: { texto: "Confirmar mi correo", url: enlace },
    nota: "El enlace sirve una sola vez y caduca en 24 horas.",
    motivo: `Te llega porque se creó una cuenta en Mesitto con {{ .Email }}. ${ignorar}`,
  },
  invitacion: {
    asunto: "Te invitaron a Mesitto",
    titulo: "Te invitaron a Mesitto",
    resumen: "Acepta la invitación y crea tu contraseña.",
    parrafos: ["Te invitaron a usar Mesitto. Acepta la invitación para crear tu contraseña y entrar al panel."],
    boton: { texto: "Aceptar invitación", url: enlace },
    nota: "El enlace sirve una sola vez y caduca en 24 horas.",
    motivo: `Te llega porque alguien invitó a {{ .Email }}. ${ignorar}`,
  },
  "enlace-magico": {
    asunto: "Tu enlace para entrar a Mesitto",
    titulo: "Entra a tu panel",
    resumen: "Toca el botón para entrar sin contraseña.",
    parrafos: ["Toca el botón para entrar a tu panel de Mesitto sin escribir la contraseña."],
    boton: { texto: "Entrar a Mesitto", url: enlace },
    nota: "El enlace sirve una sola vez y caduca en 1 hora.",
    motivo: `Te llega porque se pidió entrar con {{ .Email }}. ${ignorar}`,
  },
  "cambiar-correo": {
    asunto: "Confirma tu nuevo correo en Mesitto",
    titulo: "Confirma tu nuevo correo",
    resumen: "Confirma el cambio de correo de tu cuenta.",
    parrafos: [
      "Pediste cambiar el correo de tu cuenta de <strong>{{ .Email }}</strong> a <strong>{{ .NewEmail }}</strong>.",
      "Confírmalo para empezar a entrar con el correo nuevo.",
    ],
    boton: { texto: "Confirmar el cambio", url: enlace },
    nota: "Hasta que lo confirmes, sigues entrando con tu correo de siempre.",
    motivo: `Si no pediste este cambio, ignora este correo y cambia tu contraseña.`,
  },
  "recuperar-clave": {
    asunto: "Crea una contraseña nueva para Mesitto",
    titulo: "¿Olvidaste tu contraseña?",
    resumen: "Toca el botón para crear una contraseña nueva.",
    parrafos: [
      "Recibimos un pedido para cambiar la contraseña de <strong>{{ .Email }}</strong>. Toca el botón para crear una nueva.",
    ],
    boton: { texto: "Crear contraseña nueva", url: enlace },
    nota: "El enlace sirve una sola vez y caduca en 1 hora.",
    motivo: `Si no lo pediste tú, ignora este correo: tu contraseña actual sigue funcionando.`,
  },
  "codigo-seguridad": {
    asunto: "Tu código de seguridad de Mesitto",
    titulo: "Tu código de seguridad",
    resumen: "Usa este código para confirmar que eres tú.",
    parrafos: [
      "Usa este código para confirmar que eres tú:",
      `<span style="display:inline-block;padding:12px 20px;border-radius:12px;background:#f4f1ea;font:bold 28px/1 ui-monospace,Menlo,Consolas,monospace;letter-spacing:6px;color:#172033">{{ .Token }}</span>`,
    ],
    nota: "El código caduca en pocos minutos. Nadie de Mesitto te lo va a pedir.",
    motivo: ignorar,
  },
};

const asuntos = [];
for (const [archivo, p] of Object.entries(plantillas)) {
  writeFileSync(`supabase/correos/${archivo}.html`, htmlCorreo({ sitio, ...p }) + "\n");
  asuntos.push(`${archivo}: ${p.asunto}`);
}
console.log(asuntos.join("\n"));
