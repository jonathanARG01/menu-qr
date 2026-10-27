"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createClient } from "@/lib/supabase/client";
import type { Categoria, Plato, Restaurante } from "@/lib/types";
import { formatoPrecio, mensajeError } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { Interruptor } from "@/components/Interruptor";
import { Icono } from "@/components/Icono";
import { revalidarCarta } from "./actions";
import { PlatoModal } from "./PlatoModal";
import { IDIOMAS_EXTRA, IDIOMA_EN_ESPANOL } from "@/lib/i18n";
import { imagenDefecto } from "@/components/carta/comun";
import Link from "next/link";

type Props = {
  restaurante: Restaurante;
  // Pantallas de preparación (Cocina, Barra…) si el restaurante usa la pantalla de cocina.
  estaciones?: string[];
  categoriasIniciales: Categoria[];
  platosIniciales: Plato[];
};

type ModalEstado = { plato: Plato | null; categoriaId: string } | null;

export function EditorCarta({ restaurante, estaciones, categoriasIniciales, platosIniciales }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const avisar = useToast();
  const [categorias, setCategorias] = useState(categoriasIniciales);
  const [platos, setPlatos] = useState(platosIniciales);
  const [modal, setModal] = useState<ModalEstado>(null);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [cerradas, setCerradas] = useState<Set<string>>(new Set());
  const [traduciendo, setTraduciendo] = useState<Categoria | null>(null);
  const idiomas = IDIOMAS_EXTRA.filter((i) => restaurante.idiomas?.includes(i));

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Ejecuta una escritura, avisa del resultado y refresca la carta pública.
  async function guardar(promesa: PromiseLike<{ error: unknown }>, ok?: string, deshacer?: () => void) {
    const { error } = await promesa;
    if (error) {
      deshacer?.();
      avisar(mensajeError(error), "error");
      return false;
    }
    if (ok) avisar(ok);
    revalidarCarta();
    return true;
  }

  async function guardarOrden<T extends { id: string; orden: number }>(tabla: "categorias" | "platos", lista: T[]) {
    const cambios = lista.map((item, i) => ({ id: item.id, orden: i })).filter((c, i) => lista[i].orden !== c.orden);
    const resultados = await Promise.all(cambios.map((c) => supabase.from(tabla).update({ orden: c.orden }).eq("id", c.id)));
    const fallo = resultados.find((r) => r.error);
    if (fallo) avisar(mensajeError(fallo.error), "error");
    else revalidarCarta();
  }

  // ── Categorías ──────────────────────────────

  async function agregarCategoria(e: React.FormEvent) {
    e.preventDefault();
    const nombre = nuevaCategoria.trim();
    if (!nombre) return;
    const { data, error } = await supabase
      .from("categorias")
      .insert({ restaurante_id: restaurante.id, nombre, orden: categorias.length })
      .select()
      .single();
    if (error) return avisar(mensajeError(error), "error");
    setCategorias((c) => [...c, data as Categoria]);
    setNuevaCategoria("");
    revalidarCarta();
  }

  function actualizarCategoria(id: string, cambios: Partial<Categoria>) {
    const antes = categorias;
    setCategorias((c) => c.map((x) => (x.id === id ? { ...x, ...cambios } : x)));
    return guardar(supabase.from("categorias").update(cambios).eq("id", id), "Guardado", () => setCategorias(antes));
  }

  async function borrarCategoria(cat: Categoria) {
    const cuantos = platos.filter((p) => p.categoria_id === cat.id).length;
    const texto = cuantos
      ? `¿Borrar "${cat.nombre}" y sus ${cuantos} platos? No se puede deshacer.`
      : `¿Borrar la categoría "${cat.nombre}"?`;
    if (!confirm(texto)) return;
    const ok = await guardar(supabase.from("categorias").delete().eq("id", cat.id), "Categoría borrada");
    if (ok) {
      setCategorias((c) => c.filter((x) => x.id !== cat.id));
      setPlatos((p) => p.filter((x) => x.categoria_id !== cat.id));
    }
  }

  function alSoltarCategoria({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const desde = categorias.findIndex((c) => c.id === active.id);
    const hasta = categorias.findIndex((c) => c.id === over.id);
    const nueva = arrayMove(categorias, desde, hasta);
    setCategorias(nueva.map((c, i) => ({ ...c, orden: i })));
    guardarOrden("categorias", nueva);
  }

  // ── Platos ──────────────────────────────────

  function actualizarPlato(id: string, cambios: Partial<Plato>, ok = "Guardado") {
    const antes = platos;
    setPlatos((p) => p.map((x) => (x.id === id ? { ...x, ...cambios } : x)));
    return guardar(supabase.from("platos").update(cambios).eq("id", id), ok, () => setPlatos(antes));
  }

  function alSoltarPlato(categoriaId: string) {
    return ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return;
      const deCategoria = platos.filter((p) => p.categoria_id === categoriaId);
      const desde = deCategoria.findIndex((p) => p.id === active.id);
      const hasta = deCategoria.findIndex((p) => p.id === over.id);
      const nueva = arrayMove(deCategoria, desde, hasta);
      const orden = new Map(nueva.map((p, i) => [p.id, i]));
      setPlatos((todos) =>
        [...todos.map((p) => (orden.has(p.id) ? { ...p, orden: orden.get(p.id)! } : p))].sort((a, b) => a.orden - b.orden),
      );
      guardarOrden("platos", nueva);
    };
  }

  function alGuardarModal(plato: Plato, esNuevo: boolean) {
    setPlatos((p) => (esNuevo ? [...p, plato] : p.map((x) => (x.id === plato.id ? plato : x))).sort((a, b) => a.orden - b.orden));
    setModal(null);
    avisar(esNuevo ? "Plato añadido" : "Plato guardado");
    revalidarCarta();
  }

  function alBorrarModal(id: string) {
    setPlatos((p) => p.filter((x) => x.id !== id));
    setModal(null);
    avisar("Plato borrado");
    revalidarCarta();
  }

  function alternar(id: string) {
    setCerradas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  // Lleva a una categoría desde los chips de arriba (y la abre si estaba plegada).
  function irACategoria(id: string) {
    setCerradas((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
    requestAnimationFrame(() =>
      document.getElementById(`categoria-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Carta</h1>
            <p className="text-sm text-suave">
              <span className="font-semibold text-amber-600">{platos.length} platos</span> en {categorias.length}{" "}
              {categorias.length === 1 ? "categoría" : "categorías"}
            </p>
          </div>
          {categorias.length > 0 && (
            <button type="button" onClick={() => setModal({ plato: null, categoriaId: categorias[0].id })} className="boton">
              + Nuevo plato
            </button>
          )}
        </div>

        {categorias.length > 1 && <ChipsCategorias categorias={categorias} platos={platos} onElegir={irACategoria} />}

        {categorias.length === 0 && (
          <div className="tarjeta p-6 text-center">
            <p className="font-semibold">Tu carta está vacía</p>
            <p className="mt-1 text-sm text-suave">Empieza creando una categoría, por ejemplo “Entradas” o “Bebidas”.</p>
          </div>
        )}

        <DndContext id="categorias" sensors={sensores} collisionDetection={closestCenter} onDragEnd={alSoltarCategoria}>
          <SortableContext items={categorias.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {categorias.map((cat) => {
              const deCategoria = platos.filter((p) => p.categoria_id === cat.id);
              return (
                <BloqueCategoria
                  key={cat.id}
                  categoria={cat}
                  cantidad={deCategoria.length}
                  cerrada={cerradas.has(cat.id)}
                  onAlternar={() => alternar(cat.id)}
                  onRenombrar={(nombre) => actualizarCategoria(cat.id, { nombre })}
                  onTraducir={idiomas.length ? () => setTraduciendo(cat) : undefined}
                  onVisible={(visible) => actualizarCategoria(cat.id, { visible })}
                  estaciones={cat.estacion !== undefined ? estaciones : undefined}
                  onEstacion={(estacion) => actualizarCategoria(cat.id, { estacion })}
                  onBorrar={() => borrarCategoria(cat)}
                >
                  <DndContext
                    id={`platos-${cat.id}`}
                    sensors={sensores}
                    collisionDetection={closestCenter}
                    onDragEnd={alSoltarPlato(cat.id)}
                  >
                    <SortableContext items={deCategoria.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                      <ul className="divide-y divide-borde">
                        {deCategoria.map((plato) => (
                          <FilaPlato
                            key={plato.id}
                            plato={plato}
                            moneda={restaurante.moneda}
                            onPrecio={(precio) => actualizarPlato(plato.id, { precio }, "Precio actualizado")}
                            onDisponible={(disponible) =>
                              actualizarPlato(
                                plato.id,
                                { disponible },
                                disponible ? "Visible en la carta" : "Marcado como agotado",
                              )
                            }
                            onDestacar={
                              "destacado" in plato
                                ? (destacado) =>
                                    actualizarPlato(
                                      plato.id,
                                      { destacado },
                                      destacado ? "Ahora sale en Destacados" : "Quitado de Destacados",
                                    )
                                : undefined
                            }
                            onEditar={() => setModal({ plato, categoriaId: cat.id })}
                          />
                        ))}
                      </ul>
                    </SortableContext>
                  </DndContext>
                  <button
                    type="button"
                    onClick={() => setModal({ plato: null, categoriaId: cat.id })}
                    className="w-full border-t border-borde px-4 py-3 text-left text-sm font-medium text-marca hover:bg-stone-50"
                  >
                    + Añadir plato
                  </button>
                </BloqueCategoria>
              );
            })}
          </SortableContext>
        </DndContext>

        <form onSubmit={agregarCategoria} className="flex gap-2">
          <input
            value={nuevaCategoria}
            onChange={(e) => setNuevaCategoria(e.target.value)}
            placeholder="Nueva categoría"
            maxLength={60}
            className="campo"
            aria-label="Nombre de la nueva categoría"
          />
          <button type="submit" className="boton shrink-0" disabled={!nuevaCategoria.trim()}>
            Añadir
          </button>
        </form>

        {traduciendo && (
          <TraducirCategoria
            categoria={traduciendo}
            idiomas={idiomas}
            onCerrar={() => setTraduciendo(null)}
            onGuardar={(traducciones) => {
              actualizarCategoria(traduciendo.id, { traducciones });
              setTraduciendo(null);
            }}
          />
        )}

        {modal && (
          <PlatoModal
            restaurante={restaurante}
            categorias={categorias}
            plato={modal.plato}
            categoriaId={modal.categoriaId}
            contarPlatos={(id) => platos.filter((p) => p.categoria_id === id).length}
            onCerrar={() => setModal(null)}
            onGuardado={alGuardarModal}
            onBorrado={alBorrarModal}
          />
        )}
      </div>
      <ResumenCarta restaurante={restaurante} platos={platos} />
    </div>
  );
}

// Fila de categorías con la foto de su primer plato (o la ilustración por defecto), como accesos rápidos.
function ChipsCategorias({
  categorias,
  platos,
  onElegir,
}: {
  categorias: Categoria[];
  platos: Plato[];
  onElegir: (id: string) => void;
}) {
  return (
    <div className="sin-barra -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {categorias.map((cat) => {
        const deCategoria = platos.filter((p) => p.categoria_id === cat.id);
        const conFoto = deCategoria.find((p) => p.foto_url);
        const primero = deCategoria[0];
        const imagen = conFoto?.foto_url ?? (primero ? imagenDefecto(primero.nombre, primero.descripcion) : null);
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onElegir(cat.id)}
            className="group flex w-20 shrink-0 flex-col items-center gap-1.5 text-center"
          >
            <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-borde bg-stone-100 shadow-sm ring-marca-claro/70 transition group-hover:ring-2">
              {imagen ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagen}
                  alt=""
                  className={conFoto ? "h-full w-full object-cover" : "h-[70%] w-[70%] object-contain drop-shadow"}
                />
              ) : (
                <span className="text-lg font-bold text-suave">{cat.nombre.charAt(0)}</span>
              )}
            </span>
            <span className="w-full truncate text-xs font-medium">{cat.nombre}</span>
          </button>
        );
      })}
    </div>
  );
}

// Columna derecha en pantallas anchas: cómo está la carta de un vistazo y atajos a lo que se hace después.
function ResumenCarta({ restaurante, platos }: { restaurante: Restaurante; platos: Plato[] }) {
  const visibles = platos.filter((p) => p.disponible).length;
  const datos = [
    { texto: "Visibles", valor: visibles, color: "text-emerald-600" },
    { texto: "Agotados", valor: platos.length - visibles, color: "text-red-600" },
    { texto: "Destacados", valor: platos.filter((p) => p.destacado).length, color: "text-amber-600" },
    { texto: "Sin foto", valor: platos.filter((p) => !p.foto_url).length, color: "text-sky-600" },
  ];
  const precios = platos.map((p) => Number(p.precio)).filter((n) => n > 0);
  const promedio = precios.length ? precios.reduce((a, b) => a + b, 0) / precios.length : 0;
  const atajos = [
    { href: "/panel/marca", texto: "Cambiar el diseño", icono: "marca" },
    { href: "/panel/qr", texto: "Imprimir los QR", icono: "qr" },
    { href: "/panel/promos", texto: "Crear una promo", icono: "promos" },
  ];

  return (
    <aside className="hidden xl:block">
      <div className="tarjeta sticky top-4 overflow-hidden">
        <div className="bg-stone-100 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-suave">Resumen</p>
          <p className="mt-1 truncate text-lg font-bold">{restaurante.nombre}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 p-4">
          {datos.map((d) => (
            <div key={d.texto} className="rounded-2xl bg-stone-100 px-3 py-2.5">
              <p className={`text-xl font-bold tabular-nums ${d.color}`}>{d.valor}</p>
              <p className="text-xs text-suave">{d.texto}</p>
            </div>
          ))}
        </div>
        {/* Corte tipo ticket */}
        <div className="relative px-4" aria-hidden>
          <span className="absolute top-1/2 -left-3 h-6 w-6 -translate-y-1/2 rounded-full bg-fondo" />
          <span className="absolute top-1/2 -right-3 h-6 w-6 -translate-y-1/2 rounded-full bg-fondo" />
          <div className="border-t border-dashed border-borde" />
        </div>
        <dl className="space-y-2 px-5 py-4 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-suave">Precio promedio</dt>
            <dd className="font-semibold tabular-nums">{formatoPrecio(Math.round(promedio), restaurante.moneda)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-suave">Precio más alto</dt>
            <dd className="font-semibold tabular-nums">
              {formatoPrecio(precios.length ? Math.max(...precios) : 0, restaurante.moneda)}
            </dd>
          </div>
        </dl>
        <div className="space-y-1.5 border-t border-borde p-3">
          {atajos.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm font-medium hover:bg-stone-100"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 text-suave">
                <Icono nombre={a.icono} className="h-4 w-4" />
              </span>
              {a.texto}
            </Link>
          ))}
          <a href={`/${restaurante.slug}`} target="_blank" className="boton-acento mt-2 w-full rounded-2xl py-3">
            Ver carta pública
          </a>
        </div>
      </div>
    </aside>
  );
}

function Asa(props: React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label="Arrastrar para reordenar"
      className="flex h-9 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded text-stone-400 hover:bg-stone-100 active:cursor-grabbing"
      {...props}
    >
      <svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor" aria-hidden>
        {[3, 9, 15].map((y) => (
          <g key={y}>
            <circle cx="3" cy={y} r="1.6" />
            <circle cx="9" cy={y} r="1.6" />
          </g>
        ))}
      </svg>
    </button>
  );
}

function BloqueCategoria({
  categoria,
  cantidad,
  cerrada,
  onAlternar,
  onRenombrar,
  onTraducir,
  onVisible,
  estaciones,
  onEstacion,
  onBorrar,
  children,
}: {
  categoria: Categoria;
  cantidad: number;
  cerrada: boolean;
  onAlternar: () => void;
  onRenombrar: (nombre: string) => void;
  onTraducir?: () => void;
  onVisible: (visible: boolean) => void;
  estaciones?: string[];
  onEstacion: (estacion: string) => void;
  onBorrar: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: categoria.id });
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(categoria.nombre);

  function terminar() {
    setEditando(false);
    const limpio = nombre.trim();
    if (limpio && limpio !== categoria.nombre) onRenombrar(limpio);
    else setNombre(categoria.nombre);
  }

  return (
    <section
      id={`categoria-${categoria.id}`}
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`tarjeta scroll-mt-4 overflow-hidden ${isDragging ? "relative z-10 shadow-xl" : ""} ${categoria.visible ? "" : "opacity-70"}`}
    >
      <div className="flex items-center gap-1 bg-stone-50 px-2 py-2">
        <Asa {...attributes} {...listeners} />
        {editando ? (
          <input
            autoFocus
            value={nombre}
            maxLength={60}
            onChange={(e) => setNombre(e.target.value)}
            onBlur={terminar}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setNombre(categoria.nombre);
                setEditando(false);
              }
            }}
            className="campo py-1.5"
            aria-label="Nombre de la categoría"
          />
        ) : (
          <button type="button" onClick={onAlternar} className="min-w-0 flex-1 truncate py-1.5 text-left font-semibold">
            <span className={`mr-1 inline-block text-xs text-suave transition ${cerrada ? "-rotate-90" : ""}`}>▼</span>
            {categoria.nombre}
            <span className="ml-2 text-xs font-normal text-suave">{cantidad}</span>
            {!categoria.visible && <span className="ml-2 rounded bg-stone-200 px-1.5 py-0.5 text-xs font-normal">Oculta</span>}
          </button>
        )}
        {estaciones && estaciones.length > 1 && !editando && (
          <select
            value={categoria.estacion}
            onChange={(e) => onEstacion(e.target.value)}
            title="Pantalla donde llegan las comandas de esta categoría"
            aria-label={`Pantalla de ${categoria.nombre}`}
            className="max-w-28 rounded-lg border border-borde bg-superficie px-2 py-1 text-xs text-suave"
          >
            {[...new Set([...estaciones, categoria.estacion ?? "Cocina"])].map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        )}
        <Menu
          opciones={[
            { texto: "Cambiar nombre", accion: () => setEditando(true) },
            ...(onTraducir ? [{ texto: "Traducir nombre", accion: onTraducir }] : []),
            {
              texto: categoria.visible ? "Ocultar de la carta" : "Mostrar en la carta",
              accion: () => onVisible(!categoria.visible),
            },
            { texto: "Borrar categoría", accion: onBorrar, peligro: true },
          ]}
        />
      </div>
      {!cerrada && children}
    </section>
  );
}

function FilaPlato({
  plato,
  moneda,
  onPrecio,
  onDisponible,
  onDestacar,
  onEditar,
}: {
  plato: Plato;
  moneda: string;
  onPrecio: (precio: number) => void;
  onDisponible: (v: boolean) => void;
  // Solo si ya existe la columna (migración 0007).
  onDestacar?: (v: boolean) => void;
  onEditar: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: plato.id });
  const [precio, setPrecio] = useState(String(plato.precio));
  useEffect(() => setPrecio(String(plato.precio)), [plato.precio]);

  function guardarPrecio() {
    const valor = Number(precio.replace(",", "."));
    if (!Number.isFinite(valor) || valor < 0) {
      setPrecio(String(plato.precio));
      return;
    }
    if (valor !== Number(plato.precio)) onPrecio(Math.round(valor * 100) / 100);
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`flex items-center gap-2 bg-superficie px-2 py-2 ${isDragging ? "relative z-10 shadow-lg" : ""}`}
    >
      <Asa {...attributes} {...listeners} />
      <button type="button" onClick={onEditar} className="flex min-w-0 flex-1 items-center gap-2.5 text-left sm:gap-3">
        {plato.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={plato.foto_url} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover sm:h-11 sm:w-11" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-400 sm:h-11 sm:w-11">
            ◌
          </span>
        )}
        <span className="min-w-0">
          <span className={`block truncate font-medium ${plato.disponible ? "" : "text-suave line-through"}`}>
            {plato.nombre}
          </span>
          <span className="block truncate text-xs text-suave">
            {plato.disponible ? plato.descripcion || formatoPrecio(plato.precio, moneda) : "Agotado · no sale en la carta"}
          </span>
        </span>
      </button>
      <input
        inputMode="decimal"
        value={precio}
        onChange={(e) => setPrecio(e.target.value)}
        onBlur={guardarPrecio}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        onFocus={(e) => e.currentTarget.select()}
        aria-label={`Precio de ${plato.nombre}`}
        className="w-16 shrink-0 rounded-lg border border-borde px-2 py-1.5 sm:w-20 text-right text-sm tabular-nums outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
      />
      {onDestacar && (
        <button
          type="button"
          onClick={() => onDestacar(!plato.destacado)}
          aria-pressed={!!plato.destacado}
          aria-label={plato.destacado ? `Quitar ${plato.nombre} de Destacados` : `Destacar ${plato.nombre}`}
          title={plato.destacado ? "Destacado en la carta" : "Destacar en la carta"}
          className={`shrink-0 rounded-lg px-1.5 py-1 text-xl leading-none transition ${
            plato.destacado ? "text-amber-500" : "text-stone-300 hover:text-amber-400"
          }`}
        >
          {plato.destacado ? "★" : "☆"}
        </button>
      )}
      <Interruptor activo={plato.disponible} onChange={onDisponible} etiqueta={plato.disponible ? "Disponible" : "Agotado"} />
    </li>
  );
}

function Menu({ opciones }: { opciones: { texto: string; accion: () => void; peligro?: boolean }[] }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Opciones"
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-xl leading-none text-suave hover:bg-stone-200"
      >
        ⋯
      </button>
      {abierto && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setAbierto(false)} />
          <div className="absolute right-0 z-40 mt-1 w-52 overflow-hidden rounded-xl border border-borde bg-superficie py-1 shadow-xl">
            {opciones.map((o) => (
              <button
                key={o.texto}
                type="button"
                onClick={() => {
                  setAbierto(false);
                  o.accion();
                }}
                className={`block w-full px-4 py-2.5 text-left text-sm hover:bg-stone-50 ${o.peligro ? "text-red-600" : ""}`}
              >
                {o.texto}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TraducirCategoria({
  categoria,
  idiomas,
  onCerrar,
  onGuardar,
}: {
  categoria: Categoria;
  idiomas: string[];
  onCerrar: () => void;
  onGuardar: (traducciones: NonNullable<Categoria["traducciones"]>) => void;
}) {
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(idiomas.map((i) => [i, categoria.traducciones?.[i]?.nombre ?? ""])),
  );

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    onGuardar({
      ...categoria.traducciones,
      ...Object.fromEntries(idiomas.map((i) => [i, { ...categoria.traducciones?.[i], nombre: valores[i].trim() || undefined }])),
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onCerrar}>
      <form
        onSubmit={guardar}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Traducir ${categoria.nombre}`}
        className="w-full max-w-sm space-y-4 rounded-t-2xl bg-superficie p-5 shadow-2xl sm:rounded-2xl"
      >
        <h2 className="text-lg font-semibold">Traducir “{categoria.nombre}”</h2>
        {idiomas.map((i) => (
          <label key={i} className="block">
            <span className="etiqueta-campo">{IDIOMA_EN_ESPANOL[i as keyof typeof IDIOMA_EN_ESPANOL]}</span>
            <input
              value={valores[i]}
              maxLength={60}
              onChange={(e) => setValores((v) => ({ ...v, [i]: e.target.value }))}
              placeholder={categoria.nombre}
              className="campo"
            />
          </label>
        ))}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCerrar} className="boton-secundario">
            Cancelar
          </button>
          <button type="submit" className="boton">
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}
