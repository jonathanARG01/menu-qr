import { MARCA } from "@/lib/marca";

// Manifiesto del panel: permite instalarlo como app en el computador (Chrome, Edge) o el celular.
export const dynamic = "force-static";

export function GET() {
  const manifiesto = {
    id: "/panel",
    name: `${MARCA} · Panel`,
    short_name: MARCA,
    description: "Clientes, sellos, puntos, premios y campañas de tu negocio.",
    lang: "es",
    start_url: "/panel",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#060a17",
    theme_color: "#060a17",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icono-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icono-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icono-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Sumar con QR", url: "/panel/cobrar", icons: [{ src: "/icono-192.png", sizes: "192x192" }] },
      { name: "Clientes", url: "/panel", icons: [{ src: "/icono-192.png", sizes: "192x192" }] },
      { name: "Métricas", url: "/panel/metricas", icons: [{ src: "/icono-192.png", sizes: "192x192" }] },
    ],
  };
  return new Response(JSON.stringify(manifiesto), {
    headers: { "content-type": "application/manifest+json; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
