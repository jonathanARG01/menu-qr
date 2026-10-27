"use client";

import { useState } from "react";
import type { ClaveTexto } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

// Al cerrar la mesa: "¿Cómo estuvo todo?". Con 4 o 5 estrellas se invita a dejar la reseña en Google;
// con menos, el comentario le llega solo al restaurante (así se corrige antes de que llegue a Google).
export function Opinion({
  restauranteId,
  sucursalId,
  mesa,
  googleUrl,
  t,
  onCerrar,
}: {
  restauranteId: string;
  sucursalId: string | null;
  mesa: string | null;
  googleUrl: string;
  t: (clave: ClaveTexto) => string;
  onCerrar: () => void;
}) {
  const [estrellas, setEstrellas] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviada, setEnviada] = useState(false);
  const buena = estrellas >= 4;

  async function enviar(conComentario: boolean, n = estrellas) {
    setEnviada(true);
    await createClient()
      .rpc("opinar", {
        p_restaurante: restauranteId,
        p_sucursal: sucursalId,
        p_mesa: mesa,
        p_estrellas: n,
        p_comentario: conComentario ? comentario : null,
      })
      .then(
        () => {},
        () => {},
      );
  }

  function elegir(n: number) {
    setEstrellas(n);
    // Las buenas se guardan enseguida: el cliente puede irse directo a Google.
    if (n >= 4 && googleUrl) enviar(false, n);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="opinion-titulo"
        onClick={(e) => e.stopPropagation()}
        className="aviso-entrada w-full max-w-sm rounded-3xl bg-white p-6 text-center text-stone-900 shadow-2xl"
      >
        <h2 id="opinion-titulo" className="text-xl font-bold">
          {enviada && (!buena || !googleUrl) ? t("resenaGracias") : t("resenaTitulo")}
        </h2>
        {!(enviada && (!buena || !googleUrl)) && (
          <div className="mt-4 flex justify-center gap-1" role="radiogroup" aria-label={t("resenaTitulo")}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={estrellas === n}
                aria-label={`${n}`}
                onClick={() => elegir(n)}
                className={`text-4xl transition active:scale-90 ${n <= estrellas ? "text-amber-400" : "text-stone-300"}`}
              >
                ★
              </button>
            ))}
          </div>
        )}

        {buena && googleUrl && (
          <div className="mt-4">
            <p className="text-stone-600">{t("resenaGoogle")}</p>
            <a
              href={googleUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setTimeout(onCerrar, 300)}
              className="mt-4 block w-full rounded-2xl px-4 py-3 font-semibold"
              style={{ background: "var(--acento, #1c1917)", color: "var(--sobre-acento, #fff)" }}
            >
              {t("resenaBoton")}
            </a>
          </div>
        )}

        {estrellas > 0 && !(buena && googleUrl) && !enviada && (
          <div className="mt-4 text-left">
            {!buena && <p className="mb-2 text-sm text-stone-600">{t("resenaMejorar")}</p>}
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              maxLength={500}
              rows={3}
              aria-label={t("comentario")}
              placeholder={t("comentario")}
              className="w-full rounded-xl border border-stone-200 p-3 text-sm outline-none focus:border-stone-400"
            />
            <button
              type="button"
              onClick={() => enviar(true)}
              className="mt-3 w-full rounded-2xl px-4 py-3 font-semibold"
              style={{ background: "var(--acento, #1c1917)", color: "var(--sobre-acento, #fff)" }}
            >
              {t("enviarOpinion")}
            </button>
          </div>
        )}

        <button type="button" onClick={onCerrar} className="mt-3 text-sm text-stone-500 underline">
          {enviada ? t("cerrar") : t("ahoraNo")}
        </button>
      </div>
    </div>
  );
}
