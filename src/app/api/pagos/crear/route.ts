import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MP_API, MONEDAS_MP, UUID } from "@/lib/mercadopago";
import { decimalesMoneda } from "@/lib/utils";

export const runtime = "nodejs";

type Pedido = {
  // Pedido para llevar o delivery (id de la cuenta). Si viene, no hacen falta restaurante ni mesa.
  pedido?: string;
  restaurante?: string;
  sucursal?: string | null;
  mesa?: string;
  partes?: number;
  propina?: number;
  volver?: string;
};
type Preparado = {
  id: string;
  monto: number;
  propina: number;
  mesa?: string;
  tipo?: string;
  restaurante: string;
  slug: string;
  moneda: string;
  token: string;
};

// Para Personalizar: dice si el servidor tiene la clave de servicio (sin mostrarla).
export function GET() {
  return NextResponse.json({ listo: !!createAdminClient() }, { headers: { "Cache-Control": "no-store" } });
}

// El cliente toca "Pagar con Mercado Pago" en su mesa: se calcula el monto en la base, se crea la preferencia de
// pago con la clave del restaurante y se devuelve el link de Mercado Pago.
export async function POST(request: Request) {
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY" }, { status: 501 });

  const b = (await request.json().catch(() => ({}))) as Pedido;
  const llevar = !!b.pedido;
  if (
    llevar
      ? !UUID.test(b.pedido!)
      : !b.restaurante || !UUID.test(b.restaurante) || (b.sucursal && !UUID.test(b.sucursal)) || !b.mesa || b.mesa.length > 12
  ) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const { data, error } = llevar
    ? await admin.rpc("crear_pago_pedido", { p_cuenta: b.pedido, p_propina: Math.max(0, Number(b.propina) || 0) })
    : await admin.rpc("crear_pago_online", {
        p_restaurante: b.restaurante,
        p_sucursal: b.sucursal || null,
        p_mesa: b.mesa,
        p_partes: Math.round(Number(b.partes) || 1),
        p_propina: Math.max(0, Number(b.propina) || 0),
      });
  if (error || !data) return NextResponse.json({ error: error?.message ?? "No se pudo preparar el pago" }, { status: 400 });
  const p = data as Preparado;
  if (!MONEDAS_MP.includes(p.moneda)) {
    return NextResponse.json({ error: `Mercado Pago no cobra en ${p.moneda}` }, { status: 400 });
  }
  // En pesos chilenos (y otras monedas sin centavos) Mercado Pago solo acepta montos enteros. Se redondea hacia
  // arriba para que el pago nunca quede por debajo de lo que se debe.
  const factor = 10 ** decimalesMoneda(p.moneda);
  const total = Math.ceil((Number(p.monto) + Number(p.propina)) * factor - 1e-6) / factor;

  const origen = new URL(request.url).origin;
  // Solo se vuelve a la carta del mismo restaurante (o a la página del pedido para llevar).
  const porDefecto = llevar ? `/${p.slug}/pedido/${b.pedido}` : `/${p.slug}?mesa=${encodeURIComponent(p.mesa ?? "")}`;
  const volver = b.volver?.startsWith(`/${p.slug}`) ? b.volver : porDefecto;
  const vuelta = new URL(volver, origen);
  vuelta.searchParams.set("pago", p.id);

  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: { Authorization: `Bearer ${p.token}`, "Content-Type": "application/json", "X-Idempotency-Key": p.id },
    body: JSON.stringify({
      items: [
        {
          id: p.id,
          title: llevar
            ? `${p.restaurante} · ${p.tipo === "delivery" ? "Delivery" : "Para llevar"}`
            : `${p.restaurante} · Mesa ${p.mesa}`,
          quantity: 1,
          unit_price: total,
          currency_id: p.moneda,
        },
      ],
      external_reference: p.id,
      notification_url: `${origen}/api/pagos/mp?p=${p.id}`,
      back_urls: { success: vuelta.toString(), pending: vuelta.toString(), failure: vuelta.toString() },
      auto_return: "approved",
      statement_descriptor: p.restaurante.slice(0, 22),
    }),
  });
  const pref = (await res.json().catch(() => null)) as { init_point?: string; message?: string } | null;
  if (!res.ok || !pref?.init_point) {
    return NextResponse.json(
      {
        error:
          res.status === 401
            ? "La clave de Mercado Pago del restaurante no es válida"
            : (pref?.message ?? "Mercado Pago no respondió"),
      },
      { status: 502 },
    );
  }
  return NextResponse.json({ id: p.id, url: pref.init_point, monto: p.monto, propina: p.propina });
}
