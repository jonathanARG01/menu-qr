"use client";

import { useEffect, useRef, useState } from "react";
import { Icono } from "@/components/Icono";
import { nombreMesa, type Cuenta, type Pedido, type Piso } from "@/lib/salon";
import type { Mesa } from "@/lib/types";
import { minutosDesde } from "@/lib/useServicio";
import { ESTILOS_PLANO, Plano, type EstadoMesa, type EstiloPlano } from "./Plano";
import { formatoHora, type Region } from "@/lib/region";
import { guardarSeguirAvisos, leerSeguirAvisos, useAvisoNuevo } from "./avisos";

type Aviso = {
  id: string;
  mesa: Mesa;
  tipo: "cuenta" | "pago" | "mozo" | "pendiente" | "listo";
  desde: string;
  detalle?: string;
};

const AVISO: Record<Aviso["tipo"], { texto: string; clase: string; icono: string }> = {
  cuenta: { texto: "Pide la cuenta", clase: "bg-violet-600", icono: "$" },
  pago: { texto: "Pagó online", clase: "bg-emerald-700", icono: "$" },
  mozo: { texto: "Llama al mesero", clase: "bg-sky-600", icono: "!" },
  pendiente: { texto: "Pedido por confirmar", clase: "bg-red-600", icono: "●" },
  listo: { texto: "Pedido listo para llevar", clase: "bg-emerald-600", icono: "✓" },
};
const PRIORIDAD: Aviso["tipo"][] = ["cuenta", "pago", "mozo", "pendiente", "listo"];

// Pantalla del salón: el plano y los avisos en grande, para una tele o tableta fija en el salón (como la de cocina).
// Mantiene la pantalla encendida y, si hay varios pisos, puede ir pasando de uno a otro sola. Cuando llega un aviso
// de una mesa de otro piso, muestra ese piso y marca la mesa.
export function PantallaSalon({
  nombre,
  pisos,
  mesas,
  estados,
  cuentas,
  pedidos,
  estilo,
  onEstilo,
  onAbrirMesa,
  onSalir,
  enVivo,
  ahora,
  formato,
  region,
  children,
}: {
  nombre: string;
  pisos: Piso[];
  mesas: Mesa[];
  estados: Map<string, EstadoMesa>;
  cuentas: Cuenta[];
  pedidos: Pedido[];
  estilo: EstiloPlano;
  onEstilo: (e: EstiloPlano) => void;
  onAbrirMesa: (id: string) => void;
  onSalir: () => void;
  enVivo: boolean;
  ahora: number;
  formato: (n: number) => string;
  region: Region;
  children?: React.ReactNode;
}) {
  const marco = useRef<HTMLDivElement>(null);
  const [pisoId, setPisoId] = useState(pisos[0]?.id ?? null);
  const [rotar, setRotar] = useState(false);
  const [seguir, setSeguir] = useState(true);
  const [resaltada, setResaltada] = useState<{ mesa: Mesa; piso: string } | null>(null);
  const piso = pisos.find((p) => p.id === pisoId) ?? pisos[0] ?? null;

  useEffect(() => setSeguir(leerSeguirAvisos()), []);
  function alternarSeguir() {
    setSeguir(!seguir);
    guardarSeguirAvisos(!seguir);
  }

  // Aviso nuevo en otra mesa: se va a su piso (también si está rotando: se queda ahí la vuelta completa).
  useAvisoNuevo(cuentas, pedidos, (mesaId) => {
    const mesa = mesas.find((m) => m.id === mesaId);
    const suPiso = pisos.find((p) => p.id === mesa?.piso_id);
    if (!mesa || !suPiso) return;
    if (seguir && suPiso.id !== piso?.id) setPisoId(suPiso.id);
    if (seguir || suPiso.id === piso?.id) setResaltada({ mesa, piso: suPiso.nombre });
  });
  useEffect(() => {
    if (!resaltada) return;
    const id = setTimeout(() => setResaltada(null), 10000);
    return () => clearTimeout(id);
  }, [resaltada]);

  // Pantalla completa del navegador y pantalla siempre encendida mientras esté abierta.
  useEffect(() => {
    marco.current?.requestFullscreen?.().catch(() => {});
    let candado: { release: () => Promise<void> } | null = null;
    const pedir = () =>
      (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<typeof candado> } }).wakeLock
        ?.request("screen")
        .then((c) => (candado = c))
        .catch(() => {});
    pedir();
    const alVolver = () => document.visibilityState === "visible" && pedir();
    const alSalir = () => !document.fullscreenElement && onSalir();
    document.addEventListener("visibilitychange", alVolver);
    document.addEventListener("fullscreenchange", alSalir);
    return () => {
      candado?.release().catch(() => {});
      document.removeEventListener("visibilitychange", alVolver);
      document.removeEventListener("fullscreenchange", alSalir);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [onSalir]);

  // Cada piso se muestra 20 segundos (se vuelve a contar si un aviso lo trajo a la vista).
  useEffect(() => {
    if (!rotar || pisos.length < 2) return;
    const id = setTimeout(() => {
      setPisoId((actual) => pisos[(pisos.findIndex((p) => p.id === actual) + 1) % pisos.length].id);
    }, 20000);
    return () => clearTimeout(id);
  }, [rotar, pisos, pisoId]);

  const mesaDe = (c: { mesa_id?: string | null; cuenta_id?: string | null }) =>
    mesas.find((m) => m.id === (c.mesa_id ?? cuentas.find((x) => x.id === c.cuenta_id)?.mesa_id));
  const avisos: Aviso[] = [];
  for (const c of cuentas) {
    const mesa = mesaDe(c);
    if (c.aviso && mesa) avisos.push({ id: `a${c.id}`, mesa, tipo: c.aviso.tipo, desde: c.aviso.at });
  }
  for (const p of pedidos) {
    if (p.estado !== "pendiente" && p.estado !== "listo") continue;
    const mesa = mesaDe(p);
    if (!mesa) continue;
    avisos.push({
      id: p.id,
      mesa,
      tipo: p.estado === "listo" ? "listo" : "pendiente",
      desde: p.estado === "listo" ? p.actualizado_at : p.created_at,
      detalle: (p.pedido_items ?? []).map((i) => `${i.cantidad} ${i.nombre}`).join(", "),
    });
  }
  avisos.sort((a, b) => PRIORIDAD.indexOf(a.tipo) - PRIORIDAD.indexOf(b.tipo) || a.desde.localeCompare(b.desde));

  const ocupadas = mesas.filter((m) => estados.get(m.id)?.ocupada).length;
  const hora = formatoHora(ahora, region);

  return (
    <div
      ref={marco}
      className="tema-oscuro fixed inset-0 z-30 flex flex-col gap-3 overflow-hidden bg-[#0d1016] p-3 text-tinta sm:p-4"
    >
      <header className="tema-fijo flex text-stone-100 flex-wrap items-center gap-2">
        <h1 className="mr-2 text-lg font-bold sm:text-xl">{nombre} · Salón</h1>
        <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs">
          <span className={`h-2 w-2 rounded-full ${enVivo ? "bg-emerald-400" : "bg-stone-400"}`} />
          {enVivo ? "En vivo" : "Actualiza cada 15 s"}
        </span>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs">
          {ocupadas} de {mesas.length} mesas ocupadas
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {pisos.length > 1 &&
            pisos.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPisoId(p.id);
                  setRotar(false);
                }}
                className={`rounded-full px-3 py-1 text-sm font-medium ${piso?.id === p.id ? "bg-white text-stone-900" : "bg-white/10 hover:bg-white/20"}`}
              >
                {p.nombre}
              </button>
            ))}
          {pisos.length > 1 && (
            <button
              type="button"
              onClick={() => setRotar(!rotar)}
              className={`rounded-full px-3 py-1 text-sm ${rotar ? "bg-marca text-white" : "bg-white/10 hover:bg-white/20"}`}
              title="Pasar de un piso a otro cada 20 segundos"
            >
              Rotar pisos
            </button>
          )}
          {pisos.length > 1 && (
            <button
              type="button"
              onClick={alternarSeguir}
              aria-pressed={seguir}
              className={`rounded-full px-3 py-1 text-sm ${seguir ? "bg-marca text-white" : "bg-white/10 hover:bg-white/20"}`}
              title="Cuando llega un aviso de una mesa de otro piso, mostrar ese piso"
            >
              Ir al aviso
            </button>
          )}
          <span className="flex rounded-full bg-white/10 p-0.5 text-sm" role="group" aria-label="Estilo del plano">
            {ESTILOS_PLANO.map((e) => (
              <button
                key={e.id}
                type="button"
                aria-pressed={estilo === e.id}
                onClick={() => onEstilo(e.id)}
                className={`rounded-full px-3 py-0.5 ${estilo === e.id ? "bg-white text-stone-900" : "hover:bg-white/10"}`}
              >
                {e.texto}
              </button>
            ))}
          </span>
          <span className="px-2 text-2xl font-bold tabular-nums" suppressHydrationWarning>
            {hora}
          </span>
          <button
            type="button"
            onClick={onSalir}
            className="rounded-full bg-white/10 p-2 hover:bg-white/20"
            aria-label="Salir de pantalla completa"
            title="Salir"
          >
            <Icono nombre="cerrar" className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_320px]">
        <div className="relative min-h-0 overflow-auto">
          {resaltada && (
            <p className="tema-fijo absolute left-1/2 top-2 z-10 -translate-x-1/2 animate-pulse rounded-full bg-marca px-4 py-1.5 text-sm font-semibold text-white shadow-lg">
              {resaltada.piso} · {nombreMesa(resaltada.mesa.numero)}
            </p>
          )}
          {piso ? (
            <Plano
              piso={piso}
              mesas={mesas}
              estados={estados}
              editando={false}
              seleccion={resaltada ? { tipo: "mesa", id: resaltada.mesa.id } : null}
              onSeleccionar={() => {}}
              onMover={() => {}}
              onAbrirMesa={onAbrirMesa}
              formato={formato}
              estilo={estilo}
              alto="100vh - 9rem"
            />
          ) : (
            <p className="py-20 text-center text-stone-400">Todavía no hay un plano armado.</p>
          )}
        </div>

        <aside className="tema-fijo flex text-stone-100 min-h-0 flex-col rounded-2xl bg-white/5 p-3">
          <p className="mb-2 flex items-center gap-2 font-semibold">
            <Icono nombre="campana" className="h-5 w-5" /> Avisos
            <span className="ml-auto rounded-full bg-white/10 px-2 text-sm tabular-nums">{avisos.length}</span>
          </p>
          {avisos.length === 0 && (
            <p className="py-10 text-center text-sm text-stone-400">Todo tranquilo. Los avisos de las mesas aparecen aquí.</p>
          )}
          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {avisos.map((a) => {
              const s = AVISO[a.tipo];
              const min = minutosDesde(a.desde, ahora);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => onAbrirMesa(a.mesa.id)}
                    className={`flex w-full items-center gap-3 rounded-xl p-3 text-left text-white ${s.clase} ${a.tipo !== "listo" && a.tipo !== "pago" ? "animate-pulse" : ""}`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/20 text-lg font-bold">
                      {s.icono}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-lg font-bold leading-tight">{nombreMesa(a.mesa.numero)}</span>
                      <span className="block text-sm opacity-90">{s.texto}</span>
                      {a.detalle && <span className="block truncate text-xs opacity-80">{a.detalle}</span>}
                    </span>
                    <span className="text-sm font-semibold tabular-nums" suppressHydrationWarning>
                      {min}′
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
      {children}
    </div>
  );
}
