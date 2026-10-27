"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Marca } from "@/components/Logo";
import { Icono } from "@/components/Icono";
import { NOMBRE_ROL, type InfoSeccion, type Rol } from "@/lib/salon";
import { cerrarSesion } from "./actions";
import { SelectorRestaurante } from "./SelectorRestaurante";
import { AvisoPrueba } from "./AvisoPrueba";
import { NOMBRE_PLAN, planDeSeccion, type Plan } from "@/lib/planes";

type Props = {
  restaurante: {
    id: string;
    nombre: string;
    slug: string;
    logo_url: string | null;
    color_primario: string;
    plan: Plan;
    prueba_inicio: string | null;
    prueba_fin: string | null;
  };
  restaurantes: { id: string; nombre: string; rol: string }[];
  secciones: InfoSeccion[];
  // Secciones que el plan no incluye: van con candado al final de su grupo.
  bloqueadas: InfoSeccion[];
  admin: boolean;
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
  // La carta lleva una columna de resumen a la derecha en pantallas anchas.
  const ancho = ruta === "/panel" ? "max-w-6xl" : "max-w-5xl";
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
    <div className={`panel-ui panel-fondo min-h-screen text-tinta ${tema === "oscuro" ? "tema-oscuro" : ""}`}>
      {/* Computadora: menú lateral flotante, como una tarjeta más */}
      <aside className="fixed inset-y-3 left-3 z-30 hidden w-60 overflow-hidden rounded-3xl border border-borde bg-superficie shadow-[0_20px_50px_-30px_rgb(0_0_0/0.5)] lg:flex">
        <MenuLateral {...props} ruta={ruta} botonTema={botonTema} />
      </aside>

      {/* Teléfono y tableta: barra superior */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-borde bg-superficie/90 px-4 py-2.5 backdrop-blur lg:hidden">
        <Logo restaurante={props.restaurante} />
        <p className="min-w-0 flex-1 truncate font-semibold">{props.restaurante.nombre}</p>
        {botonTema}
        <button
          type="button"
          onClick={() => setMenuAbierto(true)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-suave hover:text-tinta"
          aria-label="Abrir menú"
        >
          <Icono nombre="menu" className="h-5 w-5" />
        </button>
      </header>

      {menuAbierto && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => setMenuAbierto(false)} />
          <div className="absolute inset-y-2 left-2 flex w-72 max-w-[85vw] overflow-hidden rounded-3xl border border-borde bg-superficie shadow-2xl">
            <MenuLateral {...props} ruta={ruta} botonTema={botonTema} onCerrar={() => setMenuAbierto(false)} />
          </div>
        </div>
      )}

      <div className="pb-28 lg:pb-10 lg:pl-[16.5rem]">
        <BarraSuperior {...props} botonTema={botonTema} />
        <main className={completo ? "px-3 py-4 sm:px-6 lg:pt-2 lg:pb-6" : `mx-auto ${ancho} px-4 py-5 sm:px-6 lg:pt-2 lg:pb-8`}>
          {props.admin && ruta !== "/panel/plan" && <AvisoPrueba restaurante={props.restaurante} />}
          {props.children}
        </main>
      </div>

      {/* Teléfono: accesos al alcance del pulgar, en una barra flotante. Fuera de la cabecera: su backdrop-blur
          rompería el position: fixed. */}
      <nav className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 flex gap-1 rounded-2xl border border-borde bg-superficie/95 p-1.5 shadow-[0_12px_40px_-12px_rgb(0_0_0/0.45)] backdrop-blur lg:hidden">
        {accesos.map((s) => {
          const actual = activa(ruta, s.href);
          return (
            <Link
              key={s.id}
              href={s.href}
              aria-current={actual ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition ${
                actual ? "bg-marca-claro text-marca-tinta" : "text-suave"
              }`}
            >
              <Icono nombre={s.id} className="h-5 w-5" />
              {s.texto}
            </Link>
          );
        })}
        {props.secciones.length > accesos.length && (
          <button
            type="button"
            onClick={() => setMenuAbierto(true)}
            className="flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium text-suave"
          >
            <Icono nombre="mas" className="h-5 w-5" />
            Más
          </button>
        )}
      </nav>
    </div>
  );
}

// Computadora: el restaurante que se está editando, su carta pública y la fecha, arriba del contenido.
function BarraSuperior({ restaurante, restaurantes, botonTema }: Props & { botonTema: React.ReactNode }) {
  const [hoy, setHoy] = useState("");
  // Se calcula en el navegador para mostrar la fecha del lugar donde está la persona.
  useEffect(() => {
    const texto = new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
    setHoy(texto.charAt(0).toUpperCase() + texto.slice(1));
  }, []);

  return (
    <div className="hidden items-center gap-3 px-6 pt-5 pb-4 lg:flex">
      <Logo restaurante={restaurante} />
      <div className="min-w-0">
        {restaurantes.length > 1 ? (
          <SelectorRestaurante actual={restaurante.id} restaurantes={restaurantes} />
        ) : (
          <p className="truncate font-semibold leading-tight">{restaurante.nombre}</p>
        )}
        <p className="text-xs text-suave">{hoy || "\u00a0"}</p>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <a
          href={`/${restaurante.slug}`}
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-full border border-borde bg-superficie px-3.5 py-2 text-sm font-medium hover:bg-stone-100"
        >
          Ver carta pública <Icono nombre="externo" className="h-3.5 w-3.5 text-suave" />
        </a>
        <span className="rounded-full border border-borde bg-superficie p-0.5">{botonTema}</span>
      </div>
    </div>
  );
}

function BotonTema({ tema, onClick }: { tema: Tema; onClick: () => void }) {
  const texto = tema === "oscuro" ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full text-suave hover:bg-stone-100 hover:text-tinta"
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
  bloqueadas,
  admin,
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
      <div className="flex items-center gap-2 px-5 pt-5 pb-3">
        <Link href="/panel" className="text-xl" aria-label="Mesitto, inicio del panel">
          <MarcaMesitto oscuro />
        </Link>
        {onCerrar && (
          <button
            type="button"
            onClick={onCerrar}
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-suave"
            aria-label="Cerrar menú"
          >
            <Icono nombre="cerrar" className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* En el teléfono la barra superior no tiene el selector: va aquí. */}
      {onCerrar && (
        <div className="mx-3 mb-1 flex items-center gap-3 rounded-2xl bg-stone-50 p-3">
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
        </div>
      )}

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-3" aria-label="Secciones del panel">
        {grupos.map((grupo) => {
          const items = secciones.filter((s) => s.grupo === grupo);
          const conCandado = bloqueadas.filter((s) => s.grupo === grupo);
          if (items.length === 0 && conCandado.length === 0) return null;
          return (
            <div key={grupo}>
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">{grupo}</p>
              <ul className="space-y-0.5">
                {items.map((s) => {
                  const actual = activa(ruta, s.href);
                  return (
                    <li key={s.id}>
                      <Link
                        href={s.href}
                        title={s.ayuda}
                        aria-current={actual ? "page" : undefined}
                        className={`group flex items-center gap-3 rounded-2xl px-2 py-1.5 text-sm transition ${
                          actual
                            ? "bg-stone-100 font-semibold text-tinta"
                            : "font-medium text-stone-600 hover:bg-stone-50 hover:text-tinta"
                        }`}
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition ${
                            actual
                              ? "bg-marca-claro text-marca-tinta shadow-[0_6px_16px_-6px_rgb(242_163_58/0.7)]"
                              : "bg-stone-100 text-stone-500 group-hover:text-tinta"
                          }`}
                        >
                          <Icono nombre={s.id} className="h-[18px] w-[18px]" />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{s.texto}</span>
                        {actual && <span className="mr-1 h-1.5 w-1.5 rounded-full bg-marca-claro" aria-hidden />}
                      </Link>
                    </li>
                  );
                })}
                {conCandado.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/panel/plan?s=${s.id}`}
                      title={`${s.ayuda} · disponible en el plan ${NOMBRE_PLAN[planDeSeccion(s.id)]}`}
                      className="group flex items-center gap-3 rounded-2xl px-2 py-1.5 text-sm font-medium text-stone-400 transition hover:bg-stone-50 hover:text-stone-600"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-stone-50 text-stone-400">
                        <Icono nombre={s.id} className="h-[18px] w-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{s.texto}</span>
                      <span className="mr-1 inline-flex items-center gap-1 rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                        <Icono nombre="candado" className="h-3 w-3" />
                        {NOMBRE_PLAN[planDeSeccion(s.id)]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="m-3 mt-1 space-y-3 rounded-2xl border border-borde bg-stone-50 p-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-marca text-sm font-bold text-white">
            {email.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{email}</p>
            <p className="text-[11px] text-suave">
              {NOMBRE_ROL[rol] ?? rol}
              {admin && (
                <>
                  {" · "}
                  <Link href="/panel/plan" className="font-semibold text-marca hover:underline">
                    Plan {NOMBRE_PLAN[restaurante.plan]}
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {esSuperadmin && (
            <Link href="/admin" className="rounded-full bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white">
              Admin
            </Link>
          )}
          <span className="ml-auto">{botonTema}</span>
          <form action={cerrarSesion}>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full text-suave hover:bg-stone-100 hover:text-tinta"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <Icono nombre="salir" className="h-5 w-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// Símbolo y nombre de Mesitto; en oscuro, el nombre en blanco.
function MarcaMesitto({ oscuro }: { oscuro?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Marca className="h-8 w-8" oscuro={oscuro} />
      <span className="font-marca text-lg font-bold leading-none tracking-tight">
        Mesitto<span className="text-marca-claro">.</span>
      </span>
    </span>
  );
}
