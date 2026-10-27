"use client";

import { useEffect, useState, type ReactNode } from "react";
import { texto, TEXTOS, type ClaveTexto, type Idioma } from "@/lib/i18n";
import type { Restaurante, Sucursal } from "@/lib/types";
import { textoSobre } from "@/lib/utils";

// Idioma del cliente en las páginas sueltas (reservar, lista de espera): el que eligió en la carta o el del navegador,
// entre los que ofrece el restaurante.
export function useTextos(restaurante: Restaurante) {
  const ofrecidos = (restaurante.idiomas ?? []).join(",");
  const [idioma, setIdioma] = useState<Idioma>("es");
  useEffect(() => {
    let guardado: string | null = null;
    try {
      guardado = localStorage.getItem("carta:idioma");
    } catch {}
    const elegido = [guardado, ...navigator.languages.map((l) => l.slice(0, 2).toLowerCase())].find(
      (i): i is Idioma => !!i && i in TEXTOS && (i === "es" || ofrecidos.split(",").includes(i)),
    );
    if (elegido) setIdioma(elegido);
  }, [ofrecidos]);
  return (clave: ClaveTexto) => texto(idioma, clave);
}

// La sucursal sale de ?s=<slug>, igual que en la carta.
export function useSucursal(sucursales: Sucursal[]) {
  const [sucursal, setSucursal] = useState<Sucursal | null>(sucursales.length === 1 ? sucursales[0] : null);
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("s");
    const encontrada = sucursales.find((x) => x.slug === s);
    if (encontrada) setSucursal(encontrada);
  }, [sucursales]);
  return [sucursal, setSucursal] as const;
}

export function Marco({ restaurante, titulo, children }: { restaurante: Restaurante; titulo: string; children: ReactNode }) {
  const color = restaurante.color_primario || "#1c1917";
  return (
    <main
      className="tema-fijo min-h-dvh bg-stone-100 px-4 py-8 text-stone-900"
      style={{ ["--acento" as string]: color, ["--sobre-acento" as string]: textoSobre(color) }}
    >
      <div className="mx-auto max-w-md">
        <a href={`/${restaurante.slug}`} className="mb-6 flex items-center gap-3">
          {restaurante.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={restaurante.logo_url} alt="" className="h-12 w-12 rounded-full bg-white object-cover shadow" />
          )}
          <span className="text-lg font-bold">{restaurante.nombre}</span>
        </a>
        <div className="rounded-3xl bg-white p-6 shadow-xl ring-1 ring-black/5">
          <h1 className="mb-4 text-2xl font-bold">{titulo}</h1>
          {children}
        </div>
      </div>
    </main>
  );
}

export const CAMPO =
  "mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base outline-none focus:border-stone-500";
export const BOTON = "w-full rounded-2xl px-4 py-3.5 font-semibold disabled:opacity-50";
export const ESTILO_BOTON = { background: "var(--acento)", color: "var(--sobre-acento)" };
