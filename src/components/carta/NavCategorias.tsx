"use client";

import { useEffect, useRef, useState } from "react";
import { idSeccion } from "./comun";

// Barra de categorías fija arriba. Los colores salen de variables CSS que define cada diseño:
// --nav-bg, --chip-bg, --chip-text, --chip-activo-bg, --chip-activo-text.
export function NavCategorias({
  categorias,
  claseChip = "",
}: {
  categorias: { id: string; nombre: string }[];
  claseChip?: string;
}) {
  const [activa, setActiva] = useState(categorias[0]?.id);
  const barra = useRef<HTMLDivElement>(null);

  // Resalta la categoría que se está viendo al hacer scroll.
  useEffect(() => {
    // Activa la última sección cuyo título ya pasó bajo la barra; arriba del todo, la primera.
    const observador = new IntersectionObserver(
      () => {
        const pasadas = categorias.filter((c) => {
          const el = document.getElementById(idSeccion(c.id));
          return el && el.getBoundingClientRect().top <= 140;
        });
        setActiva((pasadas.at(-1) ?? categorias[0])?.id);
      },
      { rootMargin: "-64px 0px -60% 0px", threshold: [0, 1] },
    );
    categorias.forEach((c) => {
      const el = document.getElementById(idSeccion(c.id));
      if (el) observador.observe(el);
    });
    return () => observador.disconnect();
  }, [categorias]);

  // Centra el chip activo moviendo solo la barra (no la página).
  useEffect(() => {
    const contenedor = barra.current;
    const chip = contenedor?.querySelector<HTMLElement>(`[data-id="${activa}"]`);
    if (contenedor && chip) {
      // Se mide en pantalla: offsetLeft cuenta desde la barra fija y en pantallas anchas corría la fila de más.
      const desde = chip.getBoundingClientRect().left - contenedor.getBoundingClientRect().left + contenedor.scrollLeft;
      contenedor.scrollTo({ left: desde - contenedor.clientWidth / 2 + chip.clientWidth / 2, behavior: "smooth" });
    }
  }, [activa]);

  return (
    <nav className="sticky top-0 z-10 backdrop-blur" style={{ background: "var(--nav-bg)" }}>
      <div ref={barra} className="mx-auto flex max-w-2xl gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
        {categorias.map((c) => {
          const esActiva = c.id === activa;
          return (
            <a
              key={c.id}
              data-id={c.id}
              href={`#${idSeccion(c.id)}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(idSeccion(c.id))?.scrollIntoView({ behavior: "smooth", block: "start" });
                setActiva(c.id);
              }}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${claseChip}`}
              style={
                esActiva
                  ? { background: "var(--chip-activo-bg)", color: "var(--chip-activo-text)" }
                  : { background: "var(--chip-bg)", color: "var(--chip-text)" }
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
