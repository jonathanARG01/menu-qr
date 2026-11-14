"use client";

import { createClient } from "@/lib/supabase/client";
import { CLAVE_PUBLICA, aBytes, soportaPush } from "@/lib/push";
import { claveLocal } from "./tipos";

// Avisa al celular del cliente y actualiza su Google Wallet después de sumar o canjear (el servidor decide qué decir).
export function avisarTarjeta(codigo: string) {
  fetch("/api/avisar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ codigo }),
    keepalive: true,
  }).catch(() => {});
}

// Avisos de la tarjeta en este celular (tarjeta web).
export async function suscribirTarjeta(codigo: string): Promise<boolean> {
  if (!soportaPush()) return false;
  if (Notification.permission !== "granted" && (await Notification.requestPermission()) !== "granted") return false;
  try {
    const registro = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const suscripcion =
      (await registro.pushManager.getSubscription()) ??
      (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(CLAVE_PUBLICA) }));
    const json = suscripcion.toJSON();
    const { data, error } = await createClient().rpc("suscribir_tarjeta", {
      p_codigo: codigo,
      p_endpoint: json.endpoint,
      p_claves: json.keys ?? {},
    });
    return !error && data === true;
  } catch {
    return false;
  }
}

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
