import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/panel";
import { ToastProvider } from "@/components/Toast";
import { MarcoPanel } from "./NavPanel";
import { Onboarding } from "./Onboarding";
import type { Perfil } from "./equipo/EditorPerfil";

export const metadata: Metadata = {
  title: "Panel · Mesitto",
  // Instalable como app (Android, computadora y "Agregar a inicio" en iPhone).
  manifest: "/panel.webmanifest",
  appleWebApp: { capable: true, title: "Mesitto", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#172033" };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { user, restaurante, restaurantes, esSuperadmin, rol, secciones, bloqueadas, admin } = await obtenerContexto();

  if (!restaurante) {
    const meta = user.user_metadata as { restaurante_nombre?: string; restaurante_slug?: string; restaurante_pais?: string };
    return (
      <Onboarding
        nombre={meta.restaurante_nombre}
        slug={meta.restaurante_slug}
        pais={meta.restaurante_pais}
        email={user.email ?? ""}
      />
    );
  }

  // Modo oscuro por defecto; el botón del menú guarda la elección en esta cookie.
  const tema = (await cookies()).get("panel-tema")?.value === "claro" ? "claro" : "oscuro";
  // Sin la migración 0018 la función no existe: queda sin perfil.
  const { data: perfil } = await (await createClient()).rpc("mi_perfil", { p_restaurante: restaurante.id });

  return (
    <MarcoPanel
      tema={tema}
      restaurante={{
        id: restaurante.id,
        nombre: restaurante.nombre,
        slug: restaurante.slug,
        logo_url: restaurante.logo_url,
        color_primario: restaurante.color_primario,
        plan: restaurante.plan,
        prueba_inicio: restaurante.prueba_inicio ?? null,
        prueba_fin: restaurante.prueba_fin ?? null,
      }}
      bloqueadas={bloqueadas}
      admin={admin}
      restaurantes={restaurantes}
      secciones={secciones}
      rol={rol ?? "dueno"}
      email={user.email ?? ""}
      esSuperadmin={esSuperadmin}
      usuarioId={user.id}
      perfil={(perfil as Perfil | null) ?? null}
    >
      <ToastProvider>{children}</ToastProvider>
    </MarcoPanel>
  );
}
