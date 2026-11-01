"use client";

import { enlaceRed, INFO_RED, REDES } from "@/lib/redes";
import { useCarta } from "./contexto";

// Redes sociales del local al final de la carta. Toma el color del texto de cada diseño.
export function RedesCarta() {
  const { ajustes, t } = useCarta();
  const todas = REDES.map((red) => ({ red, url: enlaceRed(red, ajustes.redes[red]) })).filter((r) => r.url);
  // La tienda online va como botón destacado; el resto, como íconos.
  const tienda = todas.find((r) => r.red === "tienda");
  const redes = todas.filter((r) => r.red !== "tienda");
  if (todas.length === 0) return null;

  return (
    <nav aria-label={t("siguenos")} className="relative mx-auto max-w-2xl px-4 pb-4 pt-10 text-center">
      {tienda && (
        <a
          href={tienda.url!}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold ring-1 ring-current/40 transition hover:ring-current/80"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
            <path d={INFO_RED.tienda.icono} />
          </svg>
          {t("tienda")}
        </a>
      )}
      {redes.length > 0 && <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">{t("siguenos")}</p>}
      <ul className="mt-3 flex flex-wrap justify-center gap-3">
        {redes.map(({ red, url }) => (
          <li key={red}>
            <a
              href={url!}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={INFO_RED[red].nombre}
              title={INFO_RED[red].nombre}
              className="flex h-11 w-11 items-center justify-center rounded-full ring-1 ring-current/30 transition hover:ring-current/70"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path d={INFO_RED[red].icono} />
              </svg>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
