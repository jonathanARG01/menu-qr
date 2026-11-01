import type { CSSProperties, ReactNode } from "react";
import { disenoSello, emojiSello, type ProgramaSellos } from "@/lib/sellos/tipos";
import { fuenteMono, fuentePop, fuenteSerif, fuenteTiza } from "@/lib/sellos/fuentes";
import { textoSobre } from "@/lib/utils";

// La tarjeta de sellos como se ve en el celular: marca del local, sellos ganados y por ganar, y el premio.
// Se usa en la tarjeta del cliente, en la página para unirse, en la vista previa del panel y en el selector de diseños.
// Cada diseño (programa.diseno) es un componente de este archivo; todos usan el color, el logo y el dibujo del local.

type Props = {
  local: string;
  logo?: string | null;
  programa: Pick<ProgramaSellos, "meta" | "premio" | "color" | "icono"> & { diseno?: string };
  sellos: number;
  premios?: number;
  nombre?: string;
  pie?: ReactNode;
  // Cuántos de los últimos sellos aparecen con animación (recién sumados).
  animarUltimos?: number;
};

type Celda = { i: number; lleno: boolean; ultimo: boolean; anim: { className: string; style?: CSSProperties } };

type Datos = {
  local: string;
  logo: string | null;
  meta: number;
  premio: string;
  color: string;
  emoji: string;
  sellos: number;
  premios: number;
  nombre?: string;
  pie?: ReactNode;
  celdas: Celda[];
  columnas: number;
};

export function TarjetaVisual(props: Props) {
  const meta = Math.max(1, props.programa.meta);
  const sellos = Math.min(meta, Math.max(0, props.sellos));
  const animar = props.animarUltimos ?? 0;
  const color = /^#[0-9a-f]{6}$/i.test(props.programa.color) ? props.programa.color : "#23345c";
  const d: Datos = {
    local: props.local,
    logo: props.logo ?? null,
    meta,
    premio: props.programa.premio,
    color,
    emoji: emojiSello(props.programa.icono),
    sellos,
    premios: props.premios ?? 0,
    nombre: props.nombre,
    pie: props.pie,
    columnas: meta <= 6 ? meta : meta <= 8 ? 4 : meta <= 10 ? 5 : 6,
    celdas: Array.from({ length: meta }, (_, i) => {
      const lleno = i < sellos;
      const nuevo = lleno && i >= sellos - animar;
      return {
        i,
        lleno,
        ultimo: i === meta - 1,
        anim: nuevo
          ? { className: "animate-[sello_0.5s_ease-out_both]", style: { animationDelay: `${(i - (sellos - animar)) * 120}ms` } }
          : { className: "" },
      };
    }),
  };
  const Diseno = DISENOS[disenoSello(props.programa.diseno)];
  return (
    <>
      <Diseno {...d} />
      <span className="sr-only">
        {sellos} de {meta} sellos. Premio: {d.premio}
      </span>
    </>
  );
}

// ---------- Colores ----------

function rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const alfa = (hex: string, a: number) => `rgba(${rgb(hex).join(",")},${a})`;
function mezclar(hex: string, con: string, t: number) {
  const x = rgb(hex);
  const y = rgb(con);
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}
function luz(hex: string) {
  const [r, g, b] = rgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
// Tinta legible sobre papel claro.
const tintaSobreClaro = (hex: string) => (luz(hex) > 0.6 ? mezclar(hex, "#000000", 0.5) : hex);
// Color que brilla sobre fondo oscuro.
const brilloSobreOscuro = (hex: string) => (luz(hex) < 0.45 ? mezclar(hex, "#ffffff", 0.45) : hex);
// Giro fijo y distinto para cada sello (sello de goma puesto a mano).
const giro = (i: number) => ((i * 37) % 25) - 12;

// ---------- Piezas comunes ----------

function Logo({ d, className, style }: { d: Datos; className: string; style?: CSSProperties }) {
  return d.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={d.logo} alt="" className={`shrink-0 object-contain ${className}`} style={style} />
  ) : (
    <span className={`flex shrink-0 items-center justify-center font-bold ${className}`} style={style}>
      {d.local.charAt(0).toUpperCase()}
    </span>
  );
}

function Listo({ d, className, style }: { d: Datos; className?: string; style?: CSSProperties }) {
  if (d.premios <= 0) return null;
  return (
    <p className={`mt-3 px-3 py-2 text-center text-sm font-bold ${className ?? "rounded-xl bg-white text-emerald-700"}`} style={style}>
      🎉 {d.premios === 1 ? "Tienes un premio listo" : `Tienes ${d.premios} premios listos`}
    </p>
  );
}

function Grilla({ d, className, style, children }: { d: Datos; className?: string; style?: CSSProperties; children: (c: Celda) => ReactNode }) {
  return (
    <div className={`grid ${className ?? "gap-2"}`} style={{ gridTemplateColumns: `repeat(${d.columnas}, minmax(0, 1fr))`, ...style }} aria-hidden>
      {d.celdas.map(children)}
    </div>
  );
}

function Contenido({ c, d, vacio }: { c: Celda; d: Datos; vacio?: ReactNode }) {
  if (c.lleno) return <>{d.emoji}</>;
  if (c.ultimo) return <>🎁</>;
  return <>{vacio ?? <span className="text-xs opacity-60">{c.i + 1}</span>}</>;
}

// ---------- 1. Clásica ----------

function Clasica(d: Datos) {
  const tinta = textoSobre(d.color);
  return (
    <div className="w-full max-w-sm overflow-hidden rounded-3xl p-5 shadow-xl" style={{ background: d.color, color: tinta }}>
      <div className="flex items-start gap-3">
        <Logo d={d} className={`h-11 w-11 rounded-xl text-lg ${d.logo ? "bg-white p-1" : "bg-white/20"}`} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold leading-tight">{d.local}</p>
          <p className="text-xs opacity-75">Tarjeta de sellos</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider opacity-70">Sellos</p>
          <p className="text-xl font-extrabold tabular-nums leading-none">
            {d.sellos}/{d.meta}
          </p>
        </div>
      </div>
      <Grilla d={d} className="mt-4 gap-2 rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.12)" }}>
        {(c) => (
          <span
            key={c.i}
            className={`flex aspect-square items-center justify-center rounded-full text-lg ${c.anim.className}`}
            style={
              c.lleno
                ? { background: "#ffffff", ...c.anim.style }
                : { border: `1.5px dashed ${tinta === "#ffffff" ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.3)"}` }
            }
          >
            <Contenido c={c} d={d} />
          </span>
        )}
      </Grilla>
      <div className="mt-4 flex items-end justify-between gap-3 text-sm">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider opacity-70">Premio</p>
          <p className="font-semibold leading-snug">{d.premio}</p>
        </div>
        {d.nombre && (
          <div className="min-w-0 text-right">
            <p className="text-[10px] uppercase tracking-wider opacity-70">Nombre</p>
            <p className="truncate font-semibold">{d.nombre}</p>
          </div>
        )}
      </div>
      <Listo d={d} />
      {d.pie}
    </div>
  );
}

// ---------- 2. Boleto ----------

function Boleto(d: Datos) {
  const tinta = tintaSobreClaro(d.color);
  const corte = "radial-gradient(circle 13px at 0 118px, #0000 97%, #000), radial-gradient(circle 13px at 100% 118px, #0000 97%, #000)";
  return (
    <div className="w-full max-w-sm" style={{ filter: "drop-shadow(0 12px 20px rgba(0,0,0,0.22))" }}>
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{
          background: "#fbf6ea",
          color: "#1f1a14",
          WebkitMask: corte,
          WebkitMaskComposite: "source-in",
          mask: corte,
          maskComposite: "intersect",
        }}
      >
        <div className="flex h-[118px] items-center gap-3 px-5" style={{ background: tinta, color: textoSobre(tinta) }}>
          <Logo d={d} className={`h-12 w-12 rounded-full text-lg ${d.logo ? "bg-white p-1" : "bg-white/20"}`} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold uppercase leading-tight" style={{ fontFamily: fuenteMono.style.fontFamily }}>
              {d.local}
            </p>
            <p className="text-[10px] uppercase tracking-[0.3em] opacity-80" style={{ fontFamily: fuenteMono.style.fontFamily }}>
              Pase de cliente frecuente
            </p>
          </div>
          <div className="rounded-md border border-current px-2 py-1 text-center" style={{ fontFamily: fuenteMono.style.fontFamily }}>
            <p className="text-[9px] uppercase">Sellos</p>
            <p className="text-base font-bold leading-none tabular-nums">
              {d.sellos}/{d.meta}
            </p>
          </div>
        </div>
        <div className="mx-5 border-t-2 border-dashed" style={{ borderColor: alfa("#1f1a14", 0.25) }} />
        <div className="px-5 pb-5 pt-4">
          <Grilla d={d} className="gap-2.5">
            {(c) => (
              <span
                key={c.i}
                className={`flex aspect-square items-center justify-center ${c.anim.className}`}
                style={c.anim.style}
              >
                <span
                  className="flex h-full w-full items-center justify-center rounded-full text-lg"
                  style={
                    c.lleno
                      ? {
                          border: `2.5px solid ${tinta}`,
                          boxShadow: `inset 0 0 0 3px #fbf6ea, inset 0 0 0 4.5px ${alfa(tinta, 0.7)}`,
                          background: alfa(tinta, 0.08),
                          transform: `rotate(${giro(c.i)}deg)`,
                        }
                      : { border: `1.5px dashed ${alfa("#1f1a14", 0.3)}`, color: alfa("#1f1a14", 0.6), fontFamily: fuenteMono.style.fontFamily }
                  }
                >
                  <Contenido c={c} d={d} />
                </span>
              </span>
            )}
          </Grilla>
          <div className="mt-4 flex items-end justify-between gap-3" style={{ fontFamily: fuenteMono.style.fontFamily }}>
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-widest opacity-60">Premio</p>
              <p className="text-sm font-bold leading-snug">{d.premio}</p>
            </div>
            {d.nombre && (
              <div className="min-w-0 text-right">
                <p className="text-[9px] uppercase tracking-widest opacity-60">Pasajero</p>
                <p className="truncate text-sm font-bold uppercase">{d.nombre}</p>
              </div>
            )}
          </div>
          {!d.pie && (
            <div
              className="mt-4 h-8 w-full opacity-80"
              style={{
                background:
                  "repeating-linear-gradient(90deg, #1f1a14 0 2px, transparent 2px 4px, #1f1a14 4px 5px, transparent 5px 8px, #1f1a14 8px 11px, transparent 11px 13px)",
              }}
            />
          )}
          <Listo d={d} className="rounded-lg text-white" style={{ background: tinta, color: textoSobre(tinta) }} />
          {d.pie}
        </div>
      </div>
    </div>
  );
}

// ---------- 3. De época ----------

function Esquina({ color, className }: { color: string; className: string }) {
  return (
    <svg viewBox="0 0 40 40" className={`absolute h-9 w-9 ${className}`} fill="none" stroke={color} strokeWidth="1.6" aria-hidden>
      <path d="M2 38V8a6 6 0 0 1 6-6h30" />
      <path d="M8 38V16a8 8 0 0 1 8-8h22" opacity=".6" />
      <circle cx="16" cy="16" r="3" fill={color} stroke="none" />
      <path d="M20 4c4 0 6 3 6 6M4 20c0 4 3 6 6 6" />
    </svg>
  );
}

function Epoca(d: Datos) {
  const tinta = tintaSobreClaro(d.color);
  const serif = fuenteSerif.style.fontFamily;
  return (
    <div
      className="relative w-full max-w-sm overflow-hidden rounded-xl p-6 shadow-xl"
      style={{
        color: tinta,
        background:
          "radial-gradient(circle at 20% 15%, rgba(255,255,255,.55), transparent 45%), radial-gradient(circle at 85% 90%, rgba(120,90,40,.12), transparent 50%), #f1e6cf",
      }}
    >
      <div className="pointer-events-none absolute inset-2 rounded-lg border-2" style={{ borderColor: tinta }} />
      <div className="pointer-events-none absolute inset-[13px] rounded-md border" style={{ borderColor: alfa(tinta, 0.5) }} />
      <Esquina color={tinta} className="left-3 top-3" />
      <Esquina color={tinta} className="right-3 top-3 rotate-90" />
      <Esquina color={tinta} className="bottom-3 right-3 rotate-180" />
      <Esquina color={tinta} className="bottom-3 left-3 -rotate-90" />

      <div className="relative text-center">
        <Logo d={d} className="mx-auto h-14 w-14 rounded-full border-2 bg-[#f8f0de] p-1 text-2xl" style={{ borderColor: tinta, fontFamily: serif }} />
        <p className="mt-2 text-2xl font-black uppercase leading-none tracking-wide" style={{ fontFamily: serif }}>
          {d.local}
        </p>
        <p className="mt-1 text-sm italic opacity-80" style={{ fontFamily: serif }}>
          ~ Tarjeta de la casa ~
        </p>
      </div>
      <Grilla d={d} className="relative mt-4 gap-2.5 px-1">
        {(c) => (
          <span key={c.i} className={`flex aspect-square items-center justify-center ${c.anim.className}`} style={c.anim.style}>
            <span
              className="flex h-full w-full items-center justify-center rounded-full text-lg"
              style={
                c.lleno
                  ? {
                      background: tinta,
                      boxShadow: `0 0 0 2px #f1e6cf, 0 0 0 3.5px ${tinta}`,
                      transform: `rotate(${giro(c.i)}deg)`,
                      filter: "saturate(.85)",
                    }
                  : { border: `1.5px solid ${alfa(tinta, 0.45)}`, fontFamily: serif }
              }
            >
              {c.lleno ? <span className="drop-shadow-sm">{d.emoji}</span> : <Contenido c={c} d={d} />}
            </span>
          </span>
        )}
      </Grilla>
      <div className="relative mt-4 text-center" style={{ fontFamily: serif }}>
        <p className="text-xs uppercase tracking-[0.25em] opacity-70">
          {d.sellos} de {d.meta} sellos
        </p>
        <p className="mt-1 text-base italic leading-snug">Reúne la tarjeta y llévate {d.premio.charAt(0).toLowerCase() + d.premio.slice(1)}</p>
        {d.nombre && <p className="mt-2 text-sm font-bold">Para {d.nombre}</p>}
      </div>
      <div className="relative">
        <Listo d={d} className="rounded-md text-[#f1e6cf]" style={{ background: tinta, fontFamily: serif }} />
        {d.pie}
      </div>
    </div>
  );
}

// ---------- 4. Neón ----------

function Neon(d: Datos) {
  const luzNeon = brilloSobreOscuro(d.color);
  const brillo = (a = 1) => `0 0 6px ${alfa(luzNeon, 0.9 * a)}, 0 0 16px ${alfa(luzNeon, 0.6 * a)}`;
  return (
    <div
      className="w-full max-w-sm overflow-hidden rounded-3xl p-5 text-white shadow-xl"
      style={{
        background: `linear-gradient(${alfa(luzNeon, 0.06)} 1px, transparent 1px) 0 0/22px 22px, linear-gradient(90deg, ${alfa(luzNeon, 0.06)} 1px, transparent 1px) 0 0/22px 22px, radial-gradient(circle at 50% 0%, ${alfa(luzNeon, 0.25)}, transparent 60%), #0b0b12`,
        boxShadow: `0 0 0 1px ${alfa(luzNeon, 0.35)}, 0 18px 40px rgba(0,0,0,.35)`,
      }}
    >
      <div className="flex items-center gap-3">
        <Logo d={d} className={`h-11 w-11 rounded-xl text-lg ${d.logo ? "bg-white p-1" : ""}`} style={{ boxShadow: brillo(0.8), border: d.logo ? undefined : `1.5px solid ${luzNeon}` }} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold leading-tight" style={{ textShadow: brillo(0.7) }}>
            {d.local}
          </p>
          <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: luzNeon }}>
            Club de sellos
          </p>
        </div>
        <p className="text-3xl font-black tabular-nums" style={{ color: luzNeon, textShadow: brillo() }}>
          {d.sellos}
          <span className="text-base opacity-70">/{d.meta}</span>
        </p>
      </div>
      <Grilla d={d} className="mt-5 gap-3">
        {(c) => (
          <span
            key={c.i}
            className={`flex aspect-square items-center justify-center rounded-full text-lg ${c.anim.className}`}
            style={
              c.lleno
                ? { border: `2px solid ${luzNeon}`, boxShadow: `${brillo()}, inset ${brillo(0.6)}`, background: alfa(luzNeon, 0.12), ...c.anim.style }
                : { border: `1.5px solid ${alfa(luzNeon, 0.25)}`, color: alfa(luzNeon, 0.8) }
            }
          >
            <Contenido c={c} d={d} />
          </span>
        )}
      </Grilla>
      <div className="mt-5 flex items-end justify-between gap-3 text-sm">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.25em] opacity-60">Premio</p>
          <p className="font-semibold leading-snug" style={{ color: luzNeon, textShadow: brillo(0.5) }}>
            {d.premio}
          </p>
        </div>
        {d.nombre && <p className="truncate font-semibold opacity-90">{d.nombre}</p>}
      </div>
      <Listo d={d} className="rounded-xl text-[#0b0b12]" style={{ background: luzNeon, boxShadow: brillo() }} />
      {d.pie}
    </div>
  );
}

// ---------- 5. Pasaporte ----------

const FORMAS_PASAPORTE = [
  "50%",
  "14px",
  "polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%)",
  "50% 50% 50% 50% / 38% 38% 62% 62%",
  "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
];

function Pasaporte(d: Datos) {
  const tapa = luz(d.color) > 0.35 ? mezclar(d.color, "#000000", 0.55) : d.color;
  const tinta = tintaSobreClaro(d.color);
  const oro = "linear-gradient(135deg, #f7e7b4, #c9a14a 45%, #f3dc9a 70%, #b8892f)";
  const serif = fuenteSerif.style.fontFamily;
  const dorado: CSSProperties = { backgroundImage: oro, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" };
  return (
    <div
      className="w-full max-w-sm overflow-hidden rounded-2xl p-4 shadow-xl"
      style={{ background: `repeating-linear-gradient(45deg, rgba(255,255,255,.035) 0 2px, transparent 2px 7px), ${tapa}` }}
    >
      <div className="flex items-center gap-3 px-1">
        <Logo d={d} className="h-12 w-12 rounded-full p-1 text-xl" style={{ border: "2px solid #c9a14a", background: d.logo ? "#fff" : "transparent", color: "#e8cf8a" }} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.45em]" style={dorado}>
            Pasaporte
          </p>
          <p className="truncate text-xl font-bold leading-tight" style={{ ...dorado, fontFamily: serif }}>
            {d.local}
          </p>
        </div>
        <p className="text-right text-xs font-bold tabular-nums" style={dorado}>
          {d.sellos}/{d.meta}
          <br />
          <span className="text-[9px] uppercase tracking-widest">visas</span>
        </p>
      </div>
      <div
        className="mt-4 rounded-xl p-3"
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(120,100,60,.06) 0 1px, transparent 1px 18px), radial-gradient(circle at 70% 30%, rgba(201,161,74,.12), transparent 55%), #f6efdf",
          color: tinta,
        }}
      >
        <Grilla d={d} className="gap-2.5">
          {(c) => (
            <span key={c.i} className={`flex aspect-square items-center justify-center ${c.anim.className}`} style={c.anim.style}>
              {c.lleno ? (
                <span
                  className="flex h-full w-full flex-col items-center justify-center text-base leading-none"
                  style={{
                    border: `2px solid ${alfa(tinta, 0.85)}`,
                    outline: `1px solid ${alfa(tinta, 0.5)}`,
                    outlineOffset: "-5px",
                    clipPath: FORMAS_PASAPORTE[c.i % FORMAS_PASAPORTE.length].startsWith("polygon") ? FORMAS_PASAPORTE[c.i % FORMAS_PASAPORTE.length] : undefined,
                    borderRadius: FORMAS_PASAPORTE[c.i % FORMAS_PASAPORTE.length].startsWith("polygon") ? undefined : FORMAS_PASAPORTE[c.i % FORMAS_PASAPORTE.length],
                    background: FORMAS_PASAPORTE[c.i % FORMAS_PASAPORTE.length].startsWith("polygon") ? alfa(tinta, 0.18) : alfa(tinta, 0.07),
                    transform: `rotate(${giro(c.i)}deg)`,
                  }}
                >
                  {d.emoji}
                  <span className="mt-0.5 text-[7px] font-bold tracking-wider" style={{ fontFamily: fuenteMono.style.fontFamily }}>
                    Nº{c.i + 1}
                  </span>
                </span>
              ) : (
                <span
                  className="flex h-full w-full items-center justify-center rounded-full text-sm"
                  style={{ border: `1.5px dotted ${alfa(tinta, 0.35)}`, color: alfa(tinta, 0.5), fontFamily: serif }}
                >
                  {c.ultimo ? "🎁" : c.i + 1}
                </span>
              )}
            </span>
          )}
        </Grilla>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 px-1 text-xs" style={{ color: "#e8cf8a" }}>
        <div className="min-w-0">
          <p className="text-[9px] uppercase tracking-[0.3em] opacity-70">Destino</p>
          <p className="font-semibold leading-snug" style={{ fontFamily: serif }}>
            {d.premio}
          </p>
        </div>
        {d.nombre && (
          <div className="min-w-0 text-right">
            <p className="text-[9px] uppercase tracking-[0.3em] opacity-70">Titular</p>
            <p className="truncate font-semibold" style={{ fontFamily: serif }}>
              {d.nombre}
            </p>
          </div>
        )}
      </div>
      <Listo d={d} className="rounded-lg text-[#3b2a07]" style={{ backgroundImage: oro }} />
      <div className="text-[#e8cf8a]">{d.pie}</div>
    </div>
  );
}

// ---------- 6. Editorial ----------

function Editorial(d: Datos) {
  const serif = fuenteSerif.style.fontFamily;
  const acento = tintaSobreClaro(d.color);
  return (
    <div className="w-full max-w-sm overflow-hidden rounded-[28px] bg-white p-6 text-[#111] shadow-xl ring-1 ring-black/5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Logo d={d} className="h-7 w-7 rounded-full text-xs text-white" style={{ background: d.logo ? undefined : acento }} />
          <p className="truncate text-xs font-semibold uppercase tracking-[0.25em]">{d.local}</p>
        </div>
        <p className="text-[10px] uppercase tracking-[0.25em] text-black/40">Nº {String(d.sellos).padStart(2, "0")}</p>
      </div>
      <div className="mt-6 flex items-end gap-2">
        <p className="text-[84px] font-black leading-[0.8] tabular-nums" style={{ fontFamily: serif, color: acento }}>
          {d.sellos}
        </p>
        <p className="pb-1 text-2xl font-light text-black/35" style={{ fontFamily: serif }}>
          / {d.meta}
        </p>
      </div>
      <div className="mt-4 h-[3px] w-full overflow-hidden rounded-full bg-black/10">
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${(d.sellos / d.meta) * 100}%`, background: acento }} />
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5" aria-hidden>
        {d.celdas.map((c) => (
          <span
            key={c.i}
            className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${c.anim.className}`}
            style={c.lleno ? { background: alfa(acento, 0.12), ...c.anim.style } : { border: "1px solid rgba(0,0,0,.15)" }}
          >
            {c.lleno ? d.emoji : c.ultimo ? <span className="text-xs">🎁</span> : null}
          </span>
        ))}
      </div>
      <p className="mt-5 text-xl italic leading-snug" style={{ fontFamily: serif }}>
        {d.premio}
      </p>
      <p className="mt-1 text-xs text-black/50">
        {d.sellos >= d.meta ? "Tarjeta completa" : `Te ${d.meta - d.sellos === 1 ? "falta 1 sello" : `faltan ${d.meta - d.sellos} sellos`}`}
        {d.nombre ? ` · ${d.nombre}` : ""}
      </p>
      <Listo d={d} className="rounded-full text-white" style={{ background: acento }} />
      {d.pie}
    </div>
  );
}

// ---------- 7. Aurora ----------

function Aurora(d: Datos) {
  const base = luz(d.color) > 0.7 ? mezclar(d.color, "#000000", 0.35) : d.color;
  return (
    <div
      className="w-full max-w-sm overflow-hidden rounded-[32px] p-5 text-white shadow-xl"
      style={{
        background: `radial-gradient(circle at 10% 10%, ${mezclar(base, "#ff7ab6", 0.55)}, transparent 50%), radial-gradient(circle at 90% 20%, ${mezclar(base, "#7af0ff", 0.5)}, transparent 45%), radial-gradient(circle at 70% 100%, ${mezclar(base, "#ffd36e", 0.45)}, transparent 55%), ${mezclar(base, "#000000", 0.15)}`,
      }}
    >
      <div className="rounded-3xl border border-white/30 bg-white/15 p-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Logo d={d} className={`h-11 w-11 rounded-2xl text-lg ${d.logo ? "bg-white p-1" : "bg-white/25"}`} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold leading-tight drop-shadow">{d.local}</p>
            <p className="text-xs text-white/80">Tu tarjeta de sellos</p>
          </div>
          <span className="rounded-full bg-white/25 px-3 py-1 text-sm font-bold tabular-nums">
            {d.sellos}/{d.meta}
          </span>
        </div>
        <Grilla d={d} className="mt-4 gap-2.5">
          {(c) => (
            <span
              key={c.i}
              className={`flex aspect-square items-center justify-center rounded-2xl text-lg ${c.anim.className}`}
              style={
                c.lleno
                  ? { background: "rgba(255,255,255,.92)", boxShadow: "0 6px 14px rgba(0,0,0,.15)", ...c.anim.style }
                  : { background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.35)" }
              }
            >
              <Contenido c={c} d={d} />
            </span>
          )}
        </Grilla>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3 px-1 text-sm">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-white/70">Premio</p>
          <p className="font-semibold leading-snug drop-shadow">{d.premio}</p>
        </div>
        {d.nombre && <p className="truncate font-semibold drop-shadow">{d.nombre}</p>}
      </div>
      <Listo d={d} className="rounded-2xl bg-white/90 text-emerald-700" />
      {d.pie}
    </div>
  );
}

// ---------- 8. Pizarra ----------

function Pizarra(d: Datos) {
  const tiza = fuenteTiza.style.fontFamily;
  const acento = brilloSobreOscuro(d.color);
  const bordes = ["48% 52% 45% 55% / 52% 46% 54% 48%", "55% 45% 50% 50% / 45% 55% 48% 52%", "50% 50% 56% 44% / 50% 52% 48% 50%"];
  return (
    <div
      className="w-full max-w-sm overflow-hidden rounded-2xl p-2.5 shadow-xl"
      style={{ background: "linear-gradient(135deg, #a0703f, #6e4522 50%, #94643a)", boxShadow: "0 14px 30px rgba(0,0,0,.3)" }}
    >
      <div
        className="rounded-lg p-5 text-[#f4f1e8]"
        style={{
          fontFamily: tiza,
          background:
            "radial-gradient(circle at 30% 20%, rgba(255,255,255,.07), transparent 40%), radial-gradient(circle at 80% 80%, rgba(255,255,255,.05), transparent 45%), #253229",
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,.4), inset 0 4px 14px rgba(0,0,0,.45)",
        }}
      >
        <div className="flex items-center gap-3">
          <Logo d={d} className={`h-11 w-11 rounded-full text-2xl ${d.logo ? "bg-white/90 p-1" : ""}`} style={d.logo ? undefined : { border: "2px solid rgba(244,241,232,.7)" }} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-3xl font-bold leading-none">{d.local}</p>
            <svg viewBox="0 0 200 8" className="mt-0.5 h-2 w-32" aria-hidden>
              <path d="M2 5c40-4 80 2 120-1s50 1 76-1" fill="none" stroke={acento} strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-3xl font-bold tabular-nums" style={{ color: acento }}>
            {d.sellos}/{d.meta}
          </p>
        </div>
        <Grilla d={d} className="mt-4 gap-2.5">
          {(c) => (
            <span
              key={c.i}
              className={`flex aspect-square items-center justify-center text-xl ${c.anim.className}`}
              style={{
                borderRadius: bordes[c.i % bordes.length],
                border: c.lleno ? `2.5px solid ${acento}` : "2px dashed rgba(244,241,232,.35)",
                background: c.lleno ? "rgba(244,241,232,.08)" : undefined,
                ...c.anim.style,
              }}
            >
              {c.lleno ? d.emoji : c.ultimo ? "🎁" : <span className="text-lg opacity-50">{c.i + 1}</span>}
            </span>
          )}
        </Grilla>
        <p className="mt-4 text-2xl leading-tight">
          Premio: <span style={{ color: acento }}>{d.premio}</span>
        </p>
        {d.nombre && <p className="text-xl opacity-80">Tarjeta de {d.nombre}</p>}
        <Listo d={d} className="rounded-lg text-[#253229]" style={{ background: "#f4f1e8", fontFamily: tiza, fontSize: "1.2rem" }} />
        {d.pie}
      </div>
    </div>
  );
}

// ---------- 9. Camino ----------

function Camino(d: Datos) {
  const tinta = tintaSobreClaro(d.color);
  const columnas = d.meta <= 8 ? 4 : 5;
  const filas = Math.ceil(d.meta / columnas);
  // Centros en zigzag (ida y vuelta), en unidades de celda.
  const puntos = d.celdas.map((c) => {
    const fila = Math.floor(c.i / columnas);
    const pos = c.i % columnas;
    const col = fila % 2 === 0 ? pos : columnas - 1 - pos;
    return { x: col + 0.5, y: fila + 0.5 };
  });
  const tramo = (hasta: number) =>
    puntos
      .slice(0, hasta)
      .map((p, i) => {
        if (i === 0) return `M${p.x} ${p.y}`;
        const a = puntos[i - 1];
        if (a.y === p.y) return `L${p.x} ${p.y}`;
        // Cambio de fila: curva hacia afuera de la tarjeta.
        const lado = a.x > columnas / 2 ? 0.45 : -0.45;
        return `C${a.x + lado} ${a.y} ${p.x + lado} ${p.y} ${p.x} ${p.y}`;
      })
      .join(" ");
  return (
    <div
      className="w-full max-w-sm overflow-hidden rounded-3xl p-5 shadow-xl"
      style={{ background: `linear-gradient(180deg, ${mezclar(d.color, "#ffffff", 0.9)}, ${mezclar(d.color, "#ffffff", 0.78)})`, color: "#1c1917" }}
    >
      <div className="flex items-center gap-3">
        <Logo d={d} className="h-11 w-11 rounded-full text-lg text-white" style={{ background: d.logo ? "#fff" : tinta, padding: d.logo ? 4 : undefined }} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-extrabold leading-tight">{d.local}</p>
          <p className="text-xs" style={{ color: tinta }}>
            {d.sellos >= d.meta ? "¡Llegaste a la meta!" : `Vas en el sello ${d.sellos} de ${d.meta}`}
          </p>
        </div>
      </div>
      <div className="relative mt-4" style={{ aspectRatio: `${columnas} / ${filas}` }} aria-hidden>
        <svg viewBox={`0 0 ${columnas} ${filas}`} className="absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none">
          <path d={tramo(d.meta)} fill="none" stroke={alfa(tinta, 0.3)} strokeWidth={0.07} strokeDasharray="0.12 0.12" strokeLinecap="round" />
          {d.sellos > 1 && <path d={tramo(d.sellos)} fill="none" stroke={tinta} strokeWidth={0.1} strokeLinecap="round" />}
        </svg>
        {d.celdas.map((c) => (
          <span
            key={c.i}
            className={`absolute flex items-center justify-center rounded-full ${c.anim.className}`}
            style={{
              left: `${(puntos[c.i].x / columnas) * 100}%`,
              top: `${(puntos[c.i].y / filas) * 100}%`,
              width: c.ultimo ? "17%" : "13%",
              aspectRatio: "1",
              translate: "-50% -50%",
              fontSize: c.ultimo ? "1.35rem" : "1rem",
              background: c.lleno ? tinta : "#ffffff",
              border: c.lleno ? "3px solid #fff" : `2px solid ${alfa(tinta, 0.35)}`,
              boxShadow: c.lleno ? `0 4px 10px ${alfa(tinta, 0.35)}` : undefined,
              color: alfa(tinta, 0.7),
              ...c.anim.style,
            }}
          >
            {c.lleno ? d.emoji : c.ultimo ? "🏆" : <span className="text-[11px] font-bold">{c.i + 1}</span>}
          </span>
        ))}
      </div>
      <div className="mt-4 flex items-end justify-between gap-3 text-sm">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: tinta }}>
            Meta
          </p>
          <p className="font-semibold leading-snug">{d.premio}</p>
        </div>
        {d.nombre && <p className="truncate font-semibold">{d.nombre}</p>}
      </div>
      <Listo d={d} className="rounded-xl text-white" style={{ background: tinta }} />
      {d.pie}
    </div>
  );
}

// ---------- 10. Círculo ----------

function Circulo(d: Datos) {
  const tinta = tintaSobreClaro(d.color);
  const tam = d.meta <= 8 ? 17 : d.meta <= 12 ? 14 : d.meta <= 18 ? 11 : 8.5;
  const avance = (d.sellos / d.meta) * 100;
  return (
    <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white p-5 text-[#1c1917] shadow-xl ring-1 ring-black/5">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate font-extrabold">{d.local}</p>
        <p className="shrink-0 text-xs font-semibold" style={{ color: tinta }}>
          Tarjeta de sellos
        </p>
      </div>
      <div className="relative mx-auto mt-3 aspect-square w-full max-w-[300px]" aria-hidden>
        <div
          className="absolute inset-[16%] rounded-full"
          style={{
            background: `conic-gradient(${tinta} ${avance}%, ${alfa(tinta, 0.12)} ${avance}% 100%)`,
            WebkitMask: "radial-gradient(farthest-side, #0000 calc(100% - 7px), #000 calc(100% - 6px))",
            mask: "radial-gradient(farthest-side, #0000 calc(100% - 7px), #000 calc(100% - 6px))",
          }}
        />
        <div className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full text-center" style={{ background: alfa(tinta, 0.06) }}>
          <Logo d={d} className="h-12 w-12 rounded-full text-xl text-white" style={{ background: d.logo ? undefined : tinta }} />
          <p className="mt-1 text-3xl font-black tabular-nums leading-none" style={{ color: tinta }}>
            {d.sellos}
            <span className="text-base font-semibold text-black/35">/{d.meta}</span>
          </p>
        </div>
        {d.celdas.map((c) => {
          const angulo = (c.i / d.meta) * 2 * Math.PI - Math.PI / 2;
          return (
            <span
              key={c.i}
              className={`absolute flex items-center justify-center rounded-full ${c.anim.className}`}
              style={{
                width: `${tam}%`,
                aspectRatio: "1",
                left: `${50 + 42 * Math.cos(angulo)}%`,
                top: `${50 + 42 * Math.sin(angulo)}%`,
                translate: "-50% -50%",
                fontSize: tam > 12 ? "1.1rem" : tam > 9 ? "0.9rem" : "0.7rem",
                background: c.lleno ? tinta : "#fff",
                border: c.lleno ? "2px solid #fff" : `1.5px solid ${alfa(tinta, 0.3)}`,
                boxShadow: c.lleno ? `0 3px 8px ${alfa(tinta, 0.35)}` : undefined,
                color: alfa(tinta, 0.6),
                ...c.anim.style,
              }}
            >
              {c.lleno ? d.emoji : c.ultimo ? "🎁" : <span className="text-[10px] font-bold">{c.i + 1}</span>}
            </span>
          );
        })}
      </div>
      <div className="mt-2 text-center text-sm">
        <p className="font-semibold">{d.premio}</p>
        {d.nombre && <p className="text-xs text-black/50">{d.nombre}</p>}
      </div>
      <Listo d={d} className="rounded-full text-white" style={{ background: tinta }} />
      {d.pie}
    </div>
  );
}

// ---------- 11. Pop ----------

function Pop(d: Datos) {
  const fondo = d.color;
  const texto = textoSobre(fondo);
  const resalte = luz(fondo) > 0.7 ? "#ffffff" : "#ffd23f";
  const pop = fuentePop.style.fontFamily;
  const estrella = "polygon(50% 0, 61% 18%, 82% 9%, 80% 31%, 100% 38%, 85% 54%, 97% 73%, 75% 76%, 70% 98%, 50% 86%, 30% 98%, 25% 76%, 3% 73%, 15% 54%, 0 38%, 20% 31%, 18% 9%, 39% 18%)";
  return (
    <div className="w-full max-w-sm p-1.5 pb-2.5 pr-2.5">
      <div
        className="relative overflow-hidden rounded-2xl p-5"
        style={{ background: fondo, color: texto, border: "3px solid #111", boxShadow: "7px 7px 0 #111" }}
      >
        <div
          className="pointer-events-none absolute -right-6 -top-6 h-36 w-36 rounded-full opacity-25"
          style={{ background: "radial-gradient(#111 1.6px, transparent 1.8px) 0 0/9px 9px" }}
        />
        <div className="relative flex items-center gap-3">
          <Logo d={d} className="h-12 w-12 rounded-xl bg-white p-1 text-2xl text-[#111]" style={{ border: "2.5px solid #111", boxShadow: "3px 3px 0 #111", fontFamily: pop }} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-2xl uppercase leading-none" style={{ fontFamily: pop, textShadow: texto === "#ffffff" ? "2px 2px 0 #111" : undefined }}>
              {d.local}
            </p>
            <p className="mt-1 inline-block -rotate-2 rounded bg-[#111] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: resalte }}>
              Rewards
            </p>
          </div>
          <p className="text-3xl leading-none" style={{ fontFamily: pop }}>
            {d.sellos}/{d.meta}
          </p>
        </div>
        <Grilla d={d} className="relative mt-4 gap-2.5">
          {(c) => (
            <span key={c.i} className={`flex aspect-square items-center justify-center ${c.anim.className}`} style={c.anim.style}>
              {c.ultimo && !c.lleno ? (
                <span className="flex h-full w-full items-center justify-center text-lg" style={{ background: "#111", clipPath: estrella }}>
                  <span className="flex h-[86%] w-[86%] items-center justify-center" style={{ background: resalte, clipPath: estrella }}>
                    🎁
                  </span>
                </span>
              ) : (
                <span
                  className="flex h-full w-full items-center justify-center rounded-xl text-lg font-bold text-[#111]"
                  style={{
                    border: "2.5px solid #111",
                    background: c.lleno ? resalte : "#fff",
                    boxShadow: c.lleno ? "inset 0 -3px 0 rgba(0,0,0,.15)" : "3px 3px 0 #111",
                    transform: c.lleno ? "translate(2px, 2px)" : undefined,
                    fontFamily: pop,
                  }}
                >
                  {c.lleno ? d.emoji : <span className="text-sm opacity-40">{c.i + 1}</span>}
                </span>
              )}
            </span>
          )}
        </Grilla>
        <p className="relative mt-4 text-xl uppercase leading-tight" style={{ fontFamily: pop }}>
          Junta {d.meta} y gana: {d.premio}
        </p>
        {d.nombre && <p className="relative text-sm font-bold opacity-90">{d.nombre}</p>}
        <Listo d={d} className="relative rounded-xl text-[#111]" style={{ background: resalte, border: "2.5px solid #111", boxShadow: "3px 3px 0 #111" }} />
        <div className="relative">{d.pie}</div>
      </div>
    </div>
  );
}

// ---------- 12. Premium ----------

function Premium(d: Datos) {
  const oro = "linear-gradient(135deg, #f8e9b8 0%, #d4ab52 35%, #fbe6a6 55%, #b98a2c 80%, #e9cf86 100%)";
  const dorado: CSSProperties = { backgroundImage: oro, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" };
  const mono = fuenteMono.style.fontFamily;
  return (
    <div
      className="w-full max-w-sm overflow-hidden rounded-3xl p-5 text-white shadow-2xl"
      style={{
        background: `linear-gradient(115deg, rgba(255,255,255,.07) 0%, transparent 30%, transparent 60%, rgba(255,255,255,.05) 75%, transparent 90%), radial-gradient(circle at 100% 0%, ${alfa(d.color, 0.45)}, transparent 55%), linear-gradient(160deg, #1b1b1d, #070708)`,
        boxShadow: "0 20px 40px rgba(0,0,0,.4), inset 0 0 0 1px rgba(255,255,255,.08)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xl font-bold leading-tight" style={{ ...dorado, fontFamily: fuenteSerif.style.fontFamily }}>
            {d.local}
          </p>
          <p className="text-[10px] uppercase tracking-[0.4em] text-white/50">Member card</p>
        </div>
        <Logo d={d} className={`h-10 w-10 rounded-full text-lg ${d.logo ? "bg-white p-1" : ""}`} style={d.logo ? undefined : { ...dorado, border: "1.5px solid #d4ab52" }} />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <span
          className="relative h-8 w-11 overflow-hidden rounded-md"
          style={{ backgroundImage: oro, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.25)" }}
          aria-hidden
        >
          <span className="absolute inset-x-0 top-1/2 h-px bg-black/25" />
          <span className="absolute inset-y-0 left-1/3 w-px bg-black/25" />
          <span className="absolute inset-y-0 right-1/3 w-px bg-black/25" />
        </span>
        <p className="text-sm tracking-[0.3em] text-white/70 tabular-nums" style={{ fontFamily: mono }}>
          {String(d.sellos).padStart(2, "0")} / {String(d.meta).padStart(2, "0")}
        </p>
      </div>
      <Grilla d={d} className="mt-4 gap-2.5">
        {(c) => (
          <span
            key={c.i}
            className={`flex aspect-square items-center justify-center rounded-full text-lg ${c.anim.className}`}
            style={
              c.lleno
                ? { backgroundImage: oro, boxShadow: "0 3px 10px rgba(212,171,82,.35), inset 0 1px 1px rgba(255,255,255,.6)", ...c.anim.style }
                : { background: "#141416", boxShadow: "inset 1px 1px 3px rgba(0,0,0,.9), inset -1px -1px 2px rgba(255,255,255,.07)", color: "rgba(255,255,255,.3)" }
            }
          >
            {c.lleno ? d.emoji : c.ultimo ? "🎁" : <span className="text-[10px]" style={{ fontFamily: mono }}>{c.i + 1}</span>}
          </span>
        )}
      </Grilla>
      <div className="mt-5 flex items-end justify-between gap-3" style={{ fontFamily: mono }}>
        <div className="min-w-0">
          <p className="text-[9px] uppercase tracking-[0.3em] text-white/45">Beneficio</p>
          <p className="text-sm leading-snug" style={dorado}>
            {d.premio}
          </p>
        </div>
        {d.nombre && <p className="truncate text-sm uppercase tracking-widest text-white/85">{d.nombre}</p>}
      </div>
      <Listo d={d} className="rounded-xl text-[#2b1f05]" style={{ backgroundImage: oro }} />
      {d.pie}
    </div>
  );
}

const DISENOS = {
  clasica: Clasica,
  boleto: Boleto,
  epoca: Epoca,
  neon: Neon,
  pasaporte: Pasaporte,
  editorial: Editorial,
  aurora: Aurora,
  pizarra: Pizarra,
  camino: Camino,
  circulo: Circulo,
  pop: Pop,
  premium: Premium,
} satisfies Record<string, (d: Datos) => ReactNode>;
