"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icono } from "@/components/Icono";

// Recorrido guiado del panel: la primera vez que alguien entra, un globo resalta cada sección del menú y explica
// para qué sirve. Se guarda como visto (por persona, en este navegador) y se puede volver a ver con "Ver recorrido".

export type PasoRecorrido = { objetivo?: string; icono: string; titulo: string; texto: string; rotulo: string };

const CLAVE = "club-recorrido-panel";
export const claveRecorrido = (email: string) => `${CLAVE}:${email.toLowerCase()}`;

export function recorridoVisto(email: string) {
  try {
    return localStorage.getItem(claveRecorrido(email)) === "1";
  } catch {
    return true; // sin almacenamiento, no insistimos en cada visita
  }
}

function marcarVisto(email: string) {
  try {
    localStorage.setItem(claveRecorrido(email), "1");
  } catch {}
}

// Busca el elemento visible con ese data-recorrido (hay uno en la barra de computador y otro en el menú del celular).
function buscar(objetivo?: string): HTMLElement | null {
  if (!objetivo) return null;
  const todos = Array.from(document.querySelectorAll<HTMLElement>(`[data-recorrido="${objetivo}"]`));
  return todos.find((el) => el.getClientRects().length > 0 && el.getBoundingClientRect().width > 0) ?? null;
}

type Caja = { top: number; left: number; width: number; height: number };
type Lugar = { estilo: React.CSSProperties; flecha: React.CSSProperties | null };

const ANCHO = 360;
const MARGEN = 12;

export function Recorrido({ pasos, email, alCerrar }: { pasos: PasoRecorrido[]; email: string; alCerrar: () => void }) {
  const [i, setI] = useState(0);
  const [caja, setCaja] = useState<Caja | null>(null);
  const [lugar, setLugar] = useState<Lugar | null>(null);
  const globo = useRef<HTMLDivElement>(null);
  const paso = pasos[i];
  const ultimo = i === pasos.length - 1;

  const cerrar = useCallback(() => {
    marcarVisto(email);
    alCerrar();
  }, [email, alCerrar]);

  // Mide el objetivo del paso (y lo trae a la vista si el menú tiene scroll).
  const medir = useCallback(() => {
    const el = buscar(paso?.objetivo);
    if (!el) return setCaja(null);
    const r = el.getBoundingClientRect();
    setCaja({ top: r.top - 4, left: r.left - 4, width: r.width + 8, height: r.height + 8 });
  }, [paso]);

  useEffect(() => {
    const el = buscar(paso?.objetivo);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    // El menú del celular se abre con una animación: medimos un par de veces.
    medir();
    const t1 = setTimeout(medir, 220);
    const t2 = setTimeout(medir, 480);
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [paso, medir]);

  // Ubica el globo: a la derecha del objetivo si cabe; si no, arriba o abajo; sin objetivo, al centro.
  useLayoutEffect(() => {
    const g = globo.current;
    if (!g) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const alto = g.offsetHeight;
    if (!caja) {
      setLugar({ estilo: { top: Math.max(MARGEN, (vh - alto) / 2), left: Math.max(MARGEN, (vw - Math.min(ANCHO + 60, vw - 2 * MARGEN)) / 2), width: Math.min(ANCHO + 60, vw - 2 * MARGEN) }, flecha: null });
      return;
    }
    const centroY = caja.top + caja.height / 2;
    if (caja.left + caja.width + 18 + ANCHO + MARGEN <= vw) {
      const top = Math.min(Math.max(MARGEN, centroY - alto / 2), vh - alto - MARGEN);
      setLugar({
        estilo: { top, left: caja.left + caja.width + 18, width: ANCHO },
        flecha: { left: -7, top: Math.min(Math.max(18, centroY - top - 7), alto - 32), transform: "rotate(45deg)" },
      });
      return;
    }
    const ancho = Math.min(ANCHO + 40, vw - 2 * MARGEN);
    const left = Math.min(Math.max(MARGEN, caja.left), vw - ancho - MARGEN);
    const centroX = caja.left + Math.min(caja.width, 220) / 2;
    const flechaX = Math.min(Math.max(20, centroX - left - 7), ancho - 34);
    if (centroY > vh / 2) {
      setLugar({ estilo: { top: Math.max(MARGEN, caja.top - alto - 14), left, width: ancho }, flecha: { bottom: -7, left: flechaX, transform: "rotate(-45deg)" } });
    } else {
      setLugar({ estilo: { top: Math.min(caja.top + caja.height + 14, vh - alto - MARGEN), left, width: ancho }, flecha: { top: -7, left: flechaX, transform: "rotate(135deg)" } });
    }
  }, [caja, i]);

  // Teclado: flechas para avanzar o volver, Escape para omitir.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
      else if (e.key === "ArrowRight") {
        if (ultimo) cerrar();
        else setI((n) => n + 1);
      }
      else if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [ultimo, cerrar]);

  if (!paso) return null;
  const avance = ((i + 1) / pasos.length) * 100;
  const nn = (n: number) => String(n).padStart(2, "0");

  return createPortal(
    <div className="recorrido fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-labelledby="recorrido-titulo">
      {/* Fondo oscuro con un "agujero" en el objetivo */}
      {caja ? (
        <div
          aria-hidden
          className="recorrido-foco pointer-events-none fixed rounded-2xl"
          style={{ top: caja.top, left: caja.left, width: caja.width, height: caja.height }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-black/55 backdrop-blur-[2px]" />
      )}
      {/* Captura los clics fuera del globo (no cierra, para no perder el recorrido por error) */}
      <div className="fixed inset-0" />

      <div
        ref={globo}
        key={i}
        className="recorrido-globo fixed rounded-3xl p-5 sm:p-6"
        style={{ ...(lugar?.estilo ?? { top: -9999, left: 0, width: ANCHO }), visibility: lugar ? "visible" : "hidden" }}
      >
        {lugar?.flecha && <span aria-hidden className="recorrido-flecha absolute h-3.5 w-3.5" style={lugar.flecha} />}
        <div className="flex items-start gap-3.5">
          <span className="icono-activo grid h-11 w-11 shrink-0 place-items-center rounded-2xl">
            <Icono nombre={paso.icono} className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-marca">{paso.rotulo}</p>
            <h2 id="recorrido-titulo" className="mt-0.5 text-lg font-bold leading-snug">
              {paso.titulo}
            </h2>
          </div>
        </div>
        <p className="mt-3 text-[15px] leading-relaxed text-suave">{paso.texto}</p>
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-stone-200">
          <div className="icono-activo h-full rounded-full transition-[width] duration-500" style={{ width: `${avance}%` }} />
        </div>
        <div className="mt-4 flex items-center gap-2">
          {!ultimo && (
            <button type="button" onClick={cerrar} className="rounded-lg px-1 py-2 text-sm font-medium text-suave hover:text-tinta">
              Omitir
            </button>
          )}
          <span className="ml-1 font-mono text-xs tabular-nums text-suave">
            {nn(i + 1)} / {nn(pasos.length)}
          </span>
          <span className="ml-auto flex items-center gap-2">
            {i > 0 && (
              <button
                type="button"
                onClick={() => setI((n) => n - 1)}
                className="boton-secundario h-10 w-10 !p-0"
                aria-label="Paso anterior"
              >
                <Icono nombre="abajo" className="h-4 w-4 rotate-90" />
              </button>
            )}
            <button type="button" autoFocus onClick={() => (ultimo ? cerrar() : setI((n) => n + 1))} className="boton h-10 px-4">
              {ultimo ? "¡Listo!" : i === 0 ? "Empezar" : "Siguiente"}
              {!ultimo && <Icono nombre="abajo" className="h-4 w-4 -rotate-90" />}
            </button>
          </span>
        </div>
      </div>
    </div>,
    document.querySelector(".panel-app") ?? document.body,
  );
}
