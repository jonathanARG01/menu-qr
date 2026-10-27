import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sincronizarPago } from "@/lib/mercadopago";

export const runtime = "nodejs";

// Notificación de Mercado Pago. Trae el número de pago, que se vuelve a consultar en Mercado Pago con la clave
// del restaurante antes de anotar nada.
export async function POST(request: Request) {
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false }, { status: 501 });
  const url = new URL(request.url);
  const pagoOnline = url.searchParams.get("p") ?? "";
  const cuerpo = (await request.json().catch(() => ({}))) as { type?: string; topic?: string; data?: { id?: string | number } };
  const tipo = cuerpo.type ?? cuerpo.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const mpPagoId = String(cuerpo.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
  // Otras notificaciones no hacen falta: se contesta 200 para que Mercado Pago no reintente.
  if (tipo !== "payment" || !mpPagoId) return NextResponse.json({ ok: true });
  try {
    const estado = await sincronizarPago(admin, pagoOnline, mpPagoId);
    return NextResponse.json({ ok: true, estado });
  } catch {
    // Error de la base: 500 para que Mercado Pago reintente más tarde.
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
