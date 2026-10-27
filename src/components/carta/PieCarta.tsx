"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { traducir } from "@/lib/i18n";
import type { Restaurante } from "@/lib/types";
import { formatoPrecio } from "@/lib/utils";
import { useCarta } from "./contexto";
import { AvisoEmergente } from "./AvisoEmergente";
import { MiMesa } from "./MiMesa";
import { useMiMesa } from "./useMiMesa";
import { CLAVE_PUBLICA, iphoneSinInstalar, soportaPush, suscribirAvisos } from "@/lib/push";

// Barra inferior de la carta: mesa, sucursal, contacto por WhatsApp y el pedido en curso.
// Los colores salen de las variables de cada diseño (--pie-bg, --pie-text, --acento, --sobre-acento).
export function PieCarta({ restaurante }: { restaurante: Restaurante }) {
  const { pedidos, pedidosMesa, lineas, mesa, sucursal, idioma, t } = useCarta();
  const [ofrecer, setOfrecer] = useState<null | "pedir" | "iphone">(null);
  const [abierto, setAbierto] = useState(false);
  const [mesaAbierta, setMesaAbierta] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const whatsapp = sucursal?.whatsapp || restaurante.whatsapp;
  const unidades = lineas.reduce((n, l) => n + l.cantidad, 0);
  const total = lineas.reduce((n, l) => n + l.cantidad * Number(l.plato.precio), 0);
  const miMesa = useMiMesa({ restauranteId: restaurante.id, sucursalId: sucursal?.id ?? null, mesa, activo: pedidosMesa });

  useEffect(() => {
    if (!aviso) return;
    const id = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(id);
  }, [aviso]);

  // Para que en iPhone se pueda "Agregar a inicio" con la mesa incluida (requisito de Apple para los avisos).
  useEffect(() => {
    if (!pedidosMesa || !mesa || document.querySelector("link[rel=manifest]")) return;
    const enlace = document.createElement("link");
    enlace.rel = "manifest";
    enlace.href = `/${restaurante.slug}/manifest.webmanifest?mesa=${encodeURIComponent(mesa)}${sucursal ? `&s=${encodeURIComponent(sucursal.slug)}` : ""}`;
    document.head.appendChild(enlace);
  }, [pedidosMesa, mesa, sucursal, restaurante.slug]);

  // Después de cada pedido: si ya aceptó los avisos, se renueva solo; si no, se le ofrece una vez.
  async function despuesDePedir() {
    if (!mesa) return;
    const datos = { restauranteId: restaurante.id, sucursalId: sucursal?.id ?? null, mesa, idioma };
    if (soportaPush()) {
      if (Notification.permission === "granted") return void suscribirAvisos(datos, false);
      if (Notification.permission === "default" && !yaOfrecido()) setOfrecer("pedir");
    } else if (CLAVE_PUBLICA && iphoneSinInstalar() && !yaOfrecido()) setOfrecer("iphone");
  }
  const yaOfrecido = () => {
    try {
      return sessionStorage.getItem("carta:avisos") === "no";
    } catch {
      return false;
    }
  };
  function noOfrecer() {
    setOfrecer(null);
    try {
      sessionStorage.setItem("carta:avisos", "no");
    } catch {}
  }
  async function activarAvisos() {
    if (!mesa) return;
    setOfrecer(null);
    const ok = await suscribirAvisos({ restauranteId: restaurante.id, sucursalId: sucursal?.id ?? null, mesa, idioma });
    if (ok) setAviso(t("avisosActivados"));
    else noOfrecer();
  }

  if (!mesa && !whatsapp && !sucursal && unidades === 0) return null;

  const contexto = [mesa && `${t("mesa")} ${mesa}`, sucursal?.nombre].filter(Boolean).join(" · ");
  const saludo = mesa ? `Hola ${restaurante.nombre}, estoy en la mesa ${mesa}.` : `Hola ${restaurante.nombre}.`;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {ofrecer && (
          <div className="mx-auto mb-2 flex max-w-2xl items-start gap-3 rounded-2xl bg-white p-3 text-sm text-stone-800 shadow-xl ring-1 ring-black/10">
            <span className="text-xl leading-none" aria-hidden>
              🔔
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{ofrecer === "pedir" ? t("avisosPregunta") : t("avisosIphone")}</p>
              <div className="mt-2 flex gap-2">
                {ofrecer === "pedir" && (
                  <button
                    type="button"
                    onClick={activarAvisos}
                    className="rounded-xl px-3 py-1.5 font-semibold"
                    style={{ background: "var(--acento)", color: "var(--sobre-acento)" }}
                  >
                    {t("activarAvisos")}
                  </button>
                )}
                <button type="button" onClick={noOfrecer} className="rounded-xl px-3 py-1.5 text-stone-500 hover:bg-stone-100">
                  {ofrecer === "pedir" ? t("ahoraNo") : t("cerrar")}
                </button>
              </div>
            </div>
          </div>
        )}
        {aviso && (
          <p
            role="status"
            className="mx-auto mb-2 max-w-2xl rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-xl"
          >
            {aviso}
          </p>
        )}
        <div
          className="mx-auto flex max-w-2xl items-center gap-3 rounded-2xl p-2 pl-4 shadow-xl ring-1 ring-black/10"
          style={{ background: "var(--pie-bg)", color: "var(--pie-text)" }}
        >
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{contexto || restaurante.nombre}</span>
          {pedidosMesa && (
            <button
              type="button"
              onClick={() => setMesaAbierta(true)}
              className="rounded-xl px-3 py-2.5 text-sm font-semibold ring-1 ring-current/30"
            >
              {t("miMesa")}
            </button>
          )}
          {pedidos && unidades > 0 ? (
            <button
              type="button"
              onClick={() => setAbierto(true)}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
              style={{ background: "var(--acento)", color: "var(--sobre-acento)" }}
            >
              <span className="rounded-full bg-black/15 px-2 py-0.5 text-xs tabular-nums">{unidades}</span>
              {t("verPedido")} · <span className="tabular-nums">{formatoPrecio(total, restaurante.moneda)}</span>
            </button>
          ) : (
            whatsapp &&
            !pedidosMesa && (
              <a
                href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(saludo)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl px-4 py-2.5 text-sm font-semibold"
                style={{ background: "var(--acento)", color: "var(--sobre-acento)" }}
              >
                {t("escribir")}
              </a>
            )
          )}
        </div>
      </div>
      {abierto && (
        <HojaPedido
          restaurante={restaurante}
          total={total}
          onCerrar={() => setAbierto(false)}
          onEnviado={(texto) => {
            setAviso(texto);
            miMesa.recargar();
            despuesDePedir();
          }}
        />
      )}
      {mesaAbierta && (
        <MiMesa
          restaurante={restaurante}
          datos={miMesa.datos}
          recargar={miMesa.recargar}
          onCerrar={() => setMesaAbierta(false)}
          onAviso={setAviso}
        />
      )}
      <AvisoEmergente avisos={miMesa.avisos} onDescartar={miMesa.descartar} t={t} />
    </>
  );
}

function HojaPedido({
  restaurante,
  total,
  onCerrar,
  onEnviado,
}: {
  restaurante: Restaurante;
  total: number;
  onCerrar: () => void;
  onEnviado: (aviso: string) => void;
}) {
  const {
    lineas,
    cambiar,
    vaciar,
    mesa,
    sucursales,
    sucursal,
    setSucursal,
    registrarPedido,
    idioma,
    t,
    pedidosMesa,
    whatsapp: conWhatsapp,
  } = useCarta();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [nota, setNota] = useState("");
  const precio = (valor: number) => formatoPrecio(valor, restaurante.moneda);
  const faltaSucursal = sucursales.length > 1 && !sucursal;
  const whatsapp = sucursal?.whatsapp || restaurante.whatsapp || sucursales.find((s) => s.whatsapp)?.whatsapp;

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alTeclear);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = "";
    };
  }, [onCerrar]);

  useEffect(() => {
    if (lineas.length === 0) onCerrar();
  }, [lineas.length, onCerrar]);

  // Directo a la cocina: los precios los pone la base de datos desde la carta.
  async function enviarCocina() {
    if (!mesa) return;
    setEnviando(true);
    setError(null);
    const { data, error } = await createClient().rpc("pedir_desde_mesa", {
      p_restaurante: restaurante.id,
      p_sucursal: sucursal?.id ?? null,
      p_mesa: mesa,
      p_items: lineas.map((l) => ({ id: l.plato.id, cantidad: l.cantidad })),
      p_nombre: nombre.trim() || null,
      p_nota: nota.trim() || null,
    });
    setEnviando(false);
    if (error) {
      setError(error.message.includes("Demasiados") ? error.message : t("errorEnvio"));
      return;
    }
    onEnviado((data as { pendiente?: boolean } | null)?.pendiente ? t("pedidoPorConfirmar") : t("pedidoEnviado"));
    vaciar();
  }

  function enviar() {
    if (!whatsapp || faltaSucursal) return;
    // El mensaje va siempre en español con los nombres originales: lo lee el personal del local.
    const mensaje = [
      `*Nuevo pedido* · ${restaurante.nombre}`,
      mesa && `Mesa: ${mesa}`,
      sucursal && `Sucursal: ${sucursal.nombre}`,
      "",
      ...lineas.map((l) => `${l.cantidad} × ${l.plato.nombre} — ${precio(l.cantidad * Number(l.plato.precio))}`),
      "",
      `*Total: ${precio(total)}*`,
      nombre.trim() && `Nombre: ${nombre.trim()}`,
      nota.trim() && `Nota: ${nota.trim()}`,
    ]
      .filter((linea) => typeof linea === "string")
      .join("\n");
    registrarPedido(total);
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(mensaje)}`, "_blank", "noopener");
    vaciar();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-pedido"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl bg-white text-stone-900 shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <h2 id="titulo-pedido" className="text-lg font-semibold">
            {t("tuPedido")}
          </h2>
          <div className="flex items-center gap-4 text-sm">
            <button type="button" onClick={vaciar} className="text-stone-500 hover:text-red-600">
              {t("vaciar")}
            </button>
            <button type="button" onClick={onCerrar} aria-label={t("cerrar")} className="text-2xl leading-none text-stone-400">
              ×
            </button>
          </div>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 pb-4">
          <ul className="divide-y divide-stone-100">
            {lineas.map(({ plato, cantidad }) => (
              <li key={plato.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{traducir(plato, idioma, ["nombre"]).nombre}</p>
                  <p className="text-sm tabular-nums text-stone-500">{precio(Number(plato.precio))}</p>
                </div>
                <span className="flex items-center rounded-full border border-stone-200">
                  <button
                    type="button"
                    onClick={() => cambiar(plato.id, -1)}
                    aria-label={`${t("quitar")}: ${plato.nombre}`}
                    className="h-9 w-9 text-lg"
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-semibold tabular-nums">{cantidad}</span>
                  <button
                    type="button"
                    onClick={() => cambiar(plato.id, 1)}
                    aria-label={`${t("agregar")}: ${plato.nombre}`}
                    className="h-9 w-9 text-lg"
                  >
                    +
                  </button>
                </span>
                <span className="w-20 text-right font-semibold tabular-nums">{precio(cantidad * Number(plato.precio))}</span>
              </li>
            ))}
          </ul>

          {sucursales.length > 1 && (
            <label className="block text-sm font-medium">
              {t("sucursal")}
              <select
                value={sucursal?.id ?? ""}
                onChange={(e) => setSucursal(sucursales.find((s) => s.id === e.target.value) ?? null)}
                className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base"
              >
                <option value="" disabled>
                  {t("elegirSucursal")}
                </option>
                {sucursales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                    {s.direccion ? ` · ${s.direccion}` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block text-sm font-medium">
            {t("tuNombre")} <span className="font-normal text-stone-400">({t("opcional")})</span>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={40}
              autoComplete="given-name"
              className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-base"
            />
          </label>
          <label className="block text-sm font-medium">
            {t("nota")} <span className="font-normal text-stone-400">({t("opcional")})</span>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              maxLength={200}
              rows={2}
              placeholder={t("notaEjemplo")}
              className="mt-1 w-full resize-none rounded-xl border border-stone-300 px-3 py-2.5 text-base"
            />
          </label>
        </div>

        <div className="border-t border-stone-100 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="font-medium">{t("total")}</span>
            <span className="text-xl font-bold tabular-nums">{precio(total)}</span>
          </div>
          {pedidosMesa && (
            <>
              {error && <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <button
                type="button"
                onClick={enviarCocina}
                disabled={enviando}
                className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 font-semibold disabled:opacity-50"
                style={{ background: "var(--acento)", color: "var(--sobre-acento)" }}
              >
                {enviando ? t("cargando") : `${t("enviarCocina")} · ${mesa ? `${t("mesa")} ${mesa}` : ""}`}
              </button>
            </>
          )}
          {conWhatsapp && pedidosMesa && <p className="mt-3 text-center text-xs text-stone-500">{t("oWhatsapp")}</p>}
          {conWhatsapp && (
            <>
              <button
                type="button"
                onClick={enviar}
                disabled={faltaSucursal || !whatsapp}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25d366] px-4 py-3.5 font-semibold text-white disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                  <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z" />
                </svg>
                {t("enviar")}
              </button>
              <p className="mt-2 text-center text-xs text-stone-500">
                {faltaSucursal ? t("elegirSucursal") : t("avisoWhatsapp")}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
