"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TarjetaVisual } from "@/components/sellos/TarjetaVisual";
import { guardarTarjeta, tarjetaGuardada } from "@/lib/sellos/cliente";
import { rutaTarjeta, type ProgramaSellos } from "@/lib/sellos/tipos";
import { mensajeError } from "@/lib/utils";

export type DatosUnirse = {
  restaurante: { nombre: string; slug: string; logo_url: string | null; color: string };
  programa: ProgramaSellos;
};

// El cliente se une con su nombre y teléfono. Si en este celular ya tiene la tarjeta del local, va directo a ella
// (y si vino del QR de la precuenta, el sello se suma allá).
export function Unirse({ datos, sello }: { datos: DatosUnirse; sello: string | null }) {
  const router = useRouter();
  const { restaurante: r, programa: p } = datos;
  const [revisando, setRevisando] = useState(true);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [cumple, setCumple] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [terminos, setTerminos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const destino = (codigo: string, nuevo = false) => {
    const q = new URLSearchParams();
    if (sello) q.set("sello", sello);
    if (nuevo) q.set("nuevo", "1");
    const s = q.toString();
    return `${rutaTarjeta(codigo)}${s ? `?${s}` : ""}`;
  };

  useEffect(() => {
    const guardada = tarjetaGuardada(r.slug);
    if (guardada) router.replace(destino(guardada));
    else setRevisando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function unirse(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError("");
    const { data, error } = await createClient().rpc("sellos_unirse", {
      p_slug: r.slug,
      p_nombre: nombre,
      p_telefono: telefono,
      p_email: null,
      p_cumpleanos: cumple || null,
      p_acepta: acepta,
    });
    if (error || !data) {
      setEnviando(false);
      return setError(error ? mensajeError(error) : "No se pudo crear tu tarjeta. Intenta de nuevo.");
    }
    guardarTarjeta(r.slug, String(data));
    router.replace(destino(String(data), true));
  }

  if (revisando) return <main className="min-h-dvh bg-stone-100" />;

  return (
    <main className="min-h-dvh bg-stone-100 px-4 py-8">
      <div className="mx-auto flex max-w-sm flex-col items-center gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Tu tarjeta de sellos</h1>
          <p className="mt-1 text-sm text-suave">
            Junta {p.meta} sellos en {r.nombre} y llévate <b className="text-tinta">{p.premio}</b>.
          </p>
        </div>

        <TarjetaVisual local={r.nombre} logo={r.logo_url} programa={p} sellos={p.bienvenida} nombre={nombre || undefined} />
        {p.bienvenida > 0 && (
          <p className="-mt-3 text-center text-sm font-medium text-emerald-700">
            {p.bienvenida === 1 ? "Empiezas con 1 sello de regalo" : `Empiezas con ${p.bienvenida} sellos de regalo`}
          </p>
        )}

        <form onSubmit={unirse} className="tarjeta w-full space-y-4 p-5">
          {sello && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Únete y el sello de tu visita se suma al tiro.
            </p>
          )}
          <label className="block text-sm">
            <span className="etiqueta-campo">Tu nombre</span>
            <input
              id="nombre"
              required
              maxLength={60}
              autoComplete="given-name"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="campo"
            />
          </label>
          <label className="block text-sm">
            <span className="etiqueta-campo">Tu teléfono</span>
            <input
              id="telefono"
              required
              type="tel"
              maxLength={30}
              autoComplete="tel"
              placeholder="+56 9 1234 5678"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="campo"
            />
            <span className="mt-1 block text-xs text-suave">Con tu teléfono recuperas la tarjeta si cambias de celular.</span>
          </label>
          <label className="block text-sm">
            <span className="etiqueta-campo">
              Tu cumpleaños <span className="font-normal text-suave">(opcional, para un regalo)</span>
            </span>
            <input id="cumple" type="date" value={cumple} onChange={(e) => setCumple(e.target.value)} className="campo" />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              id="terminos"
              type="checkbox"
              required
              checked={terminos}
              onChange={(e) => setTerminos(e.target.checked)}
              className="mt-1"
            />
            <span>
              Acepto que {r.nombre} guarde mi nombre y teléfono para mi tarjeta de sellos. Puedo pedir que los borren cuando
              quiera.
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input id="acepta" type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-1" />
            <span>Quiero recibir avisos y promociones de {r.nombre} (opcional).</span>
          </label>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button type="submit" className="boton w-full py-3 text-base" disabled={enviando}>
            {enviando ? "Creando tu tarjeta…" : "Obtener mi tarjeta"}
          </button>
          {p.condiciones && <p className="text-xs text-suave">{p.condiciones}</p>}
        </form>
        <p className="text-xs text-suave">Tarjeta digital por Platovi</p>
      </div>
    </main>
  );
}
