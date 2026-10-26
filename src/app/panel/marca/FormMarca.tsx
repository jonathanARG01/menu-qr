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
import { TEMA_INFO } from "@/components/carta/comun";
import { SECCIONES_EJEMPLO } from "@/components/carta/ejemplo";
import { revalidarCarta } from "../actions";

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
};

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
  const [whatsapp, setWhatsapp] = useState(restaurante.whatsapp ?? "");
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
      })
      .eq("id", restaurante.id);
    setGuardando(false);
    if (error) {
      const falta = error.message.includes("tema");
      return avisar(
        falta ? "Falta ejecutar el SQL 0002_temas.sql en Supabase para guardar el diseño." : mensajeError(error),
        "error",
      );
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
  };

  return (
    <form onSubmit={guardar} className="grid gap-6 md:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <div className="tarjeta space-y-4 p-5">
          <div>
            <h2 className="font-semibold">Diseño de la carta</h2>
            <p className="text-sm text-suave">Elige cómo ven tu carta los clientes. Puedes cambiarlo cuando quieras.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {TEMAS.map((t) => {
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
          <div className="mx-auto h-[480px] w-full max-w-[320px] overflow-y-auto overscroll-contain rounded-[2.2rem] border-[10px] border-tinta bg-white shadow-xl [scrollbar-width:none] md:h-[620px]">
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
