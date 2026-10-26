"use client";

import { useEffect, useRef, useState } from "react";

export function NavCategorias({ categorias }: { categorias: { id: string; nombre: string }[] }) {
  const [activa, setActiva] = useState(categorias[0]?.id);
  const barra = useRef<HTMLDivElement>(null);

  // Resalta la categoría que se está viendo al hacer scroll.
  useEffect(() => {
    const observador = new IntersectionObserver(
      (entradas) => {
        const visible = entradas
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiva(visible.target.id.slice(2));
      },
      { rootMargin: "-64px 0px -60% 0px" },
    );
    categorias.forEach((c) => {
      const el = document.getElementById(`c-${c.id}`);
      if (el) observador.observe(el);
    });
    return () => observador.disconnect();
  }, [categorias]);

  useEffect(() => {
    barra.current
      ?.querySelector(`[data-id="${activa}"]`)
      ?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activa]);

  return (
    <nav
      className="sticky top-0 z-10 border-b border-black/5 backdrop-blur"
      style={{ background: "color-mix(in srgb, var(--fondo) 85%, transparent)" }}
    >
      <div ref={barra} className="mx-auto flex max-w-2xl gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
        {categorias.map((c) => {
          const esActiva = c.id === activa;
          return (
            <a
              key={c.id}
              data-id={c.id}
              href={`#c-${c.id}`}
              className="shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition"
              style={
                esActiva
                  ? { background: "var(--primario)", color: "var(--sobre-primario)" }
                  : { background: "rgba(255,255,255,0.8)", color: "#44403c", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)" }
              }
            >
              {c.nombre}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
