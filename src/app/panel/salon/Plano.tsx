"use client";

import { useRef, useState } from "react";
import { ELEMENTOS, type Elemento, type Piso } from "@/lib/salon";
import type { Mesa } from "@/lib/types";

export type Caja = { x: number; y: number; ancho: number; alto: number };
export type Seleccion = { tipo: "mesa" | "elemento"; id: string } | null;

// Estado de cada mesa para pintarla en el plano.
export type EstadoMesa = {
  ocupada: boolean;
  comensales?: number;
  minutos?: number;
  total?: number;
  listo?: boolean;
  pendiente?: boolean;
  aviso?: "cuenta" | "mozo" | null;
};

export const cajaMesa = (m: Mesa): Caja => ({ x: m.x ?? 0, y: m.y ?? 0, ancho: m.ancho ?? 2, alto: m.alto ?? 2 });

const seTocan = (a: Caja, b: Caja) => a.x < b.x + b.ancho && b.x < a.x + a.ancho && a.y < b.y + b.alto && b.y < a.y + a.alto;

// ¿Se puede poner esta caja aquí? No puede salirse del piso ni pisar otra mesa o un pasillo, pared, barra…
export function lugarLibre(caja: Caja, piso: Piso, mesas: Mesa[], ignorar?: string) {
  if (caja.x < 0 || caja.y < 0 || caja.x + caja.ancho > piso.columnas || caja.y + caja.alto > piso.filas) return false;
  if (mesas.some((m) => m.id !== ignorar && m.piso_id === piso.id && seTocan(caja, cajaMesa(m)))) return false;
  return !piso.elementos.some((e) => e.id !== ignorar && ELEMENTOS[e.tipo]?.bloquea && seTocan(caja, e));
}

// Primer hueco libre (de arriba a la izquierda) para algo de este tamaño.
export function primerHueco(ancho: number, alto: number, piso: Piso, mesas: Mesa[], esMesa: boolean): Caja | null {
  for (let y = 0; y + alto <= piso.filas; y++) {
    for (let x = 0; x + ancho <= piso.columnas; x++) {
      const caja = { x, y, ancho, alto };
      if (
        esMesa
          ? lugarLibre(caja, piso, mesas)
          : !piso.elementos.some((e) => seTocan(caja, e)) &&
            !mesas.some((m) => m.piso_id === piso.id && seTocan(caja, cajaMesa(m)))
      )
        return caja;
    }
  }
  return null;
}

// Tamaño sugerido según la cantidad de personas: mesa más grande para más comensales.
export function tamanoPara(forma: Mesa["forma"], capacidad: number): { ancho: number; alto: number } {
  if (forma === "rectangular") return { ancho: Math.min(12, Math.max(3, Math.ceil(capacidad / 2) + 1)), alto: 2 };
  const lado = capacidad <= 4 ? 2 : capacidad <= 8 ? 3 : 4;
  return { ancho: lado, alto: lado };
}

const PUNTOS: Record<Piso["norte"], [string, string, string, string]> = {
  // [arriba, derecha, abajo, izquierda]
  arriba: ["N", "E", "S", "O"],
  derecha: ["O", "N", "E", "S"],
  abajo: ["S", "O", "N", "E"],
  izquierda: ["E", "S", "O", "N"],
};

const ESTILO_ELEMENTO: Record<string, string> = {
  pasillo:
    "bg-[repeating-linear-gradient(45deg,#f5f5f4_0,#f5f5f4_6px,#e7e5e4_6px,#e7e5e4_12px)] text-stone-500 border-dashed border-stone-300",
  pared: "bg-stone-700 text-white border-stone-700",
  barra: "bg-amber-900/85 text-amber-50 border-amber-900",
  bano: "bg-sky-100 text-sky-800 border-sky-200",
  cocina: "bg-orange-100 text-orange-800 border-orange-200",
  entrada: "bg-emerald-100 text-emerald-800 border-emerald-300",
  escalera: "bg-[repeating-linear-gradient(0deg,#e7e5e4_0,#e7e5e4_4px,#fafaf9_4px,#fafaf9_8px)] text-stone-600 border-stone-300",
  caja: "bg-violet-100 text-violet-800 border-violet-200",
  planta: "bg-transparent text-xl border-transparent",
};

function colorMesa(e?: EstadoMesa) {
  if (!e?.ocupada) return "bg-superficie border-stone-300 text-stone-700";
  if (e.aviso === "cuenta") return "bg-violet-50 border-violet-500 text-violet-900";
  if (e.aviso) return "bg-sky-50 border-sky-500 text-sky-900";
  if (e.listo) return "bg-emerald-50 border-emerald-500 text-emerald-900";
  return "bg-amber-50 border-amber-500 text-amber-900";
}

type Arrastre = { tipo: "mesa" | "elemento"; id: string; dx: number; dy: number; caja: Caja; movio: boolean; valido: boolean };

export function Plano({
  piso,
  mesas,
  estados,
  editando,
  seleccion,
  onSeleccionar,
  onMover,
  onAbrirMesa,
  formato,
}: {
  piso: Piso;
  mesas: Mesa[];
  estados: Map<string, EstadoMesa>;
  editando: boolean;
  seleccion: Seleccion;
  onSeleccionar: (s: Seleccion) => void;
  onMover: (tipo: "mesa" | "elemento", id: string, caja: Caja) => void;
  onAbrirMesa: (id: string) => void;
  formato: (n: number) => string;
}) {
  const lienzo = useRef<HTMLDivElement>(null);
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const enPiso = mesas.filter((m) => m.piso_id === piso.id);
  const [arriba, derecha, abajo, izquierda] = PUNTOS[piso.norte] ?? PUNTOS.arriba;

  const pct = (c: Caja) => ({
    left: `${(c.x / piso.columnas) * 100}%`,
    top: `${(c.y / piso.filas) * 100}%`,
    width: `${(c.ancho / piso.columnas) * 100}%`,
    height: `${(c.alto / piso.filas) * 100}%`,
  });

  function celda(e: React.PointerEvent) {
    const r = lienzo.current!.getBoundingClientRect();
    return { cx: ((e.clientX - r.left) / r.width) * piso.columnas, cy: ((e.clientY - r.top) / r.height) * piso.filas };
  }

  function empezar(e: React.PointerEvent, tipo: "mesa" | "elemento", id: string, caja: Caja) {
    if (!editando) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const { cx, cy } = celda(e);
    onSeleccionar({ tipo, id });
    setArrastre({ tipo, id, dx: cx - caja.x, dy: cy - caja.y, caja, movio: false, valido: true });
  }

  function mover(e: React.PointerEvent) {
    if (!arrastre) return;
    const { cx, cy } = celda(e);
    const x = Math.round(cx - arrastre.dx);
    const y = Math.round(cy - arrastre.dy);
    if (x === arrastre.caja.x && y === arrastre.caja.y) return;
    const caja = {
      ...arrastre.caja,
      x: Math.max(0, Math.min(piso.columnas - arrastre.caja.ancho, x)),
      y: Math.max(0, Math.min(piso.filas - arrastre.caja.alto, y)),
    };
    const tipoElemento = piso.elementos.find((el) => el.id === arrastre.id)?.tipo;
    const valido =
      arrastre.tipo === "mesa"
        ? lugarLibre(caja, piso, mesas, arrastre.id)
        : !(tipoElemento && ELEMENTOS[tipoElemento].bloquea && enPiso.some((m) => seTocan(caja, cajaMesa(m))));
    setArrastre({ ...arrastre, caja, movio: true, valido });
  }

  function soltar() {
    if (!arrastre) return;
    if (arrastre.movio && arrastre.valido) onMover(arrastre.tipo, arrastre.id, arrastre.caja);
    setArrastre(null);
  }

  const cajaDe = (tipo: "mesa" | "elemento", id: string, original: Caja) =>
    arrastre && arrastre.tipo === tipo && arrastre.id === id ? arrastre.caja : original;

  return (
    <div className="overflow-x-auto rounded-2xl border border-borde bg-superficie p-3 sm:p-5">
      <div
        className="relative mx-auto min-w-[620px] px-5 py-5"
        // El plano entra entero en la pantalla: el ancho se limita según el alto disponible.
        style={{ maxWidth: `calc((100vh - 16rem) * ${piso.columnas / piso.filas} + 2.5rem)` }}
      >
        <span className="absolute left-1/2 top-0 -translate-x-1/2 text-[11px] font-bold text-stone-400">{arriba}</span>
        <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[11px] font-bold text-stone-400">{derecha}</span>
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[11px] font-bold text-stone-400">{abajo}</span>
        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[11px] font-bold text-stone-400">{izquierda}</span>
        <div
          ref={lienzo}
          className="relative touch-none select-none rounded-lg bg-stone-50 ring-1 ring-stone-200"
          style={{
            aspectRatio: `${piso.columnas} / ${piso.filas}`,
            backgroundImage: editando
              ? "linear-gradient(to right, rgb(0 0 0 / 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgb(0 0 0 / 0.05) 1px, transparent 1px)"
              : undefined,
            backgroundSize: editando ? `${100 / piso.columnas}% ${100 / piso.filas}%` : undefined,
          }}
          onPointerMove={mover}
          onPointerUp={soltar}
          onPointerCancel={() => setArrastre(null)}
          onClick={(e) => e.target === e.currentTarget && onSeleccionar(null)}
        >
          {piso.elementos.map((el: Elemento) => {
            const caja = cajaDe("elemento", el.id, el);
            const elegido = seleccion?.tipo === "elemento" && seleccion.id === el.id;
            return (
              <div
                key={el.id}
                onPointerDown={(e) => empezar(e, "elemento", el.id, el)}
                className={`absolute flex items-center justify-center overflow-hidden rounded-md border text-[11px] font-semibold ${ESTILO_ELEMENTO[el.tipo] ?? ""} ${
                  editando ? "cursor-grab active:cursor-grabbing" : ""
                } ${elegido ? "ring-2 ring-marca ring-offset-1" : ""} ${arrastre?.id === el.id && !arrastre.valido ? "!border-red-500 opacity-70" : ""}`}
                style={pct(caja)}
                title={el.texto || ELEMENTOS[el.tipo]?.texto}
              >
                {el.tipo === "planta" ? "🪴" : <span className="truncate px-1">{el.texto || ELEMENTOS[el.tipo]?.texto}</span>}
              </div>
            );
          })}

          {enPiso.map((m) => {
            const caja = cajaDe("mesa", m.id, cajaMesa(m));
            const est = estados.get(m.id);
            const elegido = seleccion?.tipo === "mesa" && seleccion.id === m.id;
            const invalido = arrastre?.id === m.id && !arrastre.valido;
            return (
              <button
                key={m.id}
                type="button"
                onPointerDown={(e) => empezar(e, "mesa", m.id, cajaMesa(m))}
                onClick={() => !editando && onAbrirMesa(m.id)}
                className={`absolute flex flex-col items-center justify-center border-2 p-0.5 leading-tight shadow-sm transition-[box-shadow] ${colorMesa(
                  editando ? undefined : est,
                )} ${m.forma === "redonda" ? "rounded-full" : "rounded-xl"} ${editando ? "cursor-grab active:cursor-grabbing" : "hover:shadow-md"} ${
                  elegido ? "ring-2 ring-marca ring-offset-2" : ""
                } ${invalido ? "!border-red-500 !bg-red-50 opacity-80" : ""}`}
                style={pct(caja)}
                aria-label={`Mesa ${m.numero}${est?.ocupada ? ", ocupada" : ", libre"}`}
              >
                <span className="text-sm font-bold sm:text-base">{m.numero}</span>
                {!editando && est?.ocupada ? (
                  <span className="text-[10px] tabular-nums opacity-80" suppressHydrationWarning>
                    {est.comensales}/{m.capacidad ?? 4} · {est.minutos}′
                  </span>
                ) : (
                  <span className="text-[10px] opacity-60">{m.capacidad ?? 4} pers.</span>
                )}
                {!editando && est?.ocupada && caja.ancho * caja.alto >= 6 && !!est.total && (
                  <span className="text-[10px] font-semibold tabular-nums">{formato(est.total)}</span>
                )}
                {!editando && (est?.aviso || est?.listo || est?.pendiente) && (
                  <span
                    className={`absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white shadow ${
                      est.aviso === "cuenta"
                        ? "animate-pulse bg-violet-600"
                        : est.aviso
                          ? "animate-pulse bg-sky-600"
                          : est.pendiente
                            ? "animate-pulse bg-red-600"
                            : "bg-emerald-600"
                    }`}
                  >
                    {est.aviso === "cuenta" ? "$" : est.aviso ? "!" : est.pendiente ? "●" : "✓"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
