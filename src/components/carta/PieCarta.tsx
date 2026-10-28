"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { traducir } from "@/lib/i18n";
import type { Restaurante } from "@/lib/types";
import { formatoPrecio } from "@/lib/utils";
import { textoOpciones } from "@/lib/salon";
import { EnOtrasMonedas } from "./EnOtrasMonedas";
import { useCarta } from "./contexto";
import { AvisoEmergente } from "./AvisoEmergente";
import { MiMesa } from "./MiMesa";
import { Opinion } from "./Opinion";
import { useMiMesa } from "./useMiMesa";
import { CLAVE_PUBLICA, iphoneSinInstalar, soportaPush, suscribirAvisos } from "@/lib/push";

// Lo que agrega Mercado Pago a la dirección al volver.
const DE_MP = new Set([
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
]);

// Barra inferior de la carta: mesa, sucursal, contacto por WhatsApp y el pedido en curso.
// Los colores salen de las variables de cada diseño (--pie-bg, --pie-text, --acento, --sobre-acento).
export function PieCarta({ restaurante }: { restaurante: Restaurante }) {
  const { pedidos, pedidosMesa, pedidosLlevar, lineas, mesa, mesaNombre, sucursal, idioma, ajustes, t } = useCarta();
  const [ofrecer, setOfrecer] = useState<null | "pedir" | "iphone">(null);
  const [abierto, setAbierto] = useState(false);
  const [mesaAbierta, setMesaAbierta] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorPago, setErrorPago] = useState<string | null>(null);
  const [opinar, setOpinar] = useState(false);
  const whatsapp = sucursal?.whatsapp || restaurante.whatsapp;
  const unidades = lineas.reduce((n, l) => n + l.cantidad, 0);
  const total = lineas.reduce((n, l) => n + l.cantidad * l.precio, 0);
  const miMesa = useMiMesa({ restauranteId: restaurante.id, sucursalId: sucursal?.id ?? null, mesa, activo: pedidosMesa });

  useEffect(() => {
    if (!aviso) return;
    const id = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(id);
  }, [aviso]);

  // El mesero cerró la mesa: se pide la opinión una sola vez.
  const { cerrada, olvidarCierre } = miMesa;
  useEffect(() => {
    if (cerrada && ajustes.resenas.pedir) setOpinar(true);
  }, [cerrada, ajustes.resenas.pedir]);

  // Vuelta de Mercado Pago (?pago=…): se confirma el pago con el servidor y se limpia la dirección.
  useEffect(() => {
    const url = new URL(window.location.href);
    const id = url.searchParams.get("pago");
    if (!id) return;
    const mpPago = url.searchParams.get("payment_id") ?? url.searchParams.get("collection_id") ?? "";
    for (const p of [...url.searchParams.keys()]) if (p === "pago" || DE_MP.has(p)) url.searchParams.delete(p);
    window.history.replaceState(null, "", url.pathname + url.search);
    let intentos = 0;
    let vivo = true;
    const consultar = async () => {
      const res = await fetch(`/api/pagos/estado?id=${encodeURIComponent(id)}&payment_id=${encodeURIComponent(mpPago)}`).catch(
        () => null,
      );
      const { estado } = ((await res?.json().catch(() => null)) ?? {}) as { estado?: string | null };
      if (!vivo) return;
      if (estado === "aprobado") return (setAviso(t("pagoAprobado")), miMesa.recargar());
      if (estado === "rechazado") return setErrorPago(t("pagoRechazado"));
      setAviso(t("pagoPendiente"));
      // Mercado Pago a veces tarda unos segundos en confirmar.
      if (++intentos < 6) setTimeout(consultar, 4000);
    };
    consultar();
    return () => {
      vivo = false;
    };
    // Solo al abrir la carta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Para que en iPhone se pueda "Agregar a inicio" con la mesa incluida (requisito de Apple para los avisos).
  useEffect(() => {
    if (!pedidosMesa || !mesa || document.querySelector("link[rel=manifest]")) return;
    const enlace = document.createElement("link");
    enlace.rel = "manifest";
    enlace.href = `/${restaurante.slug}/manifest.webmanifest?mesa=${encodeURIComponent(mesa)}${mesaNombre && mesaNombre !== mesa ? `&n=${encodeURIComponent(mesaNombre)}` : ""}${sucursal ? `&s=${encodeURIComponent(sucursal.slug)}` : ""}`;
    document.head.appendChild(enlace);
  }, [pedidosMesa, mesa, mesaNombre, sucursal, restaurante.slug]);

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

  const reservar = !mesa && ajustes.modulos.reservas && ajustes.reservas.online;
  if (!mesa && !whatsapp && !sucursal && unidades === 0 && !reservar && !pedidosLlevar) return null;

  const contexto = [mesaNombre && `${t("mesa")} ${mesaNombre}`, sucursal?.nombre].filter(Boolean).join(" · ");
  const saludo = mesaNombre ? `Hola ${restaurante.nombre}, estoy en la mesa ${mesaNombre}.` : `Hola ${restaurante.nombre}.`;

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
        {errorPago && (
          <button
            type="button"
            role="alert"
            onClick={() => setErrorPago(null)}
            className="mx-auto mb-2 block w-full max-w-2xl rounded-2xl bg-red-600 px-4 py-3 text-left text-sm font-semibold text-white shadow-xl"
          >
            {errorPago}
          </button>
        )}
        <div
          className="mx-auto flex max-w-2xl items-center gap-3 rounded-2xl p-2 pl-4 shadow-xl ring-1 ring-black/10"
          style={{ background: "var(--pie-bg)", color: "var(--pie-text)" }}
        >
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {pedidosLlevar && unidades === 0 ? `🛍️ ${t("pedirLlevar")}` : contexto || restaurante.nombre}
          </span>
          {reservar && unidades === 0 && (
            <a
              href={`/${restaurante.slug}/reservar${sucursal ? `?s=${encodeURIComponent(sucursal.slug)}` : ""}`}
              className="rounded-xl px-3 py-2.5 text-sm font-semibold ring-1 ring-current/30"
            >
              {t("reservar")}
            </a>
          )}
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
      {opinar && (
        <Opinion
          restauranteId={restaurante.id}
          sucursalId={sucursal?.id ?? null}
          mesa={mesaNombre}
          googleUrl={ajustes.resenas.google_url}
          t={t}
          onCerrar={() => {
            setOpinar(false);
            olvidarCierre();
          }}
        />
      )}
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
    cambiarLinea,
    vaciar,
    mesa,
    mesaNombre,
    sucursales,
    sucursal,
    setSucursal,
    registrarPedido,
    idioma,
    t,
    pedidosMesa,
    pedidosLlevar,
    ajustes,
    whatsapp: conWhatsapp,
  } = useCarta();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [nota, setNota] = useState("");
  // Para llevar: cómo lo quiere, su teléfono y, para delivery, la dirección (se recuerdan en este teléfono).
  const [tipo, setTipo] = useState<"llevar" | "delivery">("llevar");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [cuando, setCuando] = useState<"ya" | "hora">("ya");
  const [hora, setHora] = useState("");
  useEffect(() => {
    if (!pedidosLlevar) return;
    try {
      const g = JSON.parse(localStorage.getItem("carta:cliente") ?? "{}") as Record<string, string>;
      if (g.nombre) setNombre(g.nombre);
      if (g.telefono) setTelefono(g.telefono);
      if (g.direccion) setDireccion(g.direccion);
    } catch {}
    const d = new Date(Date.now() + (ajustes.llevar.minutos + 10) * 60000);
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    setHora(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
  }, [pedidosLlevar, ajustes.llevar.minutos]);
  const envio = pedidosLlevar && tipo === "delivery" ? ajustes.llevar.envio : 0;
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
      p_items: lineas.map((l) => ({ id: l.plato.id, cantidad: l.cantidad, opciones: l.opciones })),
      p_nombre: nombre.trim() || null,
      p_nota: nota.trim() || null,
    });
    setEnviando(false);
    if (error) {
      setError(/Demasiados|se agotó/.test(error.message) ? error.message : t("errorEnvio"));
      return;
    }
    onEnviado((data as { pendiente?: boolean } | null)?.pendiente ? t("pedidoPorConfirmar") : t("pedidoEnviado"));
    vaciar();
  }

  // Para llevar o delivery: el pedido entra al panel y el cliente sigue su estado (y lo paga) en otra página.
  async function enviarLlevar(e: React.FormEvent) {
    e.preventDefault();
    if (faltaSucursal) return;
    setEnviando(true);
    setError(null);
    let paraHora: string | null = null;
    if (cuando === "hora" && hora) {
      const [h, m] = hora.split(":").map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      if (d.getTime() < Date.now() - 30 * 60000) d.setDate(d.getDate() + 1);
      paraHora = d.toISOString();
    }
    const { data, error } = await createClient().rpc("pedir_para_llevar", {
      p_restaurante: restaurante.id,
      p_sucursal: sucursal?.id ?? null,
      p_tipo: tipo,
      p_items: lineas.map((l) => ({ id: l.plato.id, cantidad: l.cantidad, opciones: l.opciones })),
      p_nombre: nombre.trim(),
      p_telefono: telefono.trim(),
      p_direccion: tipo === "delivery" ? direccion.trim() : null,
      p_hora: paraHora,
      p_nota: nota.trim() || null,
    });
    if (error || !data) {
      setEnviando(false);
      setError(/Faltan|Falta|muchos|agotó|hora|disponibles/.test(error?.message ?? "") ? error!.message : t("errorEnvio"));
      return;
    }
    try {
      localStorage.setItem(
        "carta:cliente",
        JSON.stringify({ nombre: nombre.trim(), telefono: telefono.trim(), direccion: direccion.trim() }),
      );
    } catch {}
    vaciar();
    window.location.href = `/${restaurante.slug}/pedido/${(data as { id: string }).id}`;
  }

  function enviar() {
    if (!whatsapp || faltaSucursal) return;
    // El mensaje va siempre en español con los nombres originales: lo lee el personal del local.
    const mensaje = [
      `*Nuevo pedido* · ${restaurante.nombre}`,
      mesaNombre && `Mesa: ${mesaNombre}`,
      sucursal && `Sucursal: ${sucursal.nombre}`,
      "",
      ...lineas.map(
        (l) =>
          `${l.cantidad} × ${l.plato.nombre}${l.opciones.length ? ` (${textoOpciones(l.opciones)})` : ""} — ${precio(l.cantidad * l.precio)}`,
      ),
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
            {lineas.map(({ clave, plato, cantidad, opciones, precio: unitario }) => (
              <li key={clave} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{traducir(plato, idioma, ["nombre"]).nombre}</p>
                  {opciones.length > 0 && <p className="truncate text-xs text-stone-500">{textoOpciones(opciones)}</p>}
                  <p className="text-sm tabular-nums text-stone-500">{precio(unitario)}</p>
                </div>
                <span className="flex items-center rounded-full border border-stone-200">
                  <button
                    type="button"
                    onClick={() => cambiarLinea(clave, -1)}
                    aria-label={`${t("quitar")}: ${plato.nombre}`}
                    className="h-9 w-9 text-lg"
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-semibold tabular-nums">{cantidad}</span>
                  <button
                    type="button"
                    onClick={() => cambiarLinea(clave, 1)}
                    aria-label={`${t("agregar")}: ${plato.nombre}`}
                    className="h-9 w-9 text-lg"
                  >
                    +
                  </button>
                </span>
                <span className="w-20 text-right font-semibold tabular-nums">{precio(cantidad * unitario)}</span>
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

          {pedidosLlevar && (
            <form id="form-llevar" onSubmit={enviarLlevar} className="space-y-3">
              <fieldset>
                <legend className="text-sm font-medium">{t("comoLoQuieres")}</legend>
                <div className="mt-1 flex gap-2">
                  {(["llevar", ...(ajustes.llevar.delivery ? ["delivery"] : [])] as ("llevar" | "delivery")[]).map((x) => (
                    <button
                      key={x}
                      type="button"
                      aria-pressed={tipo === x}
                      onClick={() => setTipo(x)}
                      className={`flex-1 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold ${tipo === x ? "border-current" : "border-stone-200 text-stone-500"}`}
                      style={tipo === x ? { color: "var(--acento)" } : undefined}
                    >
                      {x === "llevar" ? t("retiro") : t("delivery")}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="block text-sm font-medium">
                {t("nombreYApellido")}
                <input
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  maxLength={60}
                  autoComplete="name"
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-base"
                />
              </label>
              <label className="block text-sm font-medium">
                {t("telefono")}
                <input
                  required
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  maxLength={30}
                  autoComplete="tel"
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-base"
                />
              </label>
              {tipo === "delivery" && (
                <label className="block text-sm font-medium">
                  {t("direccion")}
                  <input
                    required
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    maxLength={200}
                    autoComplete="street-address"
                    className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-base"
                  />
                </label>
              )}
              <fieldset>
                <legend className="text-sm font-medium">{t("paraCuando")}</legend>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <label className="flex items-center gap-1.5">
                    <input type="radio" checked={cuando === "ya"} onChange={() => setCuando("ya")} /> {t("loAntesPosible")}
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="radio" checked={cuando === "hora"} onChange={() => setCuando("hora")} /> {t("aUnaHora")}
                    <input
                      type="time"
                      step={900}
                      value={hora}
                      onChange={(e) => {
                        setHora(e.target.value);
                        setCuando("hora");
                      }}
                      className="rounded-lg border border-stone-300 px-2 py-1"
                    />
                  </label>
                </div>
              </fieldset>
            </form>
          )}
          {!pedidosLlevar && (
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
          )}
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
          {envio > 0 && (
            <div className="mb-1 flex items-baseline justify-between text-sm text-stone-500">
              <span>{t("envio")}</span>
              <span className="tabular-nums">{precio(envio)}</span>
            </div>
          )}
          <div className="mb-3 flex items-baseline justify-between">
            <span className="font-medium">{t("total")}</span>
            <span className="text-right">
              <span className="block text-xl font-bold tabular-nums">{precio(total + envio)}</span>
              <EnOtrasMonedas total={total + envio} monedas={ajustes.otras_monedas} texto={t("aprox")} />
            </span>
          </div>
          {pedidosLlevar && (
            <>
              {error && <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <button
                type="submit"
                form="form-llevar"
                disabled={enviando || faltaSucursal}
                className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 font-semibold disabled:opacity-50"
                style={{ background: "var(--acento)", color: "var(--sobre-acento)" }}
              >
                {enviando ? t("cargando") : t("hacerPedido")}
              </button>
              <p className="mt-2 text-center text-xs text-stone-500">{faltaSucursal ? t("elegirSucursal") : t("llevarAyuda")}</p>
            </>
          )}
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
                {enviando ? t("cargando") : `${t("enviarCocina")} · ${mesaNombre ? `${t("mesa")} ${mesaNombre}` : ""}`}
              </button>
            </>
          )}
          {conWhatsapp && (pedidosMesa || pedidosLlevar) && (
            <p className="mt-3 text-center text-xs text-stone-500">{t("oWhatsapp")}</p>
          )}
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
