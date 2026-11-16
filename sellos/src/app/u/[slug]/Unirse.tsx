"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TarjetaVisual } from "@/components/TarjetaVisual";
import { Inclinable } from "@/components/Inclinable";
import { BotonTema, ScriptTema, Tema } from "@/components/Tema";
import { guardarTarjeta, tarjetaGuardada } from "@/lib/cliente";
import { rutaTarjeta, textoDias, type PremioCatalogo, type ProgramaSellos } from "@/lib/tipos";
import { MARCA } from "@/lib/marca";
import { mensajeError } from "@/lib/utils";

export type DatosUnirse = {
  negocio: { nombre: string; slug: string; logo_url: string | null; color: string; rubro: string; pais: string };
  programa: ProgramaSellos;
  activa: boolean;
  // Premios del catálogo (vacío si el dueño lo apagó o su plan no lo incluye).
  catalogo?: PremioCatalogo[];
};

// El cliente se une con su nombre y teléfono. Si en este celular ya tiene la tarjeta del local, va directo a ella
// (y si vino del QR de un solo uso, el sello se suma allá).
export function Unirse({
  datos,
  sello,
  referido,
}: {
  datos: DatosUnirse;
  sello: string | null;
  referido: { codigo: string; nombre: string } | null;
}) {
  const router = useRouter();
  const { negocio: r, programa: p } = datos;
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
    const { data, error } = await createClient().rpc("unirse", {
      p_slug: r.slug,
      p_nombre: nombre,
      p_telefono: telefono,
      p_email: null,
      p_cumpleanos: cumple || null,
      p_acepta: acepta,
      p_ref: referido?.codigo ?? null,
    });
    if (error || !data) {
      setEnviando(false);
      return setError(error ? mensajeError(error) : "No se pudo crear tu tarjeta. Intenta de nuevo.");
    }
    guardarTarjeta(r.slug, String(data));
    router.replace(destino(String(data), true));
  }

  const tinte = { "--tinte": p.color } as React.CSSProperties;
  if (revisando)
    return (
      <main className="cliente-app min-h-dvh" style={tinte}>
        <ScriptTema />
      </main>
    );
  if (!datos.activa)
    return (
      <main className="cliente-app flex min-h-dvh items-center justify-center px-4 text-center" style={tinte}>
        <ScriptTema />
        <p className="max-w-xs text-sm text-suave">La tarjeta de {r.nombre} está pausada por ahora. ¡Vuelve pronto!</p>
      </main>
    );

  return (
    <main className="cliente-app min-h-dvh px-4 pb-8 pt-4" style={tinte}>
      <ScriptTema />
      <Tema />
      <div className="mx-auto flex max-w-sm flex-col items-center gap-6">
        <div className="flex w-full items-center gap-3">
          {r.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.logo_url} alt="" className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain p-0.5 shadow-sm" />
          ) : (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-base font-bold text-white shadow-sm" style={{ background: p.color }}>
              {r.nombre.trim().charAt(0).toUpperCase()}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate font-semibold">{r.nombre}</span>
          <BotonTema />
        </div>
        <div className="text-center">
          {referido && (
            <p className="mb-3 rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-semibold text-emerald-900">
              🤝 {referido.nombre} te invitó{p.referido_regalo > 0 ? ": los dos ganan un regalo en tu primera visita" : ""}
            </p>
          )}
          <h1 className="text-2xl font-bold tracking-tight">{p.tipo === "puntos" ? `Tu club de ${p.nombre_puntos}` : "Tu tarjeta de sellos"}</h1>
          <p className="mt-1 text-sm text-suave">
            {p.tipo === "puntos" ? (
              <>
                Suma {p.nombre_puntos} con cada compra en {r.nombre} y canjéalos por premios.
              </>
            ) : (
              <>
                Junta {p.meta} sellos en {r.nombre} y llévate <b className="text-tinta">{p.premio}</b>.
              </>
            )}
          </p>
        </div>

        <div className="tema-fijo">
          <Inclinable giroscopio>
            <TarjetaVisual
              local={r.nombre}
              logo={r.logo_url}
              programa={p}
              sellos={p.bienvenida}
              puntos={p.bienvenida * p.puntos_regalo}
              nombre={nombre || undefined}
            />
          </Inclinable>
        </div>
        {p.dias_dobles?.length > 0 && (
          <p className="rounded-full bg-amber-100 px-4 py-1.5 text-sm font-semibold text-amber-900">
            🔥 {textoDias(p.dias_dobles)}: día doble
          </p>
        )}
        {p.bienvenida > 0 && (
          <p className="-mt-3 text-center text-sm font-medium text-emerald-700">
            {p.tipo === "puntos"
              ? `Empiezas con ${(p.bienvenida * p.puntos_regalo).toLocaleString("es-CL")} ${p.nombre_puntos} de regalo`
              : p.bienvenida === 1
                ? "Empiezas con 1 sello de regalo"
                : `Empiezas con ${p.bienvenida} sellos de regalo`}
          </p>
        )}

        {(datos.catalogo ?? []).length > 0 && (
          <section className="w-full">
            <h2 className="text-sm font-semibold">Premios que puedes ganar</h2>
            <p className="mb-2 text-xs text-suave">
              {p.tipo === "puntos"
                ? `Canjéalos con tus ${p.nombre_puntos}.`
                : `Al completar tu tarjeta eliges uno de estos o ${p.premio.charAt(0).toLowerCase() + p.premio.slice(1)}.`}
            </p>
            <ul className="sin-barra -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
              {(datos.catalogo ?? []).map((c) => (
                <li
                  key={c.id}
                  className={`tarjeta w-32 shrink-0 snap-start overflow-hidden ${c.agotado ? "opacity-50" : ""}`}
                >
                  <div className="aspect-square bg-stone-100">
                    {c.imagen_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.imagen_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-4xl">🎁</div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-semibold leading-tight">{c.titulo}</p>
                    {p.tipo === "puntos" && (
                      <p className="mt-0.5 text-[11px] font-bold" style={{ color: p.color }}>
                        {c.puntos.toLocaleString("es-CL")} {p.nombre_puntos}
                      </p>
                    )}
                    {c.agotado && <p className="text-[11px] text-suave">Agotado</p>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
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
              placeholder={r.pais === "CL" ? "+56 9 1234 5678" : "Tu número"}
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
        <Link href="/" className="text-xs text-suave">Tarjeta digital por {MARCA}</Link>
      </div>
    </main>
  );
}
