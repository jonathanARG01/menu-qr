"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Fila horizontal deslizable con flechas a los costados cuando hay más elementos de los que entran.
// En el teléfono se desliza con el dedo; en la computadora, con las flechas.
export function Carrusel({
  children,
  className = "",
  estiloBoton,
}: {
  children: React.ReactNode;
  className?: string;
  estiloBoton?: React.CSSProperties;
}) {
  const fila = useRef<HTMLDivElement>(null);
  const [puede, setPuede] = useState({ izquierda: false, derecha: false });

  const medir = useCallback(() => {
    const el = fila.current;
    if (!el) return;
    setPuede({ izquierda: el.scrollLeft > 4, derecha: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const el = fila.current;
    if (!el) return;
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, [medir]);

  const mover = (sentido: 1 | -1) => {
    const el = fila.current;
    if (el) el.scrollBy({ left: sentido * el.clientWidth * 0.8, behavior: "smooth" });
  };

  const boton = (sentido: 1 | -1) => (
    <button
      type="button"
      onClick={() => mover(sentido)}
      aria-label={sentido === 1 ? "Ver más" : "Ver anteriores"}
      className={`absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-lg shadow-lg transition active:scale-95 ${
        sentido === 1 ? "right-1" : "left-1"
      }`}
      style={{ background: "var(--acento)", color: "var(--sobre-acento)", ...estiloBoton }}
    >
      {sentido === 1 ? "›" : "‹"}
    </button>
  );

  return (
    <div className="relative">
      <div
        ref={fila}
        onScroll={medir}
        className={`flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth [scrollbar-width:none] [&>*]:snap-start ${className}`}
      >
        {children}
      </div>
      {puede.izquierda && boton(-1)}
      {puede.derecha && boton(1)}
    </div>
  );
}
