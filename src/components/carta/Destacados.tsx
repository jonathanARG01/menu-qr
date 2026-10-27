import type { Restaurante, Seccion } from "@/lib/types";
import { Agregar } from "./Agregar";
import { Carrusel } from "./Carrusel";
import { SinFoto, precio } from "./comun";
import { useCarta } from "./contexto";

// Fila de platos destacados (los marcados con ★ en el panel). Toma los colores del diseño:
// --acento para precio y botones, --dest-bg y --dest-text para las tarjetas.
export function Destacados({
  restaurante,
  secciones,
  className = "",
  claseTitulo = "text-2xl font-bold",
  claseNombre = "font-semibold",
  style,
}: {
  restaurante: Restaurante;
  secciones: Seccion[];
  className?: string;
  claseTitulo?: string;
  claseNombre?: string;
  // Variables de color propias para este bloque (--dest-bg, --dest-text, --dest-precio).
  style?: React.CSSProperties;
}) {
  const { t } = useCarta();
  const platos = secciones.flatMap((s) => s.platos).filter((p) => p.destacado);
  if (platos.length === 0) return null;

  return (
    <section aria-label={t("destacados")} className={`min-w-0 ${className}`} style={style}>
      <h2 className={`mb-3 flex items-center gap-2 ${claseTitulo}`}>
        <span style={{ color: "var(--acento)" }}>★</span> {t("destacados")}
      </h2>
      <Carrusel className="pb-2">
        {platos.map((plato) => (
          <article
            key={plato.id}
            className="flex w-60 shrink-0 flex-col overflow-hidden rounded-2xl shadow-lg"
            style={{ background: "var(--dest-bg, rgba(255,255,255,0.08))", color: "var(--dest-text, inherit)" }}
          >
            {plato.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={plato.foto_url} alt={plato.nombre} loading="lazy" className="aspect-[4/3] w-full object-cover" />
            ) : (
              <span aria-hidden className="flex aspect-[4/3] w-full items-center justify-center bg-black/5 text-6xl">
                <SinFoto plato={plato} />
              </span>
            )}
            <div className="flex flex-1 flex-col gap-1 p-3">
              <h3 className={`leading-tight ${claseNombre}`}>{plato.nombre}</h3>
              {plato.descripcion && <p className="line-clamp-2 text-xs leading-snug opacity-70">{plato.descripcion}</p>}
              <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                <span className="font-bold tabular-nums" style={{ color: "var(--dest-precio, var(--acento))" }}>
                  {precio(plato, restaurante)}
                </span>
                <Agregar plato={plato} />
              </div>
            </div>
          </article>
        ))}
      </Carrusel>
    </section>
  );
}
