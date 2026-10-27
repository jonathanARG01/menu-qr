"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { leerAjustes } from "@/lib/salon";
import { formatoFecha, formatoHora, numeroWhatsapp, paisDe } from "@/lib/region";
import { soportaPush, suscribirA } from "@/lib/push";
import type { Restaurante } from "@/lib/types";
import { BOTON, ESTILO_BOTON, Marco, useIdioma, useTextos } from "./Marco";

type Datos = {
  nombre: string;
  personas: number;
  fecha: string;
  estado: "pendiente" | "confirmada" | "avisada" | "sentada" | "cancelada" | "no_vino";
  asistencia: "si" | "no" | null;
  zona: string;
  sucursal: string | null;
  direccion: string | null;
  whatsapp: string | null;
};

// El enlace que llega con la confirmación o el recordatorio: el cliente ve su reserva, avisa si va o no,
// y puede pedir que le recuerden unas horas antes.
export function MiReserva({ restaurante, id }: { restaurante: Restaurante; id: string }) {
  const t = useTextos(restaurante);
  const idioma = useIdioma(restaurante);
  const supabase = useRef(createClient()).current;
  const ajustes = leerAjustes(restaurante.ajustes);
  const [datos, setDatos] = useState<Datos | null | undefined>(undefined);
  const [enviando, setEnviando] = useState(false);
  const [gracias, setGracias] = useState<string | null>(null);
  const [push, setPush] = useState<"no" | "ofrecer" | "activo">("no");

  const consultar = useCallback(async () => {
    const { data } = await supabase.rpc("ver_reserva", { p_id: id });
    setDatos((data as Datos | null) ?? null);
  }, [supabase, id]);

  useEffect(() => {
    consultar();
    if (soportaPush() && ajustes.reservas.recordatorio) setPush(Notification.permission === "granted" ? "activo" : "ofrecer");
  }, [consultar, ajustes.reservas.recordatorio]);

  const futura = !!datos && Date.parse(datos.fecha) > Date.now() - 3600000;
  const abierta = !!datos && futura && (datos.estado === "pendiente" || datos.estado === "confirmada");

  useEffect(() => {
    if (push === "activo" && abierta) suscribirA({ tipo: "reserva", id }, idioma);
  }, [push, abierta, id, idioma]);

  async function responder(respuesta: "si" | "no") {
    if (respuesta === "no" && !confirm(t("noPuedo") + "?")) return;
    setEnviando(true);
    const { data } = await supabase.rpc("responder_reserva", { p_id: id, p_respuesta: respuesta });
    setEnviando(false);
    if (data) setDatos(data as Datos);
    setGracias(respuesta === "si" ? t("graciasVoy") : t("graciasNoVoy"));
  }

  if (datos === undefined) {
    return (
      <Marco restaurante={restaurante} titulo={t("tuReserva")}>
        <p className="text-stone-500">{t("cargando")}</p>
      </Marco>
    );
  }
  if (datos === null) {
    return (
      <Marco restaurante={restaurante} titulo={t("tuReserva")}>
        <p className="text-stone-600">{t("reservaNoEncontrada")}</p>
      </Marco>
    );
  }

  const region = { locale: paisDe(ajustes.pais).locale, zona: datos.zona };
  const cancelada = datos.estado === "cancelada";
  const estado = cancelada
    ? t("reservaCancelada")
    : !futura
      ? t("reservaPasada")
      : datos.estado === "pendiente"
        ? t("reservaPorConfirmar")
        : t("reservaConfirmada");

  return (
    <Marco restaurante={restaurante} titulo={t("tuReserva")}>
      <div className={`rounded-2xl p-4 text-center ${cancelada ? "bg-stone-100 text-stone-500" : "bg-stone-50"}`}>
        <p className="text-sm font-medium uppercase tracking-wide text-stone-500">
          {formatoFecha(datos.fecha, region, { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <p className={`mt-1 text-4xl font-bold tabular-nums ${cancelada ? "line-through" : ""}`}>
          {formatoHora(datos.fecha, region)}
        </p>
        <p className="mt-1 text-stone-600">
          {datos.nombre} · {datos.personas} {t("personas").toLowerCase()}
        </p>
        {(datos.sucursal || datos.direccion) && (
          <p className="mt-1 text-sm text-stone-500">{[datos.sucursal, datos.direccion].filter(Boolean).join(" · ")}</p>
        )}
        <p className="mt-3 text-sm font-semibold" role="status">
          {estado}
        </p>
      </div>

      {gracias && <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{gracias}</p>}

      {abierta && (
        <div className="mt-5 space-y-2">
          {datos.asistencia !== "si" && (
            <button type="button" disabled={enviando} onClick={() => responder("si")} className={BOTON} style={ESTILO_BOTON}>
              {t("voy")}
            </button>
          )}
          <button
            type="button"
            disabled={enviando}
            onClick={() => responder("no")}
            className="w-full rounded-2xl px-4 py-3 font-semibold text-red-700 ring-1 ring-red-200"
          >
            {t("noPuedo")}
          </button>
          {push === "ofrecer" && (
            <button
              type="button"
              onClick={async () => {
                const ok = await suscribirA({ tipo: "reserva", id }, idioma);
                setPush(ok ? "activo" : "no");
                if (ok) setGracias(t("avisosActivados"));
              }}
              className="w-full rounded-2xl px-4 py-3 font-semibold ring-1 ring-stone-300"
            >
              🔔 {t("avisarmeReserva")}
            </button>
          )}
        </div>
      )}

      <div className="mt-5 space-y-2">
        {datos.whatsapp && (
          <a
            href={`https://wa.me/${numeroWhatsapp(datos.whatsapp, paisDe(ajustes.pais))}?text=${encodeURIComponent(
              `Hola ${restaurante.nombre}, te escribo por mi reserva a nombre de ${datos.nombre}.`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-2xl bg-[#25d366] px-4 py-3 text-center font-semibold text-white"
          >
            {t("escribir")}
          </a>
        )}
        <a href={`/${restaurante.slug}`} className="block py-2 text-center text-sm text-stone-500 hover:underline">
          {t("verCarta")}
        </a>
      </div>
    </Marco>
  );
}
