"use client";

import { useState } from "react";
import { textoOpciones, type PedidoItem } from "@/lib/salon";

export type PedidoDescuento = {
  items: string[] | null;
  porcentaje: number | null;
  monto: number | null;
  motivo: string;
  pin: string | null;
};

const MOTIVOS = ["Cliente frecuente", "Demora en cocina", "Plato con reclamo", "Cumpleaños", "Invitación de la casa"];

// Descuento o cortesía con motivo: a toda la cuenta o a los platos elegidos, por porcentaje, monto fijo o 100 %
// (cortesía). Un mesero necesita el PIN de un encargado; el administrador no.
export function Descuento({
  lineas,
  formato,
  pin,
  onAplicar,
  onCerrar,
}: {
  lineas: PedidoItem[];
  formato: (n: number) => string;
  pin: boolean;
  onAplicar: (d: PedidoDescuento) => Promise<boolean>;
  onCerrar: () => void;
}) {
  const [modo, setModo] = useState<"porcentaje" | "monto" | "cortesia" | "quitar">("porcentaje");
  const [valor, setValor] = useState("10");
  const [todos, setTodos] = useState(true);
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [motivo, setMotivo] = useState("");
  const [clave, setClave] = useState("");
  const [enviando, setEnviando] = useState(false);
  const conDescuento = lineas.some((l) => l.precio_original != null);

  const sobre = todos ? lineas : lineas.filter((l) => elegidos.has(l.id));
  const base = sobre.reduce((s, l) => s + Number(l.precio_original ?? l.precio) * l.cantidad, 0);
  const n = Number(valor.replace(/\./g, "").replace(",", "."));
  const descuento =
    modo === "cortesia"
      ? base
      : modo === "quitar"
        ? 0
        : modo === "monto"
          ? Math.min(base, n > 0 ? n : 0)
          : Math.round((base * Math.min(100, Math.max(0, n || 0))) / 100);
  const valido =
    sobre.length > 0 &&
    motivo.trim() &&
    (!pin || /^\d{4,6}$/.test(clave)) &&
    (modo === "cortesia" || modo === "quitar" || (n > 0 && (modo === "monto" || n <= 100)));

  async function aplicar(e: React.FormEvent) {
    e.preventDefault();
    if (!valido || enviando) return;
    setEnviando(true);
    const ok = await onAplicar({
      items: todos ? null : [...elegidos],
      porcentaje: modo === "cortesia" ? 100 : modo === "quitar" ? 0 : modo === "porcentaje" ? n : null,
      monto: modo === "monto" ? n : null,
      motivo: motivo.trim(),
      pin: pin ? clave : null,
    });
    setEnviando(false);
    if (ok) onCerrar();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCerrar}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Descuento"
        onClick={(e) => e.stopPropagation()}
        onSubmit={aplicar}
        className="max-h-[92vh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl bg-superficie p-5 shadow-2xl"
      >
        <h2 className="text-lg font-semibold">Descuento o cortesía</h2>

        <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1 text-sm sm:grid-cols-4" role="group">
          {(
            [
              ["porcentaje", "Porcentaje"],
              ["monto", "Monto"],
              ["cortesia", "Cortesía"],
              ...(conDescuento ? [["quitar", "Quitar"]] : []),
            ] as [typeof modo, string][]
          ).map(([id, texto]) => (
            <button
              key={id}
              type="button"
              aria-pressed={modo === id}
              onClick={() => setModo(id)}
              className={`rounded-lg px-2 py-1.5 font-medium ${modo === id ? "bg-superficie shadow-sm" : "text-suave"}`}
            >
              {texto}
            </button>
          ))}
        </div>

        {(modo === "porcentaje" || modo === "monto") && (
          <label className="block text-sm">
            {modo === "porcentaje" ? "Porcentaje de descuento" : "Monto a descontar"}
            <span className="mt-1 flex items-center gap-2">
              <input
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="campo w-32 text-lg tabular-nums"
                autoFocus
              />
              <span className="text-suave">{modo === "porcentaje" ? "%" : ""}</span>
              {modo === "porcentaje" && (
                <span className="flex gap-1">
                  {[10, 15, 20, 50].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setValor(String(p))}
                      className="rounded-full bg-stone-100 px-2 py-1 text-xs hover:bg-stone-200"
                    >
                      {p}%
                    </button>
                  ))}
                </span>
              )}
            </span>
          </label>
        )}

        <fieldset className="space-y-2 text-sm">
          <legend className="mb-1">¿Sobre qué?</legend>
          <label className="flex items-center gap-2">
            <input type="radio" checked={todos} onChange={() => setTodos(true)} /> Toda la cuenta
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={!todos} onChange={() => setTodos(false)} /> Solo algunos platos
          </label>
          {!todos && (
            <ul className="max-h-48 divide-y divide-borde overflow-y-auto rounded-xl border border-borde">
              {lineas.map((l) => (
                <li key={l.id}>
                  <label className="flex items-center gap-2 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={elegidos.has(l.id)}
                      onChange={(e) => {
                        const s = new Set(elegidos);
                        if (e.target.checked) s.add(l.id);
                        else s.delete(l.id);
                        setElegidos(s);
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {l.cantidad} × {l.nombre}
                      {l.opciones?.length ? <span className="text-suave"> ({textoOpciones(l.opciones)})</span> : null}
                    </span>
                    <span className="tabular-nums">{formato(Number(l.precio_original ?? l.precio) * l.cantidad)}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <label className="block text-sm">
          Motivo
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={120}
            className="campo mt-1"
            placeholder="¿Por qué se descuenta?"
            required
          />
          <span className="mt-2 flex flex-wrap gap-1.5">
            {MOTIVOS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMotivo(m)}
                className="rounded-full bg-stone-100 px-2.5 py-1 text-xs hover:bg-stone-200"
              >
                {m}
              </button>
            ))}
          </span>
        </label>

        {pin && (
          <label className="block text-sm">
            PIN del encargado
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={clave}
              onChange={(e) => setClave(e.target.value.replace(/\D/g, ""))}
              className="campo mt-1 text-center text-2xl tracking-[0.5em]"
              placeholder="••••"
            />
          </label>
        )}

        <p className="rounded-xl bg-stone-50 px-3 py-2 text-sm">
          {modo === "quitar" ? (
            "Los platos vuelven a su precio de carta."
          ) : (
            <>
              Se descuentan <strong className="tabular-nums">{formato(descuento)}</strong> de {formato(base)}. Reemplaza cualquier
              descuento anterior sobre esos platos.
            </>
          )}
        </p>

        <div className="flex justify-end gap-2">
          <button type="button" className="boton-secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" className="boton" disabled={!valido || enviando}>
            {enviando ? "Aplicando…" : "Aplicar"}
          </button>
        </div>
      </form>
    </div>
  );
}
