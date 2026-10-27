"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { borrarFoto, subirFoto } from "@/lib/fotos";
import { TEMAS, type Restaurante, type Seccion, type Tema } from "@/lib/types";
import { MONEDAS, mensajeError, urlCarta } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { useUrlSitio } from "@/lib/useUrlSitio";
import { Carta } from "@/components/carta/Carta";
import { GRUPOS_TEMA, TEMA_INFO, type GrupoTema } from "@/components/carta/comun";
import { SECCIONES_EJEMPLO } from "@/components/carta/ejemplo";
import { Interruptor } from "@/components/Interruptor";
import { IDIOMAS_EXTRA, IDIOMA_EN_ESPANOL } from "@/lib/i18n";
import { revalidarCarta } from "../actions";
import { leerAjustes, SONIDOS_HOJA, type SonidoHoja } from "@/lib/salon";

const PALETAS = [
  { primario: "#b45309", fondo: "#fffbf5" },
  { primario: "#9a3412", fondo: "#fffaf3" },
  { primario: "#166534", fondo: "#f7fbf6" },
  { primario: "#1e3a8a", fondo: "#f6f8fc" },
  { primario: "#831843", fondo: "#fdf7f9" },
  { primario: "#1c1917", fondo: "#ffffff" },
];

// Acentos sugeridos para los diseños oscuros.
const ACENTOS = ["#e8a33d", "#d4af6a", "#ffc300", "#f2b134", "#e63946", "#8ac926", "#38bdf8", "#f5f5f4"];

// Muestra en miniatura de cada diseño, para el selector.
const MUESTRA_FUENTE: Record<Tema, string> = {
  clasico: "font-serif",
  noir: "f-playfair",
  esmeralda: "f-cormorant",
  street: "f-pacifico",
  retro: "f-oswald uppercase",
  bistro: "f-marker uppercase",
  veggie: "f-vibes text-2xl",
  forno: "f-kaushan",
  oriente: "f-playfair uppercase font-bold",
  neon: "f-righteous uppercase [text-shadow:0_0_8px_currentColor]",
  tropical: "f-allura text-3xl [text-shadow:0_0_8px_currentColor]",
  jugos: "f-kaushan",
  batidos: "f-fredoka uppercase font-bold",
  gala: "f-allura text-3xl",
  vitrina: "f-playfair",
  cinta: "font-extrabold italic",
  trattoria: "f-playfair uppercase font-bold",
  kraft: "f-caveat text-2xl",
  madera: "font-semibold",
  coctel: "f-dirt uppercase",
  revista: "f-playfair italic font-bold",
};

const NOMBRE_SONIDO: Record<SonidoHoja, string> = {
  papel: "Papel",
  hojas: "Hojas",
  diario: "Diario",
  ninguno: "Sin sonido",
};

// SQL que habilita cada diseño, para avisar si falta ejecutarlo.
const SQL_TEMA = (t: Tema) =>
  ["clasico", "noir", "esmeralda", "street", "retro"].includes(t)
    ? "0002_temas.sql"
    : ["bistro", "veggie", "forno", "oriente", "neon"].includes(t)
      ? "0006_temas_nuevos.sql"
      : "0007_destacados_y_temas.sql";

export function FormMarca({ restaurante, secciones }: { restaurante: Restaurante; secciones: Seccion[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const avisar = useToast();
  const sitio = useUrlSitio();
  const [nombre, setNombre] = useState(restaurante.nombre);
  const [descripcion, setDescripcion] = useState(restaurante.descripcion ?? "");
  const [logo, setLogo] = useState(restaurante.logo_url);
  const [primario, setPrimario] = useState(restaurante.color_primario);
  const [fondo, setFondo] = useState(restaurante.color_fondo);
  const [moneda, setMoneda] = useState(restaurante.moneda);
  const [tema, setTema] = useState<Tema>(restaurante.tema ?? "clasico");
  // Los ajustes existen desde la migración 0004.
  const tieneAjustes = "ajustes" in restaurante;
  const [sonidoHoja, setSonidoHoja] = useState<SonidoHoja>(leerAjustes(restaurante.ajustes).sonido_hoja);
  const [grupo, setGrupo] = useState<GrupoTema>(TEMA_INFO[restaurante.tema ?? "clasico"]?.grupo ?? "sencillos");
  const [whatsapp, setWhatsapp] = useState(restaurante.whatsapp ?? "");
  const [idiomas, setIdiomas] = useState<string[]>(restaurante.idiomas ?? []);
  const [descTraducida, setDescTraducida] = useState<Record<string, string>>(() =>
    Object.fromEntries(IDIOMAS_EXTRA.map((i) => [i, restaurante.traducciones?.[i]?.descripcion ?? ""])),
  );
  const [pedidos, setPedidos] = useState(restaurante.pedidos_whatsapp ?? false);
  // Las columnas nuevas solo se guardan si ya se ejecutó la migración 0003.
  const tieneExtras = "idiomas" in restaurante;
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const inputLogo = useRef<HTMLInputElement>(null);

  async function elegirLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    setSubiendo(true);
    try {
      setLogo(await subirFoto(supabase, restaurante.id, archivo, 512));
    } catch (err) {
      avisar(mensajeError(err), "error");
    } finally {
      setSubiendo(false);
    }
  }

  const traducciones = {
    ...restaurante.traducciones,
    ...Object.fromEntries(
      IDIOMAS_EXTRA.map((i) => [i, { ...restaurante.traducciones?.[i], descripcion: descTraducida[i].trim() || undefined }]),
    ),
  };

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    const telefono = whatsapp.replace(/\D/g, "");
    const { error } = await supabase
      .from("restaurantes")
      .update({
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        logo_url: logo,
        color_primario: primario,
        color_fondo: fondo,
        moneda,
        whatsapp: telefono || null,
        tema,
        ...(tieneExtras ? { idiomas, traducciones, pedidos_whatsapp: pedidos } : {}),
        ...(tieneAjustes && sonidoHoja !== leerAjustes(restaurante.ajustes).sonido_hoja
          ? { ajustes: { ...leerAjustes(restaurante.ajustes), sonido_hoja: sonidoHoja } }
          : {}),
      })
      .eq("id", restaurante.id);
    setGuardando(false);
    if (error) {
      const falta = error.message.includes("tema");
      const sql = SQL_TEMA(tema);
      return avisar(falta ? `Falta ejecutar el SQL ${sql} en Supabase para guardar el diseño.` : mensajeError(error), "error");
    }
    if (restaurante.logo_url && restaurante.logo_url !== logo) borrarFoto(supabase, restaurante.logo_url);
    avisar("Cambios guardados");
    await revalidarCarta();
    router.refresh();
  }

  function elegirTema(t: Tema) {
    setTema(t);
    // Cada diseño trae su color de acento sugerido; se puede cambiar después.
    setPrimario(TEMA_INFO[t].acento);
    if (t === "clasico") setFondo(TEMA_INFO.clasico.fondo);
  }

  const vista: Restaurante = {
    ...restaurante,
    nombre: nombre || "Tu restaurante",
    descripcion: descripcion || null,
    logo_url: logo,
    color_primario: primario,
    color_fondo: fondo,
    moneda,
    tema,
    idiomas,
    traducciones,
    pedidos_whatsapp: pedidos,
    ajustes: { ...leerAjustes(restaurante.ajustes), sonido_hoja: sonidoHoja },
  };

  return (
    <form onSubmit={guardar} className="grid gap-6 md:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <div className="tarjeta space-y-4 p-5">
          <div>
            <h2 className="font-semibold">Diseño de la carta</h2>
            <p className="text-sm text-suave">Elige cómo ven tu carta los clientes. Puedes cambiarlo cuando quieras.</p>
          </div>
          <div role="tablist" aria-label="Tipos de diseño" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {GRUPOS_TEMA.map((g) => {
              const activo = grupo === g.id;
              const cantidad = TEMAS.filter((t) => TEMA_INFO[t].grupo === g.id).length;
              const elegido = TEMA_INFO[tema].grupo === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  role="tab"
                  aria-selected={activo}
                  onClick={() => setGrupo(g.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                    activo ? "border-marca bg-marca text-white" : "border-borde hover:border-stone-400"
                  }`}
                >
                  {elegido && <span aria-label="incluye el diseño elegido">●</span>}
                  {g.nombre}
                  <span className={activo ? "text-white/75" : "text-suave"}>{cantidad}</span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {TEMAS.filter((t) => TEMA_INFO[t].grupo === grupo).map((t) => {
              const info = TEMA_INFO[t];
              const activo = tema === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => elegirTema(t)}
                  aria-pressed={activo}
                  className={`overflow-hidden rounded-xl border-2 text-left transition ${
                    activo ? "border-marca ring-2 ring-marca/20" : "border-borde hover:border-stone-400"
                  }`}
                >
                  <span
                    className="flex h-20 flex-col items-center justify-center gap-1.5"
                    style={{ background: t === "clasico" ? "#fffbf5" : info.fondo }}
                  >
                    <span className={`text-lg leading-none ${MUESTRA_FUENTE[t]}`} style={{ color: info.acento }}>
                      Menú
                    </span>
                    <span className="h-1 w-10 rounded-full" style={{ background: info.acento }} />
                  </span>
                  <span className="block px-3 py-2">
                    <span className="block text-sm font-semibold">{info.nombre}</span>
                    <span className="block text-xs leading-snug text-suave">{info.descripcion}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {tema === "revista" && tieneAjustes && (
            <div className="space-y-2 rounded-xl border border-borde p-4">
              <p className="text-sm font-semibold">Sonido al pasar página</p>
              <div className="flex flex-wrap gap-2">
                {SONIDOS_HOJA.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={sonidoHoja === s}
                    onClick={() => {
                      setSonidoHoja(s);
                      if (s !== "ninguno") new Audio(`/sonidos/hoja-${s}.mp3`).play().catch(() => {});
                    }}
                    className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                      sonidoHoja === s ? "border-marca bg-marca text-white" : "border-borde hover:border-stone-400"
                    }`}
                  >
                    {NOMBRE_SONIDO[s]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-suave">Tocá uno para escucharlo. El cliente también puede silenciarlo desde la carta.</p>
            </div>
          )}
        </div>

        <div className="tarjeta space-y-4 p-5">
          <h2 className="font-semibold">Datos del restaurante</h2>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => inputLogo.current?.click()}
              className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-dashed border-stone-300 bg-stone-50 text-xs text-suave hover:border-marca"
            >
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="Logo" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <span>{subiendo ? "Subiendo…" : "+ Logo"}</span>
              )}
            </button>
            <input ref={inputLogo} type="file" accept="image/*" className="hidden" onChange={elegirLogo} />
            <div className="text-sm">
              <button type="button" onClick={() => inputLogo.current?.click()} className="block text-marca" disabled={subiendo}>
                {subiendo ? "Subiendo…" : logo ? "Cambiar logo" : "Subir logo"}
              </button>
              {logo && (
                <button type="button" onClick={() => setLogo(null)} className="mt-1 block text-suave hover:text-red-600">
                  Quitar logo
                </button>
              )}
            </div>
          </div>
          <div>
            <label htmlFor="nombre" className="etiqueta-campo">
              Nombre
            </label>
            <input
              id="nombre"
              required
              maxLength={80}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="campo"
            />
          </div>
          <div>
            <label htmlFor="descripcion" className="etiqueta-campo">
              Frase corta <span className="font-normal text-suave">(opcional)</span>
            </label>
            <input
              id="descripcion"
              maxLength={300}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="campo"
              placeholder="Cocina de barrio desde 1998"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="moneda" className="etiqueta-campo">
                Moneda
              </label>
              <select id="moneda" value={moneda} onChange={(e) => setMoneda(e.target.value)} className="campo">
                {(MONEDAS.includes(moneda) ? MONEDAS : [moneda, ...MONEDAS]).map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="whatsapp" className="etiqueta-campo">
                WhatsApp
              </label>
              <input
                id="whatsapp"
                inputMode="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="campo"
                placeholder="5215512345678"
              />
            </div>
          </div>
          <p className="text-xs text-suave">
            El WhatsApp va con código de país y sin espacios. Si lo dejas vacío no se muestra el botón.
          </p>
          <div>
            <span className="etiqueta-campo">Dirección de la carta</span>
            <p className="break-all rounded-lg bg-stone-50 px-3 py-2.5 font-mono text-sm text-suave">
              {urlCarta(restaurante.slug, undefined, sitio)}
            </p>
          </div>
        </div>

        <div className="tarjeta space-y-4 p-5">
          <div>
            <h2 className="font-semibold">Idiomas</h2>
            <p className="text-sm text-suave">
              La carta se escribe en español. Si activas otros idiomas, el cliente verá un botón para cambiarlo y la carta se abre
              sola en el idioma de su teléfono.
            </p>
          </div>
          {!tieneExtras && <AvisoMigracion />}
          <div className="flex flex-wrap gap-2">
            {IDIOMAS_EXTRA.map((i) => {
              const activo = idiomas.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={activo}
                  disabled={!tieneExtras}
                  onClick={() => setIdiomas((a) => (activo ? a.filter((x) => x !== i) : [...a, i]))}
                  className={`rounded-full border px-3 py-1 text-sm transition ${
                    activo ? "border-marca bg-marca text-white" : "border-borde text-suave hover:border-stone-400"
                  }`}
                >
                  {IDIOMA_EN_ESPANOL[i]}
                </button>
              );
            })}
          </div>
          {IDIOMAS_EXTRA.filter((i) => idiomas.includes(i)).map((i) => (
            <div key={i}>
              <label htmlFor={`desc-${i}`} className="etiqueta-campo">
                Descripción en {IDIOMA_EN_ESPANOL[i].toLowerCase()}
              </label>
              <input
                id={`desc-${i}`}
                maxLength={300}
                value={descTraducida[i]}
                onChange={(e) => setDescTraducida((d) => ({ ...d, [i]: e.target.value }))}
                placeholder={descripcion || "Opcional"}
                className="campo"
              />
            </div>
          ))}
          {idiomas.length > 0 && (
            <p className="text-xs text-suave">
              Los nombres y descripciones de cada plato se traducen desde Carta, al editar el plato. Lo que no traduzcas se
              muestra en español.
            </p>
          )}
        </div>

        <div className="tarjeta space-y-3 p-5">
          <label className="flex items-center justify-between gap-4">
            <span>
              <span className="block font-semibold">Pedidos por WhatsApp</span>
              <span className="block text-sm text-suave">
                Los clientes arman su pedido en la carta y te lo envían por WhatsApp con la mesa, el total y sus notas.
              </span>
            </span>
            <Interruptor activo={pedidos} onChange={setPedidos} etiqueta="Pedidos por WhatsApp" />
          </label>
          {!tieneExtras && <AvisoMigracion />}
          {pedidos && !whatsapp.replace(/\D/g, "") && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Escribe tu número de WhatsApp arriba (o el de cada sucursal) para recibir los pedidos.
            </p>
          )}
        </div>

        <div className="tarjeta space-y-4 p-5">
          <h2 className="font-semibold">Colores</h2>
          {tema === "clasico" ? (
            <>
              <div className="flex flex-wrap gap-2">
                {PALETAS.map((p) => (
                  <button
                    key={p.primario}
                    type="button"
                    onClick={() => {
                      setPrimario(p.primario);
                      setFondo(p.fondo);
                    }}
                    aria-label={`Paleta ${p.primario}`}
                    className={`h-10 w-10 rounded-full border-4 ${primario === p.primario ? "border-tinta" : "border-white"} shadow`}
                    style={{ background: `linear-gradient(135deg, ${p.primario} 50%, ${p.fondo} 50%)` }}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-3 rounded-lg border border-borde px-3 py-2">
                  <input
                    type="color"
                    value={primario}
                    onChange={(e) => setPrimario(e.target.value)}
                    className="h-8 w-8 cursor-pointer"
                  />
                  <span className="text-sm">Principal</span>
                </label>
                <label className="flex items-center gap-3 rounded-lg border border-borde px-3 py-2">
                  <input
                    type="color"
                    value={fondo}
                    onChange={(e) => setFondo(e.target.value)}
                    className="h-8 w-8 cursor-pointer"
                  />
                  <span className="text-sm">Fondo</span>
                </label>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-suave">El fondo lo pone el diseño. Elige el color de acento para precios y detalles.</p>
              <div className="flex flex-wrap items-center gap-2">
                {ACENTOS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setPrimario(c)}
                    aria-label={`Acento ${c}`}
                    className={`h-10 w-10 rounded-full border-4 ${primario === c ? "border-tinta" : "border-white"} shadow`}
                    style={{ background: c }}
                  />
                ))}
                <label className="flex items-center gap-2 rounded-lg border border-borde px-3 py-1.5">
                  <input
                    type="color"
                    value={primario}
                    onChange={(e) => setPrimario(e.target.value)}
                    className="h-7 w-7 cursor-pointer"
                  />
                  <span className="text-sm">Otro</span>
                </label>
              </div>
            </>
          )}
        </div>

        <button type="submit" className="boton w-full sm:w-auto" disabled={guardando || subiendo}>
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>

      {/* Vista previa en vivo con la carta real */}
      <aside className="order-first md:order-none">
        <div className="md:sticky md:top-28">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-suave">Vista previa</p>
          <div className="mx-auto h-[480px] w-full max-w-[320px] overflow-y-auto overscroll-contain rounded-[2.2rem] border-[10px] tema-fijo border-tinta bg-white shadow-xl [scrollbar-width:none] md:h-[620px]">
            <Carta restaurante={vista} secciones={secciones.length ? secciones : SECCIONES_EJEMPLO} vistaPrevia />
          </div>
          {secciones.length === 0 && (
            <p className="mt-2 text-center text-xs text-suave">Con platos de ejemplo hasta que cargues los tuyos.</p>
          )}
        </div>
      </aside>
    </form>
  );
}

function AvisoMigracion() {
  return (
    <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
      Para usar esto falta ejecutar el SQL 0003_idiomas_pedidos_sucursales.sql en Supabase.
    </p>
  );
}
