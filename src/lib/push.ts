"use client";

import { createClient } from "@/lib/supabase/client";

// Avisos al celular del comensal con la carta cerrada (notificaciones push del navegador).
// Si no están cargadas las claves VAPID en Vercel, todo esto queda apagado sin romper nada.
export const CLAVE_PUBLICA = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").replace(/[^A-Za-z0-9_-]/g, "");

export function soportaPush() {
  return (
    !!CLAVE_PUBLICA &&
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// En iPhone los avisos solo funcionan si la carta se agregó a la pantalla de inicio y se abre desde ahí.
export function iphoneSinInstalar() {
  if (typeof window === "undefined") return false;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const instalada =
    (navigator as Navigator & { standalone?: boolean }).standalone || matchMedia("(display-mode: standalone)").matches;
  return ios && !instalada;
}

function aBytes(base64: string) {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const crudo = atob((base64 + relleno).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(crudo, (c) => c.charCodeAt(0));
}

// Pide permiso (si hace falta), suscribe este navegador y lo ata a la cuenta abierta de la mesa.
// pedirPermiso=false: solo renueva la suscripción si el permiso ya estaba dado (después de cada pedido).
export async function suscribirAvisos(
  datos: { restauranteId: string; sucursalId: string | null; mesa: string; idioma: string },
  pedirPermiso = true,
): Promise<boolean> {
  if (!soportaPush()) return false;
  if (Notification.permission !== "granted") {
    if (!pedirPermiso || Notification.permission === "denied") return false;
    if ((await Notification.requestPermission()) !== "granted") return false;
  }
  try {
    const registro = await navigator.serviceWorker.register("/sw-carta.js");
    await navigator.serviceWorker.ready;
    const suscripcion =
      (await registro.pushManager.getSubscription()) ??
      (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(CLAVE_PUBLICA) }));
    const json = suscripcion.toJSON();
    const { data, error } = await createClient().rpc("suscribir_avisos", {
      p_restaurante: datos.restauranteId,
      p_sucursal: datos.sucursalId,
      p_mesa: datos.mesa,
      p_endpoint: json.endpoint,
      p_claves: json.keys ?? {},
      p_idioma: datos.idioma,
    });
    return !error && data === true;
  } catch {
    return false;
  }
}

// Desde el panel: después de cambiar el estado de un pedido, avisa al celular del comensal (si se suscribió).
export function avisarComensal(pedidoId: string) {
  if (!CLAVE_PUBLICA) return;
  fetch("/api/avisos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pedido_id: pedidoId }),
    keepalive: true,
  }).catch(() => {});
}
