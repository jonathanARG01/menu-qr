"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { TarjetaVisual } from "@/components/sellos/TarjetaVisual";
import { PROGRAMA_BASE } from "@/lib/sellos/tipos";

/* Recorrido animado de la landing: cada paso es una maqueta hecha con HTML/CSS (nada de videos) que se reproduce
   sola mientras está en pantalla, como un guion de escenas. El visitante puede tocar cada escena, pausar o seguir.
   Con "reducir movimiento" no avanza solo: muestra la escena más representativa y las demás se ven tocando los botones. */

export type IdEscena = "pedido" | "salon" | "cocina" | "cobro" | "loyalty" | "personalizar";

const clp = (n: number) => "$" + n.toLocaleString("es-CL");

type Guion = {
  ref: RefObject<HTMLDivElement | null>;
  escena: number;
  vuelta: number;
  activo: boolean;
  pausa: boolean;
  quieto: boolean;
  ir: (i: number) => void;
  alternar: () => void;
};

// Avanza de escena en escena mientras el bloque está a la vista (y no está en pausa ni con movimiento reducido).
function useGuion(duraciones: readonly number[], escenaQuieta: number): Guion {
  const ref = useRef<HTMLDivElement>(null);
  const [escena, setEscena] = useState(0);
  const [vuelta, setVuelta] = useState(0);
  const [visible, setVisible] = useState(false);
  const [pausa, setPausa] = useState(false);
  const [quieto, setQuieto] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const aplicar = () => {
      setQuieto(mq.matches);
      if (mq.matches) setEscena(escenaQuieta);
    };
    aplicar();
    mq.addEventListener("change", aplicar);
    return () => mq.removeEventListener("change", aplicar);
  }, [escenaQuieta]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const activo = visible && !pausa && !quieto;
  useEffect(() => {
    if (!activo) return;
    const t = window.setTimeout(() => setEscena((e) => (e + 1) % duraciones.length), duraciones[escena]);
    return () => window.clearTimeout(t);
  }, [activo, escena, vuelta, duraciones]);

  return {
    ref,
    escena,
    vuelta,
    activo,
    pausa,
    quieto,
    ir: (i) => {
      setEscena(i);
      setVuelta((v) => v + 1);
    },
    alternar: () => setPausa((p) => !p),
  };
}

// Contador que sube cada `ms` mientras corre (para cambios dentro de una misma escena).
function useTic(corriendo: boolean, ms: number, reinicio: unknown) {
  const [tic, setTic] = useState(0);
  useEffect(() => {
    setTic(0);
    if (!corriendo) return;
    const t = window.setInterval(() => setTic((n) => n + 1), ms);
    return () => window.clearInterval(t);
  }, [corriendo, ms, reinicio]);
  return tic;
}

// Botones de escena con barra de avance, más pausa/seguir.
function Controles({ g, etiquetas, duraciones, nombre }: { g: Guion; etiquetas: string[]; duraciones: readonly number[]; nombre: string }) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-2" role="group" aria-label={`Escenas: ${nombre}`}>
      {!g.quieto && (
        <button
          type="button"
          onClick={g.alternar}
          aria-label={g.pausa ? "Seguir la animación" : "Pausar la animación"}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-sitio-borde bg-sitio-vidrio text-sitio-tinta transition hover:border-sitio-oro/50"
        >
          {g.pausa ? (
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
              <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
            </svg>
          )}
        </button>
      )}
      {etiquetas.map((t, i) => {
        const actual = i === g.escena;
        return (
          <button
            key={t}
            type="button"
            aria-pressed={actual}
            onClick={() => g.ir(i)}
            className={`relative overflow-hidden rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              actual
                ? "border-sitio-oro/70 text-sitio-oro-texto"
                : "border-sitio-borde bg-sitio-vidrio text-sitio-suave hover:border-sitio-oro/40 hover:text-sitio-tinta"
            }`}
          >
            {actual && (
              <span
                key={`${g.escena}-${g.vuelta}-${g.activo}`}
                aria-hidden
                className={`absolute inset-0 bg-sitio-oro/15 ${g.activo ? "recorrido-progreso" : ""}`}
                style={g.activo ? { animationDuration: `${duraciones[i]}ms` } : undefined}
              />
            )}
            <span className="relative">{t}</span>
          </button>
        );
      })}
    </div>
  );
}

// Dedo (punto de toque) que viaja hasta el botón marcado con data-objetivo y lo presiona al final de la escena.
function Dedo({ raiz, objetivo, toqueEn, clave, oculto }: { raiz: RefObject<HTMLDivElement | null>; objetivo: string | null; toqueEn: number; clave: string; oculto: boolean }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const r = raiz.current;
    if (!r) return;
    const medir = () => {
      if (!objetivo) return setPos(null);
      const el = r.querySelector<HTMLElement>(`[data-objetivo="${objetivo}"]`);
      if (!el) return setPos(null);
      const a = r.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      setPos({ x: b.left - a.left + b.width / 2, y: b.top - a.top + b.height / 2 });
    };
    const t = window.setTimeout(medir, 420);
    const ro = new ResizeObserver(medir);
    ro.observe(r);
    return () => {
      window.clearTimeout(t);
      ro.disconnect();
    };
  }, [raiz, objetivo, clave]);
  if (oculto) return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute z-30 transition-[left,top,opacity] duration-700 ease-out"
      style={{ left: pos?.x ?? "50%", top: pos?.y ?? "70%", opacity: pos ? 1 : 0 }}
    >
      <span key={clave} className="recorrido-dedo block" style={{ animationDelay: `${toqueEn}ms` }} />
      <span key={`o${clave}`} className="recorrido-onda block" style={{ animationDelay: `${toqueEn}ms` }} />
    </span>
  );
}

// Marco de celular.
function Celular({ children, className = "", claro = true }: { children: ReactNode; className?: string; claro?: boolean }) {
  return (
    <div className={`relative rounded-[2.3rem] bg-[#0d0f14] p-2 shadow-2xl shadow-black/50 ring-1 ring-white/15 ${className}`}>
      <div className="absolute left-1/2 top-3 z-20 h-4 w-20 -translate-x-1/2 rounded-full bg-[#0d0f14]" />
      <div className={`relative aspect-[9/18.5] overflow-hidden rounded-[1.85rem] ${claro ? "bg-[#faf7f2] text-stone-800" : "bg-[#0f131b] text-slate-100"}`}>
        {children}
      </div>
    </div>
  );
}

// Marco de tablet / computador con el panel oscuro adentro.
function Pantalla({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`vidrio relative rounded-[1.6rem] p-1.5 shadow-2xl shadow-black/40 sm:p-2 ${className}`}>
      <div className="relative overflow-hidden rounded-[1.25rem] bg-[#0f131b] text-slate-100">{children}</div>
    </div>
  );
}

// Pastilla de aviso flotante (como las del panel).
function Pildora({ color, children, className = "" }: { color: string; children: ReactNode; className?: string }) {
  return (
    <span
      className={`recorrido-entrar inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-sitio-borde px-3 py-1.5 text-xs font-semibold text-sitio-tinta shadow-lg shadow-black/20 ${className}`}
      style={{ background: "var(--sitio-vidrio-fuerte)" }}
    >
      <span className="recorrido-titilar h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
      {children}
    </span>
  );
}

/* ───────────────────────── 01 · El cliente pide ───────────────────────── */

const PLATOS = [
  { nombre: "Flat white", detalle: "Doble espresso y leche texturizada", precio: 3200, emoji: "☕", fondo: "#e8d6c0" },
  { nombre: "Croissant de mantequilla", detalle: "Horneado cada mañana", precio: 2900, emoji: "🥐", fondo: "#f3dfb0" },
  { nombre: "Cheesecake de maracuyá", detalle: "Base de galleta y coulis", precio: 4200, emoji: "🍰", fondo: "#f6d2c4" },
];
const DUR_PEDIDO = [2300, 1900, 2000, 2500, 2700, 3200] as const;
const OBJ_PEDIDO = ["agregar-0", "agregar-1", "ver-pedido", "enviar", "mesero", null];

function EscenaPedido() {
  const g = useGuion(DUR_PEDIDO, 4);
  const e = g.escena;
  const cant = [e >= 1 ? 1 : 0, e >= 2 ? 1 : 0, 0];
  const total = PLATOS.reduce((s, p, i) => s + p.precio * cant[i], 0);
  const enviado = e >= 4;
  return (
    <div>
      <div className="flex h-10 items-center justify-center">
        {e === 4 && (
          <Pildora key="p4" color="#f59e0b">
            En el panel: Mesa 15 · pedido nuevo
          </Pildora>
        )}
        {e === 5 && (
          <Pildora key="p5" color="#38bdf8">
            En el panel: Mesa 15 llama al mesero
          </Pildora>
        )}
      </div>
      <div ref={g.ref} className="relative mx-auto mt-2 w-[250px] sm:w-[270px]">
        <Celular>
          <div aria-hidden className="absolute inset-0 flex flex-col text-[11px]">
            {/* Portada de la carta */}
            <div className="relative h-[22%] shrink-0 bg-gradient-to-br from-[#3b2414] to-[#8a5a32] px-4 pb-3 pt-8 text-white">
              <p className="font-elegante text-xl italic leading-none">Aroma Café</p>
              <p className="mt-1 text-[10px] text-white/70">Cafetería de especialidad · Valparaíso</p>
              <span className="absolute bottom-3 right-3 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold">Mesa 15</span>
            </div>
            <div className="flex gap-1.5 overflow-hidden px-3 pt-3 text-[10px] font-semibold">
              {["Cafés", "Pastelería", "Sándwiches", "Jugos"].map((c, i) => (
                <span key={c} className={`rounded-full px-2.5 py-1 ${i === 0 ? "bg-[#3b2414] text-white" : "bg-stone-200/80 text-stone-600"}`}>
                  {c}
                </span>
              ))}
            </div>
            <ul className="flex-1 space-y-2 px-3 pt-3">
              {PLATOS.map((p, i) => (
                <li key={p.nombre} className="flex items-center gap-2.5 rounded-xl bg-white p-2 shadow-sm">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xl" style={{ background: p.fondo }}>
                    {p.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold leading-tight">{p.nombre}</span>
                    <span className="block truncate text-[9.5px] text-stone-500">{p.detalle}</span>
                    <span className="mt-0.5 block font-bold text-[#8a5a32]">{clp(p.precio)}</span>
                  </span>
                  {cant[i] ? (
                    <span key="c" className="recorrido-pop flex items-center gap-1.5 rounded-full bg-[#3b2414] px-2 py-1 text-[10px] font-bold text-white">
                      <span>−</span>
                      {cant[i]}
                      <span>+</span>
                    </span>
                  ) : (
                    <span data-objetivo={`agregar-${i}`} className="rounded-full border border-[#3b2414] px-2.5 py-1 text-[10px] font-bold text-[#3b2414]">
                      Agregar
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {/* Botones de la mesa */}
            <div className="flex gap-1.5 px-3 pb-2">
              <span
                data-objetivo="mesero"
                className={`flex flex-1 items-center justify-center gap-1 rounded-full border py-1.5 text-[10px] font-semibold transition ${
                  e === 5 ? "border-sky-500 bg-sky-500 text-white" : "border-stone-300 bg-white text-stone-700"
                }`}
              >
                🙋 Llamar al mesero
              </span>
              <span className="flex flex-1 items-center justify-center gap-1 rounded-full border border-stone-300 bg-white py-1.5 text-[10px] font-semibold text-stone-700">
                🧾 Pedir la cuenta
              </span>
            </div>
            {/* Barra inferior */}
            <div className="h-12 shrink-0 px-3 pb-3">
              {enviado ? (
                <div className="flex h-full items-center justify-between rounded-full bg-emerald-50 px-3 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
                  <span className="flex items-center gap-1.5">
                    <span className="recorrido-titilar h-1.5 w-1.5 rounded-full bg-emerald-500" /> Tu pedido está en la cocina
                  </span>
                  <span>{clp(6100)}</span>
                </div>
              ) : e >= 2 ? (
                <div data-objetivo="ver-pedido" className="recorrido-subir flex h-full items-center justify-between rounded-full bg-[#3b2414] px-4 text-[11px] font-semibold text-white">
                  <span>Ver pedido · 2</span>
                  <span>{clp(total)}</span>
                </div>
              ) : null}
            </div>

            {/* Hoja del pedido */}
            <div className={`absolute inset-x-0 bottom-0 z-10 rounded-t-3xl bg-white px-4 pb-4 pt-3 shadow-[0_-12px_30px_rgb(0_0_0/0.15)] transition-transform duration-500 ${e === 3 ? "translate-y-0" : "translate-y-full"}`}>
              <span className="mx-auto block h-1 w-10 rounded-full bg-stone-300" />
              <p className="mt-2 text-sm font-bold">Tu pedido</p>
              {PLATOS.slice(0, 2).map((p) => (
                <p key={p.nombre} className="mt-1.5 flex justify-between text-[10.5px]">
                  <span>1 × {p.nombre}</span>
                  <span className="font-semibold">{clp(p.precio)}</span>
                </p>
              ))}
              <p className="mt-2 rounded-lg bg-stone-100 px-2 py-1.5 text-[10px] text-stone-500">Nota: flat white sin azúcar</p>
              <p className="mt-2 flex justify-between border-t border-stone-200 pt-2 text-[11px] font-bold">
                <span>Total</span>
                <span>{clp(6100)}</span>
              </p>
              <span data-objetivo="enviar" className="mt-2.5 flex items-center justify-center rounded-full bg-emerald-700 py-2.5 text-[11px] font-bold text-white">
                Enviar pedido · Mesa 15
              </span>
            </div>

            {/* Avisos al cliente */}
            {e === 4 && (
              <div key="t4" className="recorrido-entrar absolute inset-x-3 top-8 z-20 rounded-2xl bg-emerald-600 px-3 py-2.5 text-[10.5px] font-semibold text-white shadow-xl">
                ✓ ¡Pedido enviado! Ya está en la cocina.
              </div>
            )}
            {e === 5 && (
              <div key="t5" className="recorrido-entrar absolute inset-x-3 top-8 z-20 rounded-2xl bg-sky-600 px-3 py-2.5 text-[10.5px] font-semibold text-white shadow-xl">
                🙋 Avisamos al mesero. Ya viene.
              </div>
            )}
          </div>
        </Celular>
        <Dedo raiz={g.ref} objetivo={OBJ_PEDIDO[e]} toqueEn={DUR_PEDIDO[e] - 700} clave={`${e}-${g.vuelta}`} oculto={g.quieto || !g.activo} />
      </div>
      <p className="sr-only">
        Animación: el cliente agrega un flat white y un croissant, revisa su pedido, lo envía a la cocina y llama al mesero desde la carta.
      </p>
      <Controles g={g} nombre="pedido" duraciones={DUR_PEDIDO} etiquetas={["La carta", "Agrega", "Agrega otro", "Revisa", "Envía", "Llama al mesero"]} />
    </div>
  );
}

/* ───────────────────────── 02 · Salón ───────────────────────── */

type TipoAviso = "mozo" | "cuenta" | "listo" | "reloj";
const AVISOS: Record<TipoAviso, { color: string; icono: string; titulo: (m: string) => string; detalle: string }> = {
  mozo: { color: "#38bdf8", icono: "🙋", titulo: (m) => `Mesa ${m} llama al mesero`, detalle: "Desde la carta QR de la mesa" },
  cuenta: { color: "#a78bfa", icono: "🧾", titulo: (m) => `Mesa ${m} pide la cuenta`, detalle: "Lleva la cuenta o cobra desde el panel" },
  listo: { color: "#34d399", icono: "🍽️", titulo: (m) => `Mesa ${m}: pedido listo`, detalle: "La cocina lo terminó, llévalo a la mesa" },
  reloj: { color: "#f87171", icono: "⏱️", titulo: (m) => `Mesa ${m} necesita que pases`, detalle: "Lleva rato esperando" },
};

const PISOS = ["Planta baja", "Planta alta", "Playa"] as const;
const VISTAS = ["Simple", "Color", "3D", "Maqueta"] as const;

// Capturas reales del panel de Aroma Café; x, y y r (tamaño del anillo) en % del ancho de la imagen.
const VISTAS_SALON: {
  img: string;
  etiqueta: string;
  piso: (typeof PISOS)[number];
  vista: (typeof VISTAS)[number];
  mesa: string;
  tipo: TipoAviso;
  x: number;
  y: number;
  r: number;
  nota: string;
}[] = [
  { img: "/inicio/salon/simple.webp", etiqueta: "Simple", piso: "Planta baja", vista: "Simple", mesa: "8", tipo: "mozo", x: 57.7, y: 59, r: 12, nota: "Vista simple: clara y rápida, ideal para el celular del mesero." },
  { img: "/inicio/salon/color.webp", etiqueta: "Color", piso: "Planta baja", vista: "Color", mesa: "2", tipo: "cuenta", x: 49.9, y: 19, r: 17, nota: "Vista a color: madera, pasillos y barra como en tu local." },
  { img: "/inicio/salon/3d.webp", etiqueta: "3D", piso: "Planta baja", vista: "3D", mesa: "4", tipo: "cuenta", x: 65.4, y: 33.6, r: 15, nota: "Vista 3D: el plano inclinado para verlo de un vistazo." },
  { img: "/inicio/salon/maqueta.webp", etiqueta: "Maqueta", piso: "Planta baja", vista: "Maqueta", mesa: "6", tipo: "listo", x: 39.6, y: 60, r: 9, nota: "Maqueta: tu local en miniatura, con paredes, barra, caja y escalera." },
  { img: "/inicio/salon/comensales.webp", etiqueta: "Comensales", piso: "Planta baja", vista: "Maqueta", mesa: "2", tipo: "mozo", x: 25.5, y: 51.4, r: 24, nota: "Comensales sentados, el mesero y los platos en cada mesa. Se gira y se acerca con el dedo." },
  { img: "/inicio/salon/alta.webp", etiqueta: "Planta alta", piso: "Planta alta", vista: "Maqueta", mesa: "12", tipo: "reloj", x: 54.9, y: 37.1, r: 10, nota: "Varios pisos y los indicadores: tiempo en la mesa y mesas que esperan demasiado." },
  { img: "/inicio/salon/playa.webp", etiqueta: "Playa", piso: "Playa", vista: "Maqueta", mesa: "22", tipo: "mozo", x: 41.4, y: 45.8, r: 9, nota: "Terraza, calle o playa: cada espacio con su plano, palmeras y quincho incluidos." },
  { img: "/inicio/salon/playa-cerca.webp", etiqueta: "De cerca", piso: "Playa", vista: "Maqueta", mesa: "24", tipo: "cuenta", x: 77.1, y: 66.3, r: 22, nota: "Acerca cualquier mesa para ver quién está, cuánto lleva y cuánto va gastando." },
];
const DUR_SALON = VISTAS_SALON.map(() => 4200);

function EscenaSalon() {
  const g = useGuion(DUR_SALON, 5);
  const v = VISTAS_SALON[g.escena];
  const aviso = AVISOS[v.tipo];
  const historial = [0, 1, 2].map((k) => VISTAS_SALON[(g.escena - k + VISTAS_SALON.length) % VISTAS_SALON.length]);

  const irA = (piso?: string, vista?: string) => {
    const i = VISTAS_SALON.findIndex((s) => (piso ? s.piso === piso : true) && (vista ? s.vista === vista : true));
    const j = piso ? VISTAS_SALON.findIndex((s) => s.piso === piso && s.vista === v.vista) : -1;
    g.ir(j >= 0 ? j : Math.max(0, i));
  };
  const pastilla = (activo: boolean) =>
    `shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold transition sm:px-3 sm:text-xs ${
      activo ? "bg-white text-slate-900" : "bg-white/10 text-slate-200 hover:bg-white/20"
    }`;

  return (
    <div>
      <div ref={g.ref}>
        <Pantalla>
          {/* Barra superior como la del panel */}
          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2.5 sm:px-4">
            <p className="font-marca text-sm font-bold sm:text-base">Aroma Café · Salón</p>
            <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5 text-[10px] sm:text-xs">
              <span className="recorrido-titilar h-1.5 w-1.5 rounded-full bg-emerald-400" /> En vivo
            </span>
            <span className="hidden rounded-full bg-white/10 px-2 py-0.5 text-[10px] sm:inline sm:text-xs">Total: 8 de 26 mesas ocupadas · 22 personas</span>
          </div>
          <div className="flex gap-3 overflow-x-auto px-3 py-2 sm:px-4 [scrollbar-width:none]">
            <div className="flex shrink-0 gap-1.5">
              {PISOS.map((p) => (
                <button key={p} type="button" onClick={() => irA(p)} className={pastilla(v.piso === p)}>
                  {p}
                </button>
              ))}
            </div>
            <div className="flex shrink-0 gap-1 rounded-full bg-white/5 p-0.5">
              {VISTAS.map((s) => (
                <button key={s} type="button" onClick={() => irA(undefined, s)} className={pastilla(v.vista === s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-[1fr_15rem]">
            {/* Plano */}
            <div className="relative aspect-[1392/804] overflow-hidden bg-[#141924]">
              {VISTAS_SALON.map((s, i) => (
                <Image
                  key={s.img}
                  src={s.img}
                  alt={`Salón de Aroma Café: ${s.etiqueta.toLowerCase()}, ${s.piso.toLowerCase()}`}
                  fill
                  sizes="(min-width: 1024px) 800px, 100vw"
                  className={`object-cover transition-[opacity,transform] duration-1000 ease-out ${i === g.escena ? "scale-100 opacity-100" : "scale-[1.04] opacity-0"}`}
                />
              ))}
              {/* Mesa titilando */}
              <div
                key={`anillo-${g.escena}`}
                aria-hidden
                className="recorrido-aparecer pointer-events-none absolute"
                style={{ left: `${v.x}%`, top: `${v.y}%`, width: `${v.r}%`, aspectRatio: "1", "--color": aviso.color } as CSSProperties}
              >
                <span className="recorrido-pulso absolute left-1/2 top-1/2 h-full w-full rounded-full border-[3px]" style={{ borderColor: aviso.color }} />
                <span className="recorrido-pulso absolute left-1/2 top-1/2 h-full w-full rounded-full border-[3px]" style={{ borderColor: aviso.color, animationDelay: "0.7s" }} />
                <span className="recorrido-titilar absolute left-1/2 top-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: `radial-gradient(circle, ${aviso.color}66, transparent 65%)` }} />
                <span
                  className="recorrido-titilar absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-bold text-slate-950 shadow-lg sm:text-[11px]"
                  style={{ background: aviso.color }}
                >
                  {aviso.icono} Mesa {v.mesa}
                </span>
              </div>
            </div>
            {/* En celular el aviso aparece bajo el plano */}
            <div className="p-2 lg:hidden">
              <div key={`t-${g.escena}`} className="recorrido-entrar flex items-center gap-2 rounded-xl border-l-4 bg-[#0f131b]/95 px-3 py-2 shadow-xl lg:hidden" style={{ borderColor: aviso.color }}>
                <span className="text-base">{aviso.icono}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">{aviso.titulo(v.mesa)}</span>
                  <span className="block truncate text-[10px] text-slate-400">{aviso.detalle}</span>
                </span>
                <span className="text-[9px] font-semibold text-slate-400">AHORA</span>
              </div>
            </div>

            {/* Avisos al costado */}
            <div className="hidden border-l border-white/10 p-3 lg:block">
              <p className="flex items-center justify-between text-sm font-semibold">
                <span>🔔 Avisos</span>
                <span className="rounded-full bg-white/10 px-2 text-xs">{historial.length}</span>
              </p>
              <ul className="mt-3 space-y-2">
                {historial.map((h, k) => {
                  const a = AVISOS[h.tipo];
                  return (
                    <li
                      key={`${g.escena}-${k}`}
                      className={`${k === 0 ? "recorrido-entrar" : ""} rounded-xl border-l-4 bg-white/5 px-2.5 py-2 transition-opacity`}
                      style={{ borderColor: a.color, opacity: k === 0 ? 1 : 0.55 - k * 0.12 }}
                    >
                      <p className="flex items-start justify-between gap-2 text-xs font-semibold leading-snug">
                        <span>
                          {a.icono} {a.titulo(h.mesa)}
                        </span>
                        <span className="shrink-0 text-[9px] text-slate-400">{k === 0 ? "AHORA" : `${k * 2}′`}</span>
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-slate-400">
                        {h.piso} · {a.detalle}
                      </p>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-4 text-[10px] leading-relaxed text-slate-500">Cada aviso suena distinto y te lleva a la mesa con un toque.</p>
            </div>
          </div>
        </Pantalla>
      </div>
      <p key={g.escena} className="recorrido-entrar mx-auto mt-4 min-h-[2.6rem] max-w-2xl text-center text-sm text-sitio-suave">
        <b className="text-sitio-tinta">
          {v.vista} · {v.piso}.
        </b>{" "}
        {v.nota}
      </p>
      <Controles g={g} nombre="salón" duraciones={DUR_SALON} etiquetas={VISTAS_SALON.map((s) => s.etiqueta)} />
    </div>
  );
}

/* ───────────────────────── 03 · Cocina ───────────────────────── */

const DUR_COCINA = [2600, 2700, 2200, 3600] as const;
const OBJ_COCINA = ["empezar", "terminar", null, null];

function Comanda({ mesa, items, nota, minutos, estado, objetivo, nueva }: { mesa: string; items: string[]; nota?: string; minutos: string; estado: "nuevo" | "preparando" | "listo"; objetivo?: string; nueva?: boolean }) {
  const boton =
    estado === "nuevo" ? { texto: "Empezar", clase: "bg-emerald-600" } : estado === "preparando" ? { texto: "Terminar", clase: "bg-red-600" } : null;
  return (
    <div className={`recorrido-entrar rounded-xl bg-white p-2 text-slate-800 shadow-lg ${nueva ? "ring-2 ring-amber-400" : ""}`}>
      <p className="flex items-center justify-between text-[10px] font-bold sm:text-xs">
        <span>Mesa {mesa}</span>
        <span className={`rounded-full px-1.5 text-[9px] ${estado === "listo" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{minutos}</span>
      </p>
      <ul className="mt-1 space-y-0.5 text-[9.5px] leading-tight sm:text-[11px]">
        {items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
      {nota && <p className="mt-1 rounded bg-amber-50 px-1 text-[9px] text-amber-800">{nota}</p>}
      {boton ? (
        <span data-objetivo={objetivo} className={`mt-1.5 block rounded-lg py-1 text-center text-[9.5px] font-bold text-white sm:text-[11px] ${boton.clase}`}>
          {boton.texto}
        </span>
      ) : (
        <span className="mt-1.5 block rounded-lg bg-emerald-50 py-1 text-center text-[9.5px] font-bold text-emerald-700 sm:text-[11px]">✓ Listo para llevar</span>
      )}
    </div>
  );
}

function EscenaCocina() {
  const g = useGuion(DUR_COCINA, 3);
  const e = g.escena;
  const estadoA = e === 0 ? "nuevo" : e === 1 ? "preparando" : "listo";
  const a = (
    <Comanda
      key={`a-${estadoA}`}
      mesa="15"
      items={["1 × Flat white", "1 × Croissant"]}
      nota="Flat white sin azúcar"
      minutos={estadoA === "nuevo" ? "0′" : estadoA === "preparando" ? "2′" : "6′"}
      estado={estadoA}
      objetivo={estadoA === "nuevo" ? "empezar" : "terminar"}
      nueva={estadoA === "nuevo"}
    />
  );
  const b = <Comanda key="b" mesa="4" items={["2 × Sándwich ave palta", "2 × Jugo natural"]} minutos="9′" estado="preparando" />;
  const columnas: [string, string, ReactNode[]][] = [
    ["Nuevos", "#f59e0b", estadoA === "nuevo" ? [a] : []],
    ["Preparando", "#38bdf8", estadoA === "preparando" ? [a, b] : [b]],
    ["Listos", "#34d399", estadoA === "listo" ? [a] : []],
  ];
  const notif =
    e === 1
      ? { texto: "¡Ya están preparando tu pedido!", icono: "👩‍🍳" }
      : e >= 2
        ? { texto: "¡Tu pedido está listo!", icono: "🍽️" }
        : null;

  return (
    <div>
      <div ref={g.ref} className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-end sm:gap-4">
        <Pantalla className="w-full flex-1">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <p className="font-marca text-sm font-bold">Cocina</p>
            <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span className={`inline-block ${e === 0 ? "recorrido-sacudir" : ""}`}>🔔</span> Cocina y barra
            </span>
          </div>
          <div className="grid h-[16rem] grid-cols-3 gap-1.5 overflow-hidden p-2 sm:h-[18rem] sm:gap-2">
            {columnas.map(([t, c, items]) => (
              <div key={t} className="rounded-xl bg-white/5 p-1.5">
                <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold text-slate-300 sm:text-xs">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} /> {t}
                </p>
                <div className="space-y-1.5">{items}</div>
              </div>
            ))}
          </div>
        </Pantalla>
        {/* Celular del cliente con la notificación */}
        <div className={`w-[124px] shrink-0 transition-transform duration-700 sm:w-[140px] ${e === 3 ? "scale-110 sm:-translate-y-3" : ""}`}>
          <Celular claro={false}>
            <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-[#3b2414] via-[#1a1410] to-[#0b0e14] px-2 pt-8 text-center">
              <p className="text-2xl font-semibold leading-none text-white/90">13:42</p>
              <p className="text-[8px] text-white/60">martes 18 de noviembre</p>
              {notif && (
                <div key={notif.texto} className={`recorrido-entrar mt-3 rounded-xl bg-white/90 p-1.5 text-left text-slate-900 shadow-lg ${e === 3 ? "recorrido-vibrar ring-2 ring-emerald-400" : ""}`}>
                  <p className="flex items-center gap-1 text-[7.5px] font-semibold uppercase text-slate-500">
                    <span className="flex h-3 w-3 items-center justify-center rounded bg-[#3b2414] text-[6px] text-white">A</span> Aroma Café · ahora
                  </p>
                  <p className="mt-0.5 text-[9px] font-bold leading-tight">
                    {notif.icono} {notif.texto}
                  </p>
                </div>
              )}
            </div>
          </Celular>
          <p className="mt-2 text-center text-[11px] text-sitio-suave">El celular del cliente</p>
        </div>
        <Dedo raiz={g.ref} objetivo={OBJ_COCINA[e]} toqueEn={DUR_COCINA[e] - 700} clave={`${e}-${g.vuelta}`} oculto={g.quieto || !g.activo} />
      </div>
      <p className="sr-only">Animación: llega la comanda de la mesa 15, la cocina toca Empezar y luego Terminar, y al cliente le llega el aviso de que su pedido está listo.</p>
      <Controles g={g} nombre="cocina" duraciones={DUR_COCINA} etiquetas={["Llega la comanda", "Empezar", "Terminar", "Aviso al cliente"]} />
    </div>
  );
}

/* ───────────────────────── 04 · Cuenta ───────────────────────── */

const DUR_COBRO = [2400, 2400, 2900, 3800, 3200] as const;
const OBJ_COBRO = ["cobrar", "iguales", "propina", "cerrar", null];
const LINEAS_CUENTA: [string, number][] = [
  ["2 × Sándwich ave palta", 15800],
  ["2 × Jugo natural", 7000],
  ["2 × Cheesecake", 8400],
  ["2 × Flat white", 6400],
];
const TOTAL_CUENTA = LINEAS_CUENTA.reduce((s, [, n]) => s + n, 0);
const FORMAS = [
  ["junto", "Todo junto", "Una sola persona paga"],
  ["iguales", "Partes iguales", "Se divide entre todos"],
  ["consumo", "Cada uno lo suyo", "Según lo que consumió"],
  ["libre", "Monto libre", "Alguien paga una parte"],
];
const PARTES: [string, string][] = [
  ["Camila", "Débito"],
  ["Diego", "Efectivo"],
  ["Sofía", "Transferencia"],
  ["Tomás", "Crédito"],
];

function EscenaCobro() {
  const g = useGuion(DUR_COBRO, 3);
  const e = g.escena;
  const parte = Math.round(TOTAL_CUENTA / 4);
  const conPropina = Math.round(parte * 1.1);
  return (
    <div>
      <div ref={g.ref} className="relative mx-auto w-[250px] sm:w-[270px]">
        <Celular claro={false}>
          <div aria-hidden className="absolute inset-0 flex flex-col px-3 pb-3 pt-8 text-[11px]">
            <p className="flex items-center justify-between">
              <span className="font-marca text-base font-bold">Mesa 4</span>
              <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[9.5px] font-semibold text-violet-300">🧾 Pide la cuenta</span>
            </p>
            <p className="text-[9.5px] text-slate-400">4 personas · 52′ · Mesero: Jonathan</p>
            <ul className="mt-3 space-y-1.5 rounded-xl bg-white/5 p-2.5">
              {LINEAS_CUENTA.map(([t, n]) => (
                <li key={t} className="flex justify-between">
                  <span className="text-slate-300">{t}</span>
                  <span>{clp(n)}</span>
                </li>
              ))}
              <li className="flex justify-between border-t border-white/10 pt-1.5 font-bold">
                <span>Total</span>
                <span>{clp(TOTAL_CUENTA)}</span>
              </li>
            </ul>
            <div className="mt-auto">
              <span data-objetivo="cobrar" className="flex items-center justify-center rounded-full bg-[#f2a33a] py-2.5 text-[11.5px] font-bold text-slate-900">
                Cobrar {clp(TOTAL_CUENTA)}
              </span>
            </div>

            {/* Hoja de cobro */}
            <div className={`absolute inset-x-0 bottom-0 top-14 z-10 rounded-t-3xl bg-[#171c27] px-3 pb-3 pt-3 shadow-[0_-12px_30px_rgb(0_0_0/0.4)] transition-transform duration-500 ${e >= 1 && e <= 3 ? "translate-y-0" : "translate-y-full"}`}>
              <span className="mx-auto block h-1 w-10 rounded-full bg-white/20" />
              {e <= 1 && (
                <div key="formas" className="recorrido-entrar">
                  <p className="mt-2 text-sm font-bold">¿Cómo pagan?</p>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {FORMAS.map(([id, t, a]) => (
                      <span key={id} data-objetivo={id} className="rounded-xl border border-white/10 bg-white/5 p-2">
                        <span className="block text-[10.5px] font-semibold">{t}</span>
                        <span className="block text-[8.5px] leading-tight text-slate-400">{a}</span>
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-[9.5px] leading-snug text-slate-400">También se puede cobrar una parte ahora y el resto después.</p>
                </div>
              )}
              {e === 2 && (
                <div key="dividir" className="recorrido-entrar">
                  <p className="mt-2 text-sm font-bold">Partes iguales</p>
                  <div className="mt-2 flex items-center justify-between rounded-xl bg-white/5 p-2">
                    <span>Personas</span>
                    <span className="flex items-center gap-2 font-bold">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10">−</span>4
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10">+</span>
                    </span>
                  </div>
                  <p className="mt-2 text-[9.5px] text-slate-400">Propina sugerida</p>
                  <div className="mt-1 flex gap-1.5">
                    {["Sin propina", "10 %", "15 %"].map((p, i) => (
                      <span key={p} data-objetivo={i === 1 ? "propina" : undefined} className={`flex-1 rounded-full border py-1 text-center text-[9.5px] font-semibold ${i === 1 ? "border-[#f2a33a] bg-[#f2a33a]/15 text-[#f4b860]" : "border-white/10"}`}>
                        {p}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 rounded-xl bg-white/5 p-2 text-center">
                    <span className="block text-[9.5px] text-slate-400">Cada uno paga</span>
                    <span className="block font-marca text-xl font-bold">{clp(conPropina)}</span>
                    <span className="block text-[9px] text-slate-400">
                      {clp(parte)} + {clp(conPropina - parte)} de propina
                    </span>
                  </p>
                </div>
              )}
              {e === 3 && (
                <div key="medios" className="recorrido-entrar">
                  <p className="mt-2 text-sm font-bold">Cada parte con su medio de pago</p>
                  <ul className="mt-2 space-y-1.5">
                    {PARTES.map(([n, m], i) => (
                      <li key={n} className="flex items-center justify-between rounded-xl bg-white/5 px-2 py-1.5">
                        <span>
                          <span className="block text-[10.5px] font-semibold">{n}</span>
                          <span className="block text-[9px] text-slate-400">{m}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="text-[10px] font-semibold">{clp(conPropina)}</span>
                          <span className="recorrido-check flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white" style={{ animationDelay: `${300 + i * 600}ms` }}>
                            ✓
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <span data-objetivo="cerrar" className="mt-2.5 flex items-center justify-center rounded-full bg-emerald-600 py-2 text-[11px] font-bold text-white">
                    Cerrar la mesa
                  </span>
                </div>
              )}
            </div>

            {e === 4 && (
              <div key="cerrada" className="recorrido-entrar absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0f131b]/95 px-5 text-center">
                <span className="recorrido-pop flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-2xl font-bold text-white">✓</span>
                <p className="mt-3 font-marca text-lg font-bold">Mesa 4 cerrada</p>
                <p className="mt-1 text-slate-400">
                  {clp(Math.round(TOTAL_CUENTA * 1.1))} con propina · 4 pagos
                </p>
                <p className="mt-3 rounded-full bg-white/10 px-3 py-1 text-[10px]">Todo queda en el cierre de caja</p>
              </div>
            )}
          </div>
        </Celular>
        <Dedo raiz={g.ref} objetivo={OBJ_COBRO[e]} toqueEn={DUR_COBRO[e] - 700} clave={`${e}-${g.vuelta}`} oculto={g.quieto || !g.activo} />
      </div>
      <p className="sr-only">Animación: el mesero toca Cobrar en la mesa 4, elige partes iguales entre 4 personas con 10 % de propina, cada uno paga con su medio y la mesa se cierra.</p>
      <Controles g={g} nombre="cuenta" duraciones={DUR_COBRO} etiquetas={["La cuenta", "Cobrar", "Dividir", "Medios de pago", "Mesa cerrada"]} />
    </div>
  );
}

/* ───────────────────────── 05 · Vuelven (Loyalty) ───────────────────────── */

const DUR_LOYALTY = [3000, 3200, 3000, 3200] as const;

function EscenaLoyalty() {
  const g = useGuion(DUR_LOYALTY, 1);
  const e = g.escena;
  return (
    <div>
      <div ref={g.ref} className="relative mx-auto w-[250px] sm:w-[270px]">
        <Celular>
          <div aria-hidden className="absolute inset-0 flex flex-col px-3.5 pb-4 pt-9 text-[11px]">
            {e === 0 && (
              <div key="pre" className="recorrido-entrar flex flex-1 flex-col">
                <p className="text-center font-elegante text-xl italic">Aroma Café</p>
                <p className="text-center text-[10px] text-stone-500">Precuenta · Mesa 4</p>
                <div className="mt-3 rounded-xl bg-white p-3 shadow-sm">
                  <p className="flex justify-between font-bold">
                    <span>Total</span>
                    <span>{clp(41360)}</span>
                  </p>
                  <div className="relative mx-auto mt-3 aspect-square w-[62%] overflow-hidden rounded-lg bg-white p-1.5 ring-1 ring-stone-200">
                    <QrFalso />
                    <span className="recorrido-escanear absolute inset-x-0 h-0.5 bg-emerald-500 shadow-[0_0_12px_2px_rgb(16_185_129/0.7)]" />
                  </div>
                  <p className="mt-2 text-center text-[10px] font-semibold text-emerald-700">Escanea y suma tu sello</p>
                </div>
              </div>
            )}
            {e === 1 && (
              <div key="sello" className="recorrido-entrar flex flex-1 flex-col justify-center">
                <TarjetaVisual local="Aroma Café" programa={{ ...PROGRAMA_BASE, meta: 10, premio: "Un café de regalo" }} sellos={8} nombre="Camila" animarUltimos={1} />
                <p className="mt-3 text-center text-[11px] font-bold">¡Sumaste un sello! ☕</p>
                <p className="text-center text-[10px] text-stone-500">Te faltan 2 para un café de regalo</p>
              </div>
            )}
            {e === 2 && (
              <div key="resena" className="recorrido-entrar flex flex-1 flex-col items-center justify-center text-center">
                <p className="text-sm font-bold">¿Cómo estuvo todo, Camila?</p>
                <p className="mt-3 flex gap-1 text-2xl">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} className="recorrido-pop text-amber-400" style={{ animationDelay: `${200 + i * 180}ms` }}>
                      ★
                    </span>
                  ))}
                </p>
                <span className="mt-4 rounded-full bg-white px-4 py-2 text-[10.5px] font-semibold shadow ring-1 ring-stone-200">Dejar reseña en Google</span>
              </div>
            )}
            {e === 3 && (
              <div key="vuelve" className="recorrido-entrar flex flex-1 flex-col">
                <p className="mt-4 text-center text-2xl font-semibold text-stone-700">10:15</p>
                <p className="text-center text-[9px] text-stone-500">martes</p>
                <div className="recorrido-vibrar mt-4 rounded-2xl bg-white p-2.5 shadow-lg ring-1 ring-stone-200">
                  <p className="text-[8.5px] font-semibold uppercase text-stone-500">Aroma Café · Te extrañamos</p>
                  <p className="mt-0.5 text-[10.5px] font-bold leading-snug">Hace rato que no vienes: esta semana tu visita vale doble sello ☕☕</p>
                </div>
              </div>
            )}
          </div>
        </Celular>
      </div>
      <p className="sr-only">Animación: el cliente escanea el QR de la precuenta, suma un sello en su tarjeta, deja una reseña y días después recibe una invitación a volver.</p>
      <Controles g={g} nombre="loyalty" duraciones={DUR_LOYALTY} etiquetas={["Precuenta con QR", "Suma su sello", "Reseña en Google", "Vuelve"]} />
    </div>
  );
}

function QrFalso() {
  // Patrón fijo con aspecto de QR (decorativo).
  const celdas = Array.from({ length: 121 }, (_, i) => {
    const x = i % 11;
    const y = Math.floor(i / 11);
    const esquina = (a: number, b: number) => x >= a && x < a + 3 && y >= b && y < b + 3;
    if (esquina(0, 0) || esquina(8, 0) || esquina(0, 8)) return true;
    return ((x * 7 + y * 13 + x * y) % 5) < 2;
  });
  return (
    <div className="grid h-full w-full grid-cols-[repeat(11,1fr)] gap-px">
      {celdas.map((c, i) => (
        <span key={i} className={c ? "bg-stone-900" : ""} />
      ))}
    </div>
  );
}

/* ───────────────────────── 06 · A tu medida ───────────────────────── */

const DUR_PERSONALIZAR = [2600, 4400, 4000, 4400, 4600] as const;
const DISENOS_VISTA = [
  { nombre: "Clásico", fondo: "#faf7f2", tinta: "#1c1917", suave: "#78716c", tarjeta: "#ffffff", fuente: "font-marca" },
  { nombre: "Pizarra", fondo: "#1f2a24", tinta: "#f1f5ee", suave: "#a3b1a6", tarjeta: "#2b3a31", fuente: "font-elegante italic" },
  { nombre: "Bistró", fondo: "#f3ead8", tinta: "#3b2414", suave: "#8b6e55", tarjeta: "#fffaf0", fuente: "font-elegante italic" },
  { nombre: "Neón", fondo: "#120d2b", tinta: "#f5f3ff", suave: "#a5a0c8", tarjeta: "#1e1640", fuente: "font-marca" },
];
const COLORES_VISTA = ["#c2410c", "#0f766e", "#7c3aed", "#be123c", "#1d4ed8", "#a16207"];
const IDIOMAS_VISTA: { nombre: string; cat: string; platos: [string, string][]; agregar: string }[] = [
  { nombre: "Español", cat: "Cafés", platos: [["Flat white", "Doble espresso y leche texturizada"], ["Croissant", "Horneado cada mañana"]], agregar: "Agregar" },
  { nombre: "English", cat: "Coffee", platos: [["Flat white", "Double espresso with steamed milk"], ["Croissant", "Baked every morning"]], agregar: "Add" },
  { nombre: "Português", cat: "Cafés", platos: [["Flat white", "Espresso duplo e leite vaporizado"], ["Croissant", "Assado toda manhã"]], agregar: "Adicionar" },
  { nombre: "Français", cat: "Cafés", platos: [["Flat white", "Double espresso, lait mousseux"], ["Croissant", "Cuit chaque matin"]], agregar: "Ajouter" },
  { nombre: "中文", cat: "咖啡", platos: [["馥芮白", "双份浓缩配绵密奶泡"], ["牛角包", "每天早上新鲜烘焙"]], agregar: "加入" },
];
const MODULOS_VISTA = ["Pedidos desde la mesa", "Salón y avisos", "Cocina y barra", "Caja y propinas", "Reservas", "Loyalty"];
// Dónde se acerca la cámara en cada escena (origen del zoom sobre el panel).
const FOCO = [null, "0% 0%", "100% 0%", "0% 100%", "100% 100%"];

function EscenaPersonalizar() {
  const g = useGuion(DUR_PERSONALIZAR, 0);
  const e = g.escena;
  const tic = useTic(g.activo && e > 0, 1000, `${e}-${g.vuelta}`);
  const [diseno, setDiseno] = useState(0);
  const [color, setColor] = useState(0);
  const [idioma, setIdioma] = useState(0);
  const [modulos, setModulos] = useState(1);

  useEffect(() => {
    if (e === 0) {
      setDiseno(0);
      setColor(0);
      setIdioma(0);
      setModulos(1);
    }
  }, [e, g.vuelta]);
  useEffect(() => {
    if (tic === 0) return;
    if (e === 1) setDiseno((d) => (d + 1) % DISENOS_VISTA.length);
    if (e === 2) setColor((c) => (c + 1) % COLORES_VISTA.length);
    if (e === 3) setIdioma((i) => (i + 1) % IDIOMAS_VISTA.length);
    if (e === 4) setModulos((m) => Math.min(MODULOS_VISTA.length, m + 1));
  }, [tic, e]);

  const d = DISENOS_VISTA[diseno];
  const acento = COLORES_VISTA[color];
  const l = IDIOMAS_VISTA[idioma];
  const foco = FOCO[e];
  const grupo = (i: number) =>
    `rounded-xl border p-2.5 transition duration-500 sm:p-3 ${e === i + 1 ? "border-[#f2a33a] bg-[#f2a33a]/10" : "border-white/10 bg-white/[0.03]"}`;

  return (
    <div>
      <div ref={g.ref} className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-4">
        <Pantalla className="w-full flex-1">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <p className="font-marca text-sm font-bold">Personalizar</p>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-300">
              {foco ? "🔍 De cerca" : "Vista general"}
            </span>
          </div>
          <div className="relative aspect-[4/3.6] overflow-hidden">
            <div
              aria-hidden
              className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-2 p-2 text-[10px] transition-transform duration-[900ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] sm:gap-2.5 sm:p-3"
              style={{ transform: foco ? "scale(1.8)" : "none", transformOrigin: foco ?? "50% 50%" }}
            >
              <div className={grupo(0)}>
                <p className="font-semibold">Diseño de la carta</p>
                <div className="mt-2 grid grid-cols-4 gap-1">
                  {DISENOS_VISTA.map((x, i) => (
                    <span key={x.nombre} className={`rounded-md p-0.5 transition ${i === diseno ? "ring-2 ring-[#f2a33a]" : ""}`}>
                      <span className="block aspect-[3/4] rounded" style={{ background: x.fondo }}>
                        <span className="mx-auto block h-1/4 w-full rounded-t" style={{ background: x.tarjeta === "#ffffff" ? "#3b2414" : x.tarjeta }} />
                        <span className="mx-1 mt-1 block h-0.5 rounded" style={{ background: x.tinta, opacity: 0.6 }} />
                        <span className="mx-1 mt-0.5 block h-0.5 w-2/3 rounded" style={{ background: x.tinta, opacity: 0.35 }} />
                      </span>
                      <span className="mt-0.5 block truncate text-center text-[7px] text-slate-400">{x.nombre}</span>
                    </span>
                  ))}
                </div>
                <p className="mt-1.5 text-[8px] text-slate-400">Decenas de diseños, nuevos cada mes</p>
              </div>
              <div className={grupo(1)}>
                <p className="font-semibold">Colores y logo</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {COLORES_VISTA.map((c, i) => (
                    <span key={c} className={`h-5 w-5 rounded-full transition ${i === color ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#0f131b]" : ""}`} style={{ background: c }} />
                  ))}
                </div>
                <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-dashed border-white/20 p-1.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md font-elegante text-sm italic text-white transition-colors duration-500" style={{ background: acento }}>
                    A
                  </span>
                  <span className="text-[8.5px] text-slate-400">Tu logo y portada</span>
                </div>
              </div>
              <div className={grupo(2)}>
                <p className="font-semibold">Idiomas</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {IDIOMAS_VISTA.map((x, i) => (
                    <span key={x.nombre} className={`rounded-full px-1.5 py-0.5 text-[8.5px] transition ${i === idioma ? "bg-[#f2a33a] font-semibold text-slate-900" : "bg-white/10 text-slate-300"}`}>
                      {x.nombre}
                    </span>
                  ))}
                  <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[8.5px] text-slate-400">y más</span>
                </div>
                <p className="mt-2 text-[8px] leading-snug text-slate-400">Idiomas para turistas: cada uno lee la carta en el suyo.</p>
              </div>
              <div className={grupo(3)}>
                <p className="font-semibold">Módulos</p>
                <ul className="mt-1.5 space-y-[2px]">
                  {MODULOS_VISTA.map((m, i) => (
                    <li key={m} className="flex items-center justify-between gap-1 text-[8.5px]">
                      <span className="truncate text-slate-300">{m}</span>
                      <span className={`relative h-2.5 w-[18px] shrink-0 rounded-full transition-colors duration-300 ${i < modulos ? "bg-emerald-500" : "bg-white/15"}`}>
                        <span className={`absolute top-[1px] h-2 w-2 rounded-full bg-white transition-all duration-300 ${i < modulos ? "left-[9px]" : "left-[1px]"}`} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Pantalla>

        {/* Vista previa de la carta */}
        <div className="w-[170px] shrink-0 sm:w-[150px]">
          <Celular>
            <div aria-hidden className="absolute inset-0 flex flex-col text-[9px] transition-colors duration-500" style={{ background: d.fondo, color: d.tinta }}>
              <div className="relative h-[24%] shrink-0 px-2.5 pb-2 pt-7 text-white transition-colors duration-500" style={{ background: acento }}>
                <p className={`text-[15px] leading-none ${d.fuente}`}>Aroma Café</p>
                <p className="mt-0.5 text-[7.5px] opacity-80">Mesa 15</p>
              </div>
              <p key={`c${idioma}`} className={`recorrido-entrar px-2.5 pt-2 text-[11px] font-bold ${d.fuente}`}>
                {l.cat}
              </p>
              <ul className="space-y-1.5 px-2 pt-1.5">
                {l.platos.map(([n, t], i) => (
                  <li key={`${idioma}-${i}`} className="recorrido-entrar rounded-lg p-1.5 shadow-sm transition-colors duration-500" style={{ background: d.tarjeta }}>
                    <p className="font-semibold leading-tight">{n}</p>
                    <p className="text-[7.5px] leading-tight" style={{ color: d.suave }}>
                      {t}
                    </p>
                    <p className="mt-1 flex items-center justify-between">
                      <span className="font-bold" style={{ color: acento }}>
                        {clp(i ? 2900 : 3200)}
                      </span>
                      <span className="rounded-full px-1.5 py-0.5 text-[7.5px] font-bold text-white transition-colors duration-500" style={{ background: acento }}>
                        {l.agregar}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </Celular>
          <p className="mt-2 text-center text-[11px] text-sitio-suave">La carta cambia al tiro</p>
        </div>
      </div>
      <p className="sr-only">Animación: la cámara se acerca a cada opción de Personalizar (diseños, colores y logo, idiomas y módulos) y la carta de ejemplo cambia en vivo.</p>
      <Controles g={g} nombre="personalización" duraciones={DUR_PERSONALIZAR} etiquetas={["Todo", "Diseños", "Colores y logo", "Idiomas", "Módulos"]} />
    </div>
  );
}

export function EscenaRecorrido({ id }: { id: IdEscena }) {
  switch (id) {
    case "pedido":
      return <EscenaPedido />;
    case "salon":
      return <EscenaSalon />;
    case "cocina":
      return <EscenaCocina />;
    case "cobro":
      return <EscenaCobro />;
    case "loyalty":
      return <EscenaLoyalty />;
    case "personalizar":
      return <EscenaPersonalizar />;
  }
}
