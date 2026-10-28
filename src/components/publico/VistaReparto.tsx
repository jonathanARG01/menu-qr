"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { textoOpciones, type OpcionElegida } from "@/lib/salon";
import { formatoHora, numeroWhatsapp, paisDe } from "@/lib/region";
import { formatoPrecio } from "@/lib/utils";
import type { Restaurante } from "@/lib/types";
import { BOTON, ESTILO_BOTON, Marco } from "./Marco";

type Datos = {
  restaurante: string;
  moneda: string;
  nombre: string | null;
  telefono: string | null;
  direccion: string | null;
  para_hora: string | null;
  envio: number;
  estado: "abierta" | "cerrada" | "anulada";
  despachado_at: string | null;
  entregado_at: string | null;
  zona: string;
  pais: string | null;
  nota: string | null;
  numeros: number[];
  pagado: number;
  total: number;
  items: { nombre: string; cantidad: number; opciones?: OpcionElegida[] }[];
};

const MEDIOS = ["Efectivo", "Tarjeta", "Transferencia"] as const;

// Lo que ve el repartidor con el enlace que le manda el local: a quién, dónde, qué lleva, cuánto cobrar y "Entregado".
// Es para el equipo: va siempre en español.
export function VistaReparto({ restaurante, token }: { restaurante: Restaurante; token: string }) {
  const supabase = useRef(createClient()).current;
  const [datos, setDatos] = useState<Datos | null | undefined>(undefined);
  const [medio, setMedio] = useState<(typeof MEDIOS)[number]>("Efectivo");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const consultar = useCallback(async () => {
    const { data } = await supabase.rpc("ver_reparto", { p_token: token });
    setDatos((data as Datos | null) ?? null);
  }, [supabase, token]);

  useEffect(() => {
    consultar();
    const id = setInterval(consultar, 20000);
    return () => clearInterval(id);
  }, [consultar]);

  if (datos === undefined) {
    return (
      <Marco restaurante={restaurante} titulo="Reparto">
        <p className="text-stone-500">Cargando…</p>
      </Marco>
    );
  }
  if (datos === null) {
    return (
      <Marco restaurante={restaurante} titulo="Reparto">
        <p className="text-stone-600">Este enlace ya no sirve: el pedido tiene más de 2 días o no es un delivery.</p>
      </Marco>
    );
  }

  const precio = (n: number) => formatoPrecio(n, datos.moneda);
  const falta = Math.max(0, Number(datos.total) - Number(datos.pagado));
  const entregado = !!datos.entregado_at || datos.estado !== "abierta";
  const pais = paisDe(datos.pais ?? undefined);

  async function entregar() {
    if (!confirm(falta > 0 ? `¿Entregado y cobrado ${precio(falta)} con ${medio.toLowerCase()}?` : "¿Marcar como entregado?")) return;
    setEnviando(true);
    setError(null);
    const { error: e } = await supabase.rpc("entregar_reparto", { p_token: token, p_metodo: falta > 0 ? medio : null });
    setEnviando(false);
    if (e) return setError(e.message);
    consultar();
  }

  return (
    <Marco restaurante={restaurante} titulo={`Delivery #${datos.numeros.join(", #")}`}>
      <div className="space-y-4">
        <div className="rounded-2xl bg-stone-50 p-4">
          <p className="text-lg font-semibold">{datos.nombre ?? "Cliente"}</p>
          {datos.para_hora && (
            <p className="text-sm text-stone-500">Para las {formatoHora(datos.para_hora, { locale: pais.locale, zona: datos.zona })}</p>
          )}
          {datos.direccion && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(datos.direccion)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block font-medium text-sky-700 underline"
            >
              📍 {datos.direccion}
            </a>
          )}
          {datos.telefono && (
            <div className="mt-3 flex gap-2">
              <a href={`tel:${datos.telefono}`} className="flex-1 rounded-xl bg-white px-3 py-2 text-center text-sm font-semibold ring-1 ring-stone-200">
                📞 Llamar
              </a>
              <a
                href={`https://wa.me/${numeroWhatsapp(datos.telefono, pais)}?text=${encodeURIComponent(
                  `Hola ${datos.nombre ?? ""}, soy el repartidor de ${datos.restaurante}. Voy en camino.`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-xl bg-[#25d366] px-3 py-2 text-center text-sm font-semibold text-white"
              >
                WhatsApp
              </a>
            </div>
          )}
        </div>

        <ul className="divide-y divide-stone-100 border-y border-stone-100 text-sm">
          {datos.items.map((i, k) => (
            <li key={k} className="py-2">
              <strong>{i.cantidad} ×</strong> {i.nombre}
              {i.opciones?.length ? <span className="block text-xs text-stone-500">{textoOpciones(i.opciones)}</span> : null}
            </li>
          ))}
        </ul>
        {datos.nota && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">Nota: {datos.nota}</p>}

        <div className="rounded-2xl bg-stone-900 p-4 text-white">
          {falta > 0 ? (
            <>
              <p className="text-sm opacity-80">Cobrar al entregar</p>
              <p className="text-3xl font-bold tabular-nums">{precio(falta)}</p>
              {Number(datos.pagado) > 0 && <p className="text-xs opacity-70">Ya pagó {precio(Number(datos.pagado))}</p>}
            </>
          ) : (
            <p className="text-lg font-semibold">✓ Ya está pagado: no hay que cobrar</p>
          )}
        </div>

        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {entregado ? (
          <p className="rounded-2xl bg-emerald-50 p-4 text-center font-semibold text-emerald-800">Entregado. ¡Gracias!</p>
        ) : (
          <>
            {falta > 0 && (
              <div className="flex gap-2">
                {MEDIOS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={medio === m}
                    onClick={() => setMedio(m)}
                    className={`flex-1 rounded-xl border-2 px-2 py-2 text-sm font-semibold ${medio === m ? "border-stone-900" : "border-stone-200 text-stone-500"}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
            <button type="button" onClick={entregar} disabled={enviando} className={BOTON} style={ESTILO_BOTON}>
              {enviando ? "Guardando…" : falta > 0 ? `Entregado y cobrado · ${precio(falta)}` : "Entregado"}
            </button>
          </>
        )}
      </div>
    </Marco>
  );
}
