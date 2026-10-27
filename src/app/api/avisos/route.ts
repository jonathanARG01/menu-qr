import webpush from "web-push";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TEXTOS, type ClaveTexto, type Idioma } from "@/lib/i18n";

export const runtime = "nodejs";

const limpiar = (v: string | undefined) => (v ?? "").replace(/[^A-Za-z0-9_\-:@.]/g, "");
const PUBLICA = limpiar(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
const PRIVADA = limpiar(process.env.VAPID_PRIVATE_KEY);
const CONTACTO = process.env.VAPID_CONTACTO?.trim() || "mailto:avisos@menus-qr.app";

const MENSAJE: Record<string, { titulo: ClaveTexto; ayuda: ClaveTexto }> = {
  preparando: { titulo: "avisoPreparando", ayuda: "avisoPreparandoAyuda" },
  listo: { titulo: "avisoListo", ayuda: "avisoListoAyuda" },
  entregado: { titulo: "avisoEntregado", ayuda: "avisoEntregadoAyuda" },
};

type Suscripcion = { id: string; endpoint: string; claves: { p256dh: string; auth: string }; idioma: string };

// El panel llama aquí después de cambiar el estado de un pedido. Con la sesión del equipo (RLS) se leen el pedido
// y las suscripciones de esa mesa, y se manda el aviso a cada celular. Las suscripciones vencidas se borran.
export async function POST(request: Request) {
  if (!PUBLICA || !PRIVADA) return NextResponse.json({ enviados: 0, motivo: "sin claves VAPID" }, { status: 501 });
  const { pedido_id } = (await request.json().catch(() => ({}))) as { pedido_id?: string };
  if (!pedido_id || !/^[0-9a-f-]{36}$/i.test(pedido_id)) return NextResponse.json({ error: "pedido" }, { status: 400 });

  const supabase = await createClient();
  const { data: pedido } = await supabase
    .from("pedidos")
    .select(
      "id, estado, cuenta_id, mesa_numero, restaurante_id, pedido_items(nombre, cantidad), restaurantes(nombre, slug, logo_url)",
    )
    .eq("id", pedido_id)
    .maybeSingle();
  const mensaje = pedido && MENSAJE[pedido.estado];
  if (!pedido?.cuenta_id || !mensaje) return NextResponse.json({ enviados: 0 });

  const { data: subs } = await supabase
    .from("suscripciones_push")
    .select("id, endpoint, claves, idioma")
    .eq("cuenta_id", pedido.cuenta_id);
  if (!subs?.length) return NextResponse.json({ enviados: 0 });

  const restaurante = (Array.isArray(pedido.restaurantes) ? pedido.restaurantes[0] : pedido.restaurantes) as {
    nombre: string;
    slug: string;
    logo_url: string | null;
  } | null;
  const items = ((pedido.pedido_items ?? []) as { nombre: string; cantidad: number }[])
    .map((i) => `${i.cantidad} × ${i.nombre}`)
    .join(", ");
  const url = restaurante ? `/${restaurante.slug}?mesa=${encodeURIComponent(pedido.mesa_numero ?? "")}` : "/";

  webpush.setVapidDetails(CONTACTO, PUBLICA, PRIVADA);
  let enviados = 0;
  const vencidas: string[] = [];
  await Promise.all(
    (subs as Suscripcion[]).map(async (s) => {
      const textos = TEXTOS[(s.idioma as Idioma) in TEXTOS ? (s.idioma as Idioma) : "es"];
      const carga = JSON.stringify({
        titulo: textos[mensaje.titulo],
        cuerpo: `${textos[mensaje.ayuda]}${items ? `\n${items}` : ""}`,
        url,
        icono: restaurante?.logo_url ?? undefined,
        etiqueta: `pedido-${pedido.id}`,
        restaurante: restaurante?.nombre,
      });
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.claves }, carga, { TTL: 600, urgency: "high" });
        enviados++;
      } catch (e) {
        const codigo = (e as { statusCode?: number }).statusCode;
        if (codigo === 404 || codigo === 410) vencidas.push(s.id);
      }
    }),
  );
  if (vencidas.length) await supabase.from("suscripciones_push").delete().in("id", vencidas);
  return NextResponse.json({ enviados });
}
