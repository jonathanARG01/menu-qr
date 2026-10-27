"use client";

import { useMemo, useState, useTransition } from "react";
import { Icono } from "@/components/Icono";
import { Interruptor } from "@/components/Interruptor";
import { useToast } from "@/components/Toast";
import { NOMBRE_PLAN, type Plan } from "@/lib/planes";
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
type Hacer = (accion: () => Promise<string | null>, ok?: string) => void;

const nombrePlan = (plan: string) => NOMBRE_PLAN[plan as Plan] ?? plan;

const ESTADO: Record<string, { texto: string; color: string }> = {
  pendiente: { texto: "En prueba", color: "bg-amber-100 text-amber-800" },
  confirmado: { texto: "Contrató", color: "bg-emerald-100 text-emerald-800" },
  anulado: { texto: "No cuenta", color: "bg-stone-100 text-stone-600" },
};

export function AdminReferidos({ filas, activo, niveles, descuentos }: Props) {
  const avisar = useToast();
  const [pendiente, empezar] = useTransition();

  // Corre una acción del servidor y avisa el resultado; la página se recarga sola con los datos nuevos.
  const hacer: Hacer = (accion, ok = "Guardado") =>
    empezar(async () => {
      const error = await accion();
      avisar(error ?? ok, error ? "error" : undefined);
    });

  const porId = useMemo(() => new Map(filas.map((f) => [f.id, f])), [filas]);
  const descuentosDe = (id: string) => descuentos.filter((d) => d.restaurante_id === id);
  const conPrograma = filas.filter((f) => f.confirmados + f.pendientes > 0 || descuentosDe(f.id).length > 0);
  const invitados = filas.filter((f) => f.referente_id);
  const porCobrar = conPrograma.filter((f) => descuentoVigente(descuentosDe(f.id)).porcentaje > 0).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Referidos</h1>
        <p className="text-sm text-suave">Los restaurantes invitan a otros y ganan descuentos en su plan.</p>
      </div>

      <ComoFunciona niveles={niveles} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Dato titulo="Invitados" valor={invitados.length} icono="personas" />
        <Dato titulo="Contrataron" valor={invitados.filter((f) => f.estado === "confirmado").length} icono="check" acento />
        <Dato titulo="Siguen en prueba" valor={invitados.filter((f) => f.estado === "pendiente").length} icono="reloj" />
        <Dato titulo="Con descuento al cobrar" valor={porCobrar} icono="regalo" />
      </div>

      <EditorNiveles activoInicial={activo} iniciales={niveles} pendiente={pendiente} hacer={hacer} />

      <section className="space-y-3">
        <Titulo
          icono="caja"
          titulo="Descuentos para cobrar"
          texto="Al cobrarle a un restaurante, réstale el descuento que ves aquí y toca «Cobré un período» para gastar uno de los temporales. Los permanentes no se gastan."
        />
        {conPrograma.length === 0 ? (
          <Vacio texto="Ningún restaurante invitó a otro todavía." />
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {conPrograma.map((f) => {
              const propios = descuentosDe(f.id);
              const vigente = descuentoVigente(propios);
              const gastable = vigente.porcentaje > 0 && !vigente.permanente;
              return (
                <li key={f.id} className="tarjeta flex flex-col p-5">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                        {f.nombre}
                        {vigente.prioridad && (
                          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-800">
                            Prioritario
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-suave">
                        Plan {nombrePlan(f.plan)} · {f.confirmados} {f.confirmados === 1 ? "contrató" : "contrataron"}
                        {f.pendientes > 0 && ` · ${f.pendientes} en prueba`}
                      </p>
                    </div>
                    <div
                      className={`rounded-2xl px-3 py-2 text-right ${vigente.porcentaje > 0 ? "bg-emerald-50 text-emerald-800" : "bg-stone-50"}`}
                    >
                      <p className="text-2xl font-bold leading-none tabular-nums">
                        {vigente.porcentaje > 0 ? `${vigente.porcentaje} %` : "—"}
                      </p>
                      <p className="mt-1 text-[11px]">
                        {vigente.permanente
                          ? "para siempre"
                          : vigente.periodosPendientes > 0
                            ? `${vigente.periodosPendientes} ${vigente.periodosPendientes === 1 ? "cobro" : "cobros"} con descuento`
                            : "sin descuento ahora"}
                      </p>
                    </div>
                  </div>
                  {propios.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {propios.map((d) => {
                        const usado = d.periodos != null && d.periodos_usados >= d.periodos;
                        return (
                          <span
                            key={d.id}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${
                              usado ? "bg-stone-100 text-suave line-through" : "bg-emerald-50 text-emerald-800"
                            }`}
                          >
                            Nivel {d.referidos}: {d.porcentaje} % ·{" "}
                            {d.periodos == null
                              ? "siempre"
                              : usado
                                ? "usado"
                                : `queda${d.periodos - d.periodos_usados > 1 ? "n" : ""} ${d.periodos - d.periodos_usados}`}
                            <button
                              type="button"
                              className="ml-0.5 opacity-60 hover:text-red-600 hover:opacity-100"
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
                        );
                      })}
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-borde pt-4 text-sm">
                    <label className="flex items-center gap-2">
                      <span className="text-suave">Paga</span>
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
                    <div className="flex-1" />
                    {gastable && (
                      <button
                        type="button"
                        className="boton py-1.5"
                        disabled={pendiente}
                        onClick={() => hacer(() => usarPeriodo(f.id), "Listo: se descontó un período")}
                      >
                        <Icono nombre="check" className="h-4 w-4" />
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
        <Titulo
          icono="personas"
          titulo="Quién invitó a quién"
          texto="Un invitado cuenta cuando le pones un plan pago. Puedes anularlo si no corresponde, o asignar quién invitó a un restaurante que diste de alta tú."
        />
        <AsignarReferente filas={filas} pendiente={pendiente} hacer={hacer} />
        {invitados.length > 0 && (
          <ul className="tarjeta divide-y divide-borde overflow-hidden">
            {invitados.map((f) => {
              const estado = ESTADO[f.estado ?? "pendiente"];
              return (
                <li key={f.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                  <span className="flex min-w-0 flex-1 basis-full items-center gap-2 sm:basis-auto">
                    <strong className="truncate">{porId.get(f.referente_id!)?.nombre ?? "—"}</strong>
                    <span className="shrink-0 text-suave">invitó a</span>
                    <strong className="truncate">{f.nombre}</strong>
                    <span className="shrink-0 text-xs text-suave">plan {nombrePlan(f.plan)}</span>
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${estado.color}`}>{estado.texto}</span>
                  <label className="flex items-center">
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
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

// Explicación en cuatro pasos, con los niveles actuales.
function ComoFunciona({ niveles }: { niveles: Nivel[] }) {
  const pasos: [string, string, string][] = [
    ["referidos", "Comparte su link", "Cada restaurante tiene un link de invitación en su panel (Invitar y ahorrar)."],
    ["personas", "El invitado se registra", "Crea su cuenta con ese link y empieza su prueba. Aquí aparece «En prueba»."],
    ["estrella", "Le pones un plan pago", "Al cambiar su plan en Restaurantes, el invitado pasa solo a «Contrató»."],
    ["regalo", "El que invitó gana", "Al llegar a cada nivel gana su descuento. Tú lo restas al cobrarle."],
  ];
  return (
    <section className="tarjeta overflow-hidden">
      <div className="grid gap-px bg-borde sm:grid-cols-2 lg:grid-cols-4">
        {pasos.map(([icono, titulo, texto], i) => (
          <div key={titulo} className="bg-superficie p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-marca-claro text-marca-tinta">
                <Icono nombre={icono} className="h-[18px] w-[18px]" />
              </span>
              <span className="text-xs font-semibold text-suave">Paso {i + 1}</span>
            </div>
            <p className="mt-2 font-semibold">{titulo}</p>
            <p className="text-sm text-suave">{texto}</p>
          </div>
        ))}
      </div>
      {niveles.length > 0 && (
        <p className="border-t border-borde px-4 py-3 text-sm text-suave">
          <strong className="text-tinta">Hoy:</strong>{" "}
          {niveles.map((n) => `${n.referidos} ${n.referidos === 1 ? "contrata" : "contratan"} → ${textoNivel(n)}`).join(" · ")}.
          El descuento no se cobra solo: Mesitto no cobra en automático, lo aplicas tú.
        </p>
      )}
    </section>
  );
}

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
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Niveles del programa</h2>
          <p className="text-sm text-suave">
            Cuántos restaurantes invitados tienen que contratar para ganar cada descuento. Lo ya ganado no cambia si editas esto.
          </p>
        </div>
        <label className="flex items-center gap-2 rounded-full border border-borde px-3 py-1.5 text-sm">
          <Interruptor activo={activo} onChange={setActivo} etiqueta="Programa activo" />
          {activo ? "Activo" : "En pausa"}
        </label>
      </div>

      <ol className="space-y-3">
        {niveles.map((n, i) => (
          <li key={i} className="rounded-2xl border border-borde bg-stone-50 p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-marca text-xs font-bold text-white">
                {i + 1}
              </span>
              <p className="min-w-0 flex-1 text-sm font-medium">
                {n.referidos > 0 && n.porcentaje > 0
                  ? `Con ${n.referidos} ${n.referidos === 1 ? "invitado que contrata" : "invitados que contratan"}: ${textoNivel(n)}`
                  : "Completa los datos"}
              </p>
              <button
                type="button"
                className="text-xs text-suave hover:text-red-600"
                onClick={() => setNiveles((ns) => ns.filter((_, j) => j !== i))}
              >
                Quitar
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Campo etiqueta="Invitados que contratan">
                <input
                  type="number"
                  min={1}
                  value={n.referidos || ""}
                  onChange={(e) => cambiar(i, { referidos: Number(e.target.value) })}
                  className="campo py-2"
                />
              </Campo>
              <Campo etiqueta="Descuento (%)">
                <input
                  type="number"
                  min={1}
                  max={100}
                  step="0.5"
                  value={n.porcentaje || ""}
                  onChange={(e) => cambiar(i, { porcentaje: Number(e.target.value) })}
                  className="campo py-2"
                />
              </Campo>
              <Campo etiqueta="Cobros con descuento">
                <input
                  type="number"
                  min={1}
                  value={n.periodos ?? ""}
                  placeholder="siempre"
                  onChange={(e) => cambiar(i, { periodos: e.target.value ? Number(e.target.value) : null })}
                  className="campo py-2"
                />
              </Campo>
              <label className="flex items-end gap-2 pb-2.5 text-sm">
                <input type="checkbox" checked={n.prioridad} onChange={(e) => cambiar(i, { prioridad: e.target.checked })} />
                Acceso prioritario
              </label>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-xs text-suave">«Cobros con descuento» vacío = el descuento es para siempre.</p>

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
      className="tarjeta grid items-end gap-3 p-4 sm:grid-cols-[1fr_1fr_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        hacer(() => asignarReferente(id, ref), "Referente asignado");
        setId("");
        setRef("");
      }}
    >
      <Campo etiqueta="Restaurante invitado">
        <select value={id} onChange={(e) => setId(e.target.value)} required className="campo">
          <option value="">Elegir…</option>
          {filas.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nombre}
            </option>
          ))}
        </select>
      </Campo>
      <Campo etiqueta="Lo invitó">
        <select value={ref} onChange={(e) => setRef(e.target.value)} required className="campo">
          <option value="">Elegir…</option>
          {filas
            .filter((f) => f.id !== id)
            .map((f) => (
              <option key={f.id} value={f.slug}>
                {f.nombre}
              </option>
            ))}
        </select>
      </Campo>
      <button type="submit" className="boton" disabled={pendiente || !id || !ref}>
        Asignar
      </button>
    </form>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-suave">{etiqueta}</span>
      {children}
    </label>
  );
}

function Titulo({ icono, titulo, texto }: { icono: string; titulo: string; texto: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-500">
        <Icono nombre={icono} className="h-5 w-5" />
      </span>
      <div>
        <h2 className="font-semibold">{titulo}</h2>
        <p className="text-sm text-suave">{texto}</p>
      </div>
    </div>
  );
}

function Vacio({ texto }: { texto: string }) {
  return <p className="tarjeta p-6 text-center text-sm text-suave">{texto}</p>;
}

function Dato({ titulo, valor, icono, acento }: { titulo: string; valor: number; icono: string; acento?: boolean }) {
  return (
    <div className="tarjeta p-4">
      <div className="flex items-center gap-2">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-xl ${
            acento ? "bg-marca-claro text-marca-tinta" : "bg-stone-100 text-stone-500"
          }`}
        >
          <Icono nombre={icono} className="h-[18px] w-[18px]" />
        </span>
        <p className="text-xs text-suave">{titulo}</p>
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums">{valor}</p>
    </div>
  );
}
