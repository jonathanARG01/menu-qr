"use client";

import { useMemo, useState } from "react";
import type { Categoria, Plato } from "@/lib/types";

export type LineaNueva = { clave: string; plato: Plato; cantidad: number; nota: string; comensal: number | null };

// El mesero arma la comanda desde la carta: busca, suma platos, anota detalles y elige de quién es cada uno.
export function TomarPedido({
  categorias,
  platos,
  comensales,
  formato,
  onEnviar,
  onCancelar,
}: {
  categorias: Categoria[];
  platos: Plato[];
  comensales: number;
  formato: (n: number) => string;
  onEnviar: (lineas: LineaNueva[]) => Promise<void>;
  onCancelar: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [lineas, setLineas] = useState<LineaNueva[]>([]);
  const [enviando, setEnviando] = useState(false);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return platos.filter((p) => (q ? p.nombre.toLowerCase().includes(q) : !categoria || p.categoria_id === categoria));
  }, [platos, busqueda, categoria]);

  function sumar(plato: Plato) {
    setLineas((ls) => {
      const i = ls.findIndex((l) => l.plato.id === plato.id && !l.nota && l.comensal === null);
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, cantidad: Math.min(99, l.cantidad + 1) } : l));
      return [...ls, { clave: `${plato.id}-${Date.now()}`, plato, cantidad: 1, nota: "", comensal: null }];
    });
  }

  const cambiar = (clave: string, cambios: Partial<LineaNueva>) =>
    setLineas((ls) => ls.map((l) => (l.clave === clave ? { ...l, ...cambios } : l)).filter((l) => l.cantidad > 0));

  const total = lineas.reduce((t, l) => t + l.cantidad * Number(l.plato.precio), 0);
  const unidades = lineas.reduce((t, l) => t + l.cantidad, 0);

  return (
    <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[1fr_320px]">
      <div className="flex min-h-0 flex-col gap-3">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar plato…"
          className="campo"
          autoFocus
        />
        {!busqueda && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setCategoria(null)}
              className={`shrink-0 rounded-full px-3 py-1 text-sm ${!categoria ? "bg-tinta text-white" : "bg-stone-100"}`}
            >
              Todo
            </button>
            {categorias.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoria(c.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-sm ${categoria === c.id ? "bg-tinta text-white" : "bg-stone-100"}`}
              >
                {c.nombre}
              </button>
            ))}
          </div>
        )}
        <ul className="grid max-h-[50vh] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 md:max-h-[60vh]">
          {filtrados.map((p) => {
            const n = lineas.filter((l) => l.plato.id === p.id).reduce((t, l) => t + l.cantidad, 0);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={!p.disponible}
                  onClick={() => sumar(p)}
                  className={`flex w-full items-center gap-2 rounded-xl border p-2.5 text-left transition ${
                    n ? "border-marca bg-marca/5" : "border-borde bg-white hover:border-stone-300"
                  } disabled:opacity-50`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.nombre}</span>
                    <span className="text-xs text-suave">{p.disponible ? formato(Number(p.precio)) : "Agotado"}</span>
                  </span>
                  {n > 0 && <span className="rounded-full bg-marca px-2 py-0.5 text-xs font-bold text-white">{n}</span>}
                </button>
              </li>
            );
          })}
          {filtrados.length === 0 && <li className="p-4 text-sm text-suave">No hay platos que coincidan.</li>}
        </ul>
      </div>

      <div className="flex min-h-0 flex-col rounded-2xl border border-borde bg-stone-50 p-3">
        <p className="mb-2 font-semibold">Comanda {unidades > 0 && <span className="text-suave">({unidades})</span>}</p>
        {lineas.length === 0 ? (
          <p className="flex-1 text-sm text-suave">Toca los platos para sumarlos.</p>
        ) : (
          <ul className="flex-1 space-y-2 overflow-y-auto md:max-h-[48vh]">
            {lineas.map((l) => (
              <li key={l.clave} className="rounded-xl bg-white p-2.5 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{l.plato.nombre}</span>
                  <span className="flex items-center rounded-lg border border-borde">
                    <button
                      type="button"
                      className="h-7 w-7"
                      onClick={() => cambiar(l.clave, { cantidad: l.cantidad - 1 })}
                      aria-label="Menos"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums">{l.cantidad}</span>
                    <button
                      type="button"
                      className="h-7 w-7"
                      onClick={() => cambiar(l.clave, { cantidad: Math.min(99, l.cantidad + 1) })}
                      aria-label="Más"
                    >
                      +
                    </button>
                  </span>
                </div>
                <div className="mt-1.5 flex gap-1.5">
                  <input
                    value={l.nota}
                    onChange={(e) => cambiar(l.clave, { nota: e.target.value.slice(0, 120) })}
                    placeholder="Nota (sin sal, a punto…)"
                    className="min-w-0 flex-1 rounded-lg border border-borde px-2 py-1 text-xs"
                  />
                  <select
                    value={l.comensal ?? ""}
                    onChange={(e) => cambiar(l.clave, { comensal: e.target.value ? Number(e.target.value) : null })}
                    className="rounded-lg border border-borde px-1 py-1 text-xs"
                    aria-label="Comensal"
                  >
                    <option value="">Compartido</option>
                    {Array.from({ length: comensales }, (_, i) => (
                      <option key={i} value={i + 1}>
                        Comensal {i + 1}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 space-y-2 border-t border-borde pt-3">
          <p className="flex justify-between font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formato(total)}</span>
          </p>
          <div className="flex gap-2">
            <button type="button" className="boton-secundario" onClick={onCancelar}>
              Cancelar
            </button>
            <button
              type="button"
              className="boton flex-1"
              disabled={lineas.length === 0 || enviando}
              onClick={async () => {
                setEnviando(true);
                await onEnviar(lineas);
                setEnviando(false);
              }}
            >
              {enviando ? "Enviando…" : "Enviar a cocina"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
