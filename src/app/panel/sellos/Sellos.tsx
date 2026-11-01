"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { Icono } from "@/components/Icono";
import { Interruptor } from "@/components/Interruptor";
import { useAutorizar } from "@/components/Autorizar";
import { TarjetaVisual } from "@/components/sellos/TarjetaVisual";
import { avisarTarjeta } from "@/lib/sellos/cliente";
import {
  ICONOS_SELLO,
  PROGRAMA_BASE,
  codigoDeEscaneo,
  rutaTarjeta,
  rutaUnirse,
  textoRegla,
  type FilaTarjeta,
  type IconoSello,
  type ProgramaSellos,
} from "@/lib/sellos/tipos";
import { regionDe, type Ajustes } from "@/lib/salon";
import { formatoFecha, numeroWhatsapp, paisDe } from "@/lib/region";
import { descargar, qrPng, qrSvg } from "@/lib/qr";
import type { Restaurante } from "@/lib/types";
import { formatoPrecio, mensajeError, urlSitio } from "@/lib/utils";

type Pestana = "tarjetas" | "configurar" | "carteles";
type Filtro = "todas" | "premio" | "cerca" | "nuevas";

const COLUMNAS =
  "id, restaurante_id, cliente_id, codigo, nombre, telefono, email, cumpleanos, acepta_avisos, sellos, premios, total_sellos, canjes, created_at, ultima_at";

// Platovi Sellos en el panel: las tarjetas de los clientes (sumar, canjear), la tarjeta del local y los carteles.
export function Sellos({
  restaurante,
  admin,
  ajustes,
  programaGuardado,
  iniciales,
}: {
  restaurante: Restaurante;
  admin: boolean;
  ajustes: Ajustes;
  programaGuardado: ProgramaSellos | null;
  iniciales: FilaTarjeta[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [programa, setPrograma] = useState<ProgramaSellos>(programaGuardado ?? PROGRAMA_BASE);
  const [lista, setLista] = useState(iniciales);
  const [pestana, setPestana] = useState<Pestana>(programaGuardado || !admin ? "tarjetas" : "configurar");

  async function recargar() {
    const { data } = await supabase
      .from("sellos_tarjetas")
      .select(COLUMNAS)
      .eq("restaurante_id", restaurante.id)
      .order("ultima_at", { ascending: false, nullsFirst: false })
      .limit(3000);
    if (data) setLista(data as FilaTarjeta[]);
  }

  const pestanas: [Pestana, string][] = [
    ["tarjetas", "Tarjetas de clientes"],
    ...(admin
      ? ([
          ["configurar", "Tu tarjeta"],
          ["carteles", "QR para unirse"],
        ] as [Pestana, string][])
      : []),
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto min-w-0">
          <h1 className="text-xl font-semibold">Tarjeta de sellos</h1>
          <p className="text-sm text-suave">
            {programaGuardado
              ? `${programa.meta} sellos = ${programa.premio} · ${textoRegla(programa, (n) => formatoPrecio(n, restaurante.moneda))}`
              : "Arma tu tarjeta para empezar a dar sellos."}
            {programaGuardado && !programa.activo && " · pausada"}
          </p>
        </div>
      </div>

      {pestanas.length > 1 && (
        <div className="sin-barra flex gap-1 overflow-x-auto border-b border-borde">
          {pestanas.map(([id, texto]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPestana(id)}
              aria-pressed={pestana === id}
              className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${
                pestana === id ? "border-marca text-tinta" : "border-transparent text-suave hover:text-tinta"
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
      )}

      {pestana === "tarjetas" && (
        <Tarjetas
          restaurante={restaurante}
          admin={admin}
          ajustes={ajustes}
          programa={programa}
          configurada={!!programaGuardado}
          lista={lista}
          recargar={recargar}
          irAConfigurar={() => setPestana("configurar")}
        />
      )}
      {pestana === "configurar" && admin && (
        <Configurar restaurante={restaurante} programa={programa} nueva={!programaGuardado} onGuardado={setPrograma} />
      )}
      {pestana === "carteles" && admin && <Carteles restaurante={restaurante} programa={programa} />}
    </div>
  );
}

// ── Tarjetas de los clientes ─────────────────────
function Tarjetas({
  restaurante,
  admin,
  ajustes,
  programa,
  configurada,
  lista,
  recargar,
  irAConfigurar,
}: {
  restaurante: Restaurante;
  admin: boolean;
  ajustes: Ajustes;
  programa: ProgramaSellos;
  configurada: boolean;
  lista: FilaTarjeta[];
  recargar: () => Promise<void>;
  irAConfigurar: () => void;
}) {
  const avisar = useToast();
  const region = regionDe(ajustes);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [elegida, setElegida] = useState<FilaTarjeta | null>(null);
  const [escaneando, setEscaneando] = useState(false);
  const [ahora] = useState(() => Date.now());

  const visibles = useMemo(() => {
    const texto = q.trim().toLowerCase();
    const digitos = texto.replace(/\D/g, "");
    return lista.filter((t) => {
      if (
        texto &&
        !t.nombre.toLowerCase().includes(texto) &&
        !t.codigo.toLowerCase().includes(texto) &&
        !(digitos.length >= 3 && t.telefono?.replace(/\D/g, "").includes(digitos))
      )
        return false;
      if (filtro === "premio") return t.premios > 0;
      if (filtro === "cerca") return programa.meta - t.sellos <= 2;
      if (filtro === "nuevas") return ahora - Date.parse(t.created_at) < 30 * 86400000;
      return true;
    });
  }, [lista, q, filtro, programa.meta, ahora]);

  const resumen = useMemo(
    () => ({
      tarjetas: lista.length,
      sellos: lista.reduce((n, t) => n + t.total_sellos, 0),
      listos: lista.reduce((n, t) => n + t.premios, 0),
      canjes: lista.reduce((n, t) => n + t.canjes, 0),
    }),
    [lista],
  );

  // Mantiene abierta la ficha con los datos nuevos después de sumar o canjear.
  useEffect(() => {
    if (elegida) setElegida((e) => (e ? (lista.find((t) => t.id === e.id) ?? null) : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista]);

  function alEscanear(texto: string) {
    setEscaneando(false);
    const codigo = codigoDeEscaneo(texto);
    const t = lista.find((x) => x.codigo === codigo);
    if (t) setElegida(t);
    else avisar("Esa tarjeta no es de este local o no existe.", "error");
  }

  return (
    <div className="space-y-4">
      {!configurada && admin && (
        <button
          type="button"
          onClick={irAConfigurar}
          className="flex w-full items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-950"
        >
          <Icono nombre="sellos" className="h-5 w-5 shrink-0" />
          Primero arma tu tarjeta: cuántos sellos, el premio y los colores.
        </button>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Dato titulo="Tarjetas" valor={resumen.tarjetas} />
        <Dato titulo="Sellos dados" valor={resumen.sellos} />
        <Dato titulo="Premios por canjear" valor={resumen.listos} acento={resumen.listos > 0} />
        <Dato titulo="Premios canjeados" valor={resumen.canjes} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          id="buscar-tarjeta"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nombre, teléfono o código…"
          className="campo w-full max-w-xs py-2 text-sm"
        />
        <button type="button" className="boton-secundario py-2" onClick={() => setEscaneando(true)}>
          <Icono nombre="qr" className="h-4 w-4" /> Escanear tarjeta
        </button>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["todas", "Todas"],
              ["premio", "Con premio listo"],
              ["cerca", "A 2 sellos o menos"],
              ["nuevas", "Nuevas (30 días)"],
            ] as [Filtro, string][]
          ).map(([id, texto]) => (
            <button
              key={id}
              type="button"
              aria-pressed={filtro === id}
              onClick={() => setFiltro(id)}
              className={`rounded-full px-3 py-1.5 text-sm ${filtro === id ? "bg-tinta text-white" : "bg-stone-100 text-suave hover:text-tinta"}`}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>

      {visibles.length === 0 ? (
        <div className="tarjeta flex flex-col items-center gap-2 p-10 text-center text-sm text-suave">
          <Icono nombre="sellos" className="h-10 w-10 text-stone-300" />
          <p className="max-w-md">
            {lista.length === 0
              ? "Todavía nadie tiene tu tarjeta. Imprime el QR para unirse (pestaña “QR para unirse”) y déjalo en las mesas y la caja; la precuenta también lo trae."
              : "Nadie coincide con la búsqueda."}
          </p>
        </div>
      ) : (
        <ul className="tarjeta divide-y divide-borde">
          {visibles.slice(0, 300).map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setElegida(t)}
                className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-left hover:bg-stone-50"
              >
                <span className="min-w-0 flex-1 basis-40">
                  <span className="flex items-center gap-2 font-semibold">
                    <span className="truncate">{t.nombre}</span>
                    {t.premios > 0 && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 text-xs font-semibold text-emerald-800">
                        <Icono nombre="regalo" className="h-3 w-3" /> {t.premios === 1 ? "Premio listo" : `${t.premios} premios`}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-sm text-suave">{t.telefono || t.codigo}</span>
                </span>
                <span className="w-40 shrink-0">
                  <span className="flex justify-between text-xs text-suave">
                    <span>
                      {t.sellos}/{programa.meta} sellos
                    </span>
                  </span>
                  <span className="mt-1 block h-2 overflow-hidden rounded-full bg-stone-100">
                    <span
                      className="block h-full rounded-full bg-marca"
                      style={{ width: `${Math.min(100, (t.sellos / programa.meta) * 100)}%` }}
                    />
                  </span>
                </span>
                <span className="w-24 shrink-0 text-right text-sm text-suave">
                  {t.ultima_at ? formatoFecha(t.ultima_at, region, { day: "numeric", month: "short" }) : "—"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {escaneando && <Escaner onLeido={alEscanear} onCerrar={() => setEscaneando(false)} />}
      {elegida && (
        <FichaTarjeta
          restaurante={restaurante}
          admin={admin}
          ajustes={ajustes}
          programa={programa}
          tarjeta={elegida}
          onCambio={recargar}
          onCerrar={() => setElegida(null)}
        />
      )}
    </div>
  );
}

function Dato({ titulo, valor, acento }: { titulo: string; valor: number; acento?: boolean }) {
  return (
    <div className={`tarjeta p-4 ${acento ? "ring-2 ring-emerald-400" : ""}`}>
      <p className="text-xs text-suave">{titulo}</p>
      <p className="text-2xl font-semibold tabular-nums">{valor.toLocaleString("es-CL")}</p>
    </div>
  );
}

// ── Ficha de una tarjeta: sumar, canjear, enviar por WhatsApp ──
function FichaTarjeta({
  restaurante,
  admin,
  ajustes,
  programa,
  tarjeta: t,
  onCambio,
  onCerrar,
}: {
  restaurante: Restaurante;
  admin: boolean;
  ajustes: Ajustes;
  programa: ProgramaSellos;
  tarjeta: FilaTarjeta;
  onCambio: () => Promise<void>;
  onCerrar: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const avisar = useToast();
  const { pedir: autorizar, dialogo } = useAutorizar();
  const pidePin = ajustes.pin_autorizacion && !admin;
  const [trabajando, setTrabajando] = useState(false);
  const [cantidad, setCantidad] = useState(1);
  const [movimientos, setMovimientos] = useState<{ tipo: string; cantidad: number; origen: string; created_at: string }[]>([]);
  const region = regionDe(ajustes);

  useEffect(() => {
    supabase
      .from("sellos_movimientos")
      .select("tipo, cantidad, origen, created_at")
      .eq("tarjeta_id", t.id)
      .order("created_at", { ascending: false })
      .limit(15)
      .then(({ data }) => setMovimientos(data ?? []));
  }, [supabase, t.id, t.sellos, t.premios]);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onCerrar]);

  async function sumar(n: number) {
    const ok = await autorizar({
      titulo: n > 0 ? `¿Sumar ${n === 1 ? "un sello" : `${n} sellos`} a ${t.nombre}?` : `¿Quitar ${-n === 1 ? "un sello" : `${-n} sellos`}?`,
      pin: pidePin,
      motivo: n > 0 ? "no" : "opcional",
      ejemplos: n > 0 ? undefined : ["Sello por error", "Se equivocó de tarjeta"],
    });
    if (!ok) return;
    setTrabajando(true);
    const { error } = await supabase.rpc("sellos_sumar_manual", {
      p_tarjeta: t.codigo,
      p_cantidad: n,
      p_pin: ok.pin,
      p_motivo: ok.motivo || null,
    });
    setTrabajando(false);
    if (error) return avisar(mensajeError(error), "error");
    avisar(n > 0 ? (n === 1 ? "Sello sumado" : `${n} sellos sumados`) : "Sellos quitados");
    avisarTarjeta(t.codigo);
    setCantidad(1);
    await onCambio();
  }

  async function canjear() {
    const ok = await autorizar({ titulo: `¿Canjear ${programa.premio}?`, detalle: `Para ${t.nombre}.`, pin: pidePin, motivo: "no" });
    if (!ok) return;
    setTrabajando(true);
    const { error } = await supabase.rpc("sellos_canjear", { p_tarjeta: t.codigo, p_pin: ok.pin });
    setTrabajando(false);
    if (error) return avisar(mensajeError(error), "error");
    avisar(`Premio canjeado: ${programa.premio}`);
    avisarTarjeta(t.codigo);
    await onCambio();
  }

  async function borrar() {
    if (!confirm(`¿Borrar la tarjeta de ${t.nombre}? Pierde sus sellos y premios. No se puede deshacer.`)) return;
    const { error } = await supabase.from("sellos_tarjetas").delete().eq("id", t.id);
    if (error) return avisar(mensajeError(error), "error");
    avisar("Tarjeta borrada");
    onCerrar();
    await onCambio();
  }

  const enlace = `${urlSitio()}${rutaTarjeta(t.codigo)}`;
  const wa =
    t.telefono &&
    `https://wa.me/${numeroWhatsapp(t.telefono, paisDe(ajustes.pais))}?text=${encodeURIComponent(
      t.premios > 0
        ? `Hola ${t.nombre.split(" ")[0]}, ¡tienes ${programa.premio} esperándote en ${restaurante.nombre}! Tu tarjeta: ${enlace}`
        : `Hola ${t.nombre.split(" ")[0]}, esta es tu tarjeta de sellos de ${restaurante.nombre}: ${enlace}`,
    )}`;

  const TEXTO: Record<string, string> = {
    qr: "Sello con el QR de la cuenta",
    manual: "Sello del equipo",
    bienvenida: "Sello de bienvenida",
    anulada: "Mesa anulada: se quitó el sello",
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.nombre}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-superficie shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-borde px-5 py-4">
          <p className="min-w-0 flex-1 truncate text-xl font-bold">{t.nombre}</p>
          <button type="button" onClick={onCerrar} className="rounded-lg p-2 text-suave hover:bg-stone-100" aria-label="Cerrar">
            <Icono nombre="cerrar" />
          </button>
        </div>
        <div className="space-y-5 px-5 py-5">
          <div className="flex justify-center">
            <TarjetaVisual
              local={restaurante.nombre}
              logo={restaurante.logo_url}
              programa={programa}
              sellos={t.sellos}
              premios={t.premios}
              nombre={t.nombre}
            />
          </div>

          {t.premios > 0 && (
            <button type="button" className="boton w-full bg-emerald-600 py-3 hover:bg-emerald-700" disabled={trabajando} onClick={canjear}>
              <Icono nombre="regalo" className="h-5 w-5" /> Canjear {programa.premio}
            </button>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-borde">
              <button
                type="button"
                className="px-3 py-2 text-lg text-suave"
                onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                aria-label="Menos"
              >
                −
              </button>
              <span className="w-8 text-center font-semibold tabular-nums">{cantidad}</span>
              <button
                type="button"
                className="px-3 py-2 text-lg text-suave"
                onClick={() => setCantidad((c) => Math.min(30, c + 1))}
                aria-label="Más"
              >
                +
              </button>
            </div>
            <button type="button" className="boton flex-1" disabled={trabajando} onClick={() => sumar(cantidad)}>
              Sumar {cantidad === 1 ? "1 sello" : `${cantidad} sellos`}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#25d366] px-3 py-1.5 font-semibold text-white"
              >
                <Icono nombre="whatsapp" className="h-4 w-4" /> Enviar su tarjeta
              </a>
            )}
            <a href={rutaTarjeta(t.codigo)} target="_blank" className="boton-secundario py-1.5">
              <Icono nombre="externo" className="h-4 w-4" /> Abrir tarjeta
            </a>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-suave">Teléfono</dt>
              <dd>{t.telefono || "—"}</dd>
            </div>
            <div>
              <dt className="text-suave">Código</dt>
              <dd className="font-mono">{t.codigo}</dd>
            </div>
            <div>
              <dt className="text-suave">Sellos en total</dt>
              <dd>{t.total_sellos}</dd>
            </div>
            <div>
              <dt className="text-suave">Premios canjeados</dt>
              <dd>{t.canjes}</dd>
            </div>
            <div>
              <dt className="text-suave">Cumpleaños</dt>
              <dd>{t.cumpleanos ? formatoFecha(`${t.cumpleanos}T12:00:00`, region, { day: "numeric", month: "long" }) : "—"}</dd>
            </div>
            <div>
              <dt className="text-suave">Avisos y promociones</dt>
              <dd>{t.acepta_avisos ? "Sí acepta" : "No"}</dd>
            </div>
          </dl>

          {movimientos.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold">Movimientos</p>
              <ul className="divide-y divide-borde rounded-xl border border-borde text-sm">
                {movimientos.map((m, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span>
                      {m.tipo === "canje" ? "Premio canjeado" : m.cantidad < 0 && m.origen === "manual" ? "Sellos quitados" : TEXTO[m.origen] ?? "Ajuste"}
                      <span className="block text-xs text-suave">
                        {formatoFecha(m.created_at, region, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
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
            </div>
          )}

          <div className="flex flex-wrap gap-3 border-t border-borde pt-4 text-sm">
            <button
              type="button"
              className="text-suave hover:text-red-600"
              disabled={trabajando || (t.sellos < 1 && t.premios < 1)}
              onClick={() => sumar(-1)}
            >
              Quitar un sello
            </button>
            {admin && (
              <button type="button" className="ml-auto text-suave hover:text-red-600" onClick={borrar}>
                Borrar tarjeta
              </button>
            )}
          </div>
        </div>
      </div>
      {dialogo}
    </div>
  );
}

// ── Escanear la tarjeta del cliente con la cámara ──
type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

function Escaner({ onLeido, onCerrar }: { onLeido: (texto: string) => void; onCerrar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [codigo, setCodigo] = useState("");
  const [sinCamara, setSinCamara] = useState(false);
  const leido = useRef(onLeido);
  leido.current = onLeido;

  useEffect(() => {
    const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    if (!BD || !navigator.mediaDevices?.getUserMedia) {
      setSinCamara(true);
      return;
    }
    let activo = true;
    let flujo: MediaStream | null = null;
    const detector = new BD({ formats: ["qr_code"] });
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then(async (s) => {
        flujo = s;
        if (!video.current) return;
        video.current.srcObject = s;
        await video.current.play();
        while (activo) {
          try {
            const r = await detector.detect(video.current);
            if (r[0]?.rawValue) {
              activo = false;
              leido.current(r[0].rawValue);
              break;
            }
          } catch {}
          await new Promise((ok) => setTimeout(ok, 250));
        }
      })
      .catch(() => setSinCamara(true));
    return () => {
      activo = false;
      flujo?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Escanear tarjeta"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-4 rounded-2xl bg-superficie p-5 shadow-2xl"
      >
        <p className="font-semibold">Escanear tarjeta</p>
        {!sinCamara ? (
          <video ref={video} className="aspect-square w-full rounded-xl bg-black object-cover" muted playsInline />
        ) : (
          <p className="rounded-lg bg-stone-50 px-3 py-2 text-sm text-suave">
            Este navegador no puede leer QR. Escribe el código que aparece bajo el QR de la tarjeta, o escanéalo con la cámara
            del celular: si entraste al panel en ese celular, la tarjeta se abre con los botones para sumar y canjear.
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (codigo.trim()) onLeido(codigo);
          }}
          className="flex gap-2"
        >
          <input
            id="codigo-tarjeta"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Código de la tarjeta"
            className="campo flex-1 py-2 font-mono uppercase"
            autoCapitalize="characters"
          />
          <button type="submit" className="boton">
            Buscar
          </button>
        </form>
        <button type="button" className="w-full text-sm text-suave hover:text-tinta" onClick={onCerrar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── La tarjeta del local ─────────────────────────
function Configurar({
  restaurante,
  programa,
  nueva,
  onGuardado,
}: {
  restaurante: Restaurante;
  programa: ProgramaSellos;
  nueva: boolean;
  onGuardado: (p: ProgramaSellos) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const avisar = useToast();
  const [p, setP] = useState<ProgramaSellos>(
    nueva ? { ...programa, color: /^#[0-9a-f]{6}$/i.test(restaurante.color_primario) ? restaurante.color_primario : programa.color } : programa,
  );
  const [guardando, setGuardando] = useState(false);
  const cambiar = (c: Partial<ProgramaSellos>) => setP((x) => ({ ...x, ...c }));
  const formato = (n: number) => formatoPrecio(n, restaurante.moneda);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    const fila = { ...p, premio: p.premio.trim() || PROGRAMA_BASE.premio, condiciones: p.condiciones.trim() };
    const { error } = await supabase.from("sellos_programas").upsert({ restaurante_id: restaurante.id, ...fila });
    setGuardando(false);
    if (error) return avisar(mensajeError(error), "error");
    onGuardado(fila);
    avisar(nueva ? "Tarjeta lista. Ya puedes imprimir el QR para unirse." : "Tarjeta guardada");
  }

  const numero = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(v) || min)));

  return (
    <form onSubmit={guardar} className="grid gap-6 lg:grid-cols-[1fr_auto]">
      <div className="space-y-5">
        <section className="tarjeta space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Tarjeta activa</h2>
              <p className="text-sm text-suave">Pausada, nadie nuevo se une ni suma sellos. Lo acumulado se guarda.</p>
            </div>
            <Interruptor activo={p.activo} onChange={(v) => cambiar({ activo: v })} etiqueta="Tarjeta activa" />
          </div>
        </section>

        <section className="tarjeta space-y-4 p-5">
          <h2 className="font-semibold">Sellos y premio</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="etiqueta-campo">Sellos para el premio</span>
              <input
                id="meta"
                type="number"
                min={3}
                max={30}
                value={p.meta}
                onChange={(e) => cambiar({ meta: numero(e.target.value, 3, 30) })}
                className="campo"
              />
            </label>
            <label className="block text-sm">
              <span className="etiqueta-campo">Premio</span>
              <input
                id="premio"
                required
                maxLength={60}
                value={p.premio}
                onChange={(e) => cambiar({ premio: e.target.value })}
                placeholder="Un café de regalo"
                className="campo"
              />
            </label>
          </div>
          <fieldset className="space-y-2 text-sm">
            <legend className="etiqueta-campo">Cómo se gana un sello</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="regla" checked={p.regla === "visita"} onChange={() => cambiar({ regla: "visita" })} />
              Uno por visita (cada mesa o pedido)
            </label>
            <label className="flex flex-wrap items-center gap-2">
              <input type="radio" name="regla" checked={p.regla === "monto"} onChange={() => cambiar({ regla: "monto" })} />
              Uno por cada
              <input
                id="monto"
                type="number"
                min={1}
                value={p.monto_por_sello}
                onChange={(e) => cambiar({ monto_por_sello: Math.max(1, Number(e.target.value) || 1), regla: "monto" })}
                className="campo py-1.5"
                style={{ width: "8rem" }}
              />
              de consumo
            </label>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="etiqueta-campo">Sellos de regalo al unirse</span>
              <select
                id="bienvenida"
                value={p.bienvenida}
                onChange={(e) => cambiar({ bienvenida: Number(e.target.value) })}
                className="campo"
              >
                <option value={0}>Ninguno</option>
                <option value={1}>1 sello (recomendado)</option>
                <option value={2}>2 sellos</option>
                <option value={3}>3 sellos</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="etiqueta-campo">Máximo por día con el QR de la cuenta</span>
              <select
                id="max-dia"
                value={p.max_por_dia}
                onChange={(e) => cambiar({ max_por_dia: Number(e.target.value) })}
                className="campo"
              >
                {[1, 2, 3, 5].map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "1 vez al día" : `${n} veces al día`}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-suave">
            {textoRegla(p, formato)}. Con la tarjeta llena el cliente gana {p.premio || "el premio"} y empieza una nueva.
          </p>
        </section>

        <section className="tarjeta space-y-4 p-5">
          <h2 className="font-semibold">Diseño</h2>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              Color
              <input
                id="color"
                type="color"
                value={p.color}
                onChange={(e) => cambiar({ color: e.target.value })}
                className="h-9 w-14 cursor-pointer rounded border border-borde"
              />
            </label>
            <button
              type="button"
              className="text-marca hover:underline"
              onClick={() =>
                /^#[0-9a-f]{6}$/i.test(restaurante.color_primario) && cambiar({ color: restaurante.color_primario })
              }
            >
              Usar el color de mi carta
            </button>
          </div>
          <div>
            <p className="etiqueta-campo">Dibujo de los sellos</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(ICONOS_SELLO) as IconoSello[]).map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => cambiar({ icono: i })}
                  aria-pressed={p.icono === i}
                  aria-label={i}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl border text-xl ${
                    p.icono === i ? "border-marca ring-2 ring-marca/30" : "border-borde"
                  }`}
                >
                  {ICONOS_SELLO[i]}
                </button>
              ))}
            </div>
          </div>
          <label className="block text-sm">
            <span className="etiqueta-campo">Condiciones (opcional)</span>
            <textarea
              id="condiciones"
              maxLength={300}
              rows={2}
              value={p.condiciones}
              onChange={(e) => cambiar({ condiciones: e.target.value })}
              placeholder="Premio válido de lunes a jueves. No acumulable con otras promociones."
              className="campo resize-none"
            />
          </label>
        </section>

        <button type="submit" className="boton" disabled={guardando}>
          {guardando ? "Guardando…" : nueva ? "Crear mi tarjeta" : "Guardar cambios"}
        </button>
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-2 text-center text-xs text-suave">Así la ven tus clientes</p>
        <div className="flex justify-center">
          <TarjetaVisual
            local={restaurante.nombre}
            logo={restaurante.logo_url}
            programa={p}
            sellos={Math.min(p.meta - 1, Math.max(p.bienvenida, Math.round(p.meta * 0.6)))}
            nombre="Camila"
          />
        </div>
      </div>
    </form>
  );
}

// ── QR para unirse: carteles para mesas y caja ─────
function Carteles({ restaurante, programa }: { restaurante: Restaurante; programa: ProgramaSellos }) {
  const avisar = useToast();
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(`${urlSitio()}${rutaUnirse(restaurante.slug)}`), [restaurante.slug]);
  const svg = useMemo(() => (url ? qrSvg(url) : ""), [url]);

  async function bajar() {
    descargar(await qrPng(url, 1200), `qr-tarjeta-sellos-${restaurante.slug}.png`);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      avisar("Enlace copiado");
    } catch {
      avisar("No se pudo copiar. Mantén presionado el enlace para copiarlo.", "error");
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-[auto_1fr]">
      <div className="tarjeta flex w-full max-w-xs flex-col items-center gap-3 p-5 text-center" style={{ borderTop: `6px solid ${programa.color}` }}>
        <p className="text-lg font-bold">¡Junta sellos y gana!</p>
        <p className="text-sm text-suave">
          {programa.meta} sellos = {programa.premio}
        </p>
        <div className="w-48" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="text-xs text-suave">Escanea y obtén tu tarjeta de {restaurante.nombre}</p>
      </div>
      <div className="space-y-4 text-sm">
        <div>
          <h2 className="font-semibold">Dónde ponerlo</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-suave">
            <li>En la caja y en un cartel en cada mesa.</li>
            <li>En tu Instagram y en el WhatsApp del local (con el enlace).</li>
            <li>La precuenta ya trae su propio QR: ese suma el sello de la visita, y si el cliente no tiene tarjeta, lo invita a unirse.</li>
          </ul>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="boton" onClick={bajar} disabled={!url}>
            Descargar QR
          </button>
          <button type="button" className="boton-secundario" onClick={copiar} disabled={!url}>
            Copiar enlace
          </button>
          <a href={url || "#"} target="_blank" className="boton-secundario">
            <Icono nombre="externo" className="h-4 w-4" /> Ver página
          </a>
        </div>
        <p className="break-all font-mono text-xs text-suave">{url}</p>
      </div>
    </div>
  );
}
