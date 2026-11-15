import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/Toast";
import { LEMA, MARCA } from "@/lib/marca";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: { default: `${MARCA} · ${LEMA}`, template: "%s" },
  description: `${MARCA}: tarjeta digital de sellos para cafés, peluquerías, barberías, tiendas y cualquier negocio. Tus clientes la guardan en el celular y vuelven por su premio.`,
  applicationName: MARCA,
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#c43d22" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
