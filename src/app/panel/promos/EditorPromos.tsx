"use client";

import { useMemo, useState } from "react";
import { Icono } from "@/components/Icono";
import { Interruptor } from "@/components/Interruptor";
import { useToast } from "@/components/Toast";
import { DIAS, describirDias, describirFechas, fechaPromo, horaPromo, promoVencida, promoVigente } from "@/lib/promos";
import { createClient } from "@/lib/supabase/client";
import type { Categoria, Plato, Promo, Restaurante } from "@/lib/types";
import { formatoPrecio, mensajeError } from "@/lib/utils";
import { revalidarCarta } from "../actions";

type PlatoCorto = Pick<Plato, "id" | "nombre" | "categoria_id" | "precio">;
type Borrador = Omit<Promo, "id" | "restaurante_id" | "orden"> & { id?: string };
// Siempre (todas las semanas), solo en días puntuales (26 de diciembre) o entre dos fechas.
type ModoFechas = "siempre" | "puntuales" | "rango";

const modoDe = (p: Partial<Borrador>): ModoFechas =>
  p.fechas?.length ? "puntuales" : p.fecha_desde || p.fecha_hasta ? "rango" : "siempre";

// Abre el calendario del navegador al tocar el campo (no solo el iconito).
const abrirCalendario = (e: React.MouseEvent<HTMLInputElement>) => {
  try {
    e.currentTarget.showPicker?.();
  } catch {
    // Algunos navegadores no lo permiten: queda el calendario normal del campo.
  }
};

const anio = new Date().getFullYear();

const NUEVA: Borrador = {
  nombre: "",
  descripcion: "",
  dias: [1, 2, 3, 4, 5],
  desde: "18:00",
  hasta: "20:00",
  descuento: 20,
  categorias: [],
  platos: [],
  activa: true,
};

// Ideas para empezar rápido.
const MODELOS: { texto: string; promo: Partial<Borrador> }[] = [
  { texto: "Happy hour", promo: { nombre: "Happy hour", dias: [1, 2, 3, 4, 5], desde: "18:00", hasta: "20:00", descuento: 30 } },
  {
    texto: "Menú del mediodía",
    promo: { nombre: "Mediodía", dias: [1, 2, 3, 4, 5], desde: "12:00", hasta: "15:00", descuento: 15 },
  },
  { texto: "Trasnoche", promo: { nombre: "Trasnoche", dias: [5, 6], desde: "23:00", hasta: "02:00", descuento: 20 } },
  {
    texto: "Fiestas de fin de año",
    promo: {
      nombre: "Fiestas",
      dias: [],
      desde: "12:00",
      hasta: "23:59",
      descuento: 15,
      fecha_desde: `${anio}-12-20`,
      fecha_hasta: `${anio}-12-31`,
    },
  },
  {
    texto: "Solo un aviso",
    promo: {
      nombre: "Música en vivo",
      descripcion: "Hoy desde las 21 h",
      dias: [6],
      desde: "18:00",
      hasta: "23:59",
      descuento: 0,
    },
  },
];

// Promos por horario: un descuento que se activa solo en los días y horas elegidos (o solo un aviso arriba de la carta).
export function EditorPromos({
  restaurante,
  zona,
  iniciales,
  categorias,
  platos,
  conFechas,
}: {
  restaurante: Restaurante;
  zona: string;
  iniciales: Promo[];
  // Migración 0041 ejecutada: se pueden elegir fechas puntuales o un rango.
  conFechas: boolean;
  categorias: Categoria[];
  platos: PlatoCorto[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const avisar = useToast();
  const [promos, setPromos] = useState(iniciales);
  const [editando, setEditando] = useState<Borrador | null>(null);
  const [modoFechas, setModoFechas] = useState<ModoFechas>("siempre");
  const abrir = (b: Borrador | null) => {
    setEditando(b);
    if (b) setModoFechas(modoDe(b));
  };
  const [guardando, setGuardando] = useState(false);
  const formato = (n: number) => formatoPrecio(n, restaurante.moneda);

  const alcance = (p: Pick<Promo, "categorias" | "platos">) => {
    if (!p.categorias.length && !p.platos.length) return "Toda la carta";
    const nombres = [
      ...categorias.filter((c) => p.categorias.includes(c.id)).map((c) => c.nombre),
      ...platos.filter((x) => p.platos.includes(x.id)).map((x) => x.nombre),
    ];
    return nombres.slice(0, 4).join(", ") + (nombres.length > 4 ? ` y ${nombres.length - 4} más` : "");
  };

  async function guardar() {
    if (!editando) return;
    if (!editando.nombre.trim()) return avisar("Ponle un nombre a la promo", "error");
    const fechas = modoFechas === "puntuales" ? [...new Set(editando.fechas ?? [])].sort() : [];
    const fechaDesde = modoFechas === "rango" ? editando.fecha_desde || null : null;
    const fechaHasta = modoFechas === "rango" ? editando.fecha_hasta || null : null;
    if (modoFechas === "puntuales" && !fechas.length) return avisar("Elige al menos una fecha en el calendario", "error");
    if (modoFechas === "rango" && !fechaDesde && !fechaHasta) return avisar("Elige desde y hasta qué fecha", "error");
    if (fechaDesde && fechaHasta && fechaHasta < fechaDesde) return avisar("La fecha final es antes que la inicial", "error");
    setGuardando(true);
    const datos = {
      nombre: editando.nombre.trim(),
      descripcion: editando.descripcion?.trim() || null,
      // En días puntuales manda la fecha: no se filtra por día de la semana.
      dias: modoFechas === "puntuales" ? [] : editando.dias,
      ...(conFechas ? { fechas, fecha_desde: fechaDesde, fecha_hasta: fechaHasta } : {}),
      desde: editando.desde,
      hasta: editando.hasta,
      descuento: Math.min(90, Math.max(0, Math.round(Number(editando.descuento) || 0))),
      categorias: editando.categorias,
      platos: editando.platos,
      activa: editando.activa,
    };
    const { data, error } = editando.id
      ? await supabase.from("promos").update(datos).eq("id", editando.id).select("*").single()
      : await supabase
          .from("promos")
          .insert({ ...datos, restaurante_id: restaurante.id, orden: promos.length })
          .select("*")
          .single();
    setGuardando(false);
    if (error) return avisar(mensajeError(error), "error");
    const guardada = data as Promo;
    setPromos((ps) => (editando.id ? ps.map((p) => (p.id === guardada.id ? guardada : p)) : [...ps, guardada]));
    abrir(null);
    avisar("Promo guardada");
    revalidarCarta();
  }

  async function alternar(p: Promo) {
    const { error } = await supabase.from("promos").update({ activa: !p.activa }).eq("id", p.id);
    if (error) return avisar(mensajeError(error), "error");
    setPromos((ps) => ps.map((x) => (x.id === p.id ? { ...x, activa: !p.activa } : x)));
    revalidarCarta();
  }

  async function borrar(p: Promo) {
    if (!confirm(`¿Borrar la promo «${p.nombre}»?`)) return;
    const { error } = await supabase.from("promos").delete().eq("id", p.id);
    if (error) return avisar(mensajeError(error), "error");
    setPromos((ps) => ps.filter((x) => x.id !== p.id));
    abrir(null);
    revalidarCarta();
  }

  const ejemplo = platos.find(
    (p) =>
      editando &&
      (editando.platos.includes(p.id) ||
        editando.categorias.includes(p.categoria_id) ||
        (!editando.platos.length && !editando.categorias.length)),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl font-bold">Promos</h1>
          <p className="text-sm text-suave">
            Se activan solas en los días, fechas y horas que elijas: la carta muestra el precio con descuento y la cocina cobra
            ese precio.
          </p>
        </div>
        <button type="button" className="boton" onClick={() => abrir({ ...NUEVA })}>
          <Icono nombre="mas_simple" className="h-4 w-4" /> Nueva promo
        </button>
      </header>

      {promos.length === 0 ? (
        <div className="tarjeta p-6 text-center">
          <p className="font-medium">Todavía no hay promos.</p>
          <p className="mt-1 text-sm text-suave">Empieza con una de estas ideas:</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {MODELOS.filter((m) => conFechas || !m.promo.fecha_desde).map((m) => (
              <button
                key={m.texto}
                type="button"
                className="boton-secundario"
                onClick={() => abrir({ ...NUEVA, ...m.promo })}
              >
                {m.texto}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {promos.map((p) => {
            const ahora = promoVigente(p, zona);
            const vencida = promoVencida(p, zona);
            const fechas = describirFechas(p);
            return (
              <li key={p.id} className={`tarjeta flex items-center gap-4 p-4 ${p.activa ? "" : "opacity-60"}`}>
                <span
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                    p.descuento ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"
                  }`}
                >
                  {p.descuento ? `-${p.descuento}%` : "Aviso"}
                </span>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => abrir({ ...p })}>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{p.nombre}</span>
                    {ahora && (
                      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
                        En horario ahora
                      </span>
                    )}
                    {vencida && (
                      <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-semibold text-stone-600">
                        Ya pasó su fecha
                      </span>
                    )}
                  </span>
                  <span className="block text-sm text-suave">
                    {fechas ? `${fechas} · ` : ""}
                    {p.fechas?.length ? "" : `${describirDias(p.dias)} · `}
                    {horaPromo(p.desde)} a {horaPromo(p.hasta)} · {alcance(p)}
                  </span>
                </button>
                <Interruptor activo={p.activa} onChange={() => alternar(p)} etiqueta={p.activa ? "Activa" : "Pausada"} />
              </li>
            );
          })}
        </ul>
      )}

      {editando && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
          onClick={() => abrir(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Editar promo"
            onClick={(e) => e.stopPropagation()}
            className="tarjeta max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-b-none p-5 sm:rounded-b-2xl"
          >
            <div className="mb-4 flex items-center gap-3">
              <h2 className="flex-1 text-lg font-semibold">{editando.id ? "Editar promo" : "Nueva promo"}</h2>
              <button
                type="button"
                onClick={() => abrir(null)}
                aria-label="Cerrar"
                className="rounded-lg p-1 hover:bg-stone-100"
              >
                <Icono nombre="cerrar" />
              </button>
            </div>
            <div className="space-y-4">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Nombre</span>
                <input
                  value={editando.nombre}
                  maxLength={40}
                  onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                  placeholder="Happy hour"
                  className="campo"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Detalle (opcional)</span>
                <input
                  value={editando.descripcion ?? ""}
                  maxLength={140}
                  onChange={(e) => setEditando({ ...editando, descripcion: e.target.value })}
                  placeholder="En todos los tragos de autor"
                  className="campo"
                />
              </label>
              {conFechas ? (
                <div>
                  <p className="mb-1 text-sm font-medium">¿Qué fechas?</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        ["siempre", "Todas las semanas"],
                        ["puntuales", "Días puntuales"],
                        ["rango", "Entre dos fechas"],
                      ] as [ModoFechas, string][]
                    ).map(([id, texto]) => (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={modoFechas === id}
                        onClick={() => setModoFechas(id)}
                        className={`rounded-lg border px-2 py-2 text-sm font-medium ${modoFechas === id ? "border-marca bg-marca text-white" : "border-borde"}`}
                      >
                        {texto}
                      </button>
                    ))}
                  </div>
                  {modoFechas === "puntuales" && (
                    <div className="mt-2 rounded-xl border border-borde p-3">
                      <label className="block text-sm">
                        <span className="mb-1 block text-suave">Toca para abrir el calendario y elige un día (puedes sumar varios)</span>
                        <input
                          type="date"
                          value=""
                          onClick={abrirCalendario}
                          onChange={(e) => {
                            const f = e.target.value;
                            if (f && !(editando.fechas ?? []).includes(f))
                              setEditando({ ...editando, fechas: [...(editando.fechas ?? []), f].sort() });
                          }}
                          className="campo"
                        />
                      </label>
                      {(editando.fechas ?? []).length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(editando.fechas ?? []).map((f) => (
                            <span
                              key={f}
                              className="inline-flex items-center gap-1 rounded-full bg-marca/10 py-0.5 pl-2.5 pr-1 text-sm font-semibold text-marca"
                            >
                              {fechaPromo(f, true)}
                              <button
                                type="button"
                                aria-label={`Quitar ${fechaPromo(f, true)}`}
                                onClick={() => setEditando({ ...editando, fechas: (editando.fechas ?? []).filter((x) => x !== f) })}
                                className="rounded-full px-1.5 text-base leading-none hover:bg-marca/20"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-suave">Todavía no elegiste ninguna fecha.</p>
                      )}
                    </div>
                  )}
                  {modoFechas === "rango" && (
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <label className="block text-sm">
                        <span className="mb-1 block text-suave">Desde el</span>
                        <input
                          type="date"
                          value={editando.fecha_desde ?? ""}
                          onClick={abrirCalendario}
                          onChange={(e) => setEditando({ ...editando, fecha_desde: e.target.value || null })}
                          className="campo"
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block text-suave">Hasta el</span>
                        <input
                          type="date"
                          value={editando.fecha_hasta ?? ""}
                          min={editando.fecha_desde ?? undefined}
                          onClick={abrirCalendario}
                          onChange={(e) => setEditando({ ...editando, fecha_hasta: e.target.value || null })}
                          className="campo"
                        />
                      </label>
                      <p className="col-span-2 -mt-1 text-xs text-suave">
                        Ambas fechas incluidas. Abajo puedes limitarla además a ciertos días de la semana.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="rounded-xl bg-stone-50 px-3 py-2 text-xs text-suave">
                  Para promos de un día puntual (ej. 26 de diciembre) o entre dos fechas, falta ejecutar el SQL{" "}
                  <code>0041_comensales_y_promos_por_fecha.sql</code> en Supabase.
                </p>
              )}
              {(!conFechas || modoFechas !== "puntuales") && (
              <div>
                <p className="mb-1 text-sm font-medium">Días</p>
                <div className="flex flex-wrap gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                    const activo = editando.dias.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={activo}
                        onClick={() =>
                          setEditando({
                            ...editando,
                            dias: activo ? editando.dias.filter((x) => x !== d) : [...editando.dias, d],
                          })
                        }
                        className={`w-12 rounded-lg border py-1.5 text-sm font-medium ${activo ? "border-marca bg-marca text-white" : "border-borde"}`}
                      >
                        {DIAS[d]}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 text-xs text-suave">{describirDias(editando.dias)}</p>
              </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Desde</span>
                  <input
                    type="time"
                    value={horaPromo(editando.desde)}
                    onChange={(e) => setEditando({ ...editando, desde: e.target.value })}
                    className="campo"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Hasta</span>
                  <input
                    type="time"
                    value={horaPromo(editando.hasta)}
                    onChange={(e) => setEditando({ ...editando, hasta: e.target.value })}
                    className="campo"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Descuento</span>
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={editando.descuento}
                      onChange={(e) => setEditando({ ...editando, descuento: Number(e.target.value) })}
                      className="campo"
                    />
                    %
                  </span>
                </label>
              </div>
              {editando.hasta < editando.desde && (
                <p className="-mt-2 text-xs text-suave">
                  Cruza la medianoche: termina al día siguiente a las {horaPromo(editando.hasta)}.
                </p>
              )}
              {editando.descuento === 0 && (
                <p className="-mt-2 text-xs text-suave">
                  Con 0 % no cambia ningún precio: solo se muestra el aviso arriba de la carta.
                </p>
              )}

              <div>
                <p className="mb-1 text-sm font-medium">¿En qué platos?</p>
                <p className="mb-2 text-xs text-suave">Sin elegir nada, vale para toda la carta.</p>
                <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-borde p-3">
                  {categorias.map((c) => {
                    const cat = editando.categorias.includes(c.id);
                    const suyos = platos.filter((p) => p.categoria_id === c.id);
                    return (
                      <div key={c.id}>
                        <label className="flex items-center gap-2 text-sm font-semibold">
                          <input
                            type="checkbox"
                            checked={cat}
                            onChange={() =>
                              setEditando({
                                ...editando,
                                categorias: cat ? editando.categorias.filter((x) => x !== c.id) : [...editando.categorias, c.id],
                                platos: editando.platos.filter((x) => !suyos.some((p) => p.id === x)),
                              })
                            }
                          />
                          {c.nombre} <span className="font-normal text-suave">(toda la categoría)</span>
                        </label>
                        {!cat && (
                          <div className="ml-6 mt-1 flex flex-wrap gap-1.5">
                            {suyos.map((p) => {
                              const sel = editando.platos.includes(p.id);
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  aria-pressed={sel}
                                  onClick={() =>
                                    setEditando({
                                      ...editando,
                                      platos: sel ? editando.platos.filter((x) => x !== p.id) : [...editando.platos, p.id],
                                    })
                                  }
                                  className={`rounded-full border px-2.5 py-0.5 text-xs ${sel ? "border-marca bg-marca/10 font-semibold text-marca" : "border-borde"}`}
                                >
                                  {p.nombre}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {ejemplo && editando.descuento > 0 && (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Ejemplo: {ejemplo.nombre} pasa de <s>{formato(Number(ejemplo.precio))}</s>{" "}
                  <strong>{formato(Math.round((Number(ejemplo.precio) * (100 - editando.descuento)) / 100))}</strong> en horario
                  de promo.
                </p>
              )}
            </div>
            <div className="mt-5 flex gap-2">
              {editando.id && (
                <button type="button" className="boton-secundario text-red-600" onClick={() => borrar(editando as Promo)}>
                  Borrar
                </button>
              )}
              <button type="button" className="boton ml-auto" disabled={guardando} onClick={guardar}>
                {guardando ? "Guardando…" : "Guardar promo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
