"use client";

import { useMemo, useState } from "react";
import { Icono } from "@/components/Icono";
import { useToast } from "@/components/Toast";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mensajeError } from "@/lib/utils";

export type PlatoAgotable = {
  id: string;
  nombre: string;
  categoria_id: string;
  agotado_hasta?: string | null;
  descripcion?: string | null;
  foto_url?: string | null;
};

export const estaAgotado = (p: { agotado_hasta?: string | null }, ahora = Date.now()) =>
  !!p.agotado_hasta && Date.parse(p.agotado_hasta) > ahora;

// Marcar un plato como agotado desde la cocina: desaparece de la carta del cliente al instante y vuelve solo a la mañana.
export function Agotados({
  supabase,
  platos,
  categorias,
  onCambio,
  onCerrar,
}: {
  supabase: SupabaseClient;
  platos: PlatoAgotable[];
  categorias: { id: string; nombre: string }[];
  onCambio: (id: string, hasta: string | null) => void;
  onCerrar: () => void;
}) {
  const avisar = useToast();
  const [buscar, setBuscar] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const filtro = buscar.trim().toLowerCase();
  const grupos = useMemo(
    () =>
      categorias
        .map((c) => ({
          ...c,
          platos: platos.filter((p) => p.categoria_id === c.id && (!filtro || p.nombre.toLowerCase().includes(filtro))),
        }))
        .filter((c) => c.platos.length),
    [categorias, platos, filtro],
  );
  const agotados = platos.filter((p) => estaAgotado(p));

  async function alternar(p: PlatoAgotable) {
    const agotar = !estaAgotado(p);
    setOcupado(p.id);
    const { data, error } = await supabase.rpc("marcar_agotado", { p_plato: p.id, p_agotado: agotar });
    setOcupado(null);
    if (error) {
      return avisar(
        /marcar_agotado/.test(error.message) ? "Falta ejecutar el SQL 0009 en Supabase." : mensajeError(error),
        "error",
      );
    }
    onCambio(p.id, (data as string | null) ?? null);
    avisar(agotar ? `${p.nombre}: agotado hasta mañana` : `${p.nombre} vuelve a la carta`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Platos agotados"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-superficie text-stone-900 shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-stone-200 p-5 pb-3">
          <div className="flex-1">
            <h2 className="text-lg font-bold">Platos agotados</h2>
            <p className="text-sm text-stone-500">
              Toca un plato para agotarlo. Desaparece de la carta al instante y vuelve solo mañana a las 6.
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-lg p-1 text-stone-400 hover:bg-stone-100"
          >
            <Icono nombre="cerrar" />
          </button>
        </div>
        <div className="px-5 pt-3">
          <input
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="Buscar plato…"
            aria-label="Buscar plato"
            className="campo"
          />
          {agotados.length > 0 && !filtro && (
            <p className="mt-2 text-sm text-red-700">
              Agotados ahora: <strong>{agotados.map((p) => p.nombre).join(", ")}</strong>
            </p>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {grupos.map((c) => (
            <div key={c.id} className="mb-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">{c.nombre}</p>
              <ul className="space-y-1">
                {c.platos.map((p) => {
                  const agotado = estaAgotado(p);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        disabled={ocupado === p.id}
                        onClick={() => alternar(p)}
                        aria-pressed={agotado}
                        className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                          agotado ? "border-red-300 bg-red-50 text-red-900" : "border-stone-200 hover:border-stone-400"
                        }`}
                      >
                        <span className={`min-w-0 flex-1 font-medium ${agotado ? "line-through" : ""}`}>{p.nombre}</span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${agotado ? "bg-red-600 text-white" : "bg-stone-100 text-stone-600"}`}
                        >
                          {ocupado === p.id ? "…" : agotado ? "Agotado · reponer" : "Hay"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {grupos.length === 0 && <p className="py-6 text-center text-sm text-stone-500">No hay platos con ese nombre.</p>}
        </div>
      </div>
    </div>
  );
}
