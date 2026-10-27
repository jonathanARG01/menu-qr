"use client";

import { useState } from "react";
import { PAIS_BASE } from "@/lib/region";

// Gráficos de una sola serie en el color de la marca: barras finas, puntas redondeadas y un detalle al pasar el dedo.

const plural = (n: number, palabra: string) => `${n} ${palabra}${n === 1 ? "" : "s"}`;

const fechaCorta = (dia: string) =>
  new Date(`${dia}T12:00:00`).toLocaleDateString(PAIS_BASE.locale, { day: "numeric", month: "short" });

function Columnas({
  datos,
  etiquetaEje,
  detalle,
  alto = 160,
}: {
  datos: { clave: string; valor: number }[];
  etiquetaEje: (i: number) => string | null;
  detalle: (i: number) => string;
  alto?: number;
}) {
  const [activa, setActiva] = useState<number | null>(null);
  const max = Math.max(1, ...datos.map((d) => d.valor));
  const tope = Math.ceil(max / 5) * 5 || 5;

  return (
    <div className="relative" onPointerLeave={() => setActiva(null)}>
      <div className="flex gap-2">
        <div className="flex flex-col justify-between text-right text-[11px] tabular-nums text-suave" style={{ height: alto }}>
          <span>{tope}</span>
          <span>{tope / 2}</span>
          <span>0</span>
        </div>
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-stone-200" />
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-stone-200"
            style={{ top: alto / 2 }}
          />
          <div className="flex items-end gap-[2px] border-b border-stone-300" style={{ height: alto }}>
            {datos.map((d, i) => (
              <button
                key={d.clave}
                type="button"
                onPointerEnter={() => setActiva(i)}
                onFocus={() => setActiva(i)}
                onBlur={() => setActiva(null)}
                aria-label={detalle(i)}
                className="group flex h-full flex-1 items-end"
              >
                <span
                  className={`block w-full rounded-t-[4px] transition-opacity ${activa !== null && activa !== i ? "opacity-40" : ""}`}
                  style={{ height: `${(d.valor / tope) * 100}%`, minHeight: d.valor ? 2 : 0, background: "var(--color-marca)" }}
                />
              </button>
            ))}
          </div>
          <div className="mt-1 flex text-[11px] text-suave">
            {datos.map((d, i) => (
              <span key={d.clave} className="flex-1 overflow-visible whitespace-nowrap text-center">
                {etiquetaEje(i)}
              </span>
            ))}
          </div>
          {activa !== null && (
            <div
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-tinta px-2.5 py-1.5 text-xs text-white shadow-lg"
              style={{ left: `${((activa + 0.5) / datos.length) * 100}%` }}
            >
              {detalle(activa)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function BarrasPorDia({ datos }: { datos: { dia: string; visitas: number; pedidos: number }[] }) {
  const paso = Math.ceil(datos.length / 7);
  return (
    <Columnas
      datos={datos.map((d) => ({ clave: d.dia, valor: d.visitas }))}
      etiquetaEje={(i) => (i % paso === 0 || i === datos.length - 1 ? fechaCorta(datos[i].dia) : null)}
      detalle={(i) =>
        `${fechaCorta(datos[i].dia)}: ${plural(datos[i].visitas, "visita")}${datos[i].pedidos ? ` · ${plural(datos[i].pedidos, "pedido")}` : ""}`
      }
    />
  );
}

export function BarrasPorHora({ datos }: { datos: { hora: number; visitas: number }[] }) {
  return (
    <Columnas
      alto={120}
      datos={datos.map((d) => ({ clave: String(d.hora), valor: d.visitas }))}
      etiquetaEje={(i) => (i % 6 === 0 ? `${datos[i].hora} h` : null)}
      detalle={(i) => `${datos[i].hora}:00 a ${datos[i].hora}:59 · ${plural(datos[i].visitas, "visita")}`}
    />
  );
}

export function BarrasHorizontales({
  datos,
  unidad,
  vacio,
}: {
  datos: { etiqueta: string; valor: number }[];
  unidad: string;
  vacio: string;
}) {
  if (datos.length === 0) return <p className="py-6 text-center text-sm text-suave">{vacio}</p>;
  const max = Math.max(1, ...datos.map((d) => d.valor));
  return (
    <ul className="space-y-2.5">
      {datos.map((d) => (
        <li key={d.etiqueta} title={`${d.etiqueta}: ${d.valor} ${unidad}`}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="truncate">{d.etiqueta}</span>
            <span className="tabular-nums text-suave">{d.valor.toLocaleString(PAIS_BASE.locale)}</span>
          </div>
          <div className="h-2 rounded-full bg-stone-100">
            <div className="h-2 rounded-full" style={{ width: `${(d.valor / max) * 100}%`, background: "var(--color-marca)" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
