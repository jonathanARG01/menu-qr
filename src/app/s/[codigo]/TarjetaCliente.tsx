"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAutorizar } from "@/components/Autorizar";
import { TarjetaVisual } from "@/components/sellos/TarjetaVisual";
import { avisarTarjeta, guardarTarjeta, suscribirTarjeta } from "@/lib/sellos/cliente";
import { PROGRAMA_BASE, faltan, type TarjetaPublica } from "@/lib/sellos/tipos";
import { iphoneSinInstalar, soportaPush } from "@/lib/push";
import { qrSvg } from "@/lib/qr";
import { mensajeError } from "@/lib/utils";

const TEXTO_ORIGEN: Record<string, string> = {
  qr: "Sello por tu visita",
  manual: "Sello del equipo",
  bienvenida: "Sello de bienvenida",
  migracion: "Visitas anteriores",
  anulada: "Visita anulada",
};

export function TarjetaCliente({ inicial, googleWallet }: { inicial: TarjetaPublica; googleWallet: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const ruta = usePathname();
  const query = useSearchParams();
  const [t, setT] = useState(inicial);
  const p = t.programa ?? PROGRAMA_BASE;
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(
    query.get("nuevo") ? { tipo: "ok", texto: "¡Listo! Esta es tu tarjeta. Guárdala para no perderla." } : null,
  );
  const [nuevos, setNuevos] = useState(0);
  const [avisos, setAvisos] = useState<"no" | "si" | "puede" | "iphone">("no");
  const [equipo, setEquipo] = useState<{ pidePin: boolean } | null>(null);
  const { pedir: autorizar, dialogo } = useAutorizar();
  const [trabajando, setTrabajando] = useState(false);

  const recargar = useCallback(async () => {
    const { data } = await supabase.rpc("sellos_tarjeta", { p_codigo: t.codigo });
    if (data) {
      const n = data as TarjetaPublica;
      setT({ ...n, programa: n.programa ? { ...PROGRAMA_BASE, ...n.programa } : null });
    }
  }, [supabase, t.codigo]);

  // La tarjeta queda recordada en este celular: el QR de la precuenta la reconoce sin volver a registrarse.
  useEffect(() => guardarTarjeta(t.restaurante.slug, t.codigo), [t.restaurante.slug, t.codigo]);

  // Sello con el QR de la precuenta (?sello=CODIGO).
  useEffect(() => {
    const sello = query.get("sello");
    if (!sello) return;
    router.replace(ruta, { scroll: false });
    supabase.rpc("sellos_sumar_qr", { p_tarjeta: t.codigo, p_codigo: sello }).then(async ({ data, error }) => {
      if (error) return setAviso({ tipo: "error", texto: mensajeError(error) });
      const n = Number((data as { sumados?: number })?.sumados ?? 1);
      setNuevos(n);
      setAviso({ tipo: "ok", texto: n === 1 ? "¡Sumaste un sello por tu visita!" : `¡Sumaste ${n} sellos por tu visita!` });
      await recargar();
      avisarTarjeta(t.codigo);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Se mantiene al día (el mesero puede sumar o canjear desde su celular).
  useEffect(() => {
    const alVolver = () => document.visibilityState === "visible" && recargar();
    document.addEventListener("visibilitychange", alVolver);
    const id = setInterval(alVolver, 20000);
    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      clearInterval(id);
    };
  }, [recargar]);

  useEffect(() => {
    if (iphoneSinInstalar()) setAvisos("iphone");
    else if (soportaPush()) setAvisos(Notification.permission === "granted" && t.acepta_avisos ? "si" : "puede");
    // ¿Lo está mirando alguien del equipo del local? Entonces puede sumar sellos o canjear desde aquí.
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: miembro } = await supabase.rpc("es_miembro", { rid: t.restaurante.restaurante_id });
      if (miembro !== true) return;
      const { data: pin } = await supabase.rpc("pide_pin", { p_restaurante: t.restaurante.restaurante_id });
      setEquipo({ pidePin: pin === true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function activarAvisos() {
    if (await suscribirTarjeta(t.codigo)) {
      setAvisos("si");
      setAviso({ tipo: "ok", texto: "Te avisaremos cuando sumes sellos y cuando tengas un premio." });
    } else setAviso({ tipo: "error", texto: "No se pudieron activar los avisos. Revisa los permisos del navegador." });
  }

  async function sumar(cantidad: number) {
    if (!equipo) return;
    const ok = await autorizar({
      titulo: cantidad > 0 ? `¿Sumar ${cantidad === 1 ? "un sello" : `${cantidad} sellos`} a ${t.nombre}?` : `¿Quitar un sello a ${t.nombre}?`,
      pin: equipo.pidePin,
      motivo: cantidad > 0 ? "no" : "opcional",
    });
    if (!ok) return;
    setTrabajando(true);
    const { error } = await supabase.rpc("sellos_sumar_manual", {
      p_tarjeta: t.codigo,
      p_cantidad: cantidad,
      p_pin: ok.pin,
      p_motivo: ok.motivo || null,
    });
    setTrabajando(false);
    if (error) return setAviso({ tipo: "error", texto: mensajeError(error) });
    setNuevos(Math.max(0, cantidad));
    setAviso({ tipo: "ok", texto: cantidad > 0 ? "Sello sumado" : "Sello quitado" });
    await recargar();
    avisarTarjeta(t.codigo);
  }

  async function canjear() {
    if (!equipo) return;
    const ok = await autorizar({ titulo: `¿Canjear ${p.premio}?`, detalle: `Para ${t.nombre}.`, pin: equipo.pidePin, motivo: "no" });
    if (!ok) return;
    setTrabajando(true);
    const { error } = await supabase.rpc("sellos_canjear", { p_tarjeta: t.codigo, p_pin: ok.pin });
    setTrabajando(false);
    if (error) return setAviso({ tipo: "error", texto: mensajeError(error) });
    setAviso({ tipo: "ok", texto: `Premio canjeado: ${p.premio}` });
    await recargar();
    avisarTarjeta(t.codigo);
  }

  const url = typeof window === "undefined" ? `/s/${t.codigo}` : `${window.location.origin}/s/${t.codigo}`;
  const qr = useMemo(() => qrSvg(url), [url]);
  const restan = faltan(t, p);

  return (
    <main className="min-h-dvh bg-stone-100 px-4 py-6">
      <div className="mx-auto flex max-w-sm flex-col items-center gap-5">
        {aviso && (
          <p
            role="status"
            className={`w-full rounded-xl px-4 py-3 text-sm font-medium ${aviso.tipo === "ok" ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-800"}`}
          >
            {aviso.texto}
          </p>
        )}
        {!t.activa && (
          <p className="w-full rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-900">
            La tarjeta de sellos de {t.restaurante.nombre} está pausada. Tus sellos siguen guardados.
          </p>
        )}

        <TarjetaVisual
          local={t.restaurante.nombre}
          logo={t.restaurante.logo_url}
          programa={p}
          sellos={t.sellos}
          premios={t.premios}
          nombre={t.nombre}
          animarUltimos={nuevos}
          pie={
            <div className="mt-4 flex flex-col items-center gap-1">
              <div className="w-36 overflow-hidden rounded-xl bg-white p-1.5" dangerouslySetInnerHTML={{ __html: qr }} />
              <p className="font-mono text-xs tracking-widest opacity-80">{t.codigo}</p>
            </div>
          }
        />

        <p className="text-center text-sm text-suave">
          {t.premios > 0
            ? "Muéstrale esta tarjeta al mesero para canjear tu premio."
            : restan === 1
              ? `¡Te falta 1 sello para ${p.premio}!`
              : `Te faltan ${restan} sellos para ${p.premio}.`}
          {" "}
          {p.regla === "monto" ? "Sumas sellos según tu consumo." : "Sumas un sello en cada visita."} Escanea el QR de tu cuenta
          para sumarlo.
        </p>

        {equipo && (
          <section className="tarjeta w-full space-y-3 p-4">
            <p className="text-sm font-semibold">Equipo de {t.restaurante.nombre}</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="boton" disabled={trabajando} onClick={() => sumar(1)}>
                + 1 sello
              </button>
              <button
                type="button"
                className="boton-secundario"
                disabled={trabajando || t.premios < 1}
                onClick={canjear}
              >
                Canjear premio
              </button>
            </div>
            <button
              type="button"
              className="text-xs text-suave hover:text-red-600"
              disabled={trabajando || (t.sellos < 1 && t.premios < 1)}
              onClick={() => sumar(-1)}
            >
              Quitar un sello
            </button>
          </section>
        )}

        <div className="flex w-full flex-col gap-2">
          {googleWallet && (
            <a
              href={`/api/sellos/google/${t.codigo}`}
              className="flex items-center justify-center gap-2 rounded-full bg-black px-4 py-3 text-sm font-semibold text-white"
            >
              Guardar en Google Wallet
            </a>
          )}
          {avisos === "puede" && (
            <button type="button" className="boton-secundario w-full" onClick={activarAvisos}>
              Avisarme de mis sellos y premios
            </button>
          )}
          {avisos === "si" && <p className="text-center text-xs text-emerald-700">Avisos activados en este celular.</p>}
          {avisos === "iphone" && (
            <p className="rounded-xl bg-white px-4 py-3 text-xs text-suave">
              En iPhone: toca <b>Compartir</b> y luego <b>Agregar a inicio</b> para tener tu tarjeta a mano y recibir avisos.
            </p>
          )}
          <a href={`/${t.restaurante.slug}`} className="text-center text-sm text-marca hover:underline">
            Ver la carta de {t.restaurante.nombre}
          </a>
        </div>

        {t.movimientos.length > 0 && (
          <section className="w-full">
            <h2 className="mb-2 text-sm font-semibold">Tus últimos movimientos</h2>
            <ul className="tarjeta divide-y divide-borde text-sm">
              {t.movimientos.map((m, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span>
                    {m.tipo === "canje" ? `Canjeaste ${p.premio}` : m.cantidad < 0 ? TEXTO_ORIGEN.anulada : TEXTO_ORIGEN[m.origen]}
                    <span className="block text-xs text-suave">
                      {new Date(m.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                    </span>
                  </span>
                  {m.tipo !== "canje" && (
                    <span className={`font-semibold tabular-nums ${m.cantidad < 0 ? "text-red-600" : "text-emerald-700"}`}>
                      {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        {p.condiciones && <p className="text-center text-xs text-suave">{p.condiciones}</p>}
        <p className="text-xs text-suave">Tarjeta digital por Platovi · {t.total_sellos} sellos en total</p>
      </div>
      {dialogo}
    </main>
  );
}
