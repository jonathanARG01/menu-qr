import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Platovi · Carta digital y gestión para restaurantes",
    template: "%s",
  },
  description: "Platovi: carta digital con QR, pedidos desde la mesa y gestión del salón para restaurantes.",
  applicationName: "Platovi",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
