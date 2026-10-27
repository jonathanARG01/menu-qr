import type { SupabaseClient } from "@supabase/supabase-js";

// Mercado Pago (Checkout Pro). Cada restaurante cobra con su propia clave; acá solo se habla con su API.
export const MP_API = (process.env.MP_API_URL || "https://api.mercadopago.com").replace(/\/$/, "");

// Monedas en las que cobra Mercado Pago (una por país: la cuenta de Chile cobra en CLP).
export const MONEDAS_MP = ["CLP", "ARS", "BRL", "MXN", "COP", "PEN", "UYU"];

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PagoMP = { id: number | string; status: string; transaction_amount: number; external_reference: string | null };

// Consulta el pago en Mercado Pago (nunca se confía en lo que manda el navegador) y lo anota en la base.
// Devuelve el estado del pago online: creado, aprobado o rechazado.
export async function sincronizarPago(admin: SupabaseClient, pagoOnlineId: string, mpPagoId: string) {
  if (!UUID.test(pagoOnlineId) || !/^\d{1,20}$/.test(mpPagoId)) return null;
  const { data: token } = await admin.rpc("token_pago_online", { p_id: pagoOnlineId });
  if (!token) return null;
  const res = await fetch(`${MP_API}/v1/payments/${mpPagoId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const pago = (await res.json()) as PagoMP;
  if (pago.external_reference !== pagoOnlineId) return null;
  const { data: estado, error } = await admin.rpc("registrar_pago_online", {
    p_id: pagoOnlineId,
    p_mp_pago_id: String(pago.id),
    p_estado: pago.status,
    p_pagado: Number(pago.transaction_amount),
  });
  if (error) throw error;
  return estado as string | null;
}
