"use client";

import { useMemo, useState } from "react";
import { SelectorPropina } from "@/components/SelectorPropina";
import { consumoPorComensal, describirPropina, montoPropina, partesIguales, type LineaCuenta, type Propina } from "@/lib/cuenta";
import type { Ajustes, Pago, SolicitudCuenta } from "@/lib/salon";

type Modo = "junto" | "iguales" | "consumo" | "libre";
type Parte = { etiqueta: string; monto: number; metodo?: string };

export type NuevoPago = { parte: string; monto: number; propina: number; metodo: string; propina_metodo: string | null };

const MODOS: { id: Modo; titulo: string; ayuda: string }[] = [
  { id: "junto", titulo: "Todo junto", ayuda: "Una sola persona paga la cuenta" },
  { id: "iguales", titulo: "Partes iguales", ayuda: "Se divide el total entre todos" },
  { id: "consumo", titulo: "Cada uno lo suyo", ayuda: "Según lo que consumió cada comensal" },
  { id: "libre", titulo: "Monto libre", ayuda: "Alguien paga una parte cualquiera" },
];

// Asistente de cobro: cómo dividen la cuenta, y para cada parte la propina y el medio de pago.
export function Cobro({
  total,
  pagos,
  comensales,
  lineas,
  ajustes,
  solicitud,
  formato,
  onPagar,
  onCerrarMesa,
  onSalir,
}: {
  total: number;
  pagos: Pago[];
  comensales: number;
  lineas: LineaCuenta[];
  ajustes: Ajustes;
  solicitud?: SolicitudCuenta | null;
  formato: (n: number) => string;
  onPagar: (p: NuevoPago) => Promise<boolean>;
  onCerrarMesa: () => void;
  onSalir: () => void;
}) {
  const pagado = pagos.reduce((t, p) => t + Number(p.monto), 0);
  const falta = Math.max(0, Math.round((total - pagado) * 100) / 100);
  const [modo, setModo] = useState<Modo>(solicitud?.modo ?? "junto");
  const [partes, setPartes] = useState(solicitud?.partes ?? comensales);
  const [cobrando, setCobrando] = useState<Parte | null>(null);
  const [propinaFinal, setPropinaFinal] = useState(false);

  // Si la mesa pidió la cuenta con un medio de pago por persona, cada parte ya trae el suyo.
  const metodoDe = (i: number) =>
    (solicitud?.modo === modo && solicitud.metodos?.[i]) || (solicitud?.modo === modo ? solicitud.metodo : undefined);
  const lista = useMemo<Parte[]>(() => {
    if (modo === "iguales")
      return partesIguales(total, partes).map((monto, i) => ({
        etiqueta: `Parte ${i + 1} de ${partes}`,
        monto,
        metodo: metodoDe(i),
      }));
    if (modo === "consumo")
      return consumoPorComensal(lineas, comensales)
        .map((monto, i) => ({ etiqueta: `Comensal ${i + 1}`, monto, metodo: metodoDe(i) }))
        .filter((p) => p.monto > 0);
    if (modo === "libre") return [{ etiqueta: "Pago parcial", monto: falta }];
    return [{ etiqueta: "Cuenta completa", monto: falta }];
  }, [modo, partes, total, lineas, comensales, falta]); // eslint-disable-line react-hooks/exhaustive-deps

  const pagadaParte = (p: Parte) => modo !== "libre" && modo !== "junto" && pagos.some((x) => x.parte === p.etiqueta);
  const asignadas = lineas.filter((l) => l.comensal).length;

  if (cobrando || propinaFinal) {
    return (
      <FormPago
        parte={propinaFinal ? { etiqueta: "Propina", monto: 0 } : cobrando!}
        soloPropina={propinaFinal}
        maximo={falta}
        ajustes={ajustes}
        sugerida={solicitud?.propina}
        metodoSugerido={cobrando?.metodo ?? solicitud?.metodo}
        formato={formato}
        base={propinaFinal ? total : undefined}
        onVolver={() => {
          setCobrando(null);
          setPropinaFinal(false);
        }}
        onConfirmar={async (pago) => {
          const ok = await onPagar(pago);
          if (ok) {
            setCobrando(null);
            setPropinaFinal(false);
          }
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Dato titulo="Total" valor={formato(total)} />
        <Dato titulo="Pagado" valor={formato(pagado)} />
        <Dato titulo="Falta" valor={formato(falta)} fuerte={falta > 0} />
      </div>

      {solicitud && (
        <p className="rounded-xl bg-violet-50 p-3 text-sm text-violet-900">
          La mesa pidió: <strong>{MODOS.find((m) => m.id === solicitud.modo)?.titulo}</strong>
          {solicitud.partes ? ` en ${solicitud.partes}` : ""}
          {solicitud.propina ? ` · ${describirPropina(solicitud.propina, formato)}` : ""}
          {solicitud.metodo ? ` · ${solicitud.metodo}` : ""}
          {solicitud.metodos?.some(Boolean) && (
            <span className="mt-1 block">
              {solicitud.metodos
                .map((m, i) => `${solicitud.modo === "consumo" ? "Comensal" : "Persona"} ${i + 1}: ${m || "sin elegir"}`)
                .join(" · ")}
            </span>
          )}
        </p>
      )}

      {falta > 0 ? (
        <>
          <div>
            <p className="mb-2 text-sm font-semibold">¿Cómo pagan?</p>
            <div className="grid grid-cols-2 gap-2">
              {MODOS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setModo(m.id)}
                  className={`rounded-xl border-2 p-3 text-left ${modo === m.id ? "border-marca bg-marca/5" : "border-borde hover:border-stone-300"}`}
                >
                  <span className="block text-sm font-semibold">{m.titulo}</span>
                  <span className="block text-xs text-suave">{m.ayuda}</span>
                </button>
              ))}
            </div>
          </div>

          {modo === "iguales" && (
            <div className="flex items-center justify-between rounded-xl bg-stone-50 p-3">
              <span className="text-sm">¿Entre cuántos?</span>
              <span className="flex items-center rounded-lg border border-borde bg-superficie">
                <button
                  type="button"
                  className="h-9 w-9 text-lg"
                  onClick={() => setPartes(Math.max(2, partes - 1))}
                  aria-label="Menos partes"
                >
                  −
                </button>
                <span className="w-8 text-center font-semibold tabular-nums">{partes}</span>
                <button
                  type="button"
                  className="h-9 w-9 text-lg"
                  onClick={() => setPartes(Math.min(99, partes + 1))}
                  aria-label="Más partes"
                >
                  +
                </button>
              </span>
            </div>
          )}
          {modo === "consumo" && asignadas === 0 && (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              Todavía nadie tiene platos asignados: en la ficha de la mesa, elige de quién es cada línea (C1, C2…). Lo que quede
              como compartido se reparte entre todos.
            </p>
          )}

          <ul className="divide-y divide-borde rounded-xl border border-borde">
            {lista.map((p) => {
              const hecha = pagadaParte(p);
              return (
                <li key={p.etiqueta} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="min-w-0 flex-1 text-sm">
                    {p.etiqueta}
                    {p.metodo && (
                      <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-suave">{p.metodo}</span>
                    )}
                  </span>
                  <span className={`font-semibold tabular-nums ${hecha ? "text-suave line-through" : ""}`}>
                    {formato(p.monto)}
                  </span>
                  {hecha ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">Pagado</span>
                  ) : (
                    <button type="button" className="boton px-3 py-1.5" onClick={() => setCobrando(p)} disabled={p.monto <= 0}>
                      Cobrar
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <div className="rounded-xl bg-emerald-50 p-4 text-center">
          <p className="font-semibold text-emerald-900">La cuenta está paga</p>
          <p className="text-sm text-emerald-800">Puedes sumar una propina que dejen al final o cerrar la mesa.</p>
        </div>
      )}

      {pagos.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-semibold">Pagos</p>
          <ul className="space-y-1 text-sm">
            {pagos.map((p) => (
              <li key={p.id} className="flex justify-between gap-3">
                <span className="text-suave">
                  {p.parte ?? "Pago"} · {p.metodo}
                </span>
                <span className="tabular-nums">
                  {formato(Number(p.monto))}
                  {Number(p.propina) > 0 && (
                    <span className="text-emerald-700">
                      {" "}
                      + {formato(Number(p.propina))} propina{p.propina_metodo ? ` (${p.propina_metodo})` : ""}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-borde pt-4">
        <button type="button" className="boton-secundario" onClick={onSalir}>
          Volver a la mesa
        </button>
        {ajustes.propinas.activas && (
          <button type="button" className="boton-secundario" onClick={() => setPropinaFinal(true)}>
            + Propina al final
          </button>
        )}
        {falta <= 0 && (
          <button type="button" className="boton ml-auto" onClick={onCerrarMesa}>
            Cerrar mesa
          </button>
        )}
      </div>
    </div>
  );
}

function Dato({ titulo, valor, fuerte }: { titulo: string; valor: string; fuerte?: boolean }) {
  return (
    <div className={`rounded-xl p-2.5 ${fuerte ? "bg-marca/10 text-marca" : "bg-stone-50"}`}>
      <p className="text-xs text-suave">{titulo}</p>
      <p className="font-bold tabular-nums">{valor}</p>
    </div>
  );
}

function FormPago({
  parte,
  soloPropina,
  maximo,
  base,
  ajustes,
  sugerida,
  metodoSugerido,
  formato,
  onVolver,
  onConfirmar,
}: {
  parte: Parte;
  soloPropina: boolean;
  maximo: number;
  base?: number;
  ajustes: Ajustes;
  sugerida?: Propina;
  metodoSugerido?: string;
  formato: (n: number) => string;
  onVolver: () => void;
  onConfirmar: (p: NuevoPago) => Promise<void>;
}) {
  const metodos = ajustes.metodos_pago.length ? ajustes.metodos_pago : ["Efectivo"];
  const [monto, setMonto] = useState(String(Math.min(parte.monto, maximo || parte.monto)));
  const [metodo, setMetodo] = useState(metodoSugerido && metodos.includes(metodoSugerido) ? metodoSugerido : metodos[0]);
  const inicial: Propina =
    sugerida ??
    (ajustes.propinas.sugerida && !soloPropina ? { tipo: "porcentaje", valor: ajustes.propinas.sugerida } : { tipo: "ninguna" });
  const [propina, setPropina] = useState<Propina>(soloPropina && inicial.tipo === "despues" ? { tipo: "ninguna" } : inicial);
  const [enviando, setEnviando] = useState(false);
  const valor = soloPropina ? 0 : Math.max(0, Number(monto.replace(",", ".")) || 0);
  const montoProp = montoPropina(base ?? valor, propina);

  return (
    <div className="space-y-5">
      <button type="button" onClick={onVolver} className="text-sm text-suave hover:text-tinta">
        ← Volver
      </button>
      <div>
        <p className="text-lg font-semibold">{soloPropina ? "Propina al final" : `Cobrar ${parte.etiqueta.toLowerCase()}`}</p>
        {!soloPropina && (
          <label className="mt-3 block text-sm font-medium">
            Monto
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="campo mt-1 text-lg font-semibold tabular-nums"
            />
          </label>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Medio de pago</p>
        <div className="flex flex-wrap gap-2">
          {metodos.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetodo(m)}
              className={`rounded-xl border px-3 py-2 text-sm font-medium ${metodo === m ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-superficie"}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {(ajustes.propinas.activas || soloPropina) && (
        <div>
          <p className="mb-2 text-sm font-semibold">Propina</p>
          <SelectorPropina
            base={base ?? valor}
            config={soloPropina ? { ...ajustes.propinas, libre: true } : ajustes.propinas}
            metodos={metodos}
            valor={propina}
            onChange={setPropina}
            formato={formato}
          />
        </div>
      )}

      <div className="rounded-xl bg-stone-50 p-3">
        {!soloPropina && (
          <p className="flex justify-between text-sm">
            <span>Consumo</span> <span className="tabular-nums">{formato(valor)}</span>
          </p>
        )}
        <p className="flex justify-between text-sm">
          <span>Propina{propina.tipo === "despues" ? " (al final)" : ""}</span>{" "}
          <span className="tabular-nums">{formato(montoProp)}</span>
        </p>
        <p className="mt-1 flex justify-between border-t border-borde pt-1 font-bold">
          <span>Cobra</span> <span className="tabular-nums">{formato(valor + montoProp)}</span>
        </p>
      </div>

      <button
        type="button"
        className="boton w-full py-3"
        disabled={enviando || (soloPropina ? montoProp <= 0 : valor <= 0)}
        onClick={async () => {
          setEnviando(true);
          await onConfirmar({
            parte: parte.etiqueta,
            monto: valor,
            propina: montoProp,
            metodo,
            propina_metodo:
              montoProp > 0 && (propina.tipo === "porcentaje" || propina.tipo === "monto") ? (propina.metodo ?? null) : null,
          });
          setEnviando(false);
        }}
      >
        {enviando ? "Guardando…" : `Registrar pago de ${formato(valor + montoProp)}`}
      </button>
    </div>
  );
}
