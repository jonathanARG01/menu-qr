// Diseño único de los correos de Mesitto: el logo arriba, una tarjeta blanca con el título, el texto y un botón,
// y un pie con la marca. Lo usan los correos que manda la app (Resend) y, ya armados, las plantillas de
// Supabase Auth de supabase/correos (se regeneran con `node scripts/correos-supabase.mjs`).
// Tablas y estilos en línea para que se vea igual en Gmail, Outlook y el celular.

export const COLORES_CORREO = {
  fondo: "#f4f1ea",
  tinta: "#172033",
  texto: "#3b4256",
  suave: "#6b7280",
  borde: "#e7e2d6",
  acento: "#f2a33a",
};

export type OpcionesCorreo = {
  // Dirección del sitio, para el logo (sin / al final). En Supabase va {{ .SiteURL }}.
  sitio: string;
  titulo: string;
  // Línea corta que el correo muestra junto al asunto en la bandeja de entrada.
  resumen?: string;
  // Párrafos del cuerpo, ya escapados (pueden traer <strong> o enlaces).
  parrafos: string[];
  boton?: { texto: string; url: string };
  // Texto chico debajo del botón (por ejemplo, cuánto dura el enlace).
  nota?: string;
  // Por qué le llega este correo, al pie.
  motivo?: string;
};

export const escaparCorreo = (t: string) =>
  t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const FUENTE = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function htmlCorreo({ sitio, titulo, resumen, parrafos, boton, nota, motivo }: OpcionesCorreo) {
  const c = COLORES_CORREO;
  const cuerpo = parrafos
    .map((p) => `<p style="margin:0 0 16px;font:16px/1.6 ${FUENTE};color:${c.texto}">${p}</p>`)
    .join("\n");
  const accion = boton
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px">
<tr><td align="center" bgcolor="${c.acento}" style="border-radius:12px">
<a href="${boton.url}" target="_blank" style="display:inline-block;padding:14px 28px;font:bold 16px/1 ${FUENTE};color:${c.tinta};text-decoration:none;border-radius:12px">${boton.texto}</a>
</td></tr></table>
<p style="margin:0 0 8px;font:13px/1.5 ${FUENTE};color:${c.suave}">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
<p style="margin:0 0 16px;font:13px/1.5 ${FUENTE};word-break:break-all"><a href="${boton.url}" style="color:${c.tinta}">${boton.url}</a></p>`
    : "";
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${titulo}</title>
</head>
<body style="margin:0;padding:0;background:${c.fondo}">
${resumen ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${c.fondo}">${resumen}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${c.fondo}" style="background:${c.fondo}">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
<tr><td align="center" style="padding:0 0 20px">
<img src="${sitio}/correo/logo.png" width="200" height="56" alt="Mesitto" style="display:block;border:0;width:200px;height:auto;font:bold 24px ${FUENTE};color:${c.tinta}">
</td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;border:1px solid ${c.borde};border-radius:18px;overflow:hidden">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td height="6" bgcolor="${c.acento}" style="background:${c.acento};font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:32px 32px 16px">
<h1 style="margin:0 0 16px;font:bold 24px/1.3 ${FUENTE};color:${c.tinta}">${titulo}</h1>
${cuerpo}
${accion}
${nota ? `<p style="margin:0 0 16px;font:13px/1.5 ${FUENTE};color:${c.suave}">${nota}</p>` : ""}
</td></tr>
</table>
</td></tr>
<tr><td align="center" style="padding:24px 16px 0">
<p style="margin:0 0 6px;font:bold 13px/1.5 ${FUENTE};color:${c.tinta}">Mesitto<span style="color:${c.acento}">.</span> · Cartas QR y gestión de salón para restaurantes</p>
${motivo ? `<p style="margin:0;font:12px/1.5 ${FUENTE};color:${c.suave}">${motivo}</p>` : ""}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
