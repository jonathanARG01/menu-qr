"use client";

import { useEffect, useRef, useState } from "react";
import { banderaIdioma, NOMBRE_IDIOMA, type Idioma } from "@/lib/i18n";
import { useCarta } from "./contexto";

// Botón de idioma para la cabecera de cada diseño. No se muestra si la carta está en un solo idioma.
export function SelectorIdioma({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  const { idioma, idiomas, setIdioma, ajustes, t } = useCarta();
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => !caja.current?.contains(e.target as Node) && setAbierto(false);
    document.addEventListener("pointerdown", fuera);
    return () => document.removeEventListener("pointerdown", fuera);
  }, [abierto]);

  if (idiomas.length < 2) return null;

  return (
    <div ref={caja} className={`z-30 text-left ${className}`}>
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={t("idioma")}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide shadow-sm backdrop-blur"
        style={{ background: "rgba(0,0,0,0.35)", color: "#fff", ...style }}
      >
        <Bandera idioma={idioma} pais={ajustes.pais} />
        {idioma}
      </button>
      {abierto && (
        <ul
          role="listbox"
          aria-label={t("idioma")}
          className="absolute right-0 mt-2 min-w-36 overflow-hidden rounded-xl bg-white py-1 text-sm text-stone-800 shadow-xl ring-1 ring-black/10"
        >
          {idiomas.map((i) => (
            <li key={i}>
              <button
                type="button"
                role="option"
                aria-selected={i === idioma}
                onClick={() => {
                  setIdioma(i);
                  setAbierto(false);
                }}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-stone-100 ${
                  i === idioma ? "font-semibold" : ""
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Bandera idioma={i} pais={ajustes.pais} />
                  {NOMBRE_IDIOMA[i]}
                </span>
                <span className="text-xs uppercase text-stone-400">{i}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Bandera({ idioma, pais }: { idioma: Idioma; pais: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={banderaIdioma(idioma, pais)} alt="" width={20} height={14} className="h-3.5 w-5 shrink-0 rounded-[3px] object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.12)]" />
  );
}
