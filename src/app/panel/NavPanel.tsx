"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Marca } from "@/components/Logo";
import { Icono } from "@/components/Icono";
import { NOMBRE_ROL, type InfoSeccion, type Rol } from "@/lib/salon";
import { cerrarSesion } from "./actions";
import { SelectorRestaurante } from "./SelectorRestaurante";

type Props = {
  restaurante: { id: string; nombre: string; slug: string; logo_url: string | null; color_primario: string };
  restaurantes: { id: string; nombre: string; rol: string }[];
  secciones: InfoSeccion[];
  rol: Rol;
  email: string;
  esSuperadmin: boolean;
  tema: Tema;
  children: React.ReactNode;
};

export type Tema = "oscuro" | "claro";

// Pantallas que usan todo el ancho (plano y comandas); el resto va centrado.
const ANCHO_COMPLETO = ["/panel/salon", "/panel/cocina"];

function activa(ruta: string, href: string) {
  return href === "/panel" ? ruta === "/panel" : ruta === href || ruta.startsWith(`${href}/`);
}

// Marco del panel: menú lateral en computadora; barra superior, barra inferior y menú desplegable en el teléfono.
export function MarcoPanel(props: Props) {
  const ruta = usePathname();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const completo = ANCHO_COMPLETO.some((r) => ruta.startsWith(r));
  const accesos = props.secciones.slice(0, 4);

  const [tema, setTema] = useState(props.tema);

  useEffect(() => setMenuAbierto(false), [ruta]);

  // Se guarda en una cookie para que el servidor pinte el tema correcto desde el primer momento.
  function alternarTema() {
    const nuevo = tema === "oscuro" ? "claro" : "oscuro";
    setTema(nuevo);
    document.cookie = `panel-tema=${nuevo}; path=/; max-age=31536000; samesite=lax`;
  }
  const botonTema = <BotonTema tema={tema} onClick={alternarTema} />;

  return (
    <div className={`min-h-screen bg-fondo text-tinta ${tema === "oscuro" ? "tema-oscuro" : ""}`}>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-borde bg-superficie lg:flex">
        <MenuLateral {...props} ruta={ruta} botonTema={botonTema} />
      </aside>

      {/* Teléfono y tableta: barra superior */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-borde bg-superficie/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <Logo restaurante={props.restaurante} />
        <p className="min-w-0 flex-1 truncate font-semibold">{props.restaurante.nombre}</p>
        {botonTema}
        <button
          type="button"
          onClick={() => setMenuAbierto(true)}
          className="rounded-lg p-2 text-suave hover:bg-stone-100 hover:text-tinta"
          aria-label="Abrir menú"
        >
          <Icono nombre="menu" />
        </button>
      </header>

      {menuAbierto && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuAbierto(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] bg-superficie shadow-2xl">
            <MenuLateral {...props} ruta={ruta} botonTema={botonTema} onCerrar={() => setMenuAbierto(false)} />
          </div>
        </div>
      )}

      <div className="pb-24 lg:pb-10 lg:pl-64">
        <main className={completo ? "px-3 py-4 sm:px-6 lg:py-6" : "mx-auto max-w-4xl px-4 py-5 sm:px-6 lg:py-8"}>
          {props.children}
        </main>
      </div>

      {/* Teléfono: accesos al alcance del pulgar. Fuera de la cabecera: su backdrop-blur rompería el position: fixed. */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-borde bg-superficie pb-[env(safe-area-inset-bottom)] lg:hidden">
        {accesos.map((s) => (
          <Link
            key={s.id}
            href={s.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${activa(ruta, s.href) ? "text-marca" : "text-suave"}`}
          >
            <Icono nombre={s.id} />
            {s.texto}
          </Link>
        ))}
        {props.secciones.length > accesos.length && (
          <button
            type="button"
            onClick={() => setMenuAbierto(true)}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-suave"
          >
            <Icono nombre="mas" />
            Más
          </button>
        )}
      </nav>
    </div>
  );
}

function BotonTema({ tema, onClick }: { tema: Tema; onClick: () => void }) {
  const texto = tema === "oscuro" ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg p-2 text-suave hover:bg-stone-100 hover:text-tinta"
      aria-label={texto}
      title={texto}
    >
      <Icono nombre={tema === "oscuro" ? "sol" : "luna"} className="h-5 w-5" />
    </button>
  );
}

function Logo({ restaurante }: { restaurante: Props["restaurante"] }) {
  return restaurante.logo_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={restaurante.logo_url} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover" />
  ) : (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
      style={{ background: restaurante.color_primario }}
    >
      {restaurante.nombre.charAt(0).toUpperCase()}
    </span>
  );
}

function MenuLateral({
  restaurante,
  restaurantes,
  secciones,
  rol,
  email,
  esSuperadmin,
  ruta,
  botonTema,
  onCerrar,
}: Props & { ruta: string; botonTema: React.ReactNode; onCerrar?: () => void }) {
  const grupos = ["Servicio", "Carta", "Negocio"] as const;

  return (
    <div className="flex min-h-0 w-full flex-col">
      <div className="flex items-start gap-3 border-b border-borde px-4 py-4">
        <Logo restaurante={restaurante} />
        <div className="min-w-0 flex-1">
          {restaurantes.length > 1 ? (
            <SelectorRestaurante actual={restaurante.id} restaurantes={restaurantes} />
          ) : (
            <p className="truncate font-semibold leading-tight">{restaurante.nombre}</p>
          )}
          <a
            href={`/${restaurante.slug}`}
            target="_blank"
            className="mt-0.5 inline-flex items-center gap-1 text-xs text-marca hover:underline"
          >
            Ver carta pública <Icono nombre="externo" className="h-3 w-3" />
          </a>
        </div>
        {onCerrar && (
          <button
            type="button"
            onClick={onCerrar}
            className="-mr-1 rounded-lg p-1.5 text-suave hover:bg-stone-100"
            aria-label="Cerrar menú"
          >
            <Icono nombre="cerrar" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Secciones del panel">
        {grupos.map((grupo) => {
          const items = secciones.filter((s) => s.grupo === grupo);
          if (items.length === 0) return null;
          return (
            <div key={grupo}>
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-stone-400">{grupo}</p>
              <ul className="space-y-0.5">
                {items.map((s) => {
                  const actual = activa(ruta, s.href);
                  return (
                    <li key={s.id}>
                      <Link
                        href={s.href}
                        aria-current={actual ? "page" : undefined}
                        className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                          actual ? "bg-marca/10 text-marca" : "text-stone-600 hover:bg-stone-100 hover:text-tinta"
                        }`}
                      >
                        <Icono nombre={s.id} className={`h-5 w-5 ${actual ? "" : "text-stone-400 group-hover:text-stone-600"}`} />
                        <span className="min-w-0">
                          <span className="block">{s.texto}</span>
                          <span
                            className={`block truncate text-[11px] font-normal ${actual ? "text-marca/70" : "text-stone-400"}`}
                          >
                            {s.ayuda}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-borde px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-500">
            <Icono nombre="personas" className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-suave">{email}</p>
            <p className="text-xs font-semibold">{NOMBRE_ROL[rol] ?? rol}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {esSuperadmin && (
            <Link href="/admin" className="rounded-lg bg-stone-900 px-2.5 py-1.5 text-xs font-semibold text-white">
              Admin
            </Link>
          )}
          <span className="ml-auto">{botonTema}</span>
          <form action={cerrarSesion}>
            <button className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-suave hover:bg-stone-100 hover:text-tinta">
              <Icono nombre="salir" className="h-4 w-4" /> Salir
            </button>
          </form>
        </div>
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-suave">
          <Marca className="h-4 w-4" />
          <span className="font-semibold">Mesitto</span> · por Brote Digital
        </p>
      </div>
    </div>
  );
}
