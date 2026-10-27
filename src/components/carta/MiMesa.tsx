"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { montoPropina, partesIguales, totalLineas, type Propina } from "@/lib/cuenta";
import type { ClaveTexto } from "@/lib/i18n";
import type { SolicitudCuenta } from "@/lib/salon";
import type { Restaurante } from "@/lib/types";
import { formatoPrecio } from "@/lib/utils";
import { SelectorPropina } from "@/components/SelectorPropina";
import { useCarta } from "./contexto";
import type { DatosMesa } from "./useMiMesa";

const COLOR: Record<string, string> = {
  pendiente: "bg-stone-100 text-stone-600",
  nuevo: "bg-amber-100 text-amber-800",
  preparando: "bg-sky-100 text-sky-800",
  listo: "bg-emerald-100 text-emerald-800",
  entregado: "bg-stone-100 text-stone-600",
};

// Lo que el cliente ve de su mesa desde el QR: lo pedido y su estado, llamar al mesero y pedir la cuenta
// eligiendo cómo dividirla, la propina y el medio de pago.
export function MiMesa({
  restaurante,
  datos,
  recargar,
  onCerrar,
  onAviso,
}: {
  restaurante: Restaurante;
  datos: DatosMesa | null;
  recargar: () => void;
  onCerrar: () => void;
  onAviso: (texto: string) => void;
}) {
  const { mesa, sucursal, ajustes, t } = useCarta();
  const [paso, setPaso] = useState<"mesa" | "cuenta">("mesa");
  const [modo, setModo] = useState<SolicitudCuenta["modo"]>("junto");
  const [partes, setPartes] = useState(2);
  const [propina, setPropina] = useState<Propina>(
    ajustes.propinas.sugerida ? { tipo: "porcentaje", valor: ajustes.propinas.sugerida } : { tipo: "ninguna" },
  );
  const [metodo, setMetodo] = useState<string | undefined>(undefined);
  const [metodos, setMetodos] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const precio = (n: number) => formatoPrecio(n, restaurante.moneda);
  const cobros = ajustes.modulos.cobros;

  const comensales = datos?.cuenta?.comensales;
  useEffect(() => {
    if (comensales) setPartes((p) => (p === 2 ? Math.max(2, comensales) : p));
  }, [comensales]);

  useEffect(() => {
    recargar();
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alTeclear);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = "";
    };
  }, [recargar, onCerrar]);

  const lineas = datos?.cuenta?.pedidos.flatMap((p) => p.items) ?? [];
  const total = totalLineas(lineas);
  const falta = Math.max(0, total - Number(datos?.cuenta?.pagado ?? 0));
  const porParte = modo === "iguales" ? partesIguales(falta, partes)[0] : falta;

  async function avisar(tipo: "mozo" | "cuenta") {
    setEnviando(true);
    const detalle: SolicitudCuenta | null =
      tipo === "cuenta"
        ? {
            modo,
            partes: modo === "iguales" ? partes : undefined,
            metodos: cobros && modo !== "junto" ? Array.from({ length: partes }, (_, i) => metodos[i] ?? "") : undefined,
            propina: cobros ? propina : undefined,
            metodo: cobros && modo === "junto" ? metodo : undefined,
          }
        : null;
    const { error } = await createClient().rpc("avisar_desde_mesa", {
      p_restaurante: restaurante.id,
      p_sucursal: sucursal?.id ?? null,
      p_mesa: mesa,
      p_tipo: tipo,
      p_detalle: detalle,
    });
    setEnviando(false);
    onAviso(error ? t("errorEnvio") : tipo === "mozo" ? t("meseroAvisado") : t("cuentaPedida"));
    if (!error) onCerrar();
  }

  const contador = (etiqueta: string) => (
    <div className="mt-2 flex items-center justify-between">
      <span className="text-sm text-stone-500">{etiqueta}</span>
      <span className="flex items-center rounded-lg border border-stone-200 bg-white">
        <button type="button" aria-label="−" className="h-9 w-9 text-lg" onClick={() => setPartes(Math.max(2, partes - 1))}>
          −
        </button>
        <span className="w-8 text-center font-semibold tabular-nums">{partes}</span>
        <button type="button" aria-label="+" className="h-9 w-9 text-lg" onClick={() => setPartes(Math.min(30, partes + 1))}>
          +
        </button>
      </span>
    </div>
  );

  const chip = (activo: boolean) =>
    `rounded-xl border-2 p-3 text-left ${activo ? "border-stone-900 bg-stone-50" : "border-stone-200 bg-white"}`;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-mesa"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl bg-white text-stone-900 shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <h2 id="titulo-mesa" className="text-lg font-semibold">
            {paso === "cuenta" ? t("pedirCuenta") : `${t("mesa")} ${mesa}`}
          </h2>
          <button type="button" onClick={onCerrar} aria-label={t("cerrar")} className="text-2xl leading-none text-stone-400">
            ×
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 pb-4">
          {!datos ? (
            <p className="py-8 text-center text-stone-500">{t("cargando")}</p>
          ) : paso === "mesa" ? (
            <>
              <p className="text-sm font-medium text-stone-500">{t("loPedido")}</p>
              {!datos.cuenta || datos.cuenta.pedidos.length === 0 ? (
                <p className="rounded-xl bg-stone-50 p-4 text-center text-sm text-stone-500">{t("nadaTodavia")}</p>
              ) : (
                <ul className="space-y-2">
                  {datos.cuenta.pedidos.map((p) => (
                    <li key={p.numero} className="rounded-xl border border-stone-200 p-3">
                      <span
                        className={`mb-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${COLOR[p.estado] ?? ""}`}
                      >
                        {t(`estado_${p.estado}` as ClaveTexto)}
                      </span>
                      {p.items.map((i, k) => (
                        <p key={k} className="flex justify-between gap-3 text-sm">
                          <span>
                            {i.cantidad} × {i.nombre}
                          </span>
                          <span className="tabular-nums text-stone-500">{precio(Number(i.precio) * i.cantidad)}</span>
                        </p>
                      ))}
                    </li>
                  ))}
                </ul>
              )}
              {total > 0 && (
                <div className="rounded-xl bg-stone-50 p-3 text-sm">
                  <p className="flex justify-between font-semibold">
                    <span>{t("total")}</span> <span className="tabular-nums">{precio(total)}</span>
                  </p>
                  {Number(datos.cuenta?.pagado) > 0 && (
                    <>
                      <p className="flex justify-between text-stone-500">
                        <span>{t("pagado")}</span> <span className="tabular-nums">{precio(Number(datos.cuenta?.pagado))}</span>
                      </p>
                      <p className="flex justify-between font-semibold">
                        <span>{t("falta")}</span> <span className="tabular-nums">{precio(falta)}</span>
                      </p>
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <p className="mb-2 text-sm font-semibold">{t("comoPagan")}</p>
                <div className="grid gap-2">
                  <button type="button" className={chip(modo === "junto")} onClick={() => setModo("junto")}>
                    <span className="block font-semibold">{t("todoJunto")}</span>
                  </button>
                  <div className={chip(modo === "iguales")}>
                    <button type="button" className="block w-full text-left font-semibold" onClick={() => setModo("iguales")}>
                      {t("partesIguales")}
                    </button>
                    {modo === "iguales" && contador(t("entreCuantos"))}
                  </div>
                  <div className={chip(modo === "consumo")}>
                    <button type="button" className="block w-full text-left" onClick={() => setModo("consumo")}>
                      <span className="block font-semibold">{t("cadaUno")}</span>
                      <span className="block text-sm text-stone-500">{t("cadaUnoAyuda")}</span>
                    </button>
                    {modo === "consumo" && cobros && ajustes.metodos_pago.length > 0 && contador(t("cuantosSon"))}
                  </div>
                </div>
              </div>

              {cobros && ajustes.metodos_pago.length > 0 && modo !== "junto" && (
                <div>
                  <p className="mb-2 text-sm font-semibold">{t("comoPagaCada")}</p>
                  <ul className="space-y-2">
                    {Array.from({ length: partes }, (_, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <span className="w-24 shrink-0 text-sm text-stone-600">
                          {t("persona")} {i + 1}
                        </span>
                        <select
                          value={metodos[i] ?? ""}
                          onChange={(e) => setMetodos((m) => Object.assign([...m], { [i]: e.target.value }))}
                          aria-label={`${t("medioPago")} · ${t("persona")} ${i + 1}`}
                          className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base"
                        >
                          <option value="">{t("elegir")}</option>
                          {ajustes.metodos_pago.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {cobros && ajustes.metodos_pago.length > 0 && modo === "junto" && (
                <div>
                  <p className="mb-2 text-sm font-semibold">{t("medioPago")}</p>
                  <div className="flex flex-wrap gap-2">
                    {ajustes.metodos_pago.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMetodo(m)}
                        className={`rounded-xl border px-3 py-2 text-sm font-medium ${metodo === m ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200"}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {cobros && ajustes.propinas.activas && (
                <div>
                  <p className="mb-2 text-sm font-semibold">{t("propina")}</p>
                  <SelectorPropina
                    base={porParte}
                    config={ajustes.propinas}
                    metodos={ajustes.metodos_pago}
                    valor={propina}
                    onChange={setPropina}
                    formato={precio}
                    textos={{
                      propina: t("propina"),
                      sin: t("sinPropina"),
                      otro: t("otro"),
                      alFinal: t("alFinal"),
                      alFinalAyuda: t("alFinalAyuda"),
                      como: t("comoPropina"),
                      mismo: t("mismoMedio"),
                      porcentaje: "%",
                      monto: "$",
                    }}
                  />
                </div>
              )}

              {modo !== "consumo" && (
                <div className="rounded-xl bg-stone-50 p-3 text-sm">
                  <p className="flex justify-between font-semibold">
                    <span>{modo === "iguales" ? t("cadaParte") : t("total")}</span>
                    <span className="tabular-nums">{precio(porParte + montoPropina(porParte, propina))}</span>
                  </p>
                  {montoPropina(porParte, propina) > 0 && (
                    <p className="text-xs text-stone-500">
                      {precio(porParte)} + {precio(montoPropina(porParte, propina))} {t("propina").toLowerCase()}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {datos && (
          <div className="flex gap-2 border-t border-stone-100 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
            {paso === "mesa" ? (
              <>
                <button
                  type="button"
                  disabled={enviando}
                  onClick={() => avisar("mozo")}
                  className="flex-1 rounded-2xl border border-stone-300 px-4 py-3 font-semibold disabled:opacity-50"
                >
                  {t("llamarMesero")}
                </button>
                {total > 0 && (
                  <button
                    type="button"
                    onClick={() => setPaso("cuenta")}
                    className="flex-1 rounded-2xl px-4 py-3 font-semibold"
                    style={{ background: "var(--acento)", color: "var(--sobre-acento)" }}
                  >
                    {t("pedirCuenta")}
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setPaso("mesa")}
                  className="rounded-2xl border border-stone-300 px-4 py-3 font-semibold"
                >
                  {t("volver")}
                </button>
                <button
                  type="button"
                  disabled={enviando}
                  onClick={() => avisar("cuenta")}
                  className="flex-1 rounded-2xl px-4 py-3 font-semibold disabled:opacity-50"
                  style={{ background: "var(--acento)", color: "var(--sobre-acento)" }}
                >
                  {t("pedirCuenta")}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
