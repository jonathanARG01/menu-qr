import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La dirección antigua de Vercel lleva siempre a platovi.cl (mismo camino), para que nadie vea ni comparta
  // menu-qr-ivory.vercel.app. Las vistas previas de Vercel usan otras direcciones y no se tocan.
  async redirects() {
    return [
      {
        source: "/:camino*",
        has: [{ type: "host", value: "menu-qr-ivory.vercel.app" }],
        destination: "https://platovi.cl/:camino*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
