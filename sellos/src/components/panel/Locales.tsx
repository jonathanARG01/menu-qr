"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import type { Negocio, Sucursal } from "@/lib/tipos";
import { mensajeError } from "@/lib/utils";

type Fila = { id?: string; nombre: string; direccion: string; latitud: number | null; longitud: number | null };

// Ubicación con el GPS del celular (estando en el local).
function ubicar(): Promise<{ latitud: number; longitud: number }> {
  return new Promise((ok, mal) => {
    if (!navigator.geolocation) return mal(new Error("Tu navegador no comparte la ubicación"));
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ latitud: Number(p.coords.latitude.toFixed(6)), longitud: Number(p.coords.longitude.toFixed(6)) }),
      () => mal(new Error("No pudimos leer tu ubicación. Revisa el permiso del navegador.")),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  });
}

export function Locales({ negocio, sucursales, puede }: { negocio: Negocio; sucursales: Sucursal[]; puede: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const avisar = useToast();
  const router = useRouter();
  const [editando, setEditando] = useState<Fila | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [ubicacion, setUbicacion] = useState({ latitud: negocio.latitud, longitud: negocio.longitud });

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setOcupado(true);
    const { id, ...fila } = editando;
    const datos = { ...fila, direccion: fila.direccion.trim() || null };
    const { error } = id
      ? await supabase.from("sucursales").update(datos).eq("id", id)
      : await supabase.from("sucursales").insert({ ...datos, negocio_id: negocio.id });
    setOcupado(false);
    if (error) return avisar(mensajeError(error), "error");
    setEditando(null);
    avisar("Local guardado");
    router.refresh();
  }

  async function guardarUbicacionNegocio(u: { latitud: number | null; longitud: number | null }) {
    const { error } = await supabase.from("negocios").update(u).eq("id", negocio.id);
    if (error) return avisar(mensajeError(error), "error");
    setUbicacion(u);
    avisar("Ubicación guardada");
    router.refresh();
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Locales</h1>
        <p className="text-sm text-suave">
          Con la ubicación, Google Wallet le muestra la tarjeta al cliente cuando pasa cerca de tu local.
        </p>
      </div>

      {!sucursales.length && (
        <section className="tarjeta space-y-3 p-5">
          <h2 className="font-semibold">Ubicación de tu local</h2>
          <p className="text-sm text-suave">
            {ubicacion.latitud != null
              ? `Guardada: ${ubicacion.latitud}, ${ubicacion.longitud}.`
              : "Todavía no la guardas. Hazlo desde el celular estando en el local."}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="boton py-2"
              onClick={() => ubicar().then(guardarUbicacionNegocio, (e) => avisar(mensajeError(e), "error"))}
            >
              📍 Usar mi ubicación actual
            </button>
            {ubicacion.latitud != null && (
              <button type="button" className="boton-secundario py-2" onClick={() => guardarUbicacionNegocio({ latitud: null, longitud: null })}>
                Quitar
              </button>
            )}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">
            Locales ({sucursales.length}/{negocio.max_locales})
          </h2>
          {puede && sucursales.length < negocio.max_locales && (
            <button className="boton py-2" onClick={() => setEditando({ nombre: "", direccion: "", latitud: null, longitud: null })}>
              + Agregar local
            </button>
          )}
        </div>
        {!puede && (
          <div className="tarjeta border-dashed p-5 text-sm">
            <p className="font-semibold">Varios locales es del plan Cadena</p>
            <p className="text-suave">
              Una sola tarjeta para todos tus locales, con métricas, campañas y equipo por local. Hasta 5 locales incluidos.
            </p>
            <a href="/panel/plan" className="boton mt-3">
              Ver planes
            </a>
          </div>
        )}

        {editando && (
          <form onSubmit={guardar} className="tarjeta grid gap-3 p-5 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="etiqueta-campo">Nombre</span>
              <input required maxLength={60} value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} placeholder="Viña Centro" className="campo" />
            </label>
            <label className="block text-sm">
              <span className="etiqueta-campo">Dirección</span>
              <input maxLength={160} value={editando.direccion} onChange={(e) => setEditando({ ...editando, direccion: e.target.value })} className="campo" />
            </label>
            <div className="flex flex-wrap items-center gap-2 text-sm sm:col-span-2">
              <button
                type="button"
                className="boton-secundario py-1.5"
                onClick={() => ubicar().then((u) => setEditando({ ...editando, ...u }), (e) => avisar(mensajeError(e), "error"))}
              >
                📍 Usar mi ubicación
              </button>
              <span className="text-suave">
                {editando.latitud != null ? `${editando.latitud}, ${editando.longitud}` : "Sin ubicación"}
              </span>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <button className="boton" disabled={ocupado}>
                Guardar
              </button>
              <button type="button" className="boton-secundario" onClick={() => setEditando(null)}>
                Cancelar
              </button>
            </div>
          </form>
        )}

        <ul className="space-y-2">
          {sucursales.map((s) => (
            <li key={s.id} className="tarjeta flex items-center gap-3 p-4">
              <span className="text-2xl" aria-hidden>
                📍
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{s.nombre}</p>
                <p className="text-xs text-suave">
                  {[s.direccion, s.latitud != null ? "con ubicación" : "sin ubicación"].filter(Boolean).join(" · ")}
                </p>
              </div>
              <button className="text-sm text-marca hover:underline" onClick={() => setEditando({ ...s, direccion: s.direccion ?? "" })}>
                Editar
              </button>
              <button
                className="text-sm text-suave hover:text-red-700"
                onClick={async () => {
                  if (!confirm(`¿Borrar el local ${s.nombre}? Sus visitas quedan guardadas.`)) return;
                  const { error } = await supabase.from("sucursales").delete().eq("id", s.id);
                  if (error) return avisar(mensajeError(error), "error");
                  router.refresh();
                }}
              >
                Borrar
              </button>
            </li>
          ))}
        </ul>
        {sucursales.length >= negocio.max_locales && puede && (
          <p className="text-xs text-suave">Llegaste al máximo de locales de tu plan. Escríbenos para sumar más ($9.990 + IVA cada uno).</p>
        )}
      </section>
    </div>
  );
}
