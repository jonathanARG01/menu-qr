"use client";

import { useEffect } from "react";
import type { ClaveTexto } from "@/lib/i18n";
import type { AvisoPedido, EstadoAvisado } from "./useMiMesa";

const ESTILO: Record<EstadoAvisado, { icono: string; titulo: ClaveTexto; ayuda: ClaveTexto; fondo: string }> = {
  preparando: { icono: "👩‍🍳", titulo: "avisoPreparando", ayuda: "avisoPreparandoAyuda", fondo: "bg-sky-100" },
  listo: { icono: "🔔", titulo: "avisoListo", ayuda: "avisoListoAyuda", fondo: "bg-emerald-100" },
  entregado: { icono: "🍽️", titulo: "avisoEntregado", ayuda: "avisoEntregadoAyuda", fondo: "bg-amber-100" },
};

// Dos notas cortas: el teléfono suele estar en la mesa y el cliente charlando.
function sonar() {
  try {
    const ctx = new AudioContext();
    [0, 0.18].forEach((t, i) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.frequency.value = i ? 1046 : 784;
      vol.gain.setValueAtTime(0.15, ctx.currentTime + t);
      vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.35);
      osc.connect(vol).connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.35);
    });
  } catch {}
}

// Ventana emergente en el celular del comensal cuando su pedido avanza en la cocina.
export function AvisoEmergente({
  avisos,
  onDescartar,
  t,
}: {
  avisos: AvisoPedido[];
  onDescartar: (id: number) => void;
  t: (clave: ClaveTexto) => string;
}) {
  const aviso = avisos[0];

  useEffect(() => {
    if (!aviso) return;
    sonar();
    try {
      navigator.vibrate?.([180, 80, 180]);
    } catch {}
  }, [aviso?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!aviso) return null;
  const e = ESTILO[aviso.estado];
  const items = aviso.items.slice(0, 4);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={() => onDescartar(aviso.id)}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="aviso-titulo"
        aria-describedby="aviso-ayuda"
        onClick={(ev) => ev.stopPropagation()}
        className="aviso-entrada w-full max-w-sm rounded-3xl bg-white p-6 text-center text-stone-900 shadow-2xl"
      >
        <span className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full text-3xl ${e.fondo}`} aria-hidden>
          {e.icono}
        </span>
        <h2 id="aviso-titulo" className="text-xl font-bold">
          {t(e.titulo)}
        </h2>
        <p id="aviso-ayuda" className="mt-1 text-stone-600">
          {t(e.ayuda)}
        </p>
        {items.length > 0 && (
          <ul className="mt-4 space-y-0.5 rounded-2xl bg-stone-50 px-4 py-3 text-left text-sm">
            {items.map((i, k) => (
              <li key={k} className="truncate">
                {i.cantidad} × {i.nombre}
              </li>
            ))}
            {aviso.items.length > items.length && <li className="text-stone-400">+{aviso.items.length - items.length}</li>}
          </ul>
        )}
        <button
          type="button"
          autoFocus
          onClick={() => onDescartar(aviso.id)}
          className="mt-5 w-full rounded-2xl px-4 py-3 font-semibold"
          style={{ background: "var(--acento)", color: "var(--sobre-acento)" }}
        >
          {t("entendido")}
          {avisos.length > 1 ? ` · ${avisos.length - 1} ${t("avisoMas")}` : ""}
        </button>
      </div>
    </div>
  );
}
