"use client";

import { useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { ELEMENTOS, type Elemento, type Piso, nombreMesa } from "@/lib/salon";
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
  aviso?: "cuenta" | "mozo" | "pago" | null;
  // Quién la atiende (o, libre, el mesero que la tiene asignada): foto, emoji o iniciales en la esquina.
  mesero?: { nombre: string; avatar?: string | null; color?: string | null } | null;
  // Búsqueda de un plato desde el plano: las mesas que lo pidieron se marcan y las demás se apagan.
  destacada?: boolean;
  apagada?: boolean;
  // Mesas pegadas con una sola cuenta: "1+2" en todas; unida = no es la principal.
  grupo?: string;
  unida?: boolean;
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
    "bg-[repeating-linear-gradient(45deg,var(--color-stone-100)_0,var(--color-stone-100)_6px,var(--color-stone-200)_6px,var(--color-stone-200)_12px)] text-stone-500 border-dashed border-stone-300",
  pared: "bg-stone-700 text-white border-stone-700",
  barra: "bg-[#78350f]/85 text-[#fffbeb] border-[#78350f]",
  bano: "bg-sky-100 text-sky-800 border-sky-200",
  cocina: "bg-orange-100 text-orange-800 border-orange-200",
  entrada: "bg-emerald-100 text-emerald-800 border-emerald-300",
  escalera:
    "bg-[repeating-linear-gradient(0deg,var(--color-stone-200)_0,var(--color-stone-200)_4px,var(--color-stone-50)_4px,var(--color-stone-50)_8px)] text-stone-600 border-stone-300",
  caja: "bg-violet-100 text-violet-800 border-violet-200",
  planta: "bg-transparent text-xl border-transparent",
};

function colorMesa(e?: EstadoMesa) {
  if (!e?.ocupada) return "bg-superficie border-stone-300 text-stone-700";
  if (e.aviso === "cuenta") return "bg-violet-50 border-violet-500 text-violet-900";
  if (e.aviso === "pago") return "bg-emerald-50 border-emerald-600 text-emerald-900";
  if (e.aviso) return "bg-sky-50 border-sky-500 text-sky-900";
  if (e.listo) return "bg-emerald-50 border-emerald-500 text-emerald-900";
  return "bg-amber-50 border-amber-500 text-amber-900";
}

// Cómo se dibuja el plano: "simple" (esquema), "color" (ambientado: piso, madera, sillas) o "3d" (el ambientado
// visto en perspectiva). Se elige por pantalla: el mesero puede usar el simple y la pantalla del salón el 3D.
export type EstiloPlano = "simple" | "color" | "3d";
export const ESTILOS_PLANO: { id: EstiloPlano; texto: string }[] = [
  { id: "simple", texto: "Simple" },
  { id: "color", texto: "Color" },
  { id: "3d", texto: "3D" },
];

// Ambientado: superficies con textura, como una foto aérea del local.
const AMBIENTE: Record<string, React.CSSProperties> = {
  pasillo: {
    background: "repeating-linear-gradient(90deg,#4a4038 0 22px,#4f453c 22px 44px)",
    boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.06)",
    color: "#cbbfae",
  },
  pared: { background: "linear-gradient(#5b4a3e,#3d3029)", color: "#e7dccb", boxShadow: "0 2px 6px rgb(0 0 0 / 0.5)" },
  barra: {
    background: "linear-gradient(180deg,#8a5a34,#5e3b20)",
    color: "#fbe7c6",
    boxShadow: "inset 0 -6px 0 #3e2614, 0 0 18px rgb(251 191 36 / 0.25)",
  },
  bano: {
    background: "repeating-conic-gradient(#b7c3c9 0 25%,#9fadb4 0 50%) 0 0/14px 14px",
    color: "#24333a",
  },
  cocina: { background: "linear-gradient(135deg,#9aa1a6,#6b7378)", color: "#111827" },
  entrada: { background: "repeating-linear-gradient(0deg,#2f4a3a 0 3px,#3a5a46 3px 6px)", color: "#d9f99d" },
  escalera: { background: "repeating-linear-gradient(0deg,#6e6258 0 8px,#544a42 8px 10px)", color: "#efe6da" },
  caja: { background: "linear-gradient(135deg,#4b3a2c,#2e231a)", color: "#fde68a", boxShadow: "0 0 14px rgb(251 191 36 / 0.25)" },
  planta: { background: "radial-gradient(circle,#4d7c0f 0 45%,#365314 46% 60%,transparent 62%)" },
};

// Color de las sillas según cómo está la mesa.
function colorSillas(e?: EstadoMesa) {
  if (!e?.ocupada) return "#56604f";
  if (e.aviso === "cuenta") return "#8b5cf6";
  if (e.aviso === "pago") return "#059669";
  if (e.aviso) return "#0ea5e9";
  if (e.listo) return "#10b981";
  return "#f59e0b";
}

// Sillas alrededor de la mesa: en las redondas en círculo; en las demás repartidas por los lados largos.
function Sillas({
  forma,
  capacidad,
  color,
  ancho,
  alto,
}: {
  forma: Mesa["forma"];
  capacidad: number;
  color: string;
  ancho: number;
  alto: number;
}) {
  const n = Math.min(capacidad, 16);
  const puntos: { left: string; top: string; giro: number }[] = [];
  if (forma === "redonda") {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      puntos.push({ left: `${50 + Math.cos(a) * 58}%`, top: `${50 + Math.sin(a) * 58}%`, giro: (a * 180) / Math.PI + 90 });
    }
  } else {
    const horizontal = ancho >= alto;
    const porLado = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      const lado = i < porLado ? 0 : 1;
      const k = lado ? i - porLado : i;
      const cuantos = lado ? n - porLado : porLado;
      const t = `${((k + 0.5) / cuantos) * 100}%`;
      puntos.push(
        horizontal
          ? { left: t, top: lado ? "112%" : "-12%", giro: lado ? 180 : 0 }
          : { left: lado ? "112%" : "-12%", top: t, giro: lado ? 90 : -90 },
      );
    }
  }
  return (
    <>
      {puntos.map((p, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute h-[22%] max-h-4 min-h-2 w-[30%] max-w-5 min-w-2.5 rounded-t-md"
          style={{
            left: p.left,
            top: p.top,
            background: color,
            transform: `translate(-50%,-50%) rotate(${p.giro}deg)`,
            boxShadow: "0 1px 2px rgb(0 0 0 / 0.5)",
          }}
        />
      ))}
    </>
  );
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
  movibles,
  formato,
  estilo = "simple",
  alto,
}: {
  piso: Piso;
  mesas: Mesa[];
  estados: Map<string, EstadoMesa>;
  editando: boolean;
  seleccion: Seleccion;
  onSeleccionar: (s: Seleccion) => void;
  onMover: (tipo: "mesa" | "elemento", id: string, caja: Caja) => void;
  onAbrirMesa: (id: string) => void;
  // Fuera de la edición, mesas que igual se pueden arrastrar (las unidas a otra, mientras dura la cuenta).
  movibles?: { has: (id: string) => boolean };
  formato: (n: number) => string;
  estilo?: EstiloPlano;
  // Alto disponible para el plano (por defecto, la pantalla menos la barra y los botones).
  alto?: string;
}) {
  // Al editar se usa la vista plana: arrastrar sobre una perspectiva confunde.
  const modo: EstiloPlano = editando && estilo === "3d" ? "color" : estilo;
  const ambientado = modo !== "simple";
  const tres = modo === "3d";
  const lienzo = useRef<HTMLDivElement>(null);
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  // Tras arrastrar una mesa unida, el clic que sigue no abre la ficha.
  const recienMovida = useRef(false);
  const sePuedeMover = (tipo: "mesa" | "elemento", id: string) => editando || (tipo === "mesa" && !!movibles?.has(id));
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
    if (!sePuedeMover(tipo, id)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const { cx, cy } = celda(e);
    if (editando) onSeleccionar({ tipo, id });
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
    recienMovida.current = arrastre.movio;
    setArrastre(null);
  }

  const cajaDe = (tipo: "mesa" | "elemento", id: string, original: Caja) =>
    arrastre && arrastre.tipo === tipo && arrastre.id === id ? arrastre.caja : original;

  return (
    <div
      // En el celular el plano es más ancho que la pantalla: se desliza dentro de su recuadro, no la página entera.
      className={`w-full max-w-full overscroll-x-contain rounded-2xl border p-3 sm:p-5 ${
        ambientado ? "border-stone-800 bg-[#17130f] [color-scheme:dark]" : "border-borde bg-superficie"
      } ${tres ? "overflow-x-auto overflow-y-hidden" : "overflow-x-auto"}`}
    >
      <div
        className="relative mx-auto min-w-[620px] px-5 py-5"
        // El plano entra entero en la pantalla: el ancho se limita según el alto disponible.
        style={{
          maxWidth: `calc((${alto ?? "100vh - 16rem"}) * ${piso.columnas / piso.filas} * ${tres ? 1.08 : 1} + 2.5rem)`,
          perspective: tres ? "1600px" : undefined,
        }}
      >
        <span className="absolute left-1/2 top-0 -translate-x-1/2 text-[11px] font-bold text-stone-400">{arriba}</span>
        <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[11px] font-bold text-stone-400">{derecha}</span>
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[11px] font-bold text-stone-400">{abajo}</span>
        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[11px] font-bold text-stone-400">{izquierda}</span>
        <div
          ref={lienzo}
          // Solo al editar se bloquea el gesto del dedo (para arrastrar mesas); si no, el plano se desliza con el dedo.
          className={`relative select-none rounded-lg ${editando ? "touch-none" : ""} ${ambientado ? "" : "bg-stone-50 ring-1 ring-stone-200"}`}
          style={{
            aspectRatio: `${piso.columnas} / ${piso.filas}`,
            ...(ambientado
              ? {
                  // Piso de cemento alisado con luz cálida desde arriba y paredes alrededor.
                  background: editando
                    ? `linear-gradient(to right, rgb(255 255 255 / 0.06) 1px, transparent 1px) 0 0/${100 / piso.columnas}% ${100 / piso.filas}%, linear-gradient(to bottom, rgb(255 255 255 / 0.06) 1px, transparent 1px) 0 0/${100 / piso.columnas}% ${100 / piso.filas}%, #6b5d50`
                    : "radial-gradient(ellipse at 50% 35%, rgb(255 214 150 / 0.22), transparent 70%), repeating-linear-gradient(0deg, rgb(0 0 0 / 0.05) 0 1px, transparent 1px 48px), repeating-linear-gradient(90deg, rgb(0 0 0 / 0.05) 0 1px, transparent 1px 48px), linear-gradient(135deg, #75685b, #5d5147)",
                  boxShadow: "0 0 0 6px #2b231d, 0 0 0 8px #120e0b, 0 24px 50px rgb(0 0 0 / 0.55)",
                }
              : {
                  backgroundImage: editando
                    ? "linear-gradient(to right, rgb(0 0 0 / 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgb(0 0 0 / 0.05) 1px, transparent 1px)"
                    : undefined,
                  backgroundSize: editando ? `${100 / piso.columnas}% ${100 / piso.filas}%` : undefined,
                }),
            ...(tres
              ? {
                  transform: "rotateX(38deg) rotateZ(-4deg) scale(0.94)",
                  transformStyle: "preserve-3d",
                  transformOrigin: "50% 60%",
                }
              : {}),
          }}
          onPointerMove={mover}
          onPointerUp={soltar}
          onPointerCancel={() => setArrastre(null)}
          onClick={(e) => e.target === e.currentTarget && onSeleccionar(null)}
        >
          {piso.fondo_url && (
            // Foto o plano real del local debajo de las mesas.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={piso.fondo_url}
              alt=""
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full rounded-lg object-cover"
              style={{ opacity: (piso.fondo_opacidad ?? 60) / 100 }}
            />
          )}
          {piso.elementos.map((el: Elemento) => {
            const caja = cajaDe("elemento", el.id, el);
            const elegido = seleccion?.tipo === "elemento" && seleccion.id === el.id;
            return (
              <div
                key={el.id}
                onPointerDown={(e) => empezar(e, "elemento", el.id, el)}
                className={`absolute flex items-center justify-center overflow-hidden rounded-md text-[11px] font-semibold ${
                  ambientado ? "" : `border ${ESTILO_ELEMENTO[el.tipo] ?? ""}`
                } ${
                  editando ? "cursor-grab active:cursor-grabbing" : ""
                } ${elegido ? "ring-2 ring-marca ring-offset-1" : ""} ${arrastre?.id === el.id && !arrastre.valido ? "!border-red-500 opacity-70" : ""}`}
                style={{ ...pct(caja), ...(ambientado ? AMBIENTE[el.tipo] : {}) }}
                title={el.texto || ELEMENTOS[el.tipo]?.texto}
              >
                {el.tipo === "planta" ? (
                  ambientado ? null : (
                    "🪴"
                  )
                ) : (
                  <span className="truncate px-1" style={tres ? { transform: "translateZ(1px)" } : undefined}>
                    {el.texto || ELEMENTOS[el.tipo]?.texto}
                  </span>
                )}
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
                onClick={() => {
                  if (recienMovida.current) recienMovida.current = false;
                  else if (!editando) onAbrirMesa(m.id);
                }}
                className={`absolute flex flex-col items-center justify-center p-0.5 leading-tight transition-[box-shadow] ${
                  ambientado ? "text-[#fff7ed]" : `border-2 shadow-sm ${colorMesa(editando ? undefined : est)}`
                } ${m.forma === "redonda" ? "rounded-full" : ambientado ? "rounded-md" : "rounded-xl"} ${
                  editando || movibles?.has(m.id) ? "cursor-grab touch-none active:cursor-grabbing" : "hover:shadow-md"
                } ${elegido ? (editando ? "ring-2 ring-marca ring-offset-2" : "animate-pulse ring-4 ring-marca ring-offset-2") : ""} ${invalido ? "!border-red-500 !bg-red-50 opacity-80" : ""} ${
                  !editando && est?.destacada ? "ring-4 ring-sky-400 ring-offset-2" : ""
                } ${!editando && est?.apagada ? "opacity-35" : ""}`}
                style={{
                  ...pct(caja),
                  ...(ambientado
                    ? {
                        // Madera con un halo del color del estado para verla de lejos.
                        background: "linear-gradient(135deg,#a8774a,#7b5332 55%,#6a4529)",
                        boxShadow: `${tres ? "0 2px 0 #4a2e18, 0 4px 0 #3d2614, 0 10px 14px rgb(0 0 0 / 0.55)" : "0 3px 8px rgb(0 0 0 / 0.45)"}, 0 0 0 ${est?.ocupada && !editando ? 3 : 0}px ${colorSillas(est)}`,
                        transformStyle: tres ? "preserve-3d" : undefined,
                      }
                    : {}),
                }}
                aria-label={`${nombreMesa(m.numero)}${est?.ocupada ? ", ocupada" : ", libre"}`}
              >
                {ambientado && (
                  <Sillas
                    forma={m.forma}
                    capacidad={m.capacidad ?? 4}
                    color={editando ? "#56604f" : colorSillas(est)}
                    ancho={caja.ancho}
                    alto={caja.alto}
                  />
                )}
                <span
                  className={`text-sm font-bold sm:text-base ${ambientado ? "drop-shadow-[0_1px_1px_rgb(0_0_0/0.8)]" : ""}`}
                  style={tres ? { transform: "rotateZ(4deg) rotateX(-38deg) translateZ(10px)" } : undefined}
                >
                  {m.numero}
                </span>
                {!editando && est?.unida ? (
                  <span className="text-[10px] font-semibold opacity-80">unida</span>
                ) : !editando && est?.ocupada ? (
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
                        : est.aviso === "pago"
                          ? "bg-emerald-600"
                          : est.aviso
                            ? "animate-pulse bg-sky-600"
                            : est.pendiente
                              ? "animate-pulse bg-red-600"
                              : "bg-emerald-600"
                    }`}
                  >
                    {est.aviso === "cuenta" || est.aviso === "pago" ? "$" : est.aviso ? "!" : est.pendiente ? "●" : "✓"}
                  </span>
                )}
                {!editando && est?.grupo && (
                  <span
                    className="absolute -left-1.5 -top-1.5 rounded-full bg-marca px-1.5 py-0.5 text-[9px] font-bold leading-none text-white shadow"
                    title="Mesas unidas"
                  >
                    {est.grupo}
                  </span>
                )}
                {!editando && est?.mesero && (
                  <span className={`absolute -bottom-1.5 -left-1.5 ${est.ocupada ? "" : "opacity-60"}`}>
                    <Avatar persona={est.mesero} className="h-5 w-5 text-[8px] shadow" />
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
