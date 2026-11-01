import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { actualizarEnWallet } from "./google";
import { datosWallet } from "./servidor";
import type { TarjetaPublica } from "./tipos";

// Aviso al cliente de una tarjeta: al celular (web push) y, si la guardó, en Google Wallet. Solo en el servidor.

const limpiar = (v: string | undefined) => (v ?? "").replace(/[^A-Za-z0-9_\-:@.]/g, "");
const PUBLICA = limpiar(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
const PRIVADA = limpiar(process.env.VAPID_PRIVATE_KEY);
const CONTACTO = process.env.VAPID_CONTACTO?.trim() || "mailto:hola@platovi.cl";

export type MensajeTarjeta = { titulo: string; cuerpo: string };

export async function avisarCliente(
  admin: SupabaseClient | null,
  t: TarjetaPublica,
  mensaje: MensajeTarjeta | null,
  sitio: string,
): Promise<{ enviados: number; wallet: boolean }> {
  let wallet = false;
  try {
    wallet = await actualizarEnWallet(datosWallet(t, sitio), mensaje ?? undefined);
  } catch (e) {
    console.error(e);
  }

  let enviados = 0;
  if (!admin || !mensaje || !PUBLICA || !PRIVADA) return { enviados, wallet };
  const { data: tarjeta } = await admin.from("sellos_tarjetas").select("id").eq("codigo", t.codigo).maybeSingle();
  const { data: subs } = tarjeta
    ? await admin.from("sellos_push").select("id, endpoint, claves").eq("tarjeta_id", tarjeta.id)
    : { data: [] };
  webpush.setVapidDetails(CONTACTO, PUBLICA, PRIVADA);
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
            etiqueta: `sellos-${t.codigo}`,
            url: `${sitio}/s/${t.codigo}`,
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
  return { enviados, wallet };
}
