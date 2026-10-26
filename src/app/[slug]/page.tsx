import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatoPrecio, textoSobre } from "@/lib/utils";
import { obtenerCarta } from "./datos";
import { NavCategorias } from "./NavCategorias";
import { PieMesa } from "./PieMesa";

// La carta se sirve desde caché y se regenera al guardar en el panel (y cada 5 min por si acaso).
export const revalidate = 300;

// Ninguna carta se genera al compilar: cada una se crea en la primera visita y queda en caché.
export function generateStaticParams() {
  return [];
}

type Params = { params: Promise<{ slug: string }> };

const ICONOS: Record<string, string> = {
  vegetariano: "🌿",
  vegano: "🌱",
  "sin gluten": "🌾",
  picante: "🌶️",
  nuevo: "✨",
  recomendado: "⭐",
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const carta = await obtenerCarta((await params).slug);
  if (!carta) return { title: "Carta no encontrada" };
  const { restaurante } = carta;
  return {
    title: `${restaurante.nombre} · Carta`,
    description: restaurante.descripcion ?? `Carta de ${restaurante.nombre}`,
    openGraph: { title: restaurante.nombre, images: restaurante.logo_url ? [restaurante.logo_url] : [] },
    icons: restaurante.logo_url ? { icon: restaurante.logo_url } : undefined,
  };
}

export default async function CartaPublica({ params }: Params) {
  const carta = await obtenerCarta((await params).slug);
  if (!carta) notFound();
  const { restaurante, secciones } = carta;
  const tinta = textoSobre(restaurante.color_fondo);

  return (
    <div
      className="min-h-screen pb-28"
      style={
        {
          background: restaurante.color_fondo,
          color: tinta,
          "--primario": restaurante.color_primario,
          "--sobre-primario": textoSobre(restaurante.color_primario),
          "--tinta": tinta,
          "--fondo": restaurante.color_fondo,
        } as React.CSSProperties
      }
    >
      <header className="px-5 pb-8 pt-10 text-center" style={{ background: "var(--primario)", color: "var(--sobre-primario)" }}>
        {restaurante.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={restaurante.logo_url}
            alt={`Logo de ${restaurante.nombre}`}
            className="mx-auto mb-3 h-20 w-20 rounded-full border-4 border-white/80 object-cover shadow-md"
          />
        )}
        <h1 className="font-serif text-3xl font-semibold">{restaurante.nombre}</h1>
        {restaurante.descripcion && <p className="mx-auto mt-1 max-w-md text-sm opacity-85">{restaurante.descripcion}</p>}
      </header>

      {secciones.length > 0 && <NavCategorias categorias={secciones.map((s) => ({ id: s.id, nombre: s.nombre }))} />}

      <main className="mx-auto max-w-2xl px-4">
        {secciones.length === 0 && <p className="py-16 text-center opacity-70">La carta se está preparando. Vuelve pronto.</p>}

        {secciones.map((seccion) => (
          <section key={seccion.id} id={`c-${seccion.id}`} className="scroll-mt-16 pt-8">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-widest" style={{ color: "var(--primario)" }}>
              {seccion.nombre}
            </h2>
            <ul className="space-y-3">
              {seccion.platos.map((plato) => (
                <li key={plato.id} className="flex gap-4 rounded-2xl bg-white/70 p-3 shadow-sm ring-1 ring-black/5">
                  <div className="min-w-0 flex-1 py-0.5">
                    <h3 className="font-semibold leading-snug text-stone-900">{plato.nombre}</h3>
                    {plato.descripcion && <p className="mt-0.5 text-sm leading-snug text-stone-600">{plato.descripcion}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-semibold tabular-nums" style={{ color: "var(--primario)" }}>
                        {formatoPrecio(plato.precio, restaurante.moneda)}
                      </span>
                      {plato.etiquetas.map((et) => (
                        <span key={et} className="text-xs text-stone-600">
                          {ICONOS[et] ?? "•"} {et}
                        </span>
                      ))}
                    </div>
                  </div>
                  {plato.foto_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={plato.foto_url}
                      alt={plato.nombre}
                      loading="lazy"
                      decoding="async"
                      className="h-24 w-24 shrink-0 rounded-xl object-cover"
                    />
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>

      <Suspense>
        <PieMesa whatsapp={restaurante.whatsapp} nombre={restaurante.nombre} />
      </Suspense>
    </div>
  );
}
