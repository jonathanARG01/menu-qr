import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/server";
import { escaparCorreo, htmlCorreo } from "@/lib/correo";
import { leerAjustesSitio } from "@/lib/sitio";
import { urlSitio } from "@/lib/utils";

// Formulario de contacto del sitio de venta: guarda el mensaje (SQL 0028, con límites contra el spam) y te lo
// manda por correo con Resend (RESEND_API_KEY + AVISOS_CORREO_DE). Responder el correo le contesta al cliente.
const RESEND = (process.env.RESEND_API_KEY ?? "").trim();
const REMITENTE = (process.env.AVISOS_CORREO_DE ?? "").trim();

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(request: Request) {
  const datos = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!datos) return NextResponse.json({ error: "Mensaje vacío." }, { status: 400 });
  // Campo trampa: las personas no lo ven; los robots lo llenan.
  if (texto(datos.sitio_web, 200)) return NextResponse.json({ ok: true });

  const nombre = texto(datos.nombre, 80);
  const correo = texto(datos.correo, 120).toLowerCase();
  const telefono = texto(datos.telefono, 30);
  const negocio = texto(datos.negocio, 80);
  const mensaje = texto(datos.mensaje, 2000);
  if (nombre.length < 2 || mensaje.length < 5 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) {
    return NextResponse.json({ error: "Revisa tu nombre, tu correo y el mensaje." }, { status: 400 });
  }

  const db = createPublicClient();
  const { error } = await db.rpc("enviar_contacto", {
    p_nombre: nombre,
    p_correo: correo,
    p_telefono: telefono,
    p_negocio: negocio,
    p_mensaje: mensaje,
  });
  // Sin el SQL 0028 la función no existe: igual se intenta mandar el correo.
  const sinTabla = error && /does not exist|Could not find/i.test(error.message);
  if (error && !sinTabla) return NextResponse.json({ error: error.message }, { status: 429 });

  const { data: fila } = await db.from("sitio_ajustes").select("contacto, redes").eq("id", 1).maybeSingle();
  const { contacto } = leerAjustesSitio(fila);
  const para = contacto.aviso_correo || contacto.correo;
  let enviado = false;
  if (RESEND && REMITENTE && para) {
    const lineas = [
      `<strong>${escaparCorreo(nombre)}</strong>${negocio ? ` · ${escaparCorreo(negocio)}` : ""}`,
      `Correo: <a href="mailto:${escaparCorreo(correo)}">${escaparCorreo(correo)}</a>${telefono ? ` · Teléfono: ${escaparCorreo(telefono)}` : ""}`,
      escaparCorreo(mensaje).replace(/\n/g, "<br>"),
    ];
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: REMITENTE,
        to: [para],
        reply_to: correo,
        subject: `Nuevo contacto desde platovi.cl: ${nombre}${negocio ? ` (${negocio})` : ""}`,
        html: htmlCorreo({
          sitio: urlSitio(),
          titulo: "Nuevo mensaje de contacto",
          resumen: escaparCorreo(mensaje.slice(0, 120)),
          parrafos: lineas,
          boton: { texto: "Ver mensajes en /admin", url: `${urlSitio()}/admin/sitio` },
          motivo: "Te llega porque alguien llenó el formulario de contacto de platovi.cl. Responde este correo para contestarle.",
        }),
        text: `${nombre}${negocio ? ` (${negocio})` : ""}\n${correo}${telefono ? ` · ${telefono}` : ""}\n\n${mensaje}`,
      }),
    }).catch(() => null);
    enviado = !!r?.ok;
  }
  if (sinTabla && !enviado) {
    return NextResponse.json({ error: "No pudimos enviar tu mensaje. Escríbenos por WhatsApp." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
