"use client";

import { useState } from "react";
import { montoPropina, type Propina } from "@/lib/cuenta";
import type { Ajustes } from "@/lib/salon";

export const TEXTOS_PROPINA = {
  propina: "Propina",
  sin: "Sin propina",
  otro: "Otro",
  alFinal: "Al final",
  alFinalAyuda: "La deja cuando todos hayan pagado",
  como: "¿Cómo deja la propina?",
  mismo: "Con el mismo medio",
  porcentaje: "%",
  monto: "$",
};

// Elige la propina: porcentajes o montos fijos, un valor libre o dejarla al final; y con qué medio se paga.
// Se usa al cobrar en el panel y cuando el cliente pide la cuenta desde la carta.
export function SelectorPropina({
  base,
  config,
  metodos,
  valor,
  onChange,
  formato,
  textos = TEXTOS_PROPINA,
}: {
  base: number;
  config: Ajustes["propinas"];
  metodos: string[];
  valor: Propina;
  onChange: (p: Propina) => void;
  formato: (n: number) => string;
  textos?: typeof TEXTOS_PROPINA;
}) {
  const [libre, setLibre] = useState(false);
  const [tipoLibre, setTipoLibre] = useState<"porcentaje" | "monto">("porcentaje");
  const metodo = valor.tipo === "porcentaje" || valor.tipo === "monto" ? valor.metodo : undefined;
  const chip = (activo: boolean) =>
    `rounded-xl border px-3 py-2 text-sm font-medium transition ${activo ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white hover:border-stone-400"}`;
  const elegir = (p: Propina) => {
    setLibre(false);
    onChange(p.tipo === "porcentaje" || p.tipo === "monto" ? { ...p, metodo } : p);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={chip(valor.tipo === "ninguna" && !libre)} onClick={() => elegir({ tipo: "ninguna" })}>
          {textos.sin}
        </button>
        {config.porcentajes.map((p) => (
          <button
            key={`p${p}`}
            type="button"
            className={chip(!libre && valor.tipo === "porcentaje" && valor.valor === p)}
            onClick={() => elegir({ tipo: "porcentaje", valor: p })}
          >
            {p}% <span className="text-xs opacity-70">{formato(montoPropina(base, { tipo: "porcentaje", valor: p }))}</span>
          </button>
        ))}
        {config.montos.map((m) => (
          <button
            key={`m${m}`}
            type="button"
            className={chip(!libre && valor.tipo === "monto" && valor.valor === m)}
            onClick={() => elegir({ tipo: "monto", valor: m })}
          >
            {formato(m)}
          </button>
        ))}
        {config.libre && (
          <button
            type="button"
            className={chip(libre)}
            onClick={() => {
              setLibre(true);
              onChange({ tipo: tipoLibre, valor: 0, metodo });
            }}
          >
            {textos.otro}
          </button>
        )}
        <button
          type="button"
          className={chip(valor.tipo === "despues")}
          onClick={() => elegir({ tipo: "despues" })}
          title={textos.alFinalAyuda}
        >
          {textos.alFinal}
        </button>
      </div>

      {libre && (valor.tipo === "porcentaje" || valor.tipo === "monto") && (
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-stone-100 p-0.5 text-sm">
            {(["porcentaje", "monto"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTipoLibre(t);
                  onChange({ tipo: t, valor: 0, metodo });
                }}
                className={`rounded-md px-3 py-1 font-semibold ${valor.tipo === t ? "bg-white shadow-sm" : "text-stone-500"}`}
              >
                {t === "porcentaje" ? textos.porcentaje : textos.monto}
              </button>
            ))}
          </div>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            autoFocus
            value={valor.valor || ""}
            onChange={(e) => onChange({ tipo: valor.tipo, valor: Math.max(0, Number(e.target.value) || 0), metodo })}
            className="w-28 rounded-lg border border-stone-300 px-3 py-1.5 text-base"
            aria-label={textos.propina}
          />
          <span className="text-sm text-stone-500">= {formato(montoPropina(base, valor))}</span>
        </div>
      )}

      {(valor.tipo === "porcentaje" || valor.tipo === "monto") && montoPropina(base, valor) > 0 && metodos.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-stone-500">{textos.como}</p>
          <div className="flex flex-wrap gap-1.5">
            {[undefined, ...metodos].map((m) => (
              <button
                key={m ?? "mismo"}
                type="button"
                onClick={() => onChange({ ...valor, metodo: m })}
                className={`rounded-lg border px-2.5 py-1 text-xs ${metodo === m ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white"}`}
              >
                {m ?? textos.mismo}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
