"use client";

import { useEffect } from "react";
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
  enviarAviso({ pedido_id: pedidoId });
}

// Delivery: el pedido salió del local.
export function avisarEnCamino(cuentaId: string) {
  enviarAviso({ cuenta_id: cuentaId, evento: "en_camino" });
}

function enviarAviso(cuerpo: Record<string, string>) {
  if (!CLAVE_PUBLICA) return;
  fetch("/api/avisos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
    keepalive: true,
  }).catch(() => {});
}

// Suscribe este navegador a un pedido para llevar o a una reserva (sin mesa): la función de la base lo ata.
export async function suscribirA(destino: { tipo: "pedido" | "reserva"; id: string }, idioma: string): Promise<boolean> {
  if (!soportaPush()) return false;
  if (Notification.permission !== "granted" && (await Notification.requestPermission()) !== "granted") return false;
  try {
    const registro = await navigator.serviceWorker.register("/sw-carta.js");
    await navigator.serviceWorker.ready;
    const suscripcion =
      (await registro.pushManager.getSubscription()) ??
      (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(CLAVE_PUBLICA) }));
    const json = suscripcion.toJSON();
    const { data, error } = await createClient().rpc(
      destino.tipo === "pedido" ? "suscribir_avisos_pedido" : "suscribir_avisos_reserva",
      {
        [destino.tipo === "pedido" ? "p_cuenta" : "p_reserva"]: destino.id,
        p_endpoint: json.endpoint,
        p_claves: json.keys ?? {},
        p_idioma: idioma,
      },
    );
    return !error && data === true;
  } catch {
    return false;
  }
}

// Con Reservas o el Salón abiertos, cada 5 minutos se mandan los recordatorios de reserva que ya tocan (al celular de
// los clientes que los aceptaron). El servidor decide cuáles y no repite.
export function useRecordatorios(restauranteId: string, activo: boolean) {
  useEffect(() => {
    if (!activo || !CLAVE_PUBLICA) return;
    const mandar = () =>
      fetch("/api/recordatorios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurante: restauranteId }),
      }).catch(() => {});
    mandar();
    const id = setInterval(mandar, 5 * 60000);
    return () => clearInterval(id);
  }, [restauranteId, activo]);
}

// Avisos de la cuenta (no de un pedido): tú en /admin recibes las pruebas por vencer; el dueño, los días que le quedan.
export async function suscribirCuenta(): Promise<boolean> {
  if (!soportaPush()) return false;
  if (Notification.permission !== "granted" && (await Notification.requestPermission()) !== "granted") return false;
  try {
    const registro = await navigator.serviceWorker.register("/sw-carta.js");
    await navigator.serviceWorker.ready;
    const suscripcion =
      (await registro.pushManager.getSubscription()) ??
      (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(CLAVE_PUBLICA) }));
    const json = suscripcion.toJSON();
    const { data, error } = await createClient().rpc("suscribir_cuenta", {
      p_endpoint: json.endpoint,
      p_claves: json.keys ?? {},
    });
    return !error && data === true;
  } catch {
    return false;
  }
}
