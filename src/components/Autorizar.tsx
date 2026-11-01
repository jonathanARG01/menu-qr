"use client";

import { useCallback, useRef, useState } from "react";

// Ventana para pedir el PIN de un encargado (y el motivo) antes de algo sensible: anular, quitar un plato que ya
// está en cocina o hacer un descuento. La base de datos vuelve a revisar el PIN; esto solo lo pide.

export type Autorizacion = { pin: string | null; motivo: string };

type Pedido = {
  titulo: string;
  detalle?: string;
  // Si hace falta el PIN de un encargado (un administrador no lo necesita).
  pin: boolean;
  // Motivo obligatorio (descuentos) u opcional (anular, quitar).
  motivo: "obligatorio" | "opcional" | "no";
  ejemplos?: string[];
};

export function useAutorizar() {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const resolver = useRef<((r: Autorizacion | null) => void) | null>(null);

  const pedir = useCallback(
    (p: Pedido) =>
      new Promise<Autorizacion | null>((ok) => {
        resolver.current = ok;
        setPedido(p);
      }),
    [],
  );

  const terminar = (r: Autorizacion | null) => {
    resolver.current?.(r);
    resolver.current = null;
    setPedido(null);
  };

  const dialogo = pedido ? <Dialogo pedido={pedido} onListo={terminar} /> : null;
  return { pedir, dialogo };
}

function Dialogo({ pedido, onListo }: { pedido: Pedido; onListo: (r: Autorizacion | null) => void }) {
  const [pin, setPin] = useState("");
  const [motivo, setMotivo] = useState("");
  const falta = (pedido.pin && !/^\d{4,6}$/.test(pin)) || (pedido.motivo === "obligatorio" && !motivo.trim());

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => onListo(null)}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label={pedido.titulo}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!falta) onListo({ pin: pedido.pin ? pin : null, motivo: motivo.trim() });
        }}
        className="w-full max-w-sm space-y-4 rounded-2xl bg-superficie p-5 shadow-2xl"
      >
        <div>
          <h2 className="text-lg font-semibold">{pedido.titulo}</h2>
          {pedido.detalle && <p className="mt-1 text-sm text-suave">{pedido.detalle}</p>}
        </div>
        {pedido.motivo !== "no" && (
          <label className="block text-sm">
            Motivo{pedido.motivo === "opcional" ? " (opcional)" : ""}
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={120}
              autoFocus={!pedido.pin}
              className="campo mt-1"
              placeholder={pedido.ejemplos?.[0] ?? "¿Por qué?"}
            />
            {pedido.ejemplos && pedido.ejemplos.length > 1 && (
              <span className="mt-2 flex flex-wrap gap-1.5">
                {pedido.ejemplos.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setMotivo(e)}
                    className="rounded-full bg-stone-100 px-2.5 py-1 text-xs hover:bg-stone-200"
                  >
                    {e}
                  </button>
                ))}
              </span>
            )}
          </label>
        )}
        {pedido.pin && (
          <label className="block text-sm">
            PIN del encargado
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              pattern="\d*"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              autoFocus
              className="campo mt-1 text-center text-2xl tracking-[0.5em]"
              placeholder="••••"
            />
            <span className="mt-1 block text-xs text-suave">Lo escribe un administrador o alguien que pueda autorizar.</span>
          </label>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="boton-secundario" onClick={() => onListo(null)}>
            Cancelar
          </button>
          <button type="submit" className="boton" disabled={falta}>
            {pedido.pin ? "Autorizar" : "Confirmar"}
          </button>
        </div>
      </form>
    </div>
  );
}

// La función todavía no existe en la base (falta ejecutar el SQL 0023).
export const faltaFuncion = (error: { message?: string; code?: string } | null) =>
  !!error && (error.code === "PGRST202" || /Could not find the function|does not exist/i.test(error.message ?? ""));
