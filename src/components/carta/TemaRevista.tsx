"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { textoSobre } from "@/lib/utils";
import type { Plato, Seccion } from "@/lib/types";
import { CartaVacia, Etiquetas, FotoRedonda, Logo, precio, type PropsTema } from "./comun";
import { Agregar } from "./Agregar";
import { useCarta } from "./contexto";
import { SelectorIdioma } from "./SelectorIdioma";

const PAPEL = "#f5efe6";
const TINTA = "#1f1a17";
const POR_PAGINA = 4;

type Pagina = { tipo: "portada" } | { tipo: "platos"; titulo: string; numero: number; platos: Plato[]; destacada?: boolean };

// Arma las páginas: portada, destacados y cada categoría (las largas ocupan varias páginas).
function armarPaginas(secciones: Seccion[], tituloDestacados: string): Pagina[] {
  const paginas: Pagina[] = [{ tipo: "portada" }];
  const destacados = secciones.flatMap((s) => s.platos).filter((p) => p.destacado);
  if (destacados.length)
    paginas.push({
      tipo: "platos",
      titulo: tituloDestacados,
      numero: 0,
      platos: destacados.slice(0, POR_PAGINA),
      destacada: true,
    });
  secciones.forEach((s, i) => {
    for (let desde = 0; desde < s.platos.length; desde += POR_PAGINA) {
      paginas.push({ tipo: "platos", titulo: s.nombre, numero: i + 1, platos: s.platos.slice(desde, desde + POR_PAGINA) });
    }
  });
  return paginas;
}

// Carta que se hojea como una revista: una categoría por página, con giro de hoja y sonido al pasar.
export function TemaRevista({ restaurante, secciones, vistaPrevia, pie }: PropsTema) {
  const acento = restaurante.color_primario;
  const { t } = useCarta();
  const paginas = useMemo(() => armarPaginas(secciones, t("destacados")), [secciones, t]);
  const { ajustes } = useCarta();
  const [actual, setActual] = useState(0);
  // Giro en curso: la hoja que se mueve y hacia dónde.
  const [giro, setGiro] = useState<{ hoja: number; base: number; sentido: "siguiente" | "anterior" } | null>(null);
  const [sonido, setSonido] = useState(true);
  const audio = useRef<HTMLAudioElement | null>(null);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const toque = useRef<number | null>(null);
  const pagina = Math.min(actual, paginas.length - 1);
  const archivoSonido = ajustes.sonido_hoja === "ninguno" ? null : `/sonidos/hoja-${ajustes.sonido_hoja}.mp3`;

  useEffect(() => {
    try {
      if (localStorage.getItem("carta:sonido") === "no") setSonido(false);
    } catch {}
  }, []);

  // Precarga el sonido para que suene justo al tocar.
  useEffect(() => {
    if (!archivoSonido) return;
    const a = new Audio(archivoSonido);
    a.preload = "auto";
    a.volume = 0.7;
    audio.current = a;
  }, [archivoSonido]);

  useEffect(() => () => void (reloj.current && clearTimeout(reloj.current)), []);

  const irA = useCallback(
    (destino: number) => {
      if (destino < 0 || destino >= paginas.length || destino === pagina) return;
      const sentido = destino > pagina ? "siguiente" : "anterior";
      // Al avanzar gira la hoja actual; al volver, la hoja anterior vuelve sobre la actual.
      setGiro({ hoja: sentido === "siguiente" ? pagina : destino, base: sentido === "siguiente" ? destino : pagina, sentido });
      setActual(destino);
      if (reloj.current) clearTimeout(reloj.current);
      reloj.current = setTimeout(() => setGiro(null), 950);
      if (sonido && audio.current) {
        audio.current.currentTime = 0;
        audio.current.play().catch(() => {});
      }
      // Vuelve al principio de la página nueva si el cliente había bajado.
      const arriba = raiz.current?.getBoundingClientRect().top ?? 0;
      if (!vistaPrevia && arriba < 0) window.scrollBy({ top: arriba, behavior: "smooth" });
    },
    [pagina, paginas.length, sonido, vistaPrevia],
  );

  useEffect(() => {
    if (vistaPrevia) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") irA(pagina + 1);
      if (e.key === "ArrowLeft") irA(pagina - 1);
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [irA, pagina, vistaPrevia]);

  const cambiarSonido = () => {
    setSonido((s) => {
      try {
        localStorage.setItem("carta:sonido", s ? "no" : "si");
      } catch {}
      return !s;
    });
  };

  const props = { paginas, restaurante, secciones, irA };
  const boton =
    "flex h-11 w-11 items-center justify-center rounded-full text-xl shadow-md transition active:scale-95 disabled:opacity-30";

  return (
    <div
      ref={raiz}
      className={`f-montserrat overflow-hidden pb-28 ${vistaPrevia ? "" : "min-h-screen"}`}
      style={
        {
          color: TINTA,
          background: `linear-gradient(90deg, #e9e0d2 0%, ${PAPEL} 6%, ${PAPEL} 94%, #e9e0d2 100%)`,
          "--acento": acento,
          "--sobre-acento": textoSobre(acento),
          "--pie-bg": TINTA,
          "--pie-text": PAPEL,
        } as React.CSSProperties
      }
    >
      <div className="relative mx-auto max-w-2xl px-4 pt-4">
        <div className="flex items-center justify-between gap-3 border-b border-black/15 pb-2 text-[11px] font-semibold uppercase tracking-[0.25em]">
          <span>{restaurante.nombre}</span>
          <span className="flex items-center gap-2">
            {archivoSonido && (
              <button
                type="button"
                onClick={cambiarSonido}
                aria-pressed={sonido}
                aria-label="Sonido al pasar página"
                className="text-base"
              >
                {sonido ? "🔊" : "🔇"}
              </button>
            )}
            <SelectorIdioma className="relative" style={{ background: TINTA, color: PAPEL }} />
          </span>
        </div>

        <div
          className="relative mt-4"
          style={{ perspective: "2200px" }}
          onPointerDown={(e) => (toque.current = e.clientX)}
          onPointerUp={(e) => {
            if (toque.current === null) return;
            const dx = e.clientX - toque.current;
            toque.current = null;
            if (Math.abs(dx) > 60) irA(pagina + (dx < 0 ? 1 : -1));
          }}
        >
          {/* Debajo queda la página que se ve al terminar el giro (al volver, la actual hasta que la tape la anterior). */}
          <Hoja>
            <Contenido indice={giro?.base ?? pagina} {...props} />
          </Hoja>
          {giro && (
            <>
              <span
                aria-hidden
                className="hoja-sombra-base pointer-events-none absolute inset-0 rounded-sm"
                style={{ background: "linear-gradient(90deg, rgba(40,25,10,0.35), rgba(40,25,10,0.08) 45%, transparent 75%)" }}
              />
              <div
                aria-hidden
                key={`${giro.hoja}-${giro.sentido}`}
                className={`hoja-giro hoja-giro-${giro.sentido} pointer-events-none absolute inset-0`}
              >
                <div className="hoja-cara">
                  <Hoja alto>
                    <Contenido indice={giro.hoja} {...props} />
                  </Hoja>
                  <span
                    className="hoja-sombra-cara absolute inset-0"
                    style={{ background: "linear-gradient(270deg, rgba(0,0,0,0.28), rgba(0,0,0,0.05) 40%, transparent 70%)" }}
                  />
                </div>
                <div
                  className="hoja-cara hoja-dorso rounded-sm"
                  style={{
                    background: "linear-gradient(90deg, #efe6d6 0%, #f8f2e8 35%, #fbf7f0 70%, #e9dfcd 100%)",
                    boxShadow: "inset -18px 0 30px rgba(120,90,50,0.18)",
                  }}
                />
              </div>
            </>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => irA(pagina - 1)}
            disabled={pagina === 0}
            aria-label="Página anterior"
            className={boton}
            style={{ background: TINTA, color: PAPEL }}
          >
            ‹
          </button>
          <div className="flex flex-wrap justify-center gap-1.5 px-2">
            {paginas.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => irA(i)}
                aria-label={`Ir a la página ${i + 1}`}
                className="h-2 rounded-full transition-all"
                style={{ width: i === pagina ? 22 : 8, background: i === pagina ? acento : "rgba(0,0,0,0.2)" }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => irA(pagina + 1)}
            disabled={pagina === paginas.length - 1}
            aria-label="Página siguiente"
            className={boton}
            style={{ background: acento, color: textoSobre(acento) }}
          >
            ›
          </button>
        </div>
      </div>
      {pie}
    </div>
  );
}

function Portada({
  restaurante,
  secciones,
  paginas,
  irA,
}: Pick<PropsTema, "restaurante" | "secciones"> & { paginas: Pagina[]; irA: (i: number) => void }) {
  const { t } = useCarta();
  const acento = restaurante.color_primario;
  const portada =
    secciones.flatMap((s) => s.platos).find((p) => p.destacado && p.foto_url) ??
    secciones.flatMap((s) => s.platos).find((p) => p.foto_url);
  // Primera página de cada categoría, para el índice.
  const indice = secciones.map((s) => ({
    nombre: s.nombre,
    pagina: paginas.findIndex((p) => p.tipo === "platos" && !p.destacada && p.titulo === s.nombre),
  }));

  if (secciones.length === 0) return <CartaVacia />;

  return (
    <div className="text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.4em]" style={{ color: acento }}>
        {t("carta")} · {new Date().getFullYear()}
      </p>
      <Logo restaurante={restaurante} className="mx-auto mt-4 h-20 w-20 rounded-full object-cover" />
      <h1 className="f-playfair mt-3 text-5xl font-bold uppercase leading-[0.95] tracking-tight @md:text-6xl">
        {restaurante.nombre}
      </h1>
      {restaurante.descripcion && <p className="f-cormorant mt-3 text-2xl text-black/70">{restaurante.descripcion}</p>}
      {portada && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={portada.foto_url!} alt={portada.nombre} className="mx-auto mt-5 aspect-[4/3] w-full object-cover" />
      )}
      <ol className="mx-auto mt-6 max-w-sm space-y-1 text-left">
        {indice.map((item) => (
          <li key={item.nombre}>
            <button
              type="button"
              onClick={() => irA(item.pagina)}
              className="flex w-full items-baseline gap-2 py-1 hover:opacity-70"
            >
              <span className="f-playfair text-lg italic">{item.nombre}</span>
              <span className="mb-1 flex-1 border-b border-dotted border-black/30" />
              <span className="text-sm tabular-nums" style={{ color: acento }}>
                {item.pagina + 1}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-xs uppercase tracking-[0.3em] text-black/45">← →</p>
    </div>
  );
}

// Hoja de papel: la de abajo crece con su contenido; la que gira copia su alto y recorta lo que sobra.
function Hoja({ children, alto }: { children: React.ReactNode; alto?: boolean }) {
  return (
    <article
      className={`min-h-[60vh] rounded-sm bg-[#fbf7f0] px-5 pb-8 pt-6 shadow-[0_2px_0_#e2d8c8,0_20px_40px_rgba(60,40,20,0.15)] ${
        alto ? "h-full overflow-hidden" : ""
      }`}
      style={{ backgroundImage: "linear-gradient(90deg, rgba(120,90,50,0.10), transparent 6%)" }}
    >
      {children}
    </article>
  );
}

function Contenido({
  indice,
  paginas,
  restaurante,
  secciones,
  irA,
}: Pick<PropsTema, "restaurante" | "secciones"> & { indice: number; paginas: Pagina[]; irA: (i: number) => void }) {
  const { t } = useCarta();
  const acento = restaurante.color_primario;
  const hoja = paginas[indice];
  if (!hoja) return null;

  return (
    <>
      {hoja.tipo === "portada" ? (
        <Portada restaurante={restaurante} secciones={secciones} paginas={paginas} irA={irA} />
      ) : (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em]" style={{ color: acento }}>
            {hoja.destacada ? "★" : `${t("carta")} · ${String(hoja.numero).padStart(2, "0")}`}
          </p>
          <h2 className="f-playfair mt-1 border-b-2 border-current pb-3 text-4xl font-bold italic leading-tight @md:text-5xl">
            {hoja.titulo}
          </h2>
          <ul className="mt-5 space-y-6">
            {hoja.platos.map((plato, i) => (
              <li key={plato.id} className={i === 0 ? "" : "flex gap-4"}>
                {i === 0 ? (
                  plato.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={plato.foto_url} alt={plato.nombre} className="mb-3 aspect-[16/10] w-full object-cover" />
                  ) : (
                    <FotoRedonda plato={plato} className="float-right mb-2 ml-4 w-28 bg-[#efe4d2] text-6xl" />
                  )
                ) : (
                  <FotoRedonda plato={plato} className="w-20 shrink-0 self-start bg-[#efe4d2] text-4xl" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <h3 className={`f-playfair font-bold leading-tight ${i === 0 ? "text-2xl" : "text-xl"}`}>{plato.nombre}</h3>
                    <span className="mb-1 flex-1 border-b border-dotted border-black/30" />
                    <span className="f-playfair shrink-0 text-lg font-bold tabular-nums" style={{ color: acento }}>
                      {precio(plato, restaurante)}
                    </span>
                  </div>
                  {plato.descripcion && (
                    <p className="f-cormorant mt-1 text-lg leading-snug text-black/70">{plato.descripcion}</p>
                  )}
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <Etiquetas plato={plato} className="opacity-70" />
                    <Agregar plato={plato} className="ml-auto" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="clear-both mt-8 text-center text-[11px] tracking-[0.3em] text-black/45">
        {indice + 1} / {paginas.length}
      </p>
    </>
  );
}
