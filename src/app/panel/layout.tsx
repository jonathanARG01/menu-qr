import { obtenerContexto } from "@/lib/panel";
import { ToastProvider } from "@/components/Toast";
import { MarcoPanel } from "./NavPanel";
import { Onboarding } from "./Onboarding";

export const metadata = { title: "Panel · Menús QR" };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { user, restaurante, restaurantes, esSuperadmin, rol, secciones } = await obtenerContexto();

  if (!restaurante) {
    const meta = user.user_metadata as { restaurante_nombre?: string; restaurante_slug?: string };
    return <Onboarding nombre={meta.restaurante_nombre} slug={meta.restaurante_slug} email={user.email ?? ""} />;
  }

  return (
    <MarcoPanel
      restaurante={{
        id: restaurante.id,
        nombre: restaurante.nombre,
        slug: restaurante.slug,
        logo_url: restaurante.logo_url,
        color_primario: restaurante.color_primario,
      }}
      restaurantes={restaurantes}
      secciones={secciones}
      rol={rol ?? "dueno"}
      email={user.email ?? ""}
      esSuperadmin={esSuperadmin}
    >
      <ToastProvider>{children}</ToastProvider>
    </MarcoPanel>
  );
}
