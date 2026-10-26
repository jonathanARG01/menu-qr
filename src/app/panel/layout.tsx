import Link from "next/link";
import { obtenerContexto } from "@/lib/panel";
import { ToastProvider } from "@/components/Toast";
import { cerrarSesion } from "./actions";
import { SelectorRestaurante } from "./SelectorRestaurante";
import { NavEscritorio, NavMovil } from "./NavPanel";
import { Onboarding } from "./Onboarding";

export const metadata = { title: "Panel · Menús QR" };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { user, restaurante, restaurantes, esSuperadmin } = await obtenerContexto();

  if (!restaurante) {
    const meta = user.user_metadata as { restaurante_nombre?: string; restaurante_slug?: string };
    return <Onboarding nombre={meta.restaurante_nombre} slug={meta.restaurante_slug} />;
  }

  return (
    <div className="min-h-screen pb-24 sm:pb-8">
      <header className="sticky top-0 z-20 border-b border-borde bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          {restaurante.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={restaurante.logo_url} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: restaurante.color_primario }}
            >
              {restaurante.nombre.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            {restaurantes.length > 1 ? (
              <SelectorRestaurante actual={restaurante.id} restaurantes={restaurantes} />
            ) : (
              <p className="truncate font-semibold leading-tight">{restaurante.nombre}</p>
            )}
            <a href={`/${restaurante.slug}`} target="_blank" className="text-xs text-marca hover:underline">
              Ver carta pública ↗
            </a>
          </div>
          {esSuperadmin && (
            <Link href="/admin" className="rounded-lg bg-stone-900 px-2.5 py-1 text-xs font-semibold text-white">
              Admin
            </Link>
          )}
          <form action={cerrarSesion}>
            <button className="text-sm text-suave hover:text-tinta">Salir</button>
          </form>
        </div>
        <NavEscritorio />
      </header>
      <NavMovil />
      <ToastProvider>
        <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>
      </ToastProvider>
    </div>
  );
}
