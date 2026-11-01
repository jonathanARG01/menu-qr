import webpush from "web-push";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { actualizarEnWallet } from "@/lib/sellos/google";
import { datosWallet, leerTarjeta, sitioDe } from "@/lib/sellos/servidor";
import { limpiarCodigo, type TarjetaPublica } from "@/lib/sellos/tipos";

export const runtime = "nodejs";

const limpiar = (v: string | undefined) => (v ?? "").replace(/[^A-Za-z0-9_\-:@.]/g, "");
const PUBLICA = limpiar(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
const PRIVADA = limpiar(process.env.VAPID_PRIVATE_KEY);
const CONTACTO = process.env.VAPID_CONTACTO?.trim() || "mailto:hola@platovi.cl";

// Qué decirle al cliente según lo último que pasó en su tarjeta.
function mensajeDe(t: TarjetaPublica) {
  const m = t.movimientos[0];
  const p = t.programa;
  if (!m || !p) return null;
  if (m.tipo === "canje") return { titulo: t.restaurante.nombre, cuerpo: `Canjeaste ${p.premio}. ¡Que lo disfrutes!` };
  if (m.tipo !== "sello") return null;
  const sumados = m.cantidad === 1 ? "un sello" : `${m.cantidad} sellos`;
  if (t.premios > 0 && t.sellos < m.cantidad)
    return { titulo: "¡Completaste tu tarjeta! 🎉", cuerpo: `Tienes ${p.premio} en ${t.restaurante.nombre}. Muéstrale tu tarjeta al mesero.` };
  const faltan = p.meta - t.sellos;
  return {
    titulo: `¡Sumaste ${sumados}!`,
    cuerpo: `Te ${faltan === 1 ? "falta 1 sello" : `faltan ${faltan} sellos`} para ${p.premio} en ${t.restaurante.nombre}.`,
  };
}

// Después de sumar un sello o canjear un premio (desde la tarjeta o el panel), actualiza la tarjeta en Google Wallet
// y avisa al celular del cliente. Solo actúa si el último movimiento es de hace menos de 3 minutos: llamarlo de nuevo
// no sirve para mandar avisos a nadie.
export async function POST(request: Request) {
  const cuerpo = (await request.json().catch(() => ({}))) as { codigo?: string };
  const codigo = limpiarCodigo(cuerpo.codigo ?? "");
  const t = codigo ? await leerTarjeta(codigo) : null;
  const ultimo = t?.movimientos[0];
  if (!t || !ultimo || Date.now() - Date.parse(ultimo.created_at) > 3 * 60000) return NextResponse.json({ enviados: 0 });
  const mensaje = mensajeDe(t);

  let wallet = false;
  try {
    wallet = await actualizarEnWallet(datosWallet(t, sitioDe(request)), mensaje ?? undefined);
  } catch (e) {
    console.error(e);
  }

  let enviados = 0;
  const admin = createAdminClient();
  if (admin && mensaje && PUBLICA && PRIVADA) {
    const { data: tarjeta } = await admin.from("sellos_tarjetas").select("id").eq("codigo", codigo).maybeSingle();
    const { data: subs } = tarjeta
      ? await admin.from("sellos_push").select("id, endpoint, claves").eq("tarjeta_id", tarjeta.id)
      : { data: [] };
    webpush.setVapidDetails(CONTACTO, PUBLICA, PRIVADA);
    const sitio = sitioDe(request);
    const vencidas: string[] = [];
    await Promise.all(
      (subs ?? []).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: s.claves as { p256dh: string; auth: string } },
            JSON.stringify({
              titulo: mensaje.titulo,
              cuerpo: mensaje.cuerpo,
              icono: t.restaurante.logo_url || "/app-panel/icono-192.png",
              etiqueta: `sellos-${codigo}`,
              url: `${sitio}/s/${codigo}`,
            }),
          );
          enviados++;
        } catch (e) {
          const estado = (e as { statusCode?: number }).statusCode;
          if (estado === 404 || estado === 410) vencidas.push(s.id);
        }
      }),
    );
    if (vencidas.length) await admin.from("sellos_push").delete().in("id", vencidas);
  }
  return NextResponse.json({ enviados, wallet });
}
