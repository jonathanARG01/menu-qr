"use client";

import { useMemo, useState, useTransition } from "react";
import { Interruptor } from "@/components/Interruptor";
import { useToast } from "@/components/Toast";
import { NIVELES_BASE, descuentoVigente, textoNivel, type Descuento, type Nivel } from "@/lib/referidos";
import { asignarReferente, cambiarCiclo, cambiarEstado, guardarNiveles, quitarDescuento, usarPeriodo } from "./actions";

export type FilaReferidos = {
  id: string;
  slug: string;
  nombre: string;
  plan: string;
  ciclo: "mensual" | "anual";
  activo: boolean;
  referente_id: string | null;
  estado: "pendiente" | "confirmado" | "anulado" | null;
  confirmados: number;
  pendientes: number;
};

type Props = { filas: FilaReferidos[]; activo: boolean; niveles: Nivel[]; descuentos: Descuento[] };

export function AdminReferidos({ filas, activo, niveles, descuentos }: Props) {
  const avisar = useToast();
  const [pendiente, empezar] = useTransition();

  // Corre una acción del servidor y avisa el resultado; la página se recarga sola con los datos nuevos.
  function hacer(accion: () => Promise<string | null>, ok = "Guardado") {
    empezar(async () => {
      const error = await accion();
      avisar(error ?? ok, error ? "error" : undefined);
    });
  }

  const porId = useMemo(() => new Map(filas.map((f) => [f.id, f])), [filas]);
  const descuentosDe = (id: string) => descuentos.filter((d) => d.restaurante_id === id);
  const conPrograma = filas.filter((f) => f.confirmados + f.pendientes > 0 || descuentosDe(f.id).length > 0);
  const invitados = filas.filter((f) => f.referente_id);

  return (
    <div className="space-y-6">
      <EditorNiveles activoInicial={activo} iniciales={niveles} pendiente={pendiente} hacer={hacer} />

      <section className="space-y-3">
        <div>
          <h2 className="font-semibold">Descuentos para cobrar</h2>
          <p className="text-sm text-suave">
            Al cobrarle a un restaurante, aplica el descuento de la columna y toca «Cobré un período» para gastar uno de los
            temporales. Los permanentes no se gastan.
          </p>
        </div>
        {conPrograma.length === 0 ? (
          <p className="tarjeta p-6 text-center text-sm text-suave">Ningún restaurante invitó a otro todavía.</p>
        ) : (
          <ul className="space-y-3">
            {conPrograma.map((f) => {
              const propios = descuentosDe(f.id);
              const vigente = descuentoVigente(propios);
              const gastable = vigente.porcentaje > 0 && !vigente.permanente;
              return (
                <li key={f.id} className="tarjeta p-4">
                  <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="font-semibold">
                        {f.nombre}
                        {vigente.prioridad && (
                          <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-xs font-medium text-violet-800">
                            Prioritario
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-suave">
                        /{f.slug} · plan {f.plan} · {f.confirmados} {f.confirmados === 1 ? "contrató" : "contrataron"}
                        {f.pendientes > 0 && ` · ${f.pendientes} en prueba`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold tabular-nums">
                        {vigente.porcentaje > 0 ? `${vigente.porcentaje} %` : "—"}
                      </p>
                      <p className="text-xs text-suave">
                        {vigente.permanente
                          ? "permanente"
                          : vigente.periodosPendientes > 0
                            ? `${vigente.periodosPendientes} ${vigente.periodosPendientes === 1 ? "período" : "períodos"} con descuento`
                            : "sin descuento"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-borde pt-3 text-sm">
                    <label className="flex items-center gap-2">
                      Paga
                      <select
                        value={f.ciclo}
                        disabled={pendiente}
                        onChange={(e) => hacer(() => cambiarCiclo(f.id, e.target.value))}
                        className="campo w-auto py-1.5"
                      >
                        <option value="mensual">por mes</option>
                        <option value="anual">por año</option>
                      </select>
                    </label>
                    {propios.map((d) => (
                      <span key={d.id} className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-xs">
                        {d.porcentaje} % ·{" "}
                        {d.periodos == null
                          ? "siempre"
                          : d.periodos_usados >= d.periodos
                            ? "usado"
                            : `queda${d.periodos - d.periodos_usados > 1 ? "n" : ""} ${d.periodos - d.periodos_usados}`}
                        <button
                          type="button"
                          className="ml-1 text-suave hover:text-red-600"
                          aria-label="Quitar descuento"
                          disabled={pendiente}
                          onClick={() => {
                            if (confirm(`¿Quitar el descuento de ${d.porcentaje} % a ${f.nombre}?`))
                              hacer(() => quitarDescuento(d.id), "Descuento quitado");
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <div className="flex-1" />
                    {gastable && (
                      <button
                        type="button"
                        className="boton-secundario py-1.5"
                        disabled={pendiente}
                        onClick={() => hacer(() => usarPeriodo(f.id), "Período descontado")}
                      >
                        Cobré un período
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-semibold">Quién invitó a quién</h2>
          <p className="text-sm text-suave">
            Un invitado cuenta cuando le pones un plan pago. Puedes anularlo si no corresponde, o asignar quién invitó a un
            restaurante que diste de alta tú.
          </p>
        </div>
        <AsignarReferente filas={filas} pendiente={pendiente} hacer={hacer} />
        {invitados.length > 0 && (
          <div className="tarjeta divide-y divide-borde">
            {invitados.map((f) => (
              <div key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1 basis-full sm:basis-auto">
                  <strong>{f.nombre}</strong> <span className="text-suave">invitado por</span>{" "}
                  {porId.get(f.referente_id!)?.nombre ?? "—"}
                </span>
                <span className="text-xs text-suave">plan {f.plan}</span>
                <label className="flex items-center gap-2">
                  <select
                    value={f.estado ?? "pendiente"}
                    disabled={pendiente}
                    onChange={(e) => hacer(() => cambiarEstado(f.id, e.target.value))}
                    className="campo w-auto py-1.5"
                    aria-label={`Estado de ${f.nombre}`}
                  >
                    <option value="pendiente">En prueba</option>
                    <option value="confirmado">Contrató</option>
                    <option value="anulado">No cuenta</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="text-suave hover:text-red-600"
                  disabled={pendiente}
                  onClick={() => {
                    if (confirm(`¿Quitar el referente de ${f.nombre}?`)) hacer(() => asignarReferente(f.id, ""), "Quitado");
                  }}
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

type Hacer = (accion: () => Promise<string | null>, ok?: string) => void;

function EditorNiveles({
  activoInicial,
  iniciales,
  pendiente,
  hacer,
}: {
  activoInicial: boolean;
  iniciales: Nivel[];
  pendiente: boolean;
  hacer: Hacer;
}) {
  const [activo, setActivo] = useState(activoInicial);
  const [niveles, setNiveles] = useState(iniciales);

  const cambiar = (i: number, cambios: Partial<Nivel>) =>
    setNiveles((ns) => ns.map((n, j) => (j === i ? { ...n, ...cambios } : n)));

  function guardar() {
    const orden = [...niveles].sort((a, b) => a.referidos - b.referidos);
    setNiveles(orden);
    hacer(() => guardarNiveles(activo, orden), "Niveles guardados");
  }

  return (
    <section className="tarjeta space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="font-semibold">Niveles del programa</h2>
          <p className="text-sm text-suave">
            Al llegar a cada cantidad de restaurantes que contrataron, el que invitó gana ese descuento. Los ya ganados no cambian
            si editas esto.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Interruptor activo={activo} onChange={setActivo} etiqueta="Programa activo" />
          {activo ? "Activo" : "En pausa"}
        </label>
      </div>

      <div className="space-y-2">
        <div className="hidden grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 px-1 text-xs text-suave sm:grid">
          <span>Restaurantes que contratan</span>
          <span>Descuento (%)</span>
          <span>Períodos (vacío = siempre)</span>
          <span>Prioritario</span>
          <span />
        </div>
        {niveles.map((n, i) => (
          <div key={i} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_1fr_1fr_auto_auto]">
            <input
              type="number"
              min={1}
              value={n.referidos || ""}
              onChange={(e) => cambiar(i, { referidos: Number(e.target.value) })}
              className="campo"
              aria-label="Restaurantes que contratan"
            />
            <input
              type="number"
              min={1}
              max={100}
              step="0.5"
              value={n.porcentaje || ""}
              onChange={(e) => cambiar(i, { porcentaje: Number(e.target.value) })}
              className="campo"
              aria-label="Descuento en porcentaje"
            />
            <input
              type="number"
              min={1}
              value={n.periodos ?? ""}
              placeholder="siempre"
              onChange={(e) => cambiar(i, { periodos: e.target.value ? Number(e.target.value) : null })}
              className="campo"
              aria-label="Períodos con descuento"
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={n.prioridad} onChange={(e) => cambiar(i, { prioridad: e.target.checked })} />
              <span className="sm:hidden">Acceso prioritario</span>
            </label>
            <button
              type="button"
              className="text-sm text-suave hover:text-red-600"
              onClick={() => setNiveles((ns) => ns.filter((_, j) => j !== i))}
            >
              Quitar
            </button>
            <p className="col-span-full -mt-1 px-1 text-xs text-suave">
              {n.referidos > 0 && n.porcentaje > 0 ? `${n.referidos} → ${textoNivel(n)}` : "Completa los datos"}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="boton-secundario"
          onClick={() =>
            setNiveles((ns) => [
              ...ns,
              { referidos: (ns[ns.length - 1]?.referidos ?? 0) + 1, porcentaje: 10, periodos: 1, prioridad: false },
            ])
          }
        >
          + Nivel
        </button>
        <button type="button" className="text-sm text-suave hover:text-tinta" onClick={() => setNiveles(NIVELES_BASE)}>
          Volver a los valores sugeridos
        </button>
        <div className="flex-1" />
        <button type="button" className="boton" disabled={pendiente} onClick={guardar}>
          Guardar niveles
        </button>
      </div>
    </section>
  );
}

function AsignarReferente({ filas, pendiente, hacer }: { filas: FilaReferidos[]; pendiente: boolean; hacer: Hacer }) {
  const [id, setId] = useState("");
  const [ref, setRef] = useState("");
  return (
    <form
      className="tarjeta grid gap-2 p-4 sm:grid-cols-[1fr_1fr_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        hacer(() => asignarReferente(id, ref), "Referente asignado");
        setId("");
        setRef("");
      }}
    >
      <select value={id} onChange={(e) => setId(e.target.value)} required className="campo" aria-label="Restaurante invitado">
        <option value="">Restaurante invitado…</option>
        {filas.map((f) => (
          <option key={f.id} value={f.id}>
            {f.nombre}
          </option>
        ))}
      </select>
      <select value={ref} onChange={(e) => setRef(e.target.value)} required className="campo" aria-label="Lo invitó">
        <option value="">Lo invitó…</option>
        {filas
          .filter((f) => f.id !== id)
          .map((f) => (
            <option key={f.id} value={f.slug}>
              {f.nombre}
            </option>
          ))}
      </select>
      <button type="submit" className="boton" disabled={pendiente || !id || !ref}>
        Asignar
      </button>
    </form>
  );
}
