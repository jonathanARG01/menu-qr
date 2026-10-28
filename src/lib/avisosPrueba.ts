import webpush from "web-push";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { numeroWhatsapp } from "./region";
import { escaparCorreo, htmlCorreo } from "./correo";

// Envío diario de la prueba de 14 días (lo llama /api/recordatorios con el Vercel Cron): pausa las pruebas vencidas
// y avisa 4 días antes, 1 día antes y al vencer, al dueño del restaurante y a ti (superadmin).
//   · Aviso al celular o al computador: a quien lo activó (tú en /admin, el dueño en el aviso de su panel).
//     Necesita las claves VAPID que ya usan los avisos de pedidos.
//   · Correo: solo si cargas RESEND_API_KEY (resend.com, gratis hasta 3.000 correos al mes) y AVISOS_CORREO_DE
//     con un remitente de un dominio verificado. Sin eso, no se manda correo.
//   · Siempre: el panel del restaurante muestra los días que le quedan, y /admin las pruebas por vencer con un
//     botón de WhatsApp para escribirle.

const limpiar = (v: string | undefined) => (v ?? "").replace(/[^A-Za-z0-9_\-:@.]/g, "");
const PUBLICA = limpiar(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
const PRIVADA = limpiar(process.env.VAPID_PRIVATE_KEY);
const CONTACTO = process.env.VAPID_CONTACTO?.trim() || "mailto:avisos@menus-qr.app";
const RESEND = (process.env.RESEND_API_KEY ?? "").trim();
const REMITENTE = (process.env.AVISOS_CORREO_DE ?? "").trim();
// Correos donde te llegan a ti los avisos (separados por coma). Si no está, solo el aviso al celular.
const CORREOS_ADMIN = (process.env.AVISOS_CORREO_ADMIN ?? "")
  .split(",")
  .map((c) => c.trim())
  .filter(Boolean);

type Fila = {
  restaurante_id: string;
  nombre: string;
  slug: string;
  dias: number;
  vencida: boolean;
  whatsapp: string | null;
  correos: string[] | null;
  usuarios: string[] | null;
};
type Suscripcion = { endpoint: string; user_id: string; claves: { p256dh: string; auth: string } };
type Mensaje = { titulo: string; cuerpo: string; url: string };

const plural = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;

function paraDueno(f: Fila, sitio: string): Mensaje {
  return f.vencida
    ? {
        titulo: "Terminó tu prueba de Mesitto",
        cuerpo: `La carta de ${f.nombre} quedó pausada. Elige un plan y vuelve a mostrarla al instante: no se borró nada.`,
        url: `${sitio}/panel/plan`,
      }
    : {
        titulo: `Te ${f.dias === 1 ? "queda" : "quedan"} ${plural(f.dias)} de prueba`,
        cuerpo: `La prueba de ${f.nombre} termina pronto. Elige tu plan para que tu carta siga en línea sin cortes.`,
        url: `${sitio}/panel/plan`,
      };
}

function paraAdmin(f: Fila, sitio: string): Mensaje {
  return {
    titulo: f.vencida ? `Prueba vencida: ${f.nombre}` : `${f.nombre}: ${plural(f.dias)} de prueba`,
    cuerpo: f.vencida
      ? "Se pausó su carta. Escríbele para ofrecerle un plan."
      : `Buen momento para escribirle${f.whatsapp ? " por WhatsApp" : ""} y cerrar la venta.`,
    url: `${sitio}/admin`,
  };
}

async function enviarPush(db: SupabaseClient, usuarios: string[], mensaje: (userId: string) => Mensaje) {
  if (!PUBLICA || !PRIVADA || !usuarios.length) return 0;
  const { data } = await db.from("avisos_cuenta").select("endpoint, user_id, claves").in("user_id", usuarios);
  if (!data?.length) return 0;
  webpush.setVapidDetails(CONTACTO, PUBLICA, PRIVADA);
  let enviados = 0;
  const vencidas: string[] = [];
  await Promise.all(
    (data as Suscripcion[]).map(async (s) => {
      const m = mensaje(s.user_id);
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: s.claves },
          JSON.stringify({ titulo: m.titulo, cuerpo: m.cuerpo, url: m.url, etiqueta: `prueba-${m.url}` }),
          { TTL: 86400 },
        );
        enviados++;
      } catch (e) {
        const codigo = (e as { statusCode?: number }).statusCode;
        if (codigo === 404 || codigo === 410) vencidas.push(s.endpoint);
      }
    }),
  );
  if (vencidas.length) await db.from("avisos_cuenta").delete().in("endpoint", vencidas);
  return enviados;
}

async function enviarCorreo(para: string[], m: Mensaje, sitio: string, motivo: string) {
  if (!RESEND || !REMITENTE || !para.length) return false;
  const html = htmlCorreo({
    sitio,
    titulo: escaparCorreo(m.titulo),
    resumen: escaparCorreo(m.cuerpo),
    parrafos: [escaparCorreo(m.cuerpo)],
    boton: { texto: m.url.endsWith("/plan") ? "Elegir mi plan" : "Abrir Mesitto", url: m.url },
    motivo,
  });
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: REMITENTE, to: para, subject: m.titulo, html, text: `${m.cuerpo}\n\n${m.url}` }),
  }).catch(() => null);
  return !!r?.ok;
}

export async function procesarPruebas(db: SupabaseClient, sitio: string) {
  const { data, error } = await db.rpc("procesar_pruebas");
  // Sin la migración 0016 la función no existe: no hay nada que hacer.
  if (error) return { avisos: 0, pausados: 0, error: error.message };
  const filas = (data ?? []) as Fila[];
  if (!filas.length) return { avisos: 0, pausados: 0 };

  const { data: admins } = await db.from("superadmins").select("user_id");
  const idsAdmin = (admins ?? []).map((a: { user_id: string }) => a.user_id);

  let avisos = 0;
  for (const f of filas) {
    if (f.vencida) revalidatePath(`/${f.slug}`);
    const dueno = paraDueno(f, sitio);
    const admin = paraAdmin(f, sitio);
    const duenos = (f.usuarios ?? []).filter((u) => !idsAdmin.includes(u));
    avisos += await enviarPush(db, [...duenos, ...idsAdmin], (u) => (idsAdmin.includes(u) ? admin : dueno));
    if (await enviarCorreo(f.correos ?? [], dueno, sitio, `Te llega porque ${escaparCorreo(f.nombre)} usa Mesitto.`)) avisos++;
    const whatsapp = f.whatsapp ? ` · WhatsApp: https://wa.me/${numeroWhatsapp(f.whatsapp)}` : "";
    if (
      await enviarCorreo(
        CORREOS_ADMIN,
        { ...admin, cuerpo: `${admin.cuerpo} Dueño: ${(f.correos ?? []).join(", ") || "—"}${whatsapp}` },
        sitio,
        "Aviso para el administrador de Mesitto.",
      )
    )
      avisos++;
  }
  return { avisos, pausados: filas.filter((f) => f.vencida).length };
}
