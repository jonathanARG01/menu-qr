import Link from "next/link";
import { Logo } from "@/components/Logo";
import { MenuPanel } from "@/components/panel/MenuPanel";
import { MARCA, enlaceWhatsapp } from "@/lib/marca";
import { cargarPanel } from "@/lib/panel";
import { NOMBRE_ROL, diasPrueba, vigente } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const { negocio, negocios, dueno, gestor, usuario, sucursales, sucursal, localFijo } = await cargarPanel();
  const dias = diasPrueba(negocio);
  const alDia = vigente(negocio);

  return (
    <div className="min-h-dvh bg-fondo">
      <header className="sticky top-0 z-30 border-b border-borde bg-superficie/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href="/panel" aria-label="Inicio del panel">
            <Logo className="text-xl" />
          </Link>
          {negocios.length > 1 ? (
            <details className="relative">
              <summary className="cursor-pointer list-none rounded-lg border border-borde px-3 py-1.5 text-sm font-medium">
                {negocio.nombre} ▾
              </summary>
              <div className="absolute left-0 mt-1 w-64 rounded-xl border border-borde bg-superficie p-1 shadow-xl">
                {negocios.map((n) => (
                  <a
                    key={n.id}
                    href={`/panel/cambiar?n=${n.id}`}
                    className={`block rounded-lg px-3 py-2 text-sm hover:bg-stone-100 ${n.id === negocio.id ? "font-semibold" : ""}`}
                  >
                    {n.nombre}
                    <span className="block text-xs text-suave">{NOMBRE_ROL[n.rol]}</span>
                  </a>
                ))}
                <a href="/crear" className="block rounded-lg px-3 py-2 text-sm text-marca hover:bg-stone-100">
                  + Otro negocio
                </a>
              </div>
            </details>
          ) : (
            <span className="truncate text-sm font-medium text-suave">{negocio.nombre}</span>
          )}
          {sucursales.length > 0 &&
            (localFijo ? (
              <span className="hidden rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-medium sm:inline">📍 {sucursal?.nombre}</span>
            ) : (
              <details className="relative">
                <summary className="cursor-pointer list-none rounded-lg border border-borde px-2.5 py-1.5 text-xs font-medium">
                  📍 {sucursal?.nombre ?? "Todos los locales"} ▾
                </summary>
                <div className="absolute left-0 z-40 mt-1 w-56 rounded-xl border border-borde bg-superficie p-1 shadow-xl">
                  <a href="/panel/cambiar?l=" className={`block rounded-lg px-3 py-2 text-sm hover:bg-stone-100 ${!sucursal ? "font-semibold" : ""}`}>
                    Todos los locales
                  </a>
                  {sucursales.map((s) => (
                    <a
                      key={s.id}
                      href={`/panel/cambiar?l=${s.id}`}
                      className={`block rounded-lg px-3 py-2 text-sm hover:bg-stone-100 ${s.id === sucursal?.id ? "font-semibold" : ""}`}
                    >
                      {s.nombre}
                    </a>
                  ))}
                </div>
              </details>
            ))}
          <form action="/salir" method="post" className="ml-auto">
            <button className="text-sm text-suave hover:text-tinta" title={usuario.email}>
              Salir
            </button>
          </form>
        </div>
        <MenuPanel dueno={dueno} gestor={gestor} />
      </header>

      {negocio.estado === "prueba" && alDia && (
        <div className="bg-amber-50 px-4 py-2 text-center text-sm text-amber-950">
          {dias <= 0 ? "Hoy es el último día" : dias === 1 ? "Te queda 1 día" : `Te quedan ${dias} días`} de prueba gratis.{" "}
          {dueno && (
            <Link href="/panel/plan" className="font-semibold underline">
              Ver planes
            </Link>
          )}
        </div>
      )}
      {!alDia && (
        <div className="bg-red-600 px-4 py-2.5 text-center text-sm text-white">
          {negocio.estado === "pausado" ? "Tu cuenta está pausada." : "Tu prueba gratis terminó."} Tus clientes y sus sellos
          están guardados, pero no se pueden sumar sellos ni puntos nuevos.{" "}
          <a
            href={enlaceWhatsapp(`Hola, quiero activar ${MARCA} para ${negocio.nombre} (${negocio.slug}).`)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline"
          >
            Activar mi cuenta
          </a>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
