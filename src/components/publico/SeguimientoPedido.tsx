"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { leerAjustes, textoOpciones, type OpcionElegida } from "@/lib/salon";
import { formatoHora, numeroWhatsapp, paisDe } from "@/lib/region";
import { soportaPush, suscribirA } from "@/lib/push";
import { sonar } from "@/lib/sonidos";
import { formatoPrecio } from "@/lib/utils";
import type { ClaveTexto } from "@/lib/i18n";
import type { Restaurante } from "@/lib/types";
import { BOTON, ESTILO_BOTON, Marco, useIdioma, useTextos } from "./Marco";

type Datos = {
  tipo: "llevar" | "delivery";
  estado: "abierta" | "cerrada" | "anulada";
  nombre: string | null;
  direccion: string | null;
  para_hora: string | null;
  envio: number;
  desde: string;
  despachado_at: string | null;
  entregado_at?: string | null;
  cerrada_at: string | null;
  // Eligió pagar al retirar porque falló el pago en línea (migración 0018).
  paga_al_retirar?: boolean;
  zona: string;
  whatsapp: string | null;
  pagado: number;
  pedidos: {
    numero: number;
    estado: string;
    items: { nombre: string; precio: number; cantidad: number; opciones?: OpcionElegida[] }[];
  }[];
};

// Lo que agrega Mercado Pago a la dirección al volver.
const DE_MP = [
  "collection_id",
  "collection_status",
  "payment_id",
  "status",
  "external_reference",
  "payment_type",
  "merchant_order_id",
  "preference_id",
  "site_id",
  "processing_mode",
  "merchant_account_id",
  "pago",
];

type Paso = { clave: ClaveTexto; hecho: boolean; actual: boolean };

// Página del pedido para llevar o delivery: el cliente ve en qué va, lo paga online y pide el aviso al celular.
export function SeguimientoPedido({ restaurante, id }: { restaurante: Restaurante; id: string }) {
  const t = useTextos(restaurante);
  const idioma = useIdioma(restaurante);
  const supabase = useRef(createClient()).current;
  const ajustes = leerAjustes(restaurante.ajustes);
  const [datos, setDatos] = useState<Datos | null | undefined>(undefined);
  const [conectado, setConectado] = useState(false);
  const [pagando, setPagando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Mercado Pago no anduvo: se ofrece pagar al retirar (plan B).
  const [fallo, setFallo] = useState(false);
  const [push, setPush] = useState<"no" | "ofrecer" | "activo">("no");
  const anterior = useRef<string | null>(null);
  const precio = (n: number) => formatoPrecio(n, restaurante.moneda);

  const consultar = useCallback(async () => {
    const { data } = await supabase.rpc("mi_pedido", { p_id: id });
    setDatos((data as Datos | null) ?? null);
  }, [supabase, id]);

  useEffect(() => {
    consultar();
    const intervalo = setInterval(consultar, 8000);
    const alVolver = () => document.visibilityState === "visible" && consultar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [consultar]);

  useEffect(() => {
    if (ajustes.cobro_online.activo)
      supabase.rpc("cobro_online_conectado", { p_restaurante: restaurante.id }).then(({ data }) => setConectado(data === true));
    if (soportaPush()) setPush(Notification.permission === "granted" ? "activo" : "ofrecer");
  }, [supabase, restaurante.id, ajustes.cobro_online.activo]);

  // Con el permiso ya dado, la suscripción se ata a este pedido sin preguntar.
  useEffect(() => {
    if (push === "activo" && datos?.estado === "abierta") suscribirA({ tipo: "pedido", id }, idioma);
  }, [push, datos?.estado, id, idioma]);

  // Vuelta de Mercado Pago (?pago=…): se confirma con el servidor y se limpia la dirección.
  useEffect(() => {
    const url = new URL(window.location.href);
    const pago = url.searchParams.get("pago");
    if (!pago) return;
    const mpPago = url.searchParams.get("payment_id") ?? url.searchParams.get("collection_id") ?? "";
    DE_MP.forEach((p) => url.searchParams.delete(p));
    window.history.replaceState(null, "", url.pathname + url.search);
    let intentos = 0;
    const revisar = async () => {
      const res = await fetch(`/api/pagos/estado?id=${encodeURIComponent(pago)}&payment_id=${encodeURIComponent(mpPago)}`).catch(
        () => null,
      );
      const { estado } = ((await res?.json().catch(() => null)) ?? {}) as { estado?: string | null };
      if (estado === "aprobado") return (setAviso(t("pagoAprobado")), consultar());
      if (estado === "rechazado") return (setError(t("pagoRechazado")), setFallo(true));
      setAviso(t("pagoPendiente"));
      if (++intentos < 6) setTimeout(revisar, 4000);
    };
    revisar();
    // Solo al abrir la página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = datos?.pedidos.flatMap((p) => p.items) ?? [];
  const total = items.reduce((suma, i) => suma + Number(i.precio) * i.cantidad, 0) + Number(datos?.envio ?? 0);
  const falta = Math.max(0, total - Number(datos?.pagado ?? 0));
  const estados = datos?.pedidos.map((p) => p.estado) ?? [];
  const pendiente = estados.includes("pendiente");
  const enCocina = estados.some((e) => e === "nuevo" || e === "preparando");
  const listo = estados.length > 0 && !pendiente && !enCocina;
  const enCamino = datos?.tipo === "delivery" && !!datos.despachado_at;
  const entregado = datos?.estado === "cerrada" || (estados.length > 0 && estados.every((e) => e === "entregado"));
  const anulado = datos?.estado === "anulada";
  const esperandoPago = pendiente && ajustes.llevar.pago_obligatorio && falta > 0 && !datos?.paga_al_retirar;

  const etapa = anulado
    ? "estadoCancelado"
    : entregado
      ? "estadoEntregado"
      : enCamino
        ? "estadoEnCamino"
        : listo
          ? datos?.tipo === "delivery"
            ? "estadoListoDelivery"
            : "estadoListoRetirar"
          : enCocina
            ? "estadoCocina"
            : esperandoPago
              ? "estadoPagar"
              : "estadoRecibido";

  // Suena y vibra cuando queda listo o sale el delivery (con la página abierta).
  useEffect(() => {
    if (!datos) return;
    const clave = enCamino ? "camino" : listo ? "listo" : null;
    if (anterior.current !== null && clave && clave !== anterior.current) {
      sonar("mozo");
      navigator.vibrate?.([300, 150, 300]);
    }
    anterior.current = clave ?? "";
  }, [datos, listo, enCamino]);

  async function pagar() {
    setPagando(true);
    setError(null);
    const res = await fetch("/api/pagos/crear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedido: id, volver: `/${restaurante.slug}/pedido/${id}` }),
    }).catch(() => null);
    const r = (await res?.json().catch(() => null)) as { url?: string } | null;
    if (!r?.url) {
      setPagando(false);
      setError(t("pagoRechazado"));
      setFallo(true);
      return;
    }
    window.location.href = r.url;
  }

  async function pagarAlRetirar() {
    setPagando(true);
    const { error: e } = await supabase.rpc("pagar_al_retirar", { p_id: id });
    setPagando(false);
    if (e) return setError(e.message);
    setError(null);
    setFallo(false);
    setAviso(t("pagasAlRetirar"));
    consultar();
  }

  async function activarAvisos() {
    const ok = await suscribirA({ tipo: "pedido", id }, idioma);
    setPush(ok ? "activo" : "no");
    if (ok) setAviso(t("avisosActivados"));
  }

  if (datos === undefined) {
    return (
      <Marco restaurante={restaurante} titulo={t("tuPedido")}>
        <p className="text-stone-500">{t("cargando")}</p>
      </Marco>
    );
  }
  if (datos === null) {
    return (
      <Marco restaurante={restaurante} titulo={t("tuPedido")}>
        <p className="text-stone-600">{t("pedidoNoEncontrado")}</p>
        <a href={`/${restaurante.slug}`} className={`${BOTON} mt-6 block text-center`} style={ESTILO_BOTON}>
          {t("verCarta")}
        </a>
      </Marco>
    );
  }

  const region = { locale: paisDe(ajustes.pais).locale, zona: datos.zona };
  const pasos: Paso[] = [
    { clave: "estadoRecibido", hecho: !pendiente, actual: pendiente },
    { clave: "estadoCocina", hecho: listo || enCamino || entregado, actual: enCocina },
    ...(datos.tipo === "delivery"
      ? [{ clave: "estadoEnCamino" as ClaveTexto, hecho: enCamino || entregado, actual: enCamino && !entregado }]
      : [{ clave: "estadoListoRetirar" as ClaveTexto, hecho: entregado, actual: listo && !entregado }]),
    { clave: "estadoEntregado", hecho: entregado, actual: false },
  ];
  const whatsapp = datos.whatsapp;
  const puedePagar = conectado && ajustes.cobro_online.activo && falta > 0 && !anulado && !entregado;
  // Plan B: si el pago en línea falla (o no está disponible) y el pedido lo espera, puede pagar al retirar.
  const planB = !datos.paga_al_retirar && falta > 0 && !anulado && !entregado && (fallo || (esperandoPago && !puedePagar));

  return (
    <Marco restaurante={restaurante} titulo={t("tuPedido")}>
      <div className={`rounded-2xl p-4 text-center ${anulado ? "bg-red-50 text-red-800" : "bg-stone-50"}`}>
        <p className="text-4xl" aria-hidden>
          {anulado ? "😕" : entregado ? "🎉" : enCamino ? "🛵" : listo ? "✅" : enCocina ? "👩‍🍳" : "🧾"}
        </p>
        <p className="mt-2 text-lg font-semibold" role="status">
          {t(etapa)}
        </p>
        <p className="mt-1 text-sm text-stone-500">
          {datos.tipo === "delivery" ? t("delivery") : t("retiro")}
          {datos.para_hora ? ` · ${t("paraLas")} ${formatoHora(datos.para_hora, region)}` : ` · ${t("loAntesPosible")}`}
        </p>
      </div>

      {!anulado && (
        <ol className="mt-4 space-y-2">
          {pasos.map((p) => (
            <li key={p.clave} className="flex items-center gap-3 text-sm">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  p.hecho ? "text-white" : p.actual ? "ring-2 ring-current" : "bg-stone-100 text-stone-400"
                }`}
                style={p.hecho ? { background: "var(--acento)" } : p.actual ? { color: "var(--acento)" } : undefined}
              >
                {p.hecho ? "✓" : "•"}
              </span>
              <span className={p.hecho || p.actual ? "font-medium" : "text-stone-400"}>{t(p.clave)}</span>
            </li>
          ))}
        </ol>
      )}

      {aviso && <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{aviso}</p>}
      {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <ul className="mt-5 divide-y divide-stone-100 border-y border-stone-100 text-sm">
        {items.map((i, k) => (
          <li key={k} className="flex justify-between gap-3 py-2">
            <span>
              {i.cantidad} × {i.nombre}
              {i.opciones?.length ? <span className="block text-xs text-stone-500">{textoOpciones(i.opciones)}</span> : null}
            </span>
            <span className="tabular-nums">{precio(Number(i.precio) * i.cantidad)}</span>
          </li>
        ))}
        {Number(datos.envio) > 0 && (
          <li className="flex justify-between gap-3 py-2 text-stone-500">
            <span>{t("envio")}</span>
            <span className="tabular-nums">{precio(Number(datos.envio))}</span>
          </li>
        )}
        <li className="flex justify-between gap-3 py-2 font-semibold">
          <span>{t("total")}</span>
          <span className="tabular-nums">{precio(total)}</span>
        </li>
      </ul>
      <p className={`mt-2 text-right text-sm font-semibold ${falta > 0 ? "text-stone-500" : "text-emerald-700"}`}>
        {falta > 0 ? `${t("faltaPagar")}: ${precio(falta)}` : t("pagado")}
      </p>
      {datos.paga_al_retirar && falta > 0 && <p className="mt-1 text-right text-sm text-stone-500">{t("pagasAlRetirar")}</p>}
      {datos.direccion && <p className="mt-2 text-sm text-stone-500">📍 {datos.direccion}</p>}

      <div className="mt-5 space-y-2">
        {puedePagar && (
          <button type="button" onClick={pagar} disabled={pagando} className={BOTON} style={ESTILO_BOTON}>
            {pagando ? t("cargando") : `${t("pagarOnline")} · ${precio(falta)}`}
          </button>
        )}
        {planB && (
          <div className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
            <p>{t("planB")}</p>
            <button
              type="button"
              onClick={pagarAlRetirar}
              disabled={pagando}
              className="mt-2 w-full rounded-xl bg-white px-4 py-2.5 font-semibold ring-1 ring-amber-300"
            >
              {t("pagarAlRetirar")}
            </button>
          </div>
        )}
        {push === "ofrecer" && !entregado && !anulado && (
          <button
            type="button"
            onClick={activarAvisos}
            className="w-full rounded-2xl px-4 py-3 font-semibold ring-1 ring-stone-300"
          >
            🔔 {t("avisarmeListo")}
          </button>
        )}
        {whatsapp && (
          <a
            href={`https://wa.me/${numeroWhatsapp(whatsapp, paisDe(ajustes.pais))}?text=${encodeURIComponent(
              `Hola ${restaurante.nombre}, consulto por mi pedido${datos.nombre ? ` a nombre de ${datos.nombre}` : ""}.`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-2xl bg-[#25d366] px-4 py-3 text-center font-semibold text-white"
          >
            {t("escribir")}
          </a>
        )}
      </div>
      {!entregado && !anulado && <p className="mt-4 text-center text-xs text-stone-400">{t("guardaEnlace")}</p>}
    </Marco>
  );
}
