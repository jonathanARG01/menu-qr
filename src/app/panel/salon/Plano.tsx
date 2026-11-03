"use client";

import { useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import {
  ELEMENTOS,
  type AsientosElemento,
  type Elemento,
  type Lado,
  type LadoSillas,
  type Piso,
  type SillasMesa,
  nombreMesa,
  sillasAutomaticas,
  textoSobre,
  tono,
} from "@/lib/salon";
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
  // Mesa unida: id de la mesa principal, para dibujar la cuerda que las une.
  principal?: string;
};

export const cajaMesa = (m: Mesa): Caja => ({ x: m.x ?? 0, y: m.y ?? 0, ancho: m.ancho ?? 2, alto: m.alto ?? 2 });

const seTocan = (a: Caja, b: Caja) => a.x < b.x + b.ancho && b.x < a.x + a.ancho && a.y < b.y + b.alto && b.y < a.y + a.alto;

// ¿Se puede poner esta caja aquí? No puede salirse del piso ni pisar otra mesa o un pasillo, pared, barra…
export function lugarLibre(caja: Caja, piso: Piso, mesas: Mesa[], ignorar?: string) {
  if (caja.x < 0 || caja.y < 0 || caja.x + caja.ancho > piso.columnas || caja.y + caja.alto > piso.filas) return false;
  if (mesas.some((m) => m.id !== ignorar && m.piso_id === piso.id && seTocan(caja, cajaMesa(m)))) return false;
  return !piso.elementos.some((e) => e.id !== ignorar && ELEMENTOS[e.tipo]?.bloquea && seTocan(caja, e));
}

// Hueco libre más cerca de una caja (para duplicar): prueba primero al lado, abajo, a la izquierda y arriba,
// y si no, el lugar libre más próximo del piso.
export function huecoCerca(origen: Caja, piso: Piso, libre: (c: Caja) => boolean): Caja | null {
  const { ancho, alto } = origen;
  const vecinos = [
    { x: origen.x + ancho, y: origen.y },
    { x: origen.x, y: origen.y + alto },
    { x: origen.x - ancho, y: origen.y },
    { x: origen.x, y: origen.y - alto },
  ];
  const dentro = (c: Caja) => c.x >= 0 && c.y >= 0 && c.x + c.ancho <= piso.columnas && c.y + c.alto <= piso.filas;
  for (const v of vecinos) {
    const c = { ...v, ancho, alto };
    if (dentro(c) && libre(c)) return c;
  }
  let mejor: Caja | null = null;
  let distancia = Infinity;
  for (let y = 0; y + alto <= piso.filas; y++) {
    for (let x = 0; x + ancho <= piso.columnas; x++) {
      const d = Math.abs(x - origen.x) + Math.abs(y - origen.y);
      if (d === 0 || d >= distancia) continue;
      const c = { x, y, ancho, alto };
      if (libre(c)) {
        mejor = c;
        distancia = d;
      }
    }
  }
  return mejor;
}

// ¿Puede ir aquí la copia de un elemento? Un suelo (vereda, toldo, arena) no pisa otro igual ni lo que bloquea
// (calle, pared…); lo demás no pisa mesas ni otros elementos que no sean suelo.
export function libreParaElemento(caja: Caja, piso: Piso, mesas: Mesa[], tipo: Elemento["tipo"]) {
  const suelo = !!ELEMENTOS[tipo]?.suelo;
  if (!suelo && mesas.some((m) => m.piso_id === piso.id && seTocan(caja, cajaMesa(m)))) return false;
  return !piso.elementos.some((e) => {
    if (!seTocan(caja, e)) return false;
    const info = ELEMENTOS[e.tipo];
    return suelo ? e.tipo === tipo || !!info?.bloquea : !info?.suelo;
  });
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
  toldo: "text-red-900 border-red-300 border-dashed",
  vereda: "bg-stone-200/70 text-stone-600 border-stone-300",
  calle: "bg-stone-600 text-stone-100 border-stone-700",
  macetero: "bg-lime-100 text-lime-800 border-lime-300",
  farol: "bg-transparent border-transparent",
  palmera: "bg-transparent border-transparent",
  sombrilla: "bg-transparent border-transparent",
  arena: "bg-amber-100/80 text-amber-800 border-amber-200",
  deck: "bg-orange-100/80 text-orange-900 border-orange-200",
  mar: "bg-sky-200 text-sky-900 border-sky-300",
  choza: "bg-transparent border-transparent text-amber-950",
};

// Elementos que se dibujan con su propio dibujo (sin caja ni texto encima).
const DIBUJADOS = new Set(["planta", "palmera", "sombrilla", "farol"]);
// Zonas grandes con el nombre en letra chica, para que no tape lo que va encima.
const ZONAS = new Set(["toldo", "vereda", "arena", "deck", "mar", "calle", "choza"]);

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
  toldo: {
    background: "repeating-linear-gradient(90deg,rgb(185 28 28 / 0.55) 0 18px,rgb(254 243 199 / 0.5) 18px 36px)",
    color: "#fff7ed",
    boxShadow: "0 6px 18px rgb(0 0 0 / 0.35)",
  },
  vereda: { background: "repeating-conic-gradient(#8f8a84 0 25%,#9c968f 0 50%) 0 0/26px 26px", color: "#2a2724" },
  calle: {
    background:
      "linear-gradient(90deg,transparent 0 46%,#facc15 46% 54%,transparent 54%) 0 50%/34px 4px repeat-x, linear-gradient(#3a3a3c,#2c2c2e)",
    color: "#e5e5e5",
  },
  macetero: {
    background:
      "radial-gradient(circle at 30% 50%,#4d7c0f 0 22%,transparent 24%), radial-gradient(circle at 70% 50%,#3f6212 0 22%,transparent 24%), linear-gradient(#7c4a2a,#5b3520)",
    color: "#ecfccb",
  },
  arena: {
    background:
      "radial-gradient(rgb(120 90 40 / 0.18) 1px, transparent 1.5px) 0 0/9px 9px, linear-gradient(135deg,#e9cf98,#d8b878)",
    color: "#6b4f1d",
  },
  deck: { background: "repeating-linear-gradient(0deg,#9a6a40 0 10px,#7f5532 10px 12px)", color: "#fde9c8" },
  mar: {
    background:
      "repeating-radial-gradient(ellipse at 50% 140%, rgb(255 255 255 / 0.18) 0 2px, transparent 3px 16px), linear-gradient(180deg,#38bdf8,#0369a1)",
    color: "#e0f2fe",
  },
  choza: { background: "transparent", color: "#3b2410" },
};

// Fondo de un elemento con el color que eligió el dueño: en el ambientado con volumen, en el simple plano.
function fondoConColor(tipo: string, color: string, ambientado: boolean): React.CSSProperties {
  const texto = textoSobre(color);
  if (tipo === "toldo")
    return {
      background: `repeating-linear-gradient(90deg,${color}${ambientado ? "8c" : "66"} 0 18px,rgb(255 251 235 / ${ambientado ? 0.5 : 0.6}) 18px 36px)`,
      color: ambientado ? "#fff" : tono(color, 0.4),
    };
  if (!ambientado) return { background: color, color: texto, borderColor: tono(color, 0.25) };
  return {
    background: `linear-gradient(135deg,${tono(color, -0.12)},${color} 50%,${tono(color, 0.3)})`,
    color: texto,
    boxShadow: `inset 0 -4px 0 ${tono(color, 0.45)}, 0 3px 8px rgb(0 0 0 / 0.45)`,
  };
}

// Dibujos que escalan con su caja (palmera, sombrilla, farol, quincho).
function Dibujo({ tipo, color }: { tipo: string; color?: string }) {
  if (tipo === "palmera")
    return (
      <svg viewBox="0 0 40 40" className="h-full w-full drop-shadow-[0_3px_3px_rgb(0_0_0/0.4)]" aria-hidden>
        {[0, 51, 103, 154, 206, 257, 309].map((g, i) => (
          <path
            key={g}
            d="M20 20 C 24 12, 30 7, 37 6 C 31 11, 26 15, 20 20 Z"
            fill={i % 2 ? (color ?? "#3f7d20") : tono(color ?? "#3f7d20", 0.25)}
            transform={`rotate(${g} 20 20)`}
          />
        ))}
        <circle cx="20" cy="20" r="3" fill="#7c5a32" />
      </svg>
    );
  if (tipo === "sombrilla") {
    const c = color ?? "#0e7490";
    return (
      <svg viewBox="0 0 40 40" className="h-full w-full opacity-90 drop-shadow-[0_4px_4px_rgb(0_0_0/0.35)]" aria-hidden>
        {Array.from({ length: 8 }, (_, i) => (
          <path
            key={i}
            d="M20 20 L20 2 A18 18 0 0 1 32.73 7.27 Z"
            fill={i % 2 ? "#fefce8" : c}
            transform={`rotate(${i * 45} 20 20)`}
          />
        ))}
        <circle cx="20" cy="20" r="2" fill={tono(c, 0.4)} />
      </svg>
    );
  }
  if (tipo === "farol")
    return (
      <span
        className="block h-[70%] w-[70%] rounded-full"
        style={{
          background: `radial-gradient(circle,${color ?? "#fde68a"} 0 30%,#3f3f46 32% 48%,rgb(253 224 71 / 0.25) 50%,transparent 70%)`,
        }}
        aria-hidden
      />
    );
  if (tipo === "planta") return <span aria-hidden>🪴</span>;
  return null;
}

// Techo de paja del quincho (palapa): líneas desde el centro.
function techoQuincho(color?: string): React.CSSProperties {
  const c = color ?? "#b88a4a";
  return {
    background: `repeating-conic-gradient(from 0deg, ${c} 0 6deg, ${tono(c, 0.22)} 6deg 12deg)`,
    boxShadow: `inset 0 0 0 3px ${tono(c, 0.4)}, 0 6px 16px rgb(0 0 0 / 0.4)`,
    color: textoSobre(c),
  };
}

// Color de las sillas según cómo está la mesa.
function colorSillas(e?: EstadoMesa) {
  if (!e?.ocupada) return "#56604f";
  if (e.aviso === "cuenta") return "#8b5cf6";
  if (e.aviso === "pago") return "#059669";
  if (e.aviso) return "#0ea5e9";
  if (e.listo) return "#10b981";
  return "#f59e0b";
}

// Posición de un asiento pegado a un lado de la caja (de la mesa o de la barra), por fuera.
function enLado(lado: Lado, t: number, separacion = "1px"): React.CSSProperties {
  const pos = `${t * 100}%`;
  switch (lado) {
    case "arriba":
      return { left: pos, bottom: `calc(100% + ${separacion})`, transform: "translateX(-50%)" };
    case "abajo":
      return { left: pos, top: `calc(100% + ${separacion})`, transform: "translateX(-50%)" };
    case "izquierda":
      return { top: pos, right: `calc(100% + ${separacion})`, transform: "translateY(-50%)" };
    case "derecha":
      return { top: pos, left: `calc(100% + ${separacion})`, transform: "translateY(-50%)" };
  }
}

const SOMBRA_ASIENTO = "0 1px 2px rgb(0 0 0 / 0.5)";

// Asientos de un lado: sillas o taburetes repartidos, o una banca/sillón que ocupa todo el lado.
function LadoAsientos({
  lado,
  conf,
  color,
  ancho,
  alto,
}: {
  lado: Lado;
  conf: LadoSillas;
  color: string;
  ancho: number;
  alto: number;
}) {
  if (!conf.n) return null;
  const horizontal = lado === "arriba" || lado === "abajo";
  const largo = horizontal ? ancho : alto;
  if (conf.tipo === "banca" || conf.tipo === "sillon") {
    const sillon = conf.tipo === "sillon";
    const grosor = sillon ? "clamp(8px, 30%, 18px)" : "clamp(5px, 20%, 11px)";
    const base: React.CSSProperties = horizontal
      ? { left: "4%", right: "4%", height: grosor, [lado === "arriba" ? "bottom" : "top"]: "calc(100% + 2px)" }
      : { top: "4%", bottom: "4%", width: grosor, [lado === "izquierda" ? "right" : "left"]: "calc(100% + 2px)" };
    // El respaldo queda del lado de afuera.
    const respaldo = { arriba: "inset 0 3px 0", abajo: "inset 0 -3px 0", izquierda: "inset 3px 0 0", derecha: "inset -3px 0 0" }[
      lado
    ];
    const fondo = sillon ? tono(color, 0.15) : color;
    return (
      <span
        aria-hidden
        className="pointer-events-none absolute rounded-md"
        style={{
          ...base,
          background: `repeating-linear-gradient(${horizontal ? "90deg" : "0deg"}, ${fondo} 0 calc(${100 / conf.n}% - 1px), ${tono(color, 0.5)} calc(${100 / conf.n}% - 1px) calc(${100 / conf.n}%))`,
          boxShadow: `${respaldo} ${tono(color, sillon ? 0.55 : 0.4)}, ${SOMBRA_ASIENTO}`,
          borderRadius: sillon ? 6 : 4,
        }}
      />
    );
  }
  const taburete = conf.tipo === "taburete";
  // Tamaño según cuántas entran en el lado, con un mínimo y un máximo para que se vean.
  const tam = `clamp(6px, ${Math.min(30, (70 * largo) / Math.max(1, conf.n) / largo)}%, ${taburete ? 14 : 18}px)`;
  const redondeo = {
    arriba: "6px 6px 2px 2px",
    abajo: "2px 2px 6px 6px",
    izquierda: "6px 2px 2px 6px",
    derecha: "2px 6px 6px 2px",
  }[lado];
  return (
    <>
      {Array.from({ length: Math.min(conf.n, 24) }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            ...enLado(lado, (i + 0.5) / conf.n, taburete ? "3px" : "1px"),
            width: taburete ? tam : horizontal ? tam : `clamp(5px, 22%, 13px)`,
            height: taburete ? undefined : horizontal ? `clamp(5px, 22%, 13px)` : tam,
            aspectRatio: taburete ? "1" : undefined,
            background: taburete ? `radial-gradient(circle at 40% 35%, ${tono(color, -0.25)}, ${color} 60%)` : color,
            borderRadius: taburete ? "999px" : redondeo,
            boxShadow: SOMBRA_ASIENTO,
          }}
        />
      ))}
    </>
  );
}

// Sillas alrededor de una mesa redonda (sillas, taburetes o sillones individuales).
function Alrededor({ conf, color }: { conf: LadoSillas; color: string }) {
  const n = Math.min(conf.n, 24);
  const sillon = conf.tipo === "sillon";
  const taburete = conf.tipo === "taburete";
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        const r = sillon ? 64 : 58;
        return (
          <span
            key={i}
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              left: `${50 + Math.cos(a) * r}%`,
              top: `${50 + Math.sin(a) * r}%`,
              width: sillon ? "38%" : taburete ? "24%" : "30%",
              height: sillon ? "30%" : taburete ? "24%" : "22%",
              maxWidth: sillon ? 26 : 20,
              maxHeight: sillon ? 20 : 16,
              minWidth: 8,
              minHeight: 6,
              background: taburete
                ? `radial-gradient(circle at 40% 35%, ${tono(color, -0.25)}, ${color} 60%)`
                : sillon
                  ? tono(color, 0.15)
                  : color,
              borderRadius: taburete ? "999px" : sillon ? "8px 8px 5px 5px" : "6px 6px 2px 2px",
              boxShadow: sillon ? `inset 0 3px 0 ${tono(color, 0.55)}, ${SOMBRA_ASIENTO}` : SOMBRA_ASIENTO,
              transform: `translate(-50%,-50%) rotate(${(a * 180) / Math.PI + 90}deg)`,
            }}
          />
        );
      })}
    </>
  );
}

// Sillas de una mesa: las elegidas a mano o, si no hay, repartidas según las personas.
function Sillas({
  forma,
  capacidad,
  sillas,
  color,
  ancho,
  alto,
}: {
  forma: Mesa["forma"];
  capacidad: number;
  sillas?: SillasMesa | null;
  color: string;
  ancho: number;
  alto: number;
}) {
  const conf = sillas && Object.keys(sillas).length ? sillas : sillasAutomaticas(forma, capacidad, ancho, alto);
  if (forma === "redonda") {
    const todas = conf.alrededor ?? { tipo: "silla" as const, n: Object.values(conf).reduce((t, l) => t + (l?.n ?? 0), 0) };
    return <Alrededor conf={todas} color={color} />;
  }
  return (
    <>
      {(["arriba", "abajo", "izquierda", "derecha"] as Lado[]).map((l) =>
        conf[l] ? <LadoAsientos key={l} lado={l} conf={conf[l]!} color={color} ancho={ancho} alto={alto} /> : null,
      )}
    </>
  );
}

// Taburetes o sillas altas a un lado de la barra (o del quincho).
function AsientosBarra({
  asientos,
  ancho,
  alto,
  ambientado,
}: {
  asientos: AsientosElemento;
  ancho: number;
  alto: number;
  ambientado: boolean;
}) {
  const color = ambientado ? "#c9894b" : "#a16207";
  return (
    <LadoAsientos lado={asientos.lado} conf={{ tipo: asientos.tipo, n: asientos.n }} color={color} ancho={ancho} alto={alto} />
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
          {/* Primero las zonas de piso (vereda, arena, toldo…), así las mesas y lo demás quedan encima. */}
          {[...piso.elementos]
            .sort((a, b) => Number(!!ELEMENTOS[b.tipo]?.suelo) - Number(!!ELEMENTOS[a.tipo]?.suelo))
            .map((el: Elemento) => {
              const caja = cajaDe("elemento", el.id, el);
              const elegido = seleccion?.tipo === "elemento" && seleccion.id === el.id;
              const dibujado = DIBUJADOS.has(el.tipo);
              const zona = ZONAS.has(el.tipo);
              const color = el.color ?? ELEMENTOS[el.tipo]?.color;
              const estilo: React.CSSProperties =
                el.tipo === "choza"
                  ? techoQuincho(el.color)
                  : dibujado
                    ? {}
                    : el.color
                      ? fondoConColor(el.tipo, el.color, ambientado)
                      : el.tipo === "toldo" && !ambientado
                        ? fondoConColor("toldo", color ?? "#b91c1c", false)
                        : ambientado
                          ? (AMBIENTE[el.tipo] ?? {})
                          : {};
              return (
                <div
                  key={el.id}
                  onPointerDown={(e) => empezar(e, "elemento", el.id, el)}
                  className={`absolute flex items-center justify-center text-[11px] font-semibold ${
                    el.tipo === "choza" ? "rounded-[30%]" : dibujado ? "rounded-full" : "rounded-md"
                  } ${ambientado || dibujado || el.color ? "" : `border ${ESTILO_ELEMENTO[el.tipo] ?? ""}`} ${
                    editando ? "cursor-grab active:cursor-grabbing" : ""
                  } ${elegido ? "ring-2 ring-marca ring-offset-1" : ""} ${arrastre?.id === el.id && !arrastre.valido ? "!border-red-500 opacity-70" : ""}`}
                  style={{ ...pct(caja), ...estilo }}
                  title={el.texto || ELEMENTOS[el.tipo]?.texto}
                >
                  {dibujado ? (
                    el.tipo === "planta" && ambientado ? (
                      <span className="h-full w-full rounded-full" style={AMBIENTE.planta} />
                    ) : (
                      <Dibujo tipo={el.tipo} color={el.color ?? ELEMENTOS[el.tipo]?.color} />
                    )
                  ) : (
                    <span
                      className={`max-w-full truncate px-1 ${zona ? "self-start pt-0.5 text-[10px] uppercase tracking-wider opacity-80" : ""}`}
                      style={tres ? { transform: "translateZ(1px)" } : undefined}
                    >
                      {el.texto || ELEMENTOS[el.tipo]?.texto}
                    </span>
                  )}
                  {el.asientos && el.asientos.n > 0 && (
                    <AsientosBarra asientos={el.asientos} ancho={caja.ancho} alto={caja.alto} ambientado={ambientado} />
                  )}
                </div>
              );
            })}

          {/* Cuerda verde entre mesas unidas (por debajo: si quedaron pegadas, casi no se ve). */}
          {!editando && enPiso.some((m) => estados.get(m.id)?.principal) && (
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox={`0 0 ${piso.columnas} ${piso.filas}`}
              preserveAspectRatio="none"
              aria-hidden
            >
              {enPiso.map((m) => {
                const principal = enPiso.find((x) => x.id === estados.get(m.id)?.principal);
                if (!principal) return null;
                const a = cajaDe("mesa", m.id, cajaMesa(m));
                const b = cajaMesa(principal);
                const linea = {
                  x1: a.x + a.ancho / 2,
                  y1: a.y + a.alto / 2,
                  x2: b.x + b.ancho / 2,
                  y2: b.y + b.alto / 2,
                  vectorEffect: "non-scaling-stroke" as const,
                  strokeLinecap: "round" as const,
                };
                return (
                  <g key={m.id}>
                    <line {...linea} stroke="#14532d" strokeWidth={7} />
                    <line {...linea} stroke="#22c55e" strokeWidth={4} strokeDasharray="7 5" />
                  </g>
                );
              })}
            </svg>
          )}

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
                  ambientado
                    ? "text-[#fff7ed]"
                    : `border-2 shadow-sm ${m.color && (editando || !est?.ocupada) ? "" : colorMesa(editando ? undefined : est)}`
                } ${m.forma === "redonda" ? "rounded-full" : ambientado ? "rounded-md" : "rounded-xl"} ${
                  editando || movibles?.has(m.id) ? "cursor-grab touch-none active:cursor-grabbing" : "hover:shadow-md"
                } ${elegido ? (editando ? "ring-2 ring-marca ring-offset-2" : "animate-pulse ring-4 ring-marca ring-offset-2") : ""} ${invalido ? "!border-red-500 !bg-red-50 opacity-80" : ""} ${
                  !editando && est?.destacada ? "ring-4 ring-sky-400 ring-offset-2" : ""
                } ${!editando && est?.apagada ? "opacity-35" : ""}`}
                style={{
                  ...pct(caja),
                  // Color elegido para la mesa (en el simple, mientras está libre; ocupada manda el color del estado).
                  ...(!ambientado && m.color && (editando || !est?.ocupada)
                    ? { background: m.color, color: textoSobre(m.color), borderColor: tono(m.color, 0.3) }
                    : {}),
                  ...(ambientado
                    ? {
                        // Madera (o el color elegido) con un halo del color del estado para verla de lejos.
                        background: m.color
                          ? `linear-gradient(135deg,${tono(m.color, -0.15)},${m.color} 55%,${tono(m.color, 0.2)})`
                          : "linear-gradient(135deg,#a8774a,#7b5332 55%,#6a4529)",
                        color: m.color ? textoSobre(m.color) : undefined,
                        boxShadow: `${tres ? "0 2px 0 #4a2e18, 0 4px 0 #3d2614, 0 10px 14px rgb(0 0 0 / 0.55)" : "0 3px 8px rgb(0 0 0 / 0.45)"}, 0 0 0 ${est?.ocupada && !editando ? 3 : 0}px ${colorSillas(est)}`,
                        transformStyle: tres ? "preserve-3d" : undefined,
                      }
                    : {}),
                }}
                aria-label={`${nombreMesa(m.numero)}${est?.ocupada ? ", ocupada" : ", libre"}`}
              >
                {
                  <Sillas
                    forma={m.forma}
                    capacidad={m.capacidad ?? 4}
                    sillas={m.sillas}
                    color={
                      !ambientado
                        ? editando || !est?.ocupada
                          ? "#a8a29e"
                          : colorSillas(est)
                        : editando
                          ? "#56604f"
                          : colorSillas(est)
                    }
                    ancho={caja.ancho}
                    alto={caja.alto}
                  />
                }
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
