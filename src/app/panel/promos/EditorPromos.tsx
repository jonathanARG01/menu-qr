"use client";

import { useMemo, useState } from "react";
import { Icono } from "@/components/Icono";
import { Interruptor } from "@/components/Interruptor";
import { useToast } from "@/components/Toast";
import { DIAS, describirDias, horaPromo, promoVigente } from "@/lib/promos";
import { createClient } from "@/lib/supabase/client";
import type { Categoria, Plato, Promo, Restaurante } from "@/lib/types";
import { formatoPrecio, mensajeError } from "@/lib/utils";
import { revalidarCarta } from "../actions";

type PlatoCorto = Pick<Plato, "id" | "nombre" | "categoria_id" | "precio">;
type Borrador = Omit<Promo, "id" | "restaurante_id" | "orden"> & { id?: string };

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
}: {
  restaurante: Restaurante;
  zona: string;
  iniciales: Promo[];
  categorias: Categoria[];
  platos: PlatoCorto[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const avisar = useToast();
  const [promos, setPromos] = useState(iniciales);
  const [editando, setEditando] = useState<Borrador | null>(null);
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
    setGuardando(true);
    const datos = {
      nombre: editando.nombre.trim(),
      descripcion: editando.descripcion?.trim() || null,
      dias: editando.dias,
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
    setEditando(null);
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
    setEditando(null);
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
          <h1 className="text-2xl font-bold">Promos por horario</h1>
          <p className="text-sm text-suave">
            Se activan solas en los días y horas que elijas: la carta muestra el precio con descuento y la cocina cobra ese
            precio.
          </p>
        </div>
        <button type="button" className="boton" onClick={() => setEditando({ ...NUEVA })}>
          <Icono nombre="mas_simple" className="h-4 w-4" /> Nueva promo
        </button>
      </header>

      {promos.length === 0 ? (
        <div className="tarjeta p-6 text-center">
          <p className="font-medium">Todavía no hay promos.</p>
          <p className="mt-1 text-sm text-suave">Empieza con una de estas ideas:</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {MODELOS.map((m) => (
              <button
                key={m.texto}
                type="button"
                className="boton-secundario"
                onClick={() => setEditando({ ...NUEVA, ...m.promo })}
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
            return (
              <li key={p.id} className={`tarjeta flex items-center gap-4 p-4 ${p.activa ? "" : "opacity-60"}`}>
                <span
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                    p.descuento ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"
                  }`}
                >
                  {p.descuento ? `-${p.descuento}%` : "Aviso"}
                </span>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditando({ ...p })}>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{p.nombre}</span>
                    {ahora && (
                      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
                        En horario ahora
                      </span>
                    )}
                  </span>
                  <span className="block text-sm text-suave">
                    {describirDias(p.dias)} · {horaPromo(p.desde)} a {horaPromo(p.hasta)} · {alcance(p)}
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
          onClick={() => setEditando(null)}
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
                onClick={() => setEditando(null)}
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
