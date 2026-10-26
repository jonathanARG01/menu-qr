"use client";

import { useEffect, useRef, useState } from "react";
import { NOMBRE_IDIOMA } from "@/lib/i18n";
import { useCarta } from "./contexto";

// Botón de idioma para la cabecera de cada diseño. No se muestra si la carta está en un solo idioma.
export function SelectorIdioma({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  const { idioma, idiomas, setIdioma, t } = useCarta();
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
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
        </svg>
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
                {NOMBRE_IDIOMA[i]}
                <span className="text-xs uppercase text-stone-400">{i}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
