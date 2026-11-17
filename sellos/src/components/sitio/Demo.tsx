"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Icono } from "@/components/Icono";
import { Inclinable } from "@/components/Inclinable";
import { TarjetaVisual } from "@/components/TarjetaVisual";
import { guardarDemo, type ConfigDemo } from "@/lib/demo";
import { MARCA } from "@/lib/marca";
import { qrSvg } from "@/lib/qr";
import { RUBROS, type IdRubro } from "@/lib/rubros";
import { DISENOS_SELLO, PROGRAMA_BASE, emojiSello, type DisenoSello } from "@/lib/tipos";
import { blobADataUrl, comprimirImagen, slugify, urlSitio } from "@/lib/utils";

// "Ver demo": un paso a paso en ventana donde el visitante arma su propia tarjeta (tipo, logo, foto de fondo
// difuminada, color, diseño, avisos), la prueba como si fuera su cliente y la crea de verdad al registrarse.

const PASOS = ["Tu panel", "Tipo", "Diseño", "Avisos", "Pruébala", "¡Lista!"] as const;

const COLORES = ["#b38a2e", "#141414", "#7a1f2b", "#1f3a5f", "#2f5d50", "#6d28d9", "#be185d", "#b45309"];
const DISENOS: DisenoSello[] = ["clasica", "aurora", "cristal", "neon", "premium", "dorada", "pizarra", "editorial", "pop", "holografica"];

const INICIAL: ConfigDemo = {
  negocio: "",
  rubro: "cafe",
  tipo: "sellos",
  cashback: false,
  meta: 8,
  premio: RUBROS.cafe.premio,
  color: "#b38a2e",
  icono: RUBROS.cafe.icono,
  diseno: "aurora",
  textoClaro: true,
  logo: null,
  fondo: null,
  difuminado: 6,
  guardado: 0,
};

type Aviso = { id: string; titulo: string; texto: string; icono: string; mensaje: (c: ConfigDemo) => string };
const AVISOS: Aviso[] = [
  { id: "premio", icono: "🎁", titulo: "Premio listo", texto: "Cuando completa la tarjeta.", mensaje: (c) => `¡Tu premio te espera: ${c.premio.toLowerCase()}! Pasa por él cuando quieras.` },
  { id: "falta", icono: "✨", titulo: "Te falta poco", texto: "Cuando le queda 1 sello.", mensaje: (c) => `Te falta 1 sello para ${c.premio.toLowerCase()}. ¡Ya casi!` },
  { id: "cumple", icono: "🎂", titulo: "Cumpleaños", texto: "Un saludo y un regalo en su día.", mensaje: () => "¡Feliz cumpleaños, Elizabeth! Te regalamos 2 sellos para celebrar." },
  { id: "extrana", icono: "👋", titulo: "Te extrañamos", texto: "Si lleva tiempo sin venir.", mensaje: () => "Hace rato que no te vemos. Vuelve esta semana y te damos un sello extra." },
  { id: "doble", icono: "🔥", titulo: "Día doble", texto: "Para llenar los días flojos.", mensaje: () => "Hoy es día doble: cada visita vale 2 sellos." },
];

function Vista({ c, sellos, puntos, animar = 0, nombre = "Elizabeth" }: { c: ConfigDemo; sellos: number; puntos?: number; animar?: number; nombre?: string }) {
  return (
    <TarjetaVisual
      local={c.negocio.trim() || "Tu negocio"}
      logo={c.logo}
      programa={{
        ...PROGRAMA_BASE,
        tipo: c.tipo,
        nombre_puntos: c.cashback ? "pesos" : "puntos",
        meta: c.meta,
        premio: c.premio || "Tu premio",
        color: c.color,
        icono: c.icono,
        diseno: c.fondo ? "medida" : c.diseno,
        fondo_url: c.fondo,
        texto_claro: c.textoClaro,
      }}
      sellos={sellos}
      puntos={puntos ?? (c.cashback ? 3200 : 1350)}
      proximo={{ titulo: c.premio || "Tu premio", puntos: c.cashback ? 5000 : 2000 }}
      nombre={nombre}
      animarUltimos={animar}
    />
  );
}

// Botón que abre el demo (va en la portada y en "Cómo funciona").
export function BotonDemo({ className = "boton-capsula", children, conAncla = false }: { className?: string; children?: React.ReactNode; conAncla?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const cerrar = useCallback(() => setAbierto(false), []);
  useEffect(() => {
    if (conAncla && window.location.hash === "#demo") setAbierto(true);
  }, [conAncla]);
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className={className}>
        {children ?? (
          <>
            <Icono nombre="ojo" className="h-[18px] w-[18px]" /> Ver demo
          </>
        )}
      </button>
      {abierto && createPortal(<Demo cerrar={cerrar} />, document.querySelector(".club") ?? document.body)}
    </>
  );
}

function Demo({ cerrar }: { cerrar: () => void }) {
  const router = useRouter();
  const [paso, setPaso] = useState(0);
  const [c, setC] = useState<ConfigDemo>(INICIAL);
  const [avisos, setAvisos] = useState<Record<string, boolean>>({ premio: true, falta: true, cumple: true, extrana: true, doble: false });
  const [avisoVisto, setAvisoVisto] = useState("premio");
  const [sellos, setSellos] = useState(3);
  const [puntos, setPuntos] = useState(600);
  const [animar, setAnimar] = useState(0);
  const [procesando, setProcesando] = useState(false);
  const fondoOriginal = useRef<Blob | null>(null);
  const caja = useRef<HTMLDivElement>(null);
  const cambiar = (x: Partial<ConfigDemo>) => setC((v) => ({ ...v, ...x }));

  // Bloquea el scroll de la página y cierra con Escape.
  useEffect(() => {
    const antes = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && cerrar();
    document.addEventListener("keydown", esc);
    caja.current?.focus();
    return () => {
      document.documentElement.style.overflow = antes;
      document.removeEventListener("keydown", esc);
    };
  }, [cerrar]);

  useEffect(() => {
    caja.current?.querySelector("[data-cuerpo]")?.scrollTo({ top: 0 });
  }, [paso]);

  const elegirRubro = (r: IdRubro) => {
    const d = RUBROS[r];
    cambiar({ rubro: r, icono: d.icono, premio: d.premio, meta: Math.min(12, d.meta) });
  };

  async function subirLogo(f: File | undefined) {
    if (!f) return;
    setProcesando(true);
    try {
      cambiar({ logo: await blobADataUrl(await comprimirImagen(f, 320, 0.9)) });
    } catch {}
    setProcesando(false);
  }

  const procesarFondo = useCallback(async (difuminado: number) => {
    if (!fondoOriginal.current) return;
    setProcesando(true);
    try {
      const url = await blobADataUrl(await comprimirImagen(fondoOriginal.current, 900, 0.8, difuminado));
      setC((v) => ({ ...v, fondo: url }));
    } catch {}
    setProcesando(false);
  }, []);

  async function subirFondo(f: File | undefined) {
    if (!f || !f.type.startsWith("image/")) return;
    fondoOriginal.current = f;
    await procesarFondo(c.difuminado);
  }

  // Al mover el difuminado se vuelve a procesar la foto (con una pequeña espera).
  useEffect(() => {
    const t = setTimeout(() => procesarFondo(c.difuminado), 180);
    return () => clearTimeout(t);
  }, [c.difuminado, procesarFondo]);

  const sumar = () => {
    if (c.tipo === "puntos") {
      setPuntos((p) => p + (c.cashback ? 600 : 240));
      return;
    }
    if (sellos >= c.meta) return;
    setAnimar(1);
    setSellos((s) => Math.min(c.meta, s + 1));
  };
  const completa = c.tipo === "puntos" ? puntos >= (c.cashback ? 5000 : 2000) : sellos >= c.meta;

  function crear() {
    guardarDemo({ ...c, negocio: c.negocio.trim(), guardado: Date.now() });
    const q = new URLSearchParams({ demo: "1", rubro: c.rubro });
    router.push(`/registro?${q}`);
  }

  const qr = useMemo(() => qrSvg(`${urlSitio()}/u/${slugify(c.negocio) || "tu-negocio"}`, { logo: null, color: "#141414" }), [c.negocio]);
  const ultimo = paso === PASOS.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && cerrar()}>
      <div
        ref={caja}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Así funciona ${MARCA}`}
        className="aparecer-club relative flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[2rem] border border-borde shadow-2xl shadow-black/40 outline-none sm:rounded-[2rem]"
        style={{ background: "var(--club-fondo)" }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 fondo-club opacity-70" />

        {/* Cabecera: título, pasos y cerrar */}
        <div className="relative flex items-center gap-3 border-b border-borde px-5 py-4 sm:px-7">
          <p className="min-w-0 truncate font-titulo text-base font-bold sm:text-lg">
            <span className="hidden sm:inline">Así funciona </span>
            {MARCA}
          </p>
          <span className="shrink-0 whitespace-nowrap rounded-full bg-club-oro/15 px-2.5 py-0.5 text-xs font-semibold text-club-oro-texto">
            Paso {paso + 1} de {PASOS.length}
          </span>
          <button type="button" onClick={cerrar} aria-label="Cerrar demo" className="ml-auto grid h-10 w-10 place-items-center rounded-full text-suave transition hover:bg-club-vidrio hover:text-tinta">
            <Icono nombre="cerrar" className="h-5 w-5" />
          </button>
        </div>
        <nav aria-label="Pasos" className="relative hidden gap-1 px-7 pt-4 md:flex">
          {PASOS.map((t, i) => (
            <button
              key={t}
              type="button"
              onClick={() => setPaso(i)}
              aria-current={i === paso ? "step" : undefined}
              className={`flex flex-1 items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition ${
                i === paso ? "text-[#1a1408]" : i < paso ? "text-club-oro-texto hover:bg-club-vidrio" : "text-suave hover:bg-club-vidrio"
              }`}
              style={i === paso ? { background: "var(--oro-degradado)" } : undefined}
            >
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] ${i === paso ? "bg-white/40" : i < paso ? "bg-club-oro/20" : "border border-borde"}`}>
                {i < paso ? "✓" : i + 1}
              </span>
              {t}
            </button>
          ))}
        </nav>
        <div aria-hidden className="relative mx-5 mt-3 h-1 overflow-hidden rounded-full bg-club-vidrio md:hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${((paso + 1) / PASOS.length) * 100}%`, background: "var(--oro-degradado)" }} />
        </div>

        {/* Cuerpo de cada paso */}
        <div data-cuerpo className="relative flex-1 overflow-y-auto px-5 pb-6 pt-5 sm:px-7">
          <div key={paso} className="aparecer-club">
            {paso === 0 && (
              <Paso titulo="Tu panel de tarjetas" bajada="Desde tu celular manejas tu tarjeta, tus clientes y tus premios. Empecemos creando la tuya.">
                <div className="flex flex-wrap items-center justify-center gap-5">
                  {(
                    [
                      ["Barbería Don Pepe", "barberia", "dorada", 4],
                      ["Pádel Club Viña", "padel", "holografica", 7],
                    ] as [string, IdRubro, DisenoSello, number][]
                  ).map(([local, r, d, s]) => (
                    <div key={local} className="tema-fijo w-[260px] max-w-full" style={{ zoom: 0.78 }}>
                      <TarjetaVisual local={local} programa={{ ...PROGRAMA_BASE, meta: RUBROS[r].meta, premio: RUBROS[r].premio, icono: RUBROS[r].icono, color: RUBROS[r].color, diseno: d }} sellos={s} nombre="Elizabeth" />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPaso(1)}
                    className="group grid h-[200px] w-[260px] max-w-full place-items-center rounded-3xl border-2 border-dashed border-club-oro/50 bg-club-oro/5 text-club-oro-texto transition hover:border-club-oro hover:bg-club-oro/10"
                  >
                    <span className="flex flex-col items-center gap-3 font-semibold">
                      <span className="grid h-14 w-14 place-items-center rounded-full text-2xl text-[#1a1408] shadow-lg transition group-hover:scale-110" style={{ background: "var(--oro-degradado)" }}>
                        +
                      </span>
                      Crear mi tarjeta
                    </span>
                  </button>
                </div>
                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  {[
                    ["📈", "Ves quién vuelve", "Visitas, clientes frecuentes y dormidos, en vivo."],
                    ["🎁", "Premios a tu manera", "Sellos, puntos o cashback, con catálogo y premios intermedios."],
                    ["👥", "Todo tu equipo", "Cada uno con su cuenta, y tú con el PIN para canjear."],
                  ].map(([i, t, d]) => (
                    <div key={t} className="vidrio-club flex gap-3 rounded-2xl p-4 text-sm">
                      <span className="text-xl" aria-hidden>
                        {i}
                      </span>
                      <span>
                        <span className="block font-semibold">{t}</span>
                        <span className="block text-suave">{d}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </Paso>
            )}

            {paso === 1 && (
              <Paso titulo="¿Qué tarjeta quieres?" bajada="Elige cómo premias y tu rubro: partimos con un premio y un dibujo pensados para tu negocio.">
                <div className="grid gap-3 sm:grid-cols-3">
                  {(
                    [
                      ["sellos", false, "⭐", "Sellos", "Cada visita suma un sello. Al completar, su premio."],
                      ["puntos", false, "💎", "Puntos", "Suma puntos por lo que gasta y canjea en tu catálogo."],
                      ["puntos", true, "💸", "Cashback", "Le devuelves un % en saldo para su próxima compra."],
                    ] as [ConfigDemo["tipo"], boolean, string, string, string][]
                  ).map(([tipo, cb, icono, t, d]) => {
                    const activo = c.tipo === tipo && c.cashback === cb;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => cambiar({ tipo, cashback: cb })}
                        aria-pressed={activo}
                        className={`tarjeta-club relative p-5 text-left ${activo ? "borde-oro shadow-[0_20px_50px_-25px_rgb(184_145_47/0.6)]" : ""}`}
                      >
                        {activo && (
                          <span className="absolute right-4 top-4 grid h-6 w-6 place-items-center rounded-full text-xs font-bold text-[#1a1408]" style={{ background: "var(--oro-degradado)" }}>
                            ✓
                          </span>
                        )}
                        <span className="anillo-oro h-12 w-12 text-2xl" aria-hidden>
                          {icono}
                        </span>
                        <span className="mt-4 block font-titulo text-lg font-bold">{t}</span>
                        <span className="mt-1 block text-sm text-suave">{d}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-8 text-sm font-semibold">¿Qué negocio tienes?</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(Object.keys(RUBROS) as IdRubro[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => elegirRubro(r)}
                      aria-pressed={c.rubro === r}
                      className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                        c.rubro === r ? "border-transparent font-semibold text-[#1a1408]" : "border-borde bg-club-vidrio hover:border-club-oro/60"
                      }`}
                      style={c.rubro === r ? { background: "var(--oro-degradado)" } : undefined}
                    >
                      {emojiSello(RUBROS[r].icono)} {RUBROS[r].nombre}
                    </button>
                  ))}
                </div>
              </Paso>
            )}

            {paso === 2 && (
              <Paso titulo="Hazla tuya" bajada="Tu logo, tu nombre, tu premio y una foto de tu local de fondo. La vista previa cambia al instante.">
                <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
                  <div className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Archivo
                        etiqueta="Logo"
                        imagen={c.logo}
                        texto={c.logo ? "Logo cargado" : "Subir logo"}
                        onArchivo={subirLogo}
                        quitar={() => cambiar({ logo: null })}
                      />
                      <Archivo
                        etiqueta="Foto de fondo"
                        imagen={c.fondo}
                        texto={c.fondo ? "Foto cargada" : "Foto de tu local o tus productos"}
                        onArchivo={subirFondo}
                        quitar={() => {
                          fondoOriginal.current = null;
                          cambiar({ fondo: null });
                        }}
                        cubrir
                      />
                    </div>
                    {c.fondo && (
                      <div className="vidrio-club aparecer-club grid gap-4 rounded-2xl p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                        <label className="block">
                          <span className="flex justify-between text-sm">
                            <span className="font-medium">Difuminado de la foto</span>
                            <span className="text-suave">{c.difuminado === 0 ? "Nítida" : c.difuminado < 6 ? "Suave" : c.difuminado < 12 ? "Medio" : "Fuerte"}</span>
                          </span>
                          <input type="range" min={0} max={18} value={c.difuminado} onChange={(e) => cambiar({ difuminado: Number(e.target.value) })} className="mt-2 w-full accent-[var(--club-oro)]" />
                        </label>
                        <Interruptor activo={c.textoClaro} cambiar={(v) => cambiar({ textoClaro: v })} texto="Letras blancas" />
                      </div>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1.5 block text-sm text-suave">Nombre de tu negocio</span>
                        <input value={c.negocio} maxLength={40} onChange={(e) => cambiar({ negocio: e.target.value })} className="campo-club" placeholder="Café del Cerro" />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-sm text-suave">{c.tipo === "puntos" ? "Primer premio del catálogo" : "Premio"}</span>
                        <input value={c.premio} maxLength={60} onChange={(e) => cambiar({ premio: e.target.value })} className="campo-club" placeholder="Un café de regalo" />
                      </label>
                    </div>
                    {c.tipo === "sellos" && (
                      <label className="block">
                        <span className="flex justify-between text-sm">
                          <span className="text-suave">Sellos para el premio</span>
                          <b className="tabular-nums">{c.meta}</b>
                        </span>
                        <input
                          type="range"
                          min={3}
                          max={15}
                          value={c.meta}
                          onChange={(e) => {
                            const m = Number(e.target.value);
                            cambiar({ meta: m });
                            setSellos((s) => Math.min(s, m - 1));
                          }}
                          className="mt-2 w-full accent-[var(--club-oro)]"
                        />
                      </label>
                    )}
                    <div>
                      <span className="mb-2 block text-sm text-suave">Color</span>
                      <div className="flex flex-wrap items-center gap-2.5">
                        {COLORES.map((col) => (
                          <button
                            key={col}
                            type="button"
                            onClick={() => cambiar({ color: col })}
                            aria-label={`Color ${col}`}
                            aria-pressed={c.color === col}
                            className={`h-9 w-9 rounded-full border border-white/15 transition hover:scale-110 ${c.color === col ? "ring-2 ring-club-oro ring-offset-2 ring-offset-[var(--club-fondo)]" : ""}`}
                            style={{ background: col }}
                          />
                        ))}
                        <label className="relative grid h-9 w-9 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-borde text-suave" title="Otro color">
                          <Icono nombre="mas" className="h-4 w-4" />
                          <input type="color" value={c.color} onChange={(e) => cambiar({ color: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
                        </label>
                      </div>
                    </div>
                    {!c.fondo && (
                      <div>
                        <span className="mb-2 block text-sm text-suave">Diseño</span>
                        <div className="flex flex-wrap gap-2">
                          {DISENOS.map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => cambiar({ diseno: d })}
                              aria-pressed={c.diseno === d}
                              className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                                c.diseno === d ? "border-transparent font-semibold text-[#1a1408]" : "border-borde bg-club-vidrio hover:border-club-oro/60"
                              }`}
                              style={c.diseno === d ? { background: "var(--oro-degradado)" } : undefined}
                            >
                              {DISENOS_SELLO[d].nombre}
                            </button>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-suave">Hay muchos más en tu panel, y te hacemos uno a medida sin costo.</p>
                      </div>
                    )}
                  </div>
                  <div className="order-first lg:sticky lg:top-0 lg:order-none lg:self-start">
                    <div className="relative grid place-items-center rounded-[2rem] px-4 py-4 lg:py-8" style={{ background: "radial-gradient(closest-side, var(--club-brillo), transparent)" }}>
                      <div className={`tema-fijo w-full max-w-[340px] transition ${procesando ? "opacity-70" : ""}`}>
                        <Inclinable>
                          <Vista c={c} sellos={Math.min(sellos, c.meta - 1)} />
                        </Inclinable>
                      </div>
                      <p className="mt-4 hidden text-xs text-suave lg:block">Mueve el mouse sobre la tarjeta ✨</p>
                    </div>
                  </div>
                </div>
              </Paso>
            )}

            {paso === 3 && (
              <Paso titulo="Avisos que hacen volver" bajada="Le llegan solos al celular de tu cliente. Toca uno para ver cómo se ve.">
                <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
                  <div className="space-y-2.5">
                    {AVISOS.map((a) => (
                      <div
                        key={a.id}
                        onClick={() => setAvisoVisto(a.id)}
                        className={`flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition ${
                          avisoVisto === a.id ? "border-club-oro/60 bg-club-oro/10" : "border-borde bg-club-vidrio hover:border-club-oro/40"
                        }`}
                      >
                        <span className="anillo-oro h-11 w-11 shrink-0 text-xl" aria-hidden>
                          {a.icono}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{a.titulo}</span>
                          <span className="block text-sm text-suave">{a.texto}</span>
                        </span>
                        <Interruptor
                          activo={!!avisos[a.id]}
                          cambiar={(v) => {
                            setAvisos((x) => ({ ...x, [a.id]: v }));
                            if (v) setAvisoVisto(a.id);
                          }}
                          texto={a.titulo}
                          oculto
                        />
                      </div>
                    ))}
                  </div>
                  <Celular>
                    <p className="pt-10 text-center font-titulo text-5xl font-bold text-white/90 tabular-nums">9:41</p>
                    <p className="text-center text-xs text-white/60">lunes 17 de noviembre</p>
                    <div className="mt-8 space-y-2.5 px-3">
                      {AVISOS.filter((a) => avisos[a.id])
                        .sort((a, b) => (a.id === avisoVisto ? -1 : b.id === avisoVisto ? 1 : 0))
                        .slice(0, 3)
                        .map((a, i) => (
                          <div
                            key={a.id + avisoVisto}
                            className="aparecer-club flex gap-3 rounded-2xl bg-white/85 p-3 text-[#111] shadow-lg backdrop-blur"
                            style={{ animationDelay: `${i * 90}ms`, opacity: i ? 0.85 - i * 0.15 : 1, transform: i ? `scale(${1 - i * 0.04})` : undefined }}
                          >
                            <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl text-lg" style={{ background: c.color }}>
                              {c.logo ? <img src={c.logo} alt="" className="h-full w-full bg-white object-contain" /> : emojiSello(c.icono)}
                            </span>
                            <span className="min-w-0 flex-1 text-xs leading-snug">
                              <span className="flex justify-between gap-2">
                                <b className="truncate">{c.negocio.trim() || "Tu negocio"}</b>
                                <span className="shrink-0 text-black/45">{i === 0 ? "ahora" : `hace ${i * 2} h`}</span>
                              </span>
                              <span className="mt-0.5 block text-black/75">{a.mensaje(c)}</span>
                            </span>
                          </div>
                        ))}
                      {!AVISOS.some((a) => avisos[a.id]) && <p className="text-center text-sm text-white/60">Sin avisos activos</p>}
                    </div>
                  </Celular>
                </div>
              </Paso>
            )}

            {paso === 4 && (
              <Paso titulo="Pruébala como tu cliente" bajada={c.tipo === "puntos" ? "Suma compras y mira cómo avanza hacia su premio." : "Suma sellos como si cobraras en tu mesón y mira qué pasa al completar."}>
                <div className="grid items-center gap-8 lg:grid-cols-[360px_1fr]">
                  <Celular claro>
                    <div className="px-3 pt-8">
                      <p className="mb-3 text-center text-xs font-semibold text-black/50">{c.negocio.trim() || "Tu negocio"} · tarjeta de Elizabeth</p>
                      <div className="tema-fijo">
                        <Vista c={c} sellos={sellos} puntos={puntos} animar={animar} />
                      </div>
                      {completa && (
                        <div className="aparecer-club mt-3 rounded-2xl p-3 text-center text-sm font-semibold text-[#1a1408]" style={{ background: "var(--oro-degradado)" }}>
                          🎉 ¡Premio listo! {c.premio}
                        </div>
                      )}
                    </div>
                  </Celular>
                  <div className="space-y-4">
                    <div className="vidrio-club rounded-3xl p-6">
                      <p className="text-sm text-suave">{c.tipo === "puntos" ? (c.cashback ? "Saldo de Elizabeth" : "Puntos de Elizabeth") : "Sellos de Elizabeth"}</p>
                      <p className="mt-1 font-titulo text-5xl font-bold tabular-nums">
                        {c.tipo === "puntos" ? (
                          <span className="texto-oro">{c.cashback ? `$${puntos.toLocaleString("es-CL")}` : puntos.toLocaleString("es-CL")}</span>
                        ) : (
                          <>
                            <span className="texto-oro">{sellos}</span>
                            <span className="text-2xl text-suave"> / {c.meta}</span>
                          </>
                        )}
                      </p>
                      <div className="mt-6 flex flex-wrap gap-3">
                        {completa ? (
                          <button
                            type="button"
                            onClick={() => {
                              setAnimar(0);
                              setSellos(0);
                              setPuntos(0);
                            }}
                            className="boton-oro boton-bronce px-6 py-3"
                          >
                            🎁 Canjear premio
                          </button>
                        ) : (
                          <button type="button" onClick={sumar} className="boton-oro px-6 py-3 text-base">
                            {c.tipo === "puntos" ? (c.cashback ? "+ Compra de $12.000 (5 %)" : "+ Compra de $12.000") : "+1 sello"}
                          </button>
                        )}
                      </div>
                    </div>
                    <ul className="space-y-2 text-sm text-suave">
                      <li>✓ Sumas con un toque escaneando su tarjeta, o le muestras un QR que sirve una sola vez.</li>
                      <li>✓ Máximo de sellos por día y PIN del dueño para canjear: sin trampas.</li>
                      <li>✓ El cliente la guarda en Google Wallet o en la pantalla de inicio.</li>
                    </ul>
                  </div>
                </div>
              </Paso>
            )}

            {paso === 5 && (
              <Paso titulo="¡Tu tarjeta está lista!" bajada="Imprime el QR, déjalo en tu mesón y tus clientes se unen en 10 segundos, sin bajar ninguna app.">
                <div className="grid items-center gap-8 md:grid-cols-2">
                  <div className="tema-fijo mx-auto w-full max-w-[340px]">
                    <Inclinable>
                      <Vista c={c} sellos={Math.max(1, Math.min(c.meta - 2, 3))} />
                    </Inclinable>
                  </div>
                  <div className="mx-auto flex w-full max-w-xs flex-col items-center text-center">
                    <div className="rounded-[1.75rem] border border-borde bg-white p-5 shadow-xl">
                      <p className="text-xs font-bold uppercase tracking-widest text-[#141414]">{c.negocio.trim() || "Tu negocio"}</p>
                      <div className="mx-auto mt-3 w-44" dangerouslySetInnerHTML={{ __html: qr }} />
                      <p className="mt-3 text-sm font-semibold text-[#141414]">Escanea y únete a nuestro club</p>
                    </div>
                    <p className="mt-4 text-sm text-suave">
                      Tu dirección será <b className="text-tinta">…/u/{slugify(c.negocio) || "tu-negocio"}</b>
                    </p>
                  </div>
                </div>
                <div className="mt-8 rounded-3xl p-6 text-center" style={{ background: "radial-gradient(ellipse at 50% 0%, var(--club-brillo), transparent 70%)" }}>
                  <p className="font-titulo text-xl font-bold">¿Te gustó? Créala de verdad en 1 minuto.</p>
                  <p className="mt-1 text-sm text-suave">Guardamos este diseño, tu logo y tu foto: al crear tu cuenta, tu tarjeta queda lista. 30 días gratis, sin tarjeta de crédito.</p>
                </div>
              </Paso>
            )}
          </div>
        </div>

        {/* Pie: atrás / siguiente */}
        <div className="relative flex items-center gap-3 border-t border-borde px-5 py-4 sm:px-7">
          {paso === 0 ? (
            <button type="button" onClick={cerrar} className="rounded-full px-3 py-2 text-sm text-suave hover:text-tinta">
              Cerrar
            </button>
          ) : ultimo ? (
            <button
              type="button"
              onClick={() => {
                setPaso(1);
                setSellos(3);
                setPuntos(600);
              }}
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-suave hover:text-tinta"
            >
              ↺ Empezar de nuevo
            </button>
          ) : (
            <button type="button" onClick={() => setPaso(paso - 1)} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-suave hover:text-tinta">
              ← Atrás
            </button>
          )}
          <div className="ml-auto flex items-center gap-2 md:hidden" aria-hidden>
            {PASOS.map((t, i) => (
              <span key={t} className={`h-1.5 rounded-full transition-all ${i === paso ? "w-5 bg-club-oro" : "w-1.5 bg-borde"}`} />
            ))}
          </div>
          {ultimo ? (
            <button type="button" onClick={crear} className="boton-oro ml-auto px-5 py-3 text-sm sm:px-6 sm:text-base md:ml-auto">
              Crear mi tarjeta gratis <span className="flecha">→</span>
            </button>
          ) : (
            <button type="button" onClick={() => setPaso(paso + 1)} className="boton-oro px-5 py-3 text-sm sm:px-6 sm:text-base md:ml-auto">
              Siguiente <span className="flecha">→</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Paso({ titulo, bajada, children }: { titulo: string; bajada: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{titulo}</h2>
      <p className="mt-1.5 max-w-2xl text-suave">{bajada}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Archivo({
  etiqueta,
  imagen,
  texto,
  onArchivo,
  quitar,
  cubrir = false,
}: {
  etiqueta: string;
  imagen: string | null;
  texto: string;
  onArchivo: (f: File | undefined) => void;
  quitar: () => void;
  cubrir?: boolean;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-sm text-suave">{etiqueta}</span>
      <div className="flex items-center gap-3 rounded-2xl border border-borde bg-club-vidrio p-2.5">
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-club-oro/50 bg-club-oro/5 text-club-oro-texto">
            {imagen ? <img src={imagen} alt="" className={`h-full w-full ${cubrir ? "object-cover" : "bg-white object-contain p-0.5"}`} /> : <Icono nombre="foto" className="h-5 w-5" />}
          </span>
          <span className={`min-w-0 truncate text-sm ${imagen ? "font-medium text-club-oro-texto" : "text-suave"}`}>
            {imagen ? `✓ ${texto}` : texto}
          </span>
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => onArchivo(e.target.files?.[0])} />
        </label>
        {imagen && (
          <button type="button" onClick={quitar} aria-label={`Quitar ${etiqueta.toLowerCase()}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-suave hover:bg-club-vidrio hover:text-tinta">
            <Icono nombre="cerrar" className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function Interruptor({ activo, cambiar, texto, oculto = false }: { activo: boolean; cambiar: (v: boolean) => void; texto: string; oculto?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={texto}
      onClick={(e) => {
        e.stopPropagation();
        cambiar(!activo);
      }}
      className="flex shrink-0 items-center gap-2 text-sm"
    >
      {!oculto && <span>{texto}</span>}
      <span className={`relative h-7 w-12 rounded-full transition ${activo ? "" : "bg-borde"}`} style={activo ? { background: "var(--oro-degradado)" } : undefined}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${activo ? "left-6" : "left-1"}`} />
      </span>
    </button>
  );
}

// Un celular dibujado con CSS (para los avisos y la prueba).
function Celular({ children, claro = false }: { children: React.ReactNode; claro?: boolean }) {
  return (
    <div className="mx-auto w-full max-w-[340px]">
      <div className="rounded-[2.75rem] bg-[#0b0f0e] p-2.5 shadow-2xl shadow-black/40 ring-1 ring-white/10">
        <div
          className="relative h-[480px] overflow-hidden rounded-[2.25rem]"
          style={{
            background: claro ? "#f4f6f5" : "radial-gradient(ellipse at 30% 0%, #6b5420, transparent 60%), radial-gradient(ellipse at 90% 100%, #3a3a3e, transparent 60%), #0b0b0c",
          }}
        >
          <div aria-hidden className="absolute left-1/2 top-2.5 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
          {children}
        </div>
      </div>
    </div>
  );
}
