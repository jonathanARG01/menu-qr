import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Mesaly · Carta digital y gestión para restaurantes",
    template: "%s",
  },
  description: "Mesaly: carta digital con QR, pedidos desde la mesa y gestión del salón para restaurantes.",
  applicationName: "Mesaly",
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
