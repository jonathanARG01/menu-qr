"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icono } from "@/components/Icono";
import { Logo } from "@/components/Logo";
import { SelectorTema, Tema } from "@/components/Tema";
import { NOMBRE_ROL, type Rol } from "@/lib/tipos";

// quien: "todos" (también el equipo), "gestor" (dueño o encargado) o "dueno".
type Enlace = { href: string; texto: string; icono: string; quien: "todos" | "gestor" | "dueno" };
const GRUPOS: { titulo: string; enlaces: Enlace[] }[] = [
  {
    titulo: "Día a día",
    enlaces: [
      { href: "/panel", texto: "Clientes", icono: "clientes", quien: "todos" },
      { href: "/panel/cobrar", texto: "Sumar con QR", icono: "qr", quien: "todos" },
    ],
  },
  {
    titulo: "Hacer crecer",
    enlaces: [
      { href: "/panel/metricas", texto: "Métricas", icono: "estadisticas", quien: "gestor" },
      { href: "/panel/campanas", texto: "Campañas", icono: "megafono", quien: "gestor" },
      { href: "/panel/premios", texto: "Premios y cupones", icono: "regalo", quien: "gestor" },
    ],
  },
  {
    titulo: "Tu negocio",
    enlaces: [
      { href: "/panel/tarjeta", texto: "Tu tarjeta", icono: "sellos", quien: "dueno" },
      { href: "/panel/carteles", texto: "QR para unirse", icono: "impresora", quien: "gestor" },
      { href: "/panel/locales", texto: "Locales", icono: "ubicacion", quien: "dueno" },
      { href: "/panel/negocio", texto: "Negocio", icono: "restaurantes", quien: "dueno" },
      { href: "/panel/equipo", texto: "Equipo", icono: "equipo", quien: "dueno" },
      { href: "/panel/integraciones", texto: "API e IA", icono: "rayo", quien: "dueno" },
      { href: "/panel/plan", texto: "Plan", icono: "estrella", quien: "dueno" },
    ],
  },
];

export type DatosMarco = {
  negocio: { id: string; nombre: string; logo_url: string | null };
  negocios: { id: string; nombre: string; rol: Rol }[];
  rol: Rol;
  dueno: boolean;
  gestor: boolean;
  usuario: { email: string; nombre: string };
  sucursales: { id: string; nombre: string }[];
  sucursal: { id: string; nombre: string } | null;
  localFijo: boolean;
  prueba: { estado: string; dias: number; alDia: boolean };
  // Superadmin dentro del panel de un negocio (modo soporte).
  soporte: boolean;
  superadmin: boolean;
};

// Estructura del panel: barra lateral de vidrio (en computador) o menú desplegable (en celular).
export function Marco({ datos, children }: { datos: DatosMarco; children: React.ReactNode }) {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);

  useEffect(() => setAbierto(false), [ruta]);
  useEffect(() => {
    document.body.style.overflow = abierto ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [abierto]);

  const actual = GRUPOS.flatMap((g) => g.enlaces).find((e) => (e.href === "/panel" ? ruta === "/panel" : ruta.startsWith(e.href)));

  return (
    <>
      <Tema />
      <RegistrarApp />

      {/* Computador: barra fija a la izquierda */}
      <aside className="vidrio-barra fixed inset-y-3 left-3 z-30 hidden w-64 flex-col rounded-3xl lg:flex">
        <Contenido datos={datos} ruta={ruta} />
      </aside>

      {/* Celular: barra superior con menú */}
      <header className="vidrio-barra sticky top-0 z-30 flex items-center gap-3 rounded-b-2xl border-t-0 px-4 py-3 lg:hidden">
        <button type="button" onClick={() => setAbierto(true)} className="-ml-1 rounded-xl p-2 hover:bg-stone-100" aria-label="Abrir menú">
          <Icono nombre="menu" className="h-5 w-5" />
        </button>
        <Link href="/panel" aria-label="Inicio del panel">
          <Logo className="text-lg" />
        </Link>
        <span className="ml-auto truncate text-sm font-medium text-suave">{actual?.texto ?? datos.negocio.nombre}</span>
      </header>
      {abierto && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setAbierto(false)} aria-label="Cerrar menú" />
          <aside className="vidrio-barra absolute inset-y-2 left-2 flex w-[17rem] max-w-[85vw] flex-col rounded-3xl bg-superficie">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="absolute right-3 top-4 rounded-xl p-2 text-suave hover:bg-stone-100"
              aria-label="Cerrar menú"
            >
              <Icono nombre="cerrar" className="h-5 w-5" />
            </button>
            <Contenido datos={datos} ruta={ruta} />
          </aside>
        </div>
      )}

      <div className="lg:pl-[17.5rem]">
        {datos.soporte && <Soporte nombre={datos.negocio.nombre} />}
        <BarraSuperior datos={datos} titulo={actual?.texto ?? "Panel"} />
        <Avisos datos={datos} />
        <main className="mx-auto max-w-6xl px-4 pb-10 pt-4 lg:px-8 lg:pt-2">{children}</main>
      </div>
    </>
  );
}

function Contenido({ datos, ruta }: { datos: DatosMarco; ruta: string }) {
  const { negocio, negocios, sucursales, sucursal, localFijo, dueno, gestor } = datos;
  const ve = (e: Enlace) => e.quien === "todos" || (e.quien === "gestor" ? gestor : dueno);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-5 pb-3 pt-5">
        <Link href="/panel" aria-label="Inicio del panel">
          <Logo className="text-lg" />
        </Link>
      </div>

      {/* Negocio (y local) en uso */}
      <div className="space-y-2 px-3">
        <details className="group relative">
          <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl border border-borde bg-stone-50 p-2.5 hover:bg-stone-100">
            <Inicial nombre={negocio.nombre} logo={negocio.logo_url} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{negocio.nombre}</span>
              <span className="block text-xs text-suave">{datos.soporte ? "Modo soporte" : NOMBRE_ROL[datos.rol]}</span>
            </span>
            <Icono nombre="abajo" className="h-4 w-4 text-suave transition group-open:rotate-180" />
          </summary>
          <div className="absolute inset-x-0 z-40 mt-1 rounded-2xl border border-borde bg-superficie p-1 shadow-2xl">
            {negocios.map((n) => (
              <a
                key={n.id}
                href={`/panel/cambiar?n=${n.id}`}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-stone-100 ${n.id === negocio.id ? "font-semibold" : ""}`}
              >
                <span className="min-w-0 flex-1 truncate">{n.nombre}</span>
                <span className="text-xs text-suave">{NOMBRE_ROL[n.rol]}</span>
              </a>
            ))}
            {datos.soporte ? (
              <a href="/panel/soporte?salir=1" className="block rounded-xl px-3 py-2 text-sm font-medium text-marca hover:bg-stone-100">
                ← Volver a Admin
              </a>
            ) : (
              <>
                <a href="/crear" className="block rounded-xl px-3 py-2 text-sm font-medium text-marca hover:bg-stone-100">
                  + Otro negocio
                </a>
                {datos.superadmin && (
                  <a href="/admin" className="block rounded-xl px-3 py-2 text-sm font-medium text-marca hover:bg-stone-100">
                    Ir a Admin (todos los negocios)
                  </a>
                )}
              </>
            )}
          </div>
        </details>
        {sucursales.length > 0 &&
          (localFijo ? (
            <p className="flex items-center gap-2 px-2 text-xs text-suave">
              <Icono nombre="ubicacion" className="h-3.5 w-3.5" /> {sucursal?.nombre}
            </p>
          ) : (
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-medium text-suave hover:bg-stone-100 hover:text-tinta">
                <Icono nombre="ubicacion" className="h-3.5 w-3.5" />
                <span className="flex-1 truncate">{sucursal?.nombre ?? "Todos los locales"}</span>
                <Icono nombre="abajo" className="h-3.5 w-3.5 transition group-open:rotate-180" />
              </summary>
              <div className="absolute inset-x-0 z-40 mt-1 rounded-2xl border border-borde bg-superficie p-1 shadow-2xl">
                <a href="/panel/cambiar?l=" className={`block rounded-xl px-3 py-2 text-sm hover:bg-stone-100 ${!sucursal ? "font-semibold" : ""}`}>
                  Todos los locales
                </a>
                {sucursales.map((s) => (
                  <a
                    key={s.id}
                    href={`/panel/cambiar?l=${s.id}`}
                    className={`block rounded-xl px-3 py-2 text-sm hover:bg-stone-100 ${s.id === sucursal?.id ? "font-semibold" : ""}`}
                  >
                    {s.nombre}
                  </a>
                ))}
              </div>
            </details>
          ))}
      </div>

      <nav className="sin-barra mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-3" aria-label="Secciones del panel">
        {GRUPOS.map((g) => {
          const enlaces = g.enlaces.filter(ve);
          if (!enlaces.length) return null;
          return (
            <div key={g.titulo}>
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-suave/80">{g.titulo}</p>
              <ul className="space-y-0.5">
                {enlaces.map((e) => {
                  const activo = e.href === "/panel" ? ruta === "/panel" : ruta.startsWith(e.href);
                  return (
                    <li key={e.href}>
                      <Link
                        href={e.href}
                        aria-current={activo ? "page" : undefined}
                        className={`group flex items-center gap-3 rounded-2xl px-2 py-1 text-sm transition ${
                          activo ? "bg-marca/10 font-semibold text-tinta" : "text-suave hover:bg-stone-100 hover:text-tinta"
                        }`}
                      >
                        <span
                          className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg transition ${
                            activo ? "icono-activo" : "bg-stone-100 group-hover:bg-stone-200"
                          }`}
                        >
                          <Icono nombre={e.icono} className="h-4 w-4" />
                        </span>
                        {e.texto}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-borde p-3 pt-2.5">
        {datos.prueba.estado === "prueba" && datos.prueba.alDia && <Prueba dias={datos.prueba.dias} dueno={dueno} />}
        <Instalar />
        <SelectorTema />
        <form action="/salir" method="post" className="flex items-center gap-2 px-1">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium">{datos.usuario.nombre || "Tu cuenta"}</span>
            <span className="block truncate text-[11px] text-suave">{datos.usuario.email}</span>
          </span>
          <button className="rounded-xl p-2 text-suave hover:bg-stone-100 hover:text-tinta" title="Salir" aria-label="Salir">
            <Icono nombre="salir" className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

function Inicial({ nombre, logo }: { nombre: string; logo: string | null }) {
  if (logo)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" className="h-9 w-9 shrink-0 rounded-xl bg-white object-contain p-0.5" />;
  return (
    <span className="icono-activo grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold">
      {nombre.trim().charAt(0).toUpperCase() || "·"}
    </span>
  );
}

function Prueba({ dias, dueno }: { dias: number; dueno: boolean }) {
  const total = 30;
  const quedan = Math.max(0, dias);
  return (
    <div className="rounded-2xl border border-borde bg-stone-50 px-3 py-2">
      <p className="flex items-center gap-2 text-xs">
        <span className="font-semibold">{quedan <= 0 ? "Prueba: último día" : quedan === 1 ? "Prueba: queda 1 día" : `Prueba: quedan ${quedan} días`}</span>
        {dueno && (
          <Link href="/panel/plan" className="ml-auto font-semibold text-marca hover:underline">
            Planes
          </Link>
        )}
      </p>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-stone-200">
        <div className="icono-activo h-full rounded-full" style={{ width: `${Math.min(100, Math.max(4, ((total - quedan) / total) * 100))}%` }} />
      </div>
    </div>
  );
}

function BarraSuperior({ datos, titulo }: { datos: DatosMarco; titulo: string }) {
  const [hoy, setHoy] = useState("");
  useEffect(() => {
    setHoy(new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" }));
  }, []);
  return (
    <div className="mx-auto hidden max-w-6xl items-center gap-3 px-8 pb-2 pt-6 lg:flex">
      <p className="text-sm text-suave">
        {datos.negocio.nombre} <span className="mx-1.5 opacity-50">/</span>
        <span className="font-medium text-tinta">{titulo}</span>
      </p>
      <p className="ml-auto text-sm text-suave first-letter:uppercase">{hoy}</p>
      <Link href="/panel/cobrar" className="boton py-2">
        <Icono nombre="qr" className="h-4 w-4" /> Sumar con QR
      </Link>
    </div>
  );
}

// Franja fija que recuerda que estás dentro de un negocio ajeno como soporte.
function Soporte({ nombre }: { nombre: string }) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-3 lg:px-8 lg:pt-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-50 px-4 py-2.5 text-sm text-amber-950">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-amber-400 text-base text-black" aria-hidden>
          🛠️
        </span>
        <p className="min-w-0 flex-1">
          <b>Modo soporte.</b> Estás dentro de <b>{nombre}</b> como desarrollador: todo lo que cambies queda guardado en su cuenta.
        </p>
        <a href="/panel/soporte?salir=1" className="boton-secundario py-1.5">
          Salir del modo soporte
        </a>
      </div>
    </div>
  );
}

function Avisos({ datos }: { datos: DatosMarco }) {
  const { prueba } = datos;
  if (prueba.alDia) return null;
  return (
    <div className="mx-auto max-w-6xl px-4 pt-4 lg:px-8">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-800">
        <Icono nombre="candado" className="h-5 w-5 shrink-0" />
        <p className="min-w-0 flex-1">
          <b>{prueba.estado === "pausado" ? "Tu cuenta está pausada." : "Tu prueba gratis terminó."}</b> Tus clientes y sus sellos
          están guardados, pero no se pueden sumar sellos ni puntos nuevos.
        </p>
        {datos.dueno && (
          <Link href="/panel/plan" className="boton py-2">
            Activar mi cuenta
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Instalar el panel como app en el computador o celular ──
type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
declare global {
  interface Window {
    __instalarPanel?: EventoInstalar | null;
  }
}

function RegistrarApp() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}

function Instalar() {
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  const [instalada, setInstalada] = useState(true);

  useEffect(() => {
    setInstalada(matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: window-controls-overlay)").matches);
    setEvento(window.__instalarPanel ?? null);
    const listo = (e: Event) => {
      e.preventDefault();
      window.__instalarPanel = e as EventoInstalar;
      setEvento(e as EventoInstalar);
    };
    const hecho = () => {
      window.__instalarPanel = null;
      setEvento(null);
      setInstalada(true);
    };
    window.addEventListener("beforeinstallprompt", listo);
    window.addEventListener("appinstalled", hecho);
    return () => {
      window.removeEventListener("beforeinstallprompt", listo);
      window.removeEventListener("appinstalled", hecho);
    };
  }, []);

  if (instalada || !evento) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        await evento.prompt();
        const r = await evento.userChoice.catch(() => null);
        if (r?.outcome === "accepted") setInstalada(true);
        window.__instalarPanel = null;
        setEvento(null);
      }}
      className="flex w-full items-center gap-3 rounded-2xl border border-marca/30 bg-marca/10 p-2.5 text-left text-sm transition hover:bg-marca/15"
    >
      <span className="icono-activo grid h-8 w-8 shrink-0 place-items-center rounded-xl">
        <Icono nombre="instalar" className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">Instalar la app</span>
        <span className="block text-xs text-suave">Ábrela como programa, sin el navegador</span>
      </span>
    </button>
  );
}
