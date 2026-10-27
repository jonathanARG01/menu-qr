import { NextResponse } from "next/server";
import { obtenerCarta } from "../datos";

// Manifiesto de la carta para "Agregar a inicio": abre directo en la mesa del QR.
// En iPhone es la única forma de recibir avisos del pedido con la carta cerrada.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const carta = await obtenerCarta(slug);
  if (!carta) return NextResponse.json({ error: "no existe" }, { status: 404 });
  const { restaurante } = carta;
  const pedido = new URL(request.url).searchParams;
  const consulta = new URLSearchParams();
  const mesa = pedido.get("mesa")?.slice(0, 12);
  const sucursal = pedido.get("s")?.slice(0, 60);
  if (mesa) consulta.set("mesa", mesa);
  if (sucursal) consulta.set("s", sucursal);
  const inicio = `/${restaurante.slug}${consulta.size ? `?${consulta}` : ""}`;

  return NextResponse.json(
    {
      name: restaurante.nombre,
      short_name: restaurante.nombre.slice(0, 12),
      id: inicio,
      start_url: inicio,
      scope: `/${restaurante.slug}`,
      display: "standalone",
      background_color: "#ffffff",
      theme_color: restaurante.color_primario ?? "#b45309",
      icons: restaurante.logo_url
        ? [
            { src: restaurante.logo_url, sizes: "192x192", purpose: "any" },
            { src: restaurante.logo_url, sizes: "512x512", purpose: "any" },
          ]
        : [{ src: "/favicon.ico", sizes: "48x48" }],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } },
  );
}
