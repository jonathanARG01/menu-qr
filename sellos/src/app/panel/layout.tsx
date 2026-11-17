import type { Metadata, Viewport } from "next";
import { Marco } from "@/components/panel/Marco";
import { DemoPendiente } from "@/components/panel/DemoPendiente";
import { MARCA } from "@/lib/marca";
import { cargarPanel } from "@/lib/panel";
import { diasPrueba, vigente } from "@/lib/tipos";
import { SCRIPT_TEMA } from "@/lib/tema";

export const dynamic = "force-dynamic";

// El panel se puede instalar como app (computador o celular).
export const metadata: Metadata = {
  manifest: "/app.webmanifest",
  appleWebApp: { capable: true, title: MARCA, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f4ec" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
  ],
};

// Pone el tema antes de pintar (sin parpadeo) y guarda el aviso de "instalar app" si llega antes que React.
const SCRIPT_INICIO = `${SCRIPT_TEMA};window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__instalarPanel=e})`;

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const { negocio, negocios, rol, dueno, gestor, usuario, sucursales, sucursal, localFijo, soporte, superadmin } = await cargarPanel();

  return (
    <div className="panel-app min-h-dvh">
      <script dangerouslySetInnerHTML={{ __html: SCRIPT_INICIO }} />
      {!soporte && <DemoPendiente negocio={{ id: negocio.id, slug: negocio.slug }} dueno={dueno} />}
      <Marco
        datos={{
          negocio: { id: negocio.id, nombre: negocio.nombre, logo_url: negocio.logo_url },
          negocios,
          rol,
          dueno,
          gestor,
          usuario: { email: usuario.email, nombre: usuario.nombre },
          sucursales: sucursales.map((s) => ({ id: s.id, nombre: s.nombre })),
          sucursal: sucursal ? { id: sucursal.id, nombre: sucursal.nombre } : null,
          localFijo,
          soporte,
          superadmin,
          prueba: { estado: negocio.estado, dias: diasPrueba(negocio), alDia: vigente(negocio) },
        }}
      >
        {children}
      </Marco>
    </div>
  );
}
