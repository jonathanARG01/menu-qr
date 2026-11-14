"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { Interruptor } from "@/components/Interruptor";
import { RUBROS, type IdRubro } from "@/lib/rubros";
import { emojiSello, type Negocio } from "@/lib/tipos";
import { MONEDAS, comprimirImagen, mensajeError } from "@/lib/utils";

const PAISES: [string, string, string, string][] = [
  ["CL", "Chile", "CLP", "America/Santiago"],
  ["AR", "Argentina", "ARS", "America/Argentina/Buenos_Aires"],
  ["PE", "Perú", "PEN", "America/Lima"],
  ["CO", "Colombia", "COP", "America/Bogota"],
  ["MX", "México", "MXN", "America/Mexico_City"],
  ["UY", "Uruguay", "UYU", "America/Montevideo"],
  ["BO", "Bolivia", "BOB", "America/La_Paz"],
  ["PY", "Paraguay", "PYG", "America/Asuncion"],
  ["EC", "Ecuador", "USD", "America/Guayaquil"],
  ["ES", "España", "EUR", "Europe/Madrid"],
  ["US", "Estados Unidos", "USD", "America/New_York"],
];

// Datos del negocio: nombre, logo, contacto, reseñas, país y PIN para autorizar.
export function DatosNegocio({ negocio, tienePin }: { negocio: Negocio; tienePin: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const avisar = useToast();
  const [n, setN] = useState(negocio);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [pin, setPin] = useState("");
  const cambiar = (c: Partial<Negocio>) => setN((x) => ({ ...x, ...c }));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (n.resena_url && !/^https:\/\//.test(n.resena_url)) return avisar("El enlace de reseñas debe empezar con https://", "error");
    setGuardando(true);
    const { error } = await supabase
      .from("negocios")
      .update({
        nombre: n.nombre.trim(),
        rubro: n.rubro,
        telefono: n.telefono?.trim() || null,
        direccion: n.direccion?.trim() || null,
        instagram: n.instagram?.trim().replace(/^@/, "") || null,
        resena_url: n.resena_url?.trim() || null,
        pais: n.pais,
        moneda: n.moneda,
        zona_horaria: n.zona_horaria,
        pide_pin: n.pide_pin,
      })
      .eq("id", n.id);
    setGuardando(false);
    if (error) return avisar(mensajeError(error), "error");
    avisar("Datos guardados");
    router.refresh();
  }

  async function subirLogo(archivo: File) {
    setSubiendo(true);
    try {
      const blob = await comprimirImagen(archivo, 600);
      const ruta = `${n.id}/logo-${Date.now()}.webp`;
      const { error } = await supabase.storage.from("logos").upload(ruta, blob, { contentType: "image/webp", upsert: true });
      if (error) throw error;
      const url = supabase.storage.from("logos").getPublicUrl(ruta).data.publicUrl;
      const { error: e2 } = await supabase.from("negocios").update({ logo_url: url }).eq("id", n.id);
      if (e2) throw e2;
      cambiar({ logo_url: url });
      avisar("Logo actualizado");
      router.refresh();
    } catch (e) {
      avisar(mensajeError(e), "error");
    }
    setSubiendo(false);
  }

  async function quitarLogo() {
    const { error } = await supabase.from("negocios").update({ logo_url: null }).eq("id", n.id);
    if (error) return avisar(mensajeError(error), "error");
    cambiar({ logo_url: null });
    router.refresh();
  }

  async function guardarPin(borrar = false) {
    if (!borrar && !/^\d{4,6}$/.test(pin)) return avisar("El PIN debe tener de 4 a 6 números", "error");
    const { error } = await supabase.rpc("poner_pin", { p_negocio: n.id, p_pin: borrar ? null : pin });
    if (error) return avisar(mensajeError(error), "error");
    setPin("");
    avisar(borrar ? "PIN borrado" : "PIN guardado");
    router.refresh();
  }

  return (
    <form onSubmit={guardar} className="max-w-2xl space-y-5">
      <h1 className="text-xl font-semibold">Tu negocio</h1>

      <section className="tarjeta space-y-4 p-5">
        <div className="flex items-center gap-4">
          {n.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={n.logo_url} alt="Logo" className="h-20 w-20 rounded-2xl border border-borde object-contain p-1" />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-stone-100 text-3xl" aria-hidden>
              {emojiSello(RUBROS[n.rubro as IdRubro]?.icono)}
            </span>
          )}
          <div className="space-y-1 text-sm">
            <label className="boton-secundario cursor-pointer py-1.5">
              {subiendo ? "Subiendo…" : n.logo_url ? "Cambiar logo" : "Subir logo"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={subiendo}
                onChange={(e) => e.target.files?.[0] && subirLogo(e.target.files[0])}
              />
            </label>
            {n.logo_url && (
              <button type="button" className="block text-suave hover:text-red-600" onClick={quitarLogo}>
                Quitar logo
              </button>
            )}
            <p className="text-xs text-suave">Sale en la tarjeta de tus clientes y en el cartel.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="etiqueta-campo">Nombre</span>
            <input required maxLength={80} value={n.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} className="campo" />
          </label>
          <label className="block text-sm">
            <span className="etiqueta-campo">Rubro</span>
            <select value={n.rubro} onChange={(e) => cambiar({ rubro: e.target.value })} className="campo">
              {(Object.keys(RUBROS) as IdRubro[]).map((id) => (
                <option key={id} value={id}>
                  {emojiSello(RUBROS[id].icono)} {RUBROS[id].nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="etiqueta-campo">WhatsApp o teléfono</span>
            <input
              type="tel"
              maxLength={30}
              value={n.telefono ?? ""}
              onChange={(e) => cambiar({ telefono: e.target.value })}
              className="campo"
            />
          </label>
          <label className="block text-sm">
            <span className="etiqueta-campo">Instagram</span>
            <input
              maxLength={60}
              value={n.instagram ?? ""}
              onChange={(e) => cambiar({ instagram: e.target.value })}
              placeholder="@tunegocio"
              className="campo"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="etiqueta-campo">Dirección</span>
            <input
              maxLength={160}
              value={n.direccion ?? ""}
              onChange={(e) => cambiar({ direccion: e.target.value })}
              className="campo"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="etiqueta-campo">Enlace para dejar reseña en Google</span>
            <input
              type="url"
              maxLength={500}
              value={n.resena_url ?? ""}
              onChange={(e) => cambiar({ resena_url: e.target.value })}
              placeholder="https://g.page/r/…/review"
              className="campo"
            />
            <span className="mt-1 block text-xs text-suave">
              En tu Perfil de Empresa de Google: “Pedir reseñas” → copiar enlace. La tarjeta invita a dejar reseña después de
              sumar un sello.
            </span>
          </label>
        </div>
      </section>

      <section className="tarjeta space-y-4 p-5">
        <h2 className="font-semibold">País y moneda</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="etiqueta-campo">País</span>
            <select
              value={n.pais}
              onChange={(e) => {
                const p = PAISES.find((x) => x[0] === e.target.value);
                cambiar(p ? { pais: p[0], moneda: p[2], zona_horaria: p[3] } : { pais: e.target.value });
              }}
              className="campo"
            >
              {PAISES.map(([id, nombre]) => (
                <option key={id} value={id}>
                  {nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="etiqueta-campo">Moneda</span>
            <select value={n.moneda} onChange={(e) => cambiar({ moneda: e.target.value })} className="campo">
              {MONEDAS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="etiqueta-campo">Zona horaria</span>
            <input value={n.zona_horaria} onChange={(e) => cambiar({ zona_horaria: e.target.value })} className="campo" />
          </label>
        </div>
      </section>

      <section className="tarjeta space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Pedir PIN al equipo</h2>
            <p className="text-sm text-suave">
              Para canjear premios o corregir sellos, tus empleados necesitarán tu PIN. Sumar un sello no lo pide.
            </p>
          </div>
          <Interruptor activo={n.pide_pin} onChange={(v) => cambiar({ pide_pin: v })} etiqueta="Pedir PIN al equipo" />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block text-sm">
            <span className="etiqueta-campo">{tienePin ? "Cambiar mi PIN" : "Mi PIN"}</span>
            <input
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="4 a 6 números"
              className="campo w-40 font-mono tracking-widest"
            />
          </label>
          <button type="button" className="boton-secundario" onClick={() => guardarPin()}>
            Guardar PIN
          </button>
          {tienePin && (
            <button type="button" className="text-sm text-suave hover:text-red-600" onClick={() => guardarPin(true)}>
              Borrar PIN
            </button>
          )}
        </div>
        {n.pide_pin && !tienePin && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Pon tu PIN: sin él, tu equipo no podrá canjear premios.
          </p>
        )}
      </section>

      <button className="boton" disabled={guardando}>
        {guardando ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
