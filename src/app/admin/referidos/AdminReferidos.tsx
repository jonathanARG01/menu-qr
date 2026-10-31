"use client";

import { useMemo, useState, useTransition } from "react";
import { Icono } from "@/components/Icono";
import { Interruptor } from "@/components/Interruptor";
import { useToast } from "@/components/Toast";
import { CICLOS, NOMBRE_PLAN, PRECIO_PLAN, type Ciclo, type Plan } from "@/lib/planes";
import {
  NIVELES_BASE,
  calcularCobro,
  colorNivel,
  descuentoVigente,
  nombreNivel,
  textoNivel,
  type Descuento,
  type Nivel,
} from "@/lib/referidos";
import { formatoPrecio } from "@/lib/utils";
import { asignarReferente, cambiarCiclo, cambiarEstado, guardarNiveles, quitarDescuento, registrarCobro } from "./actions";

export type FilaReferidos = {
  id: string;
  slug: string;
  nombre: string;
  plan: string;
  ciclo: Ciclo;
  activo: boolean;
  referente_id: string | null;
  estado: "pendiente" | "confirmado" | "anulado" | null;
  confirmados: number;
  pendientes: number;
};

type Props = { filas: FilaReferidos[]; activo: boolean; niveles: Nivel[]; descuentos: Descuento[] };
type Hacer = (accion: () => Promise<string | null>, ok?: string) => void;

const nombrePlan = (plan: string) => NOMBRE_PLAN[plan as Plan] ?? plan;
const pesos = (n: number) => formatoPrecio(n, "CLP");
const meses = (n: number) => `${n} ${n === 1 ? "mes" : "meses"}`;

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

      <ComoFunciona />

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
          texto="Aquí ves cuánto cobrarle a cada uno en su próximo cobro, ya con el descuento de su período y el de referidos. Cuando le cobres, toca «Cobré» para gastar los meses de descuento que usó. Los permanentes no se gastan."
        />
        {conPrograma.length === 0 ? (
          <Vacio texto="Ningún restaurante invitó a otro todavía." />
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {conPrograma.map((f) => {
              const propios = descuentosDe(f.id);
              const vigente = descuentoVigente(propios);
              const pago = f.plan !== "free";
              const cobro = calcularCobro(f.plan, f.ciclo, propios);
              const gasta = cobro.detalle.some((d) => d.temporal);
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
                          : vigente.mesesPendientes > 0
                            ? `${meses(vigente.mesesPendientes)} con descuento`
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
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ring-1 ring-inset ${
                              usado ? "bg-stone-100 text-suave line-through ring-transparent" : colorNivel(d.nombre)
                            }`}
                          >
                            <strong>{nombreNivel(d)}</strong> {d.porcentaje} % ·{" "}
                            {d.periodos == null
                              ? "siempre"
                              : usado
                                ? "usado"
                                : `queda${d.periodos - d.periodos_usados > 1 ? "n" : ""} ${meses(d.periodos - d.periodos_usados)}`}
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
                  {pago && <DetalleCobro cobro={cobro} plan={f.plan} />}
                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-borde pt-4 text-sm">
                    <label className="flex items-center gap-2">
                      <span className="text-suave">Paga</span>
                      <select
                        value={f.ciclo}
                        disabled={pendiente}
                        onChange={(e) => hacer(() => cambiarCiclo(f.id, e.target.value))}
                        className="campo w-auto py-1.5"
                      >
                        {CICLOS.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.meses === 1 ? "por mes" : c.meses === 12 ? "por año" : `cada ${c.meses} meses`}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex-1" />
                    {pago && gasta && (
                      <button
                        type="button"
                        className="boton py-1.5"
                        disabled={pendiente}
                        onClick={() => {
                          if (confirm(`¿Le cobraste ${pesos(cobro.total)} a ${f.nombre}? Se gastan los meses de descuento de este cobro.`))
                            hacer(() => registrarCobro(f.id), "Listo: cobro anotado");
                        }}
                      >
                        <Icono nombre="check" className="h-4 w-4" />
                        Cobré {pesos(cobro.total)}
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

// Explicación en cuatro pasos y cómo se aplican los descuentos según cómo paga.
function ComoFunciona() {
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
      <div className="space-y-1.5 border-t border-borde px-4 py-3 text-sm text-suave">
        <p>
          <strong className="text-tinta">Los descuentos se cuentan en meses.</strong> Si paga por mes, se restan del próximo
          cobro. Si paga cada 3, 6 o 12 meses, primero va el descuento de ese período y después el de referidos, solo sobre
          los meses que cubre. Los permanentes se restan de todos los meses.
        </p>
        <p>Platovi no cobra en automático: abajo ves cuánto cobrarle a cada uno y lo anotas con «Cobré».</p>
      </div>
    </section>
  );
}

// Desglose del próximo cobro: lista → descuento del período → descuento de referidos → total.
function DetalleCobro({ cobro, plan }: { cobro: ReturnType<typeof calcularCobro>; plan: string }) {
  return (
    <dl className="mt-3 space-y-1 rounded-2xl bg-stone-50 px-4 py-3 text-sm">
      <p className="mb-1 text-xs font-semibold text-suave">
        Próximo cobro · plan {nombrePlan(plan)} · {meses(cobro.meses)}
      </p>
      <Linea texto={`Precio de lista (${meses(cobro.meses)})`} valor={pesos(cobro.lista)} />
      {cobro.descuentoCiclo > 0 && (
        <Linea texto={`Pago por ${meses(cobro.meses)} (−${cobro.porcentajeCiclo} %)`} valor={`−${pesos(cobro.descuentoCiclo)}`} />
      )}
      {cobro.detalle.map((d) => (
        <Linea
          key={d.nombre}
          texto={`${d.nombre}: ${d.porcentaje} % × ${meses(d.meses)}`}
          valor={`−${pesos(Math.round((cobro.base / cobro.meses) * (d.porcentaje / 100) * d.meses))}`}
          acento
        />
      ))}
      <div className="flex items-baseline justify-between border-t border-borde pt-1.5 font-semibold">
        <dt>A cobrar</dt>
        <dd className="tabular-nums">{pesos(cobro.total)}</dd>
      </div>
    </dl>
  );
}

function Linea({ texto, valor, acento }: { texto: string; valor: string; acento?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${acento ? "text-emerald-700" : "text-suave"}`}>
      <dt>{texto}</dt>
      <dd className="shrink-0 tabular-nums">{valor}</dd>
    </div>
  );
}

// Lo que ahorra un local Pro con un nivel, pagando por mes y por año, para ver de un vistazo qué estás regalando.
function EjemploNivel({ n }: { n: Nivel }) {
  if (!(n.referidos > 0 && n.porcentaje > 0)) return null;
  const desc: Descuento = {
    id: "x",
    restaurante_id: "x",
    nombre: n.nombre,
    referidos: n.referidos,
    porcentaje: n.porcentaje,
    periodos: n.periodos,
    periodos_usados: 0,
    prioridad: n.prioridad,
    created_at: "",
  };
  const mes = calcularCobro("pro", "mensual", [desc]);
  const anio = calcularCobro("pro", "anual", [desc]);
  // En mensual, un temporal se reparte en varios cobros: el ahorro total es por mes × meses.
  const ahorroMes = mes.descuentoReferidos * (n.periodos == null ? 1 : n.periodos);
  return (
    <p className="mt-2 text-xs text-suave">
      Ejemplo plan Pro ({pesos(PRECIO_PLAN.pro)}/mes):{" "}
      {n.periodos == null ? (
        <>
          paga {pesos(mes.total)} por mes o {pesos(anio.total)} por año (en vez de {pesos(anio.base)}).
        </>
      ) : (
        <>
          por mes ahorra {pesos(ahorroMes)} en total; por año se le cobran {pesos(anio.total)} en vez de {pesos(anio.base)}.
        </>
      )}
    </p>
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

  // Lo que la base rechazaría, avisado antes de guardar.
  const repetidos = new Set(niveles.map((n) => n.referidos).filter((r, i, rs) => rs.indexOf(r) !== i));
  const problema = niveles.some((n) => !n.nombre.trim())
    ? "Cada nivel necesita un nombre."
    : niveles.some((n) => !(n.referidos >= 1) || !(n.porcentaje > 0 && n.porcentaje <= 100))
      ? "Revisa los números: al menos 1 invitado y un descuento de 1 a 100 %."
      : repetidos.size > 0
        ? "Dos niveles no pueden pedir la misma cantidad de invitados."
        : null;
  const cambios = JSON.stringify(niveles) !== JSON.stringify(iniciales) || activo !== activoInicial;

  function guardar() {
    const orden = [...niveles].map((n) => ({ ...n, nombre: n.nombre.trim() })).sort((a, b) => a.referidos - b.referidos);
    setNiveles(orden);
    hacer(() => guardarNiveles(activo, orden), "Niveles guardados");
  }

  return (
    <section className="tarjeta space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Niveles del programa</h2>
          <p className="text-sm text-suave">
            Cuántos invitados tienen que contratar para subir de nivel y qué gana en cada uno. Lo ya ganado no cambia si
            editas esto.
          </p>
        </div>
        <label className="flex items-center gap-2 rounded-full border border-borde px-3 py-1.5 text-sm">
          <Interruptor activo={activo} onChange={setActivo} etiqueta="Programa activo" />
          {activo ? "Activo" : "En pausa"}
        </label>
      </div>

      <ol className="space-y-3">
        {niveles.map((n, i) => {
          const permanente = n.periodos == null;
          return (
            <li key={i} className="rounded-2xl border border-borde bg-stone-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${colorNivel(n.nombre)}`}
                >
                  <Icono nombre="estrella" className="h-4 w-4" />
                  {n.nombre.trim() || "Sin nombre"}
                </span>
                <p className="min-w-0 flex-1 text-sm font-medium">
                  {n.referidos > 0 && n.porcentaje > 0
                    ? `Desde ${n.referidos} ${n.referidos === 1 ? "invitado que contrata" : "invitados que contratan"}: ${textoNivel(n)}`
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
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-[1.3fr_1fr_1fr_1.6fr]">
                <Campo etiqueta="Nombre">
                  <input
                    value={n.nombre}
                    maxLength={30}
                    placeholder="Ej.: Oro"
                    onChange={(e) => cambiar(i, { nombre: e.target.value })}
                    className="campo py-2"
                  />
                </Campo>
                <Campo etiqueta="Invitados que contratan">
                  <input
                    type="number"
                    min={1}
                    value={n.referidos || ""}
                    onChange={(e) => cambiar(i, { referidos: Number(e.target.value) })}
                    className={`campo py-2 ${repetidos.has(n.referidos) ? "border-red-400" : ""}`}
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
                <Campo etiqueta="Por cuánto tiempo">
                  <div className="flex gap-2">
                    <select
                      value={permanente ? "siempre" : "meses"}
                      onChange={(e) => cambiar(i, { periodos: e.target.value === "siempre" ? null : (n.periodos ?? 1) })}
                      className="campo py-2"
                    >
                      <option value="meses">Meses</option>
                      <option value="siempre">Para siempre</option>
                    </select>
                    {!permanente && (
                      <input
                        type="number"
                        min={1}
                        value={n.periodos ?? ""}
                        aria-label="Meses con descuento"
                        onChange={(e) => cambiar(i, { periodos: Math.max(1, Number(e.target.value) || 1) })}
                        className="campo w-20 py-2"
                      />
                    )}
                  </div>
                </Campo>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={n.prioridad} onChange={(e) => cambiar(i, { prioridad: e.target.checked })} />
                  Acceso prioritario a las mejoras
                </label>
                {n.porcentaje !== 100 && (
                  <button type="button" className="text-xs text-marca-tinta hover:underline" onClick={() => cambiar(i, { porcentaje: 100 })}>
                    Hacerlo gratis (100 %)
                  </button>
                )}
              </div>
              <EjemploNivel n={n} />
            </li>
          );
        })}
      </ol>

      {problema && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{problema}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="boton-secundario"
          onClick={() =>
            setNiveles((ns) => [
              ...ns,
              {
                nombre: "",
                referidos: Math.max(0, ...ns.map((n) => n.referidos)) + 1,
                porcentaje: 10,
                periodos: 1,
                prioridad: false,
              },
            ])
          }
        >
          + Nivel
        </button>
        <button
          type="button"
          className="text-sm text-suave hover:text-tinta"
          onClick={() => {
            if (confirm("¿Volver a Bronce, Plata, Oro, Diamante y Platino? Se pierden los cambios sin guardar."))
              setNiveles(NIVELES_BASE);
          }}
        >
          Volver a los valores sugeridos
        </button>
        <div className="flex-1" />
        <button type="button" className="boton" disabled={pendiente || !!problema || !cambios} onClick={guardar}>
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
