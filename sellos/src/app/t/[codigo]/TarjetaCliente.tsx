"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAutorizar } from "@/components/Autorizar";
import { TarjetaVisual } from "@/components/TarjetaVisual";
import { Inclinable } from "@/components/Inclinable";
import { avisarTarjeta, guardarTarjeta, suscribirTarjeta } from "@/lib/cliente";
import { PROGRAMA_BASE, faltan, hitosDe, textoDias, unidad, type TarjetaPublica } from "@/lib/tipos";
import { iphoneSinInstalar, soportaPush } from "@/lib/push";
import { qrSvg } from "@/lib/qr";
import { MARCA } from "@/lib/marca";
import { mensajeError, urlSitio } from "@/lib/utils";

const TEXTO_ORIGEN: Record<string, string> = {
  qr: "Por tu visita",
  equipo: "Por tu visita",
  manual: "Sumados por el equipo",
  bienvenida: "Regalo de bienvenida",
  migracion: "Sellos anteriores",
  anulada: "Sello quitado",
  cumpleanos: "Regalo de cumpleaños 🎂",
  regreso: "Regalo por volver",
  referido: "Regalo por invitar a un amigo 🤝",
  api: "Por tu compra",
  premio: "Canjeaste un premio",
  cupon: "Usaste un cupón",
  reto: "Reto logrado 🏅",
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
  // Después de sumar un sello con el QR, invitar a dejar reseña en Google (una vez cada 60 días en este celular).
  const [pedirResena, setPedirResena] = useState(false);
  const [resenaVista, setResenaVista] = useState(true);
  useEffect(() => {
    try {
      const vista = Number(localStorage.getItem(`club-resena:${t.negocio.slug}`) || 0);
      setResenaVista(Date.now() - vista < 60 * 86400000);
    } catch {
      setResenaVista(false);
    }
  }, [t.negocio.slug]);
  function marcarResena() {
    setResenaVista(true);
    try {
      localStorage.setItem(`club-resena:${t.negocio.slug}`, String(Date.now()));
    } catch {}
  }

  const recargar = useCallback(async () => {
    const { data } = await supabase.rpc("ver_tarjeta", { p_codigo: t.codigo });
    if (data) {
      const n = data as TarjetaPublica;
      setT({ ...n, programa: n.programa ? { ...PROGRAMA_BASE, ...n.programa } : null });
    }
  }, [supabase, t.codigo]);

  // La tarjeta queda recordada en este celular: el QR de un solo uso la reconoce sin volver a registrarse.
  useEffect(() => guardarTarjeta(t.negocio.slug, t.codigo), [t.negocio.slug, t.codigo]);

  // Sello con el QR de un solo uso del equipo (?sello=CODIGO).
  useEffect(() => {
    const sello = query.get("sello");
    if (!sello) return;
    router.replace(ruta, { scroll: false });
    supabase.rpc("sumar_qr", { p_tarjeta: t.codigo, p_codigo: sello }).then(async ({ data, error }) => {
      if (error) return setAviso({ tipo: "error", texto: mensajeError(error) });
      const r = (data ?? {}) as { sumados?: number; doble?: boolean; retos?: string[] | null; referido?: boolean };
      const n = Number(r.sumados ?? 1);
      const u = unidad(p, n);
      setNuevos(p.tipo === "puntos" ? 0 : n);
      setAviso({
        tipo: "ok",
        texto:
          (r.doble ? `¡Día doble! Sumaste ${n} ${u} por tu visita.` : `¡Sumaste ${n} ${u} por tu visita!`) +
          (r.retos?.length ? ` Y lograste el reto “${r.retos.join("”, “")}” 🏅` : "") +
          (r.referido ? " ¡Y tu amigo que te invitó también ganó!" : ""),
      });
      setPedirResena(true);
      await recargar();
      avisarTarjeta(t.codigo);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Se mantiene al día (el equipo puede sumar o canjear desde su celular).
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
    // ¿Lo está mirando alguien del equipo del negocio? Entonces puede sumar sellos o canjear desde aquí.
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: miembro } = await supabase.rpc("es_miembro", { n: t.negocio.id });
      if (miembro !== true) return;
      const { data: pin } = await supabase.rpc("pide_pin", { p_negocio: t.negocio.id });
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
    let pin: string | null = null;
    let motivo: string | null = null;
    if (cantidad < 0) {
      const ok = await autorizar({ titulo: `¿Quitar un sello a ${t.nombre}?`, pin: equipo.pidePin, motivo: "opcional" });
      if (!ok) return;
      pin = ok.pin;
      motivo = ok.motivo || null;
    }
    let monto: number | null = null;
    if (cantidad > 0 && (p.regla === "monto" || p.tipo === "puntos")) {
      const v = Number((prompt("Monto de la compra") ?? "").replace(/[^\d.,]/g, "").replace(",", "."));
      if (!(v > 0)) return;
      monto = v;
    }
    setTrabajando(true);
    const { data, error } =
      cantidad > 0
        ? await supabase.rpc("sellar", { p_tarjeta: t.codigo, p_monto: monto })
        : await supabase.rpc("ajustar", { p_tarjeta: t.codigo, p_cantidad: cantidad, p_pin: pin, p_motivo: motivo });
    setTrabajando(false);
    if (error) return setAviso({ tipo: "error", texto: mensajeError(error) });
    const r = (data ?? {}) as { sumados?: number; doble?: boolean };
    const sumados = r.sumados ?? cantidad;
    setNuevos(Math.max(0, sumados));
    setAviso({
      tipo: "ok",
      texto:
        sumados > 0
          ? `${r.doble ? "Día doble: " : ""}${sumados} ${unidad(p, sumados)} sumados`
          : `${unidad(p, 1)} quitado`,
    });
    await recargar();
    avisarTarjeta(t.codigo);
  }

  async function canjear() {
    if (!equipo) return;
    const ok = await autorizar({
      titulo: `¿Canjear ${p.premio}?`,
      detalle: `Para ${t.nombre}.`,
      pin: equipo.pidePin,
      motivo: "no",
    });
    if (!ok) return;
    setTrabajando(true);
    const { error } = await supabase.rpc("canjear", { p_tarjeta: t.codigo, p_pin: ok.pin });
    setTrabajando(false);
    if (error) return setAviso({ tipo: "error", texto: mensajeError(error) });
    setAviso({ tipo: "ok", texto: `Premio canjeado: ${p.premio}` });
    await recargar();
    avisarTarjeta(t.codigo);
  }

  const url = `${urlSitio()}/t/${t.codigo}`;
  const qr = useMemo(() => qrSvg(url), [url]);
  const restan = faltan(t, p);
  const puntos = p.tipo === "puntos";
  const u = unidad(p);
  const catalogo = t.catalogo ?? [];
  const proximo = !puntos
    ? null
    : catalogo.filter((r) => !r.agotado && r.puntos > t.puntos).sort((a, b) => a.puntos - b.puntos)[0] ??
    catalogo.filter((r) => !r.agotado).sort((a, b) => b.puntos - a.puntos)[0] ??
    null;
  const niveles = [...(p.niveles ?? [])].sort((a, b) => a.visitas - b.visitas);
  const siguienteNivel = niveles.find((n) => n.visitas > t.visitas) ?? null;
  const [categoria, setCategoria] = useState("");
  const categorias = [...new Set(catalogo.map((r) => r.categoria).filter(Boolean))];
  const enlaceAmigo = `${urlSitio()}/u/${t.negocio.slug}?ref=${t.codigo}`;
  const textoAmigo = `Únete a la tarjeta de ${t.negocio.nombre} con mi enlace y los dos ganamos un regalo: ${enlaceAmigo}`;
  async function invitar() {
    try {
      if (navigator.share) return await navigator.share({ title: t.negocio.nombre, text: textoAmigo });
    } catch {
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(textoAmigo)}`, "_blank");
  }

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
            La tarjeta de {t.negocio.nombre} está pausada. Lo que juntaste sigue guardado.
          </p>
        )}

        {pedirResena && !resenaVista && t.negocio.resena_url && (
          <section className="w-full rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-black/5">
            <p className="text-2xl" aria-hidden>
              ⭐⭐⭐⭐⭐
            </p>
            <p className="mt-1 font-semibold">¿Te gustó tu visita a {t.negocio.nombre}?</p>
            <p className="text-sm text-suave">Tu reseña en Google nos ayuda muchísimo. Toma menos de un minuto.</p>
            <div className="mt-3 flex justify-center gap-2">
              <a
                href={t.negocio.resena_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={marcarResena}
                className="boton"
              >
                Dejar mi reseña
              </a>
              <button type="button" className="boton-secundario" onClick={marcarResena}>
                Ahora no
              </button>
            </div>
          </section>
        )}
        {t.promocion && t.activa ? (
          <p className="w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-orange-500 px-4 py-3 text-center text-sm font-semibold text-white shadow">
            🎉 {t.promocion.titulo}: cada visita vale ×{t.promocion.multiplicador}
          </p>
        ) : (
          t.dia_doble &&
          t.activa && (
            <p className="w-full rounded-xl bg-amber-100 px-4 py-3 text-center text-sm font-semibold text-amber-900">
              🔥 Hoy es día doble: cada visita vale el doble.
            </p>
          )
        )}
        {(t.cupones ?? []).map((c, i) => (
          <div key={i} className="w-full rounded-2xl border-2 border-dashed border-violet-400 bg-violet-50 px-4 py-3 text-sm text-violet-950">
            <p className="font-bold">🎟️ {c.titulo}</p>
            {c.detalle && <p>{c.detalle}</p>}
            <p className="text-xs opacity-75">
              Muéstralo al pagar{c.vence_at ? ` · vence el ${new Date(c.vence_at).toLocaleDateString("es-CL", { day: "numeric", month: "long" })}` : ""}
            </p>
          </div>
        ))}

        <Inclinable giroscopio>
          <TarjetaVisual
            local={t.negocio.nombre}
            logo={t.negocio.logo_url}
            programa={p}
            sellos={t.sellos}
            premios={t.premios}
            puntos={t.puntos}
            proximo={proximo}
            nivel={t.nivel?.nombre}
            nombre={t.nombre}
            animarUltimos={nuevos}
            pie={
              <div className="mt-4 flex flex-col items-center gap-1">
                <div className="w-36 overflow-hidden rounded-xl bg-white p-1.5" dangerouslySetInnerHTML={{ __html: qr }} />
                <p className="font-mono text-xs tracking-widest opacity-80">{t.codigo}</p>
              </div>
            }
          />
        </Inclinable>

        <p className="text-center text-sm text-suave">
          {puntos
            ? `Sumas ${u} con cada compra y los canjeas por premios del catálogo.`
            : t.premios > 0
              ? "Muéstrale esta tarjeta al equipo para canjear tu premio."
              : restan === 1
                ? `¡Te falta 1 sello para ${p.premio}!`
                : `Te faltan ${restan} sellos para ${p.premio}.`}{" "}
          {!puntos && (p.regla === "monto" ? "Sumas sellos según tu compra." : "Sumas un sello en cada visita.")} Muestra esta
          tarjeta al pagar o escanea el QR que te muestre el equipo.
          {p.dias_dobles.length > 0 && ` ${textoDias(p.dias_dobles)}: día doble.`}
        </p>

        {!puntos && hitosDe(p).length > 0 && (
          <section className="w-full">
            <h2 className="mb-2 text-sm font-semibold">Premios en el camino</h2>
            <ol className="tarjeta divide-y divide-borde text-sm">
              {[...hitosDe(p), { sellos: p.meta, premio: p.premio }].map((h) => {
                const usado = t.hitos_canjeados?.includes(h.sellos);
                const listo = t.sellos >= h.sellos && !usado;
                return (
                  <li key={h.sellos} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-bold">{h.sellos}</span>
                    <span className="flex-1">{h.premio}</span>
                    <span className={`text-xs font-semibold ${listo ? "text-emerald-700" : "text-suave"}`}>
                      {usado ? "✓ Canjeado" : listo ? "¡Listo! 🎉" : `Faltan ${h.sellos - t.sellos}`}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {niveles.length > 0 && (
          <section className="tarjeta w-full p-4 text-sm">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{t.nivel ? `Nivel ${t.nivel.nombre}` : "Tu nivel"}</p>
              <p className="text-xs text-suave">{t.visitas === 1 ? "1 visita" : `${t.visitas} visitas`}</p>
            </div>
            {t.nivel?.beneficio && <p className="mt-1">✨ {t.nivel.beneficio}</p>}
            {siguienteNivel && (
              <>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, (t.visitas / siguienteNivel.visitas) * 100)}%`, background: p.color }} />
                </div>
                <p className="mt-1 text-xs text-suave">
                  Te faltan {siguienteNivel.visitas - t.visitas} visitas para {siguienteNivel.nombre}
                  {siguienteNivel.beneficio ? `: ${siguienteNivel.beneficio}` : ""}.
                </p>
              </>
            )}
            <div className="mt-3 flex gap-1.5">
              {niveles.map((n) => (
                <span
                  key={n.nombre}
                  className={`flex-1 rounded-lg px-1 py-1 text-center text-xs font-semibold ${t.visitas >= n.visitas ? "text-white" : "bg-stone-100 text-suave"}`}
                  style={t.visitas >= n.visitas ? { background: p.color } : undefined}
                >
                  {n.nombre}
                </span>
              ))}
            </div>
          </section>
        )}

        {catalogo.length > 0 && (
          <section className="w-full">
            {puntos ? (
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Canjea tus {u}</h2>
                <p className="text-xs text-suave">
                  Tienes {t.puntos.toLocaleString("es-CL")} {u}
                </p>
              </div>
            ) : (
              <div className="mb-2">
                <h2 className="text-sm font-semibold">Elige tu premio</h2>
                <p className="text-xs text-suave">
                  Al completar tu tarjeta te llevas uno de estos o {p.premio.charAt(0).toLowerCase() + p.premio.slice(1)}.
                </p>
              </div>
            )}
            {categorias.length > 1 && (
              <div className="sin-barra mb-2 flex gap-1.5 overflow-x-auto">
                {["", ...categorias].map((c) => (
                  <button
                    key={c || "todas"}
                    type="button"
                    onClick={() => setCategoria(c)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${categoria === c ? "bg-tinta text-white" : "bg-white text-suave"}`}
                  >
                    {c || "Todos"}
                  </button>
                ))}
              </div>
            )}
            <ul className="grid grid-cols-2 gap-2">
              {catalogo
                .filter((r) => !categoria || r.categoria === categoria)
                .map((r) => {
                  const alcanza = puntos ? t.puntos >= r.puntos : t.premios > 0;
                  const avance = puntos ? t.puntos / r.puntos : t.premios > 0 ? 1 : t.sellos / p.meta;
                  return (
                    <li key={r.id} className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 ${r.agotado ? "opacity-50" : ""}`}>
                      <div className="relative aspect-square bg-stone-50">
                        {r.imagen_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.imagen_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-4xl">🎁</div>
                        )}
                        {r.destacado && <span className="absolute left-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold">Destacado</span>}
                      </div>
                      <div className="p-2.5">
                        <p className="text-sm font-semibold leading-tight">{r.titulo}</p>
                        {puntos ? (
                          <p className="mt-0.5 text-xs font-bold" style={{ color: p.color }}>
                            {r.puntos.toLocaleString("es-CL")} {u}
                          </p>
                        ) : (
                          r.descripcion && <p className="mt-0.5 line-clamp-2 text-[11px] text-suave">{r.descripcion}</p>
                        )}
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, avance * 100)}%`, background: alcanza ? "#059669" : p.color }} />
                        </div>
                        <p className="mt-1 text-[11px] text-suave">
                          {r.agotado
                            ? "Agotado"
                            : alcanza
                              ? puntos
                                ? "¡Ya te alcanza! Pídelo al pagar"
                                : "¡Ya puedes elegirlo! Pídelo al pagar"
                              : puntos
                                ? `Te faltan ${(r.puntos - t.puntos).toLocaleString("es-CL")}`
                                : `Te faltan ${restan} ${restan === 1 ? "sello" : "sellos"}`}
                        </p>
                      </div>
                    </li>
                  );
                })}
            </ul>
          </section>
        )}

        {(t.retos ?? []).length > 0 && (
          <section className="w-full">
            <h2 className="mb-2 text-sm font-semibold">Retos e insignias</h2>
            <ul className="space-y-2">
              {(t.retos ?? []).map((r) => (
                <li key={r.titulo} className="tarjeta flex items-center gap-3 p-3 text-sm">
                  <span className={`text-3xl ${r.logrados ? "" : "opacity-40 grayscale"}`} aria-hidden>
                    {r.insignia}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {r.titulo} {r.logrados > 0 && <span className="text-xs text-emerald-700">×{r.logrados}</span>}
                    </p>
                    <p className="text-xs text-suave">
                      Ven {r.visitas} veces en {r.dias} días{r.regalo ? ` y gana ${r.regalo} ${unidad(p, r.regalo)}` : ""}
                    </p>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, (r.avance / r.visitas) * 100)}%` }} />
                    </div>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-suave">
                    {Math.min(r.avance, r.visitas)}/{r.visitas}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {p.referido_regalo > 0 && t.activa && (
          <section className="w-full rounded-2xl p-4 text-white shadow" style={{ background: `linear-gradient(135deg, ${p.color}, #111827)` }}>
            <p className="font-semibold">🤝 Invita a un amigo</p>
            <p className="text-sm opacity-90">
              Cuando venga por primera vez, los dos ganan {p.referido_regalo * (puntos ? p.puntos_regalo : 1)}{" "}
              {unidad(p, p.referido_regalo * (puntos ? p.puntos_regalo : 1))}.
            </p>
            <button type="button" onClick={invitar} className="mt-3 w-full rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-tinta">
              Compartir mi enlace
            </button>
          </section>
        )}

        {equipo && (
          <section className="tarjeta w-full space-y-3 p-4">
            <p className="text-sm font-semibold">Equipo de {t.negocio.nombre}</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="boton" disabled={trabajando} onClick={() => sumar(1)}>
                {puntos ? `+ ${u}` : "+ 1 sello"}
              </button>
              <button type="button" className="boton-secundario" disabled={trabajando || t.premios < 1} onClick={canjear}>
                Canjear premio
              </button>
            </div>
            <button
              type="button"
              className="text-xs text-suave hover:text-red-600"
              disabled={trabajando || (t.sellos < 1 && t.premios < 1)}
              onClick={() => sumar(-1)}
            >
              Quitar {puntos ? "1 punto" : "un sello"}
            </button>
          </section>
        )}

        <div className="flex w-full flex-col gap-2">
          {googleWallet && (
            <a
              href={`/api/google/${t.codigo}`}
              className="flex items-center justify-center gap-2 rounded-full bg-black px-4 py-3 text-sm font-semibold text-white"
            >
              Guardar en Google Wallet
            </a>
          )}
          {avisos === "puede" && (
            <button type="button" className="boton-secundario w-full" onClick={activarAvisos}>
              Avisarme de mis {u} y premios
            </button>
          )}
          {avisos === "si" && <p className="text-center text-xs text-emerald-700">Avisos activados en este celular.</p>}
          {avisos === "iphone" && (
            <p className="rounded-xl bg-white px-4 py-3 text-xs text-suave">
              En iPhone: toca <b>Compartir</b> y luego <b>Agregar a inicio</b> para tener tu tarjeta a mano y recibir avisos.
            </p>
          )}
          {t.negocio.instagram && (
            <a
              href={`https://instagram.com/${t.negocio.instagram}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-center text-sm text-marca hover:underline"
            >
              @{t.negocio.instagram}
            </a>
          )}
        </div>

        {t.movimientos.length > 0 && (
          <section className="w-full">
            <h2 className="mb-2 text-sm font-semibold">Tus últimos movimientos</h2>
            <ul className="tarjeta divide-y divide-borde text-sm">
              {t.movimientos.map((m, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span>
                    {m.tipo === "canje"
                      ? `Canjeaste ${m.nota || p.premio}`
                      : m.cantidad < 0
                        ? TEXTO_ORIGEN.anulada
                        : TEXTO_ORIGEN[m.origen]}
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
        {(t.locales ?? []).length > 0 && (
          <p className="text-center text-xs text-suave">Válida en: {(t.locales ?? []).map((l) => l.nombre).join(", ")}</p>
        )}
        {p.condiciones && <p className="text-center text-xs text-suave">{p.condiciones}</p>}
        <Link href="/" className="text-xs text-suave">{puntos ? `${t.total_puntos.toLocaleString("es-CL")} ${u}` : t.total_sellos === 1 ? "1 sello" : `${t.total_sellos} sellos`} en total · Tarjeta digital por {MARCA}</Link>
      </div>
      {dialogo}
    </main>
  );
}
