import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID, sincronizarPago } from "@/lib/mercadopago";

export const runtime = "nodejs";

// La carta pregunta cómo quedó el pago al volver de Mercado Pago. Si trae el número de pago se confirma con
// Mercado Pago en el momento (por si el aviso del webhook todavía no llegó).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? "";
  const mpPagoId = url.searchParams.get("payment_id") ?? url.searchParams.get("collection_id") ?? "";
  if (!UUID.test(id)) return NextResponse.json({ error: "id" }, { status: 400 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ estado: null }, { status: 501 });
  let estado: string | null = null;
  if (mpPagoId && mpPagoId !== "null") estado = await sincronizarPago(admin, id, mpPagoId).catch(() => null);
  if (!estado) estado = ((await admin.rpc("estado_pago_online", { p_id: id })).data as string | null) ?? null;
  return NextResponse.json({ estado }, { headers: { "Cache-Control": "no-store" } });
}
