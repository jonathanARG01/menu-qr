"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { borrarFoto, subirFoto } from "@/lib/fotos";
import type { Restaurante } from "@/lib/types";
import { MONEDAS, formatoPrecio, mensajeError, textoSobre, urlCarta } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { revalidarCarta } from "../actions";

const PALETAS = [
  { primario: "#b45309", fondo: "#fffbf5" },
  { primario: "#9a3412", fondo: "#fffaf3" },
  { primario: "#166534", fondo: "#f7fbf6" },
  { primario: "#1e3a8a", fondo: "#f6f8fc" },
  { primario: "#831843", fondo: "#fdf7f9" },
  { primario: "#1c1917", fondo: "#ffffff" },
];

export function FormMarca({ restaurante }: { restaurante: Restaurante }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const avisar = useToast();
  const [nombre, setNombre] = useState(restaurante.nombre);
  const [descripcion, setDescripcion] = useState(restaurante.descripcion ?? "");
  const [logo, setLogo] = useState(restaurante.logo_url);
  const [primario, setPrimario] = useState(restaurante.color_primario);
  const [fondo, setFondo] = useState(restaurante.color_fondo);
  const [moneda, setMoneda] = useState(restaurante.moneda);
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
      })
      .eq("id", restaurante.id);
    setGuardando(false);
    if (error) return avisar(mensajeError(error), "error");
    if (restaurante.logo_url && restaurante.logo_url !== logo) borrarFoto(supabase, restaurante.logo_url);
    avisar("Cambios guardados");
    await revalidarCarta();
    router.refresh();
  }

  return (
    <form onSubmit={guardar} className="grid gap-6 md:grid-cols-[1fr_260px]">
      <div className="space-y-5">
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
              {urlCarta(restaurante.slug)}
            </p>
          </div>
        </div>

        <div className="tarjeta space-y-4 p-5">
          <h2 className="font-semibold">Colores</h2>
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
              <input type="color" value={fondo} onChange={(e) => setFondo(e.target.value)} className="h-8 w-8 cursor-pointer" />
              <span className="text-sm">Fondo</span>
            </label>
          </div>
        </div>

        <button type="submit" className="boton w-full sm:w-auto" disabled={guardando || subiendo}>
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>

      {/* Vista previa en vivo */}
      <aside className="order-first md:order-none">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-suave">Vista previa</p>
        <div className="overflow-hidden rounded-3xl border-8 border-tinta shadow-xl" style={{ background: fondo }}>
          <div className="px-4 pb-4 pt-6 text-center" style={{ background: primario, color: textoSobre(primario) }}>
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="mx-auto mb-2 h-12 w-12 rounded-full border-2 border-white object-cover" />
            )}
            <p className="font-serif text-lg font-semibold">{nombre || "Tu restaurante"}</p>
            {descripcion && <p className="text-xs opacity-80">{descripcion}</p>}
          </div>
          <div className="space-y-3 p-4">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: primario }}>
              Entradas
            </p>
            {[
              ["Empanadas (3)", 8.5],
              ["Ceviche clásico", 12],
            ].map(([n, p]) => (
              <div key={n} className="flex justify-between gap-2 text-sm" style={{ color: textoSobre(fondo) }}>
                <span>{n}</span>
                <span className="font-semibold" style={{ color: primario }}>
                  {formatoPrecio(Number(p), moneda)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </form>
  );
}
