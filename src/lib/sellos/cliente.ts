"use client";

import { createClient } from "@/lib/supabase/client";
import { CLAVE_PUBLICA, soportaPush } from "@/lib/push";
import { claveLocal } from "./tipos";

// Avisa al celular del cliente y actualiza su Google Wallet después de sumar o canjear (el servidor decide qué decir).
export function avisarTarjeta(codigo: string) {
  fetch("/api/sellos/avisar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ codigo }),
    keepalive: true,
  }).catch(() => {});
}

function aBytes(base64: string) {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const crudo = atob((base64 + relleno).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(crudo, (c) => c.charCodeAt(0));
}

// Avisos de la tarjeta en este celular (tarjeta web). Usa el mismo service worker de la carta.
export async function suscribirTarjeta(codigo: string): Promise<boolean> {
  if (!soportaPush()) return false;
  if (Notification.permission !== "granted" && (await Notification.requestPermission()) !== "granted") return false;
  try {
    const registro = await navigator.serviceWorker.register("/sw-carta.js");
    await navigator.serviceWorker.ready;
    const suscripcion =
      (await registro.pushManager.getSubscription()) ??
      (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(CLAVE_PUBLICA) }));
    const json = suscripcion.toJSON();
    const { data, error } = await createClient().rpc("sellos_suscribir", {
      p_codigo: codigo,
      p_endpoint: json.endpoint,
      p_claves: json.keys ?? {},
    });
    return !error && data === true;
  } catch {
    return false;
  }
}

// La tarjeta de este local guardada en este celular (para sumar con el QR de la precuenta sin volver a registrarse).
export function tarjetaGuardada(slug: string): string | null {
  try {
    return localStorage.getItem(claveLocal(slug));
  } catch {
    return null;
  }
}

export function guardarTarjeta(slug: string, codigo: string) {
  try {
    localStorage.setItem(claveLocal(slug), codigo);
  } catch {}
}
