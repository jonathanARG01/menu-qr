"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { GrupoOpciones } from "@/lib/types";
import type { OpcionElegida } from "@/lib/salon";
import { extraOpciones, faltanOpciones } from "@/lib/opciones";

type Textos = { agregar: string; cancelar: string; obligatorio: string; hasta: (n: number) => string };

const TEXTOS: Textos = {
  agregar: "Agregar",
  cancelar: "Cancelar",
  obligatorio: "Obligatorio",
  hasta: (n) => (n === 1 ? "Elige 1" : `Hasta ${n}`),
};

// Hoja para elegir las opciones de un plato antes de sumarlo al pedido. La usan la carta y el panel.
export function ElegirOpciones({
  nombre,
  precio,
  grupos,
  formato,
  textos = TEXTOS,
  acento,
  onCerrar,
  onElegir,
}: {
  nombre: string;
  precio: number;
  grupos: GrupoOpciones[];
  formato: (n: number) => string;
  textos?: Textos;
  // Color del botón (en la carta, el del diseño elegido).
  acento?: { background: string; color: string };
  onCerrar: () => void;
  onElegir: (opciones: OpcionElegida[]) => void;
}) {
  // De entrada, la primera opción de cada grupo obligatorio de una sola elección.
  const [elegidas, setElegidas] = useState<OpcionElegida[]>(() =>
    grupos
      .filter((g) => g.min > 0 && g.max === 1)
      .map((g) => ({ grupo: g.nombre, valor: g.valores[0].nombre, precio: g.valores[0].precio })),
  );
  const faltan = faltanOpciones(grupos, elegidas);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onCerrar]);

  function tocar(g: GrupoOpciones, v: { nombre: string; precio: number }) {
    setElegidas((actual) => {
      const marcada = actual.some((e) => e.grupo === g.nombre && e.valor === v.nombre);
      if (marcada) return actual.filter((e) => !(e.grupo === g.nombre && e.valor === v.nombre));
      const nueva = { grupo: g.nombre, valor: v.nombre, precio: v.precio };
      if (g.max === 1) return [...actual.filter((e) => e.grupo !== g.nombre), nueva];
      if (actual.filter((e) => e.grupo === g.nombre).length >= g.max) return actual;
      return [...actual, nueva];
    });
  }

  // Se guardan en el orden de la carta, así la misma elección arma siempre la misma línea.
  const ordenadas = grupos.flatMap((g) =>
    g.valores.flatMap((v) => elegidas.filter((e) => e.grupo === g.nombre && e.valor === v.nombre)),
  );

  // En un portal: el botón que la abre puede estar dentro de una tarjeta que también reacciona a los toques.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={(e) => {
        e.stopPropagation();
        onCerrar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={nombre}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-3xl bg-white text-stone-900 shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-5">
          <h2 className="text-lg font-semibold leading-tight">{nombre}</h2>
          <button type="button" onClick={onCerrar} aria-label={textos.cancelar} className="text-2xl leading-none text-stone-400">
            ×
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto px-5 pb-4">
          {grupos.map((g) => (
            <fieldset key={g.nombre}>
              <legend className="flex w-full items-baseline justify-between gap-2 text-sm font-semibold">
                {g.nombre}
                <span className={`text-xs font-normal ${faltan.includes(g) ? "text-red-600" : "text-stone-500"}`}>
                  {g.min > 0 ? `${textos.obligatorio} · ` : ""}
                  {textos.hasta(g.max)}
                </span>
              </legend>
              <div className="mt-2 grid gap-1.5">
                {g.valores.map((v) => {
                  const activa = elegidas.some((e) => e.grupo === g.nombre && e.valor === v.nombre);
                  return (
                    <button
                      key={v.nombre}
                      type="button"
                      aria-pressed={activa}
                      onClick={() => tocar(g, v)}
                      className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left text-sm transition ${
                        activa ? "border-stone-900 bg-stone-50 font-semibold" : "border-stone-200"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 ${g.max === 1 ? "rounded-full" : "rounded-md"} ${
                          activa ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300"
                        }`}
                        aria-hidden
                      >
                        {activa && "✓"}
                      </span>
                      <span className="min-w-0 flex-1">{v.nombre}</span>
                      {v.precio > 0 && <span className="tabular-nums text-stone-500">+{formato(v.precio)}</span>}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
        <div className="border-t border-stone-100 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          <button
            type="button"
            disabled={faltan.length > 0}
            onClick={() => onElegir(ordenadas)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-900 px-4 py-3.5 font-semibold text-white disabled:opacity-40"
            style={acento}
          >
            {textos.agregar} · <span className="tabular-nums">{formato(precio + extraOpciones(elegidas))}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
