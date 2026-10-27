"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icono } from "@/components/Icono";
import { useToast } from "@/components/Toast";
import { NOMBRE_ESTADO, type Ajustes, type EstadoPedido, type Pedido, type PedidoItem, type Piso } from "@/lib/salon";
import type { Mesa, Restaurante } from "@/lib/types";
import { mensajeError } from "@/lib/utils";
import { minutosDesde, useAhora, useServicio } from "@/lib/useServicio";

type Props = {
  restaurante: Restaurante;
  ajustes: Ajustes;
  pedidosIniciales: Pedido[];
  mesas: Mesa[];
  pisos: Pick<Piso, "id" | "nombre">[];
};

const SIGUIENTE: Partial<Record<EstadoPedido, { estado: EstadoPedido; texto: string; clase: string }>> = {
  nuevo: { estado: "preparando", texto: "Empezar", clase: "bg-emerald-600 hover:bg-emerald-700" },
  preparando: { estado: "listo", texto: "Terminar", clase: "bg-red-600 hover:bg-red-700" },
  listo: { estado: "entregado", texto: "Entregado", clase: "bg-stone-700 hover:bg-stone-800" },
};

const leer = (clave: string) => {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
};
const guardar = (clave: string, valor: string) => {
  try {
    localStorage.setItem(clave, valor);
  } catch {}
};

// Pitido corto para avisar que entró una comanda.
function pitar() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.frequency.value = 880;
    vol.gain.setValueAtTime(0.2, ctx.currentTime);
    vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(vol).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {}
}

// Pantalla de cocina (o de barra): comandas en tiempo real, del más viejo al más nuevo.
export function Cocina({ restaurante, ajustes, pedidosIniciales, mesas, pisos }: Props) {
  const avisar = useToast();
  const { pedidos, supabase, recargar, enVivo } = useServicio(restaurante.id, {
    cuentas: [],
    pedidos: pedidosIniciales,
    pagos: [],
  });
  const ahora = useAhora(15000);
  const tablero = useRef<HTMLDivElement>(null);
  const [estacion, setEstacion] = useState<string>("Todas");
  const [sonido, setSonido] = useState(true);
  const [verEntregados, setVerEntregados] = useState(false);
  const [detalle, setDetalle] = useState<string | null>(null);
  const vistos = useRef<Set<string> | null>(null);

  useEffect(() => {
    setEstacion(leer("cocina:estacion") ?? "Todas");
    setSonido(leer("cocina:sonido") !== "no");
  }, []);

  const estaciones = useMemo(
    () => [...new Set([...ajustes.estaciones, ...pedidos.map((p) => p.estacion)])],
    [ajustes.estaciones, pedidos],
  );
  const deEstacion = pedidos.filter((p) => estacion === "Todas" || p.estacion === estacion);
  const activos = deEstacion.filter((p) => p.estado === "nuevo" || p.estado === "preparando");
  const listos = deEstacion.filter((p) => p.estado === "listo");
  const pendientes = deEstacion.filter((p) => p.estado === "pendiente");
  const entregados = deEstacion
    .filter((p) => p.estado === "entregado")
    .slice(-12)
    .reverse();

  // Suena cuando entra una comanda nueva (no al abrir la pantalla).
  useEffect(() => {
    const nuevos = pedidos.filter((p) => p.estado === "nuevo").map((p) => p.id);
    if (vistos.current === null) {
      vistos.current = new Set(nuevos);
      return;
    }
    const llegaron = nuevos.filter((id) => !vistos.current!.has(id));
    nuevos.forEach((id) => vistos.current!.add(id));
    if (llegaron.length && sonido) pitar();
  }, [pedidos, sonido]);

  function lugar(p: Pedido) {
    const mesa = mesas.find(
      (m) => m.numero === p.mesa_numero && (!p.sucursal_id || !m.sucursal_id || m.sucursal_id === p.sucursal_id),
    );
    const piso = pisos.find((x) => x.id === mesa?.piso_id)?.nombre;
    return { mesa: p.mesa_numero ? `Mesa ${p.mesa_numero}` : "Mostrador", piso };
  }

  async function cambiar(p: Pedido, estado: EstadoPedido) {
    const { error } = await supabase.from("pedidos").update({ estado }).eq("id", p.id);
    if (error) return avisar(mensajeError(error), "error");
    recargar();
  }

  async function alternarItem(i: PedidoItem) {
    const { error } = await supabase.from("pedido_items").update({ listo: !i.listo }).eq("id", i.id);
    if (error) return avisar(mensajeError(error), "error");
    recargar();
  }

  const color = (min: number) =>
    min >= ajustes.alertas.rojo ? "bg-red-600" : min >= ajustes.alertas.amarillo ? "bg-amber-500" : "bg-emerald-600";

  const elegido = pedidos.find((p) => p.id === detalle);

  return (
    <div ref={tablero} className="flex min-h-[calc(100vh-8rem)] flex-col gap-3 rounded-2xl bg-stone-900 p-3 text-white sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 flex items-center gap-2 text-lg font-bold">
          <Icono nombre="cocina" /> {estacion === "Todas" ? "Comandas" : estacion}
        </h1>
        <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs">
          <span className={`h-2 w-2 rounded-full ${enVivo ? "bg-emerald-400" : "bg-stone-400"}`} />
          {enVivo ? "En vivo" : "Actualiza cada 15 s"}
        </span>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs">{activos.length} en curso</span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {["Todas", ...estaciones].map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                setEstacion(e);
                guardar("cocina:estacion", e);
              }}
              className={`rounded-full px-3 py-1 text-sm font-medium ${estacion === e ? "bg-white text-stone-900" : "bg-white/10 hover:bg-white/20"}`}
            >
              {e}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setSonido(!sonido);
              guardar("cocina:sonido", sonido ? "no" : "si");
              if (!sonido) pitar();
            }}
            className="rounded-full bg-white/10 p-2 hover:bg-white/20"
            aria-label={sonido ? "Silenciar" : "Activar sonido"}
            title={sonido ? "Sonido activado" : "Sonido apagado"}
          >
            <Icono nombre={sonido ? "sonido" : "silencio"} className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => (document.fullscreenElement ? document.exitFullscreen() : tablero.current?.requestFullscreen())}
            className="rounded-full bg-white/10 p-2 hover:bg-white/20"
            aria-label="Pantalla completa"
            title="Pantalla completa"
          >
            <Icono nombre="pantalla" className="h-4 w-4" />
          </button>
        </div>
      </div>

      {pendientes.length > 0 && (
        <p className="rounded-xl bg-white/10 px-3 py-2 text-sm text-stone-300">
          {pendientes.length} {pendientes.length === 1 ? "pedido espera" : "pedidos esperan"} que el mesero lo confirme (
          {pendientes.map((p) => lugar(p).mesa).join(", ")}).
        </p>
      )}

      <div className="grid flex-1 gap-3 lg:grid-cols-[1fr_260px]">
        <div className="grid content-start gap-3 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
          {activos.length === 0 && (
            <p className="col-span-full py-16 text-center text-stone-400">
              No hay comandas pendientes. Las nuevas aparecen solas aquí.
            </p>
          )}
          {activos.map((p) => {
            const min = minutosDesde(p.created_at, ahora);
            const { mesa, piso } = lugar(p);
            const sig = SIGUIENTE[p.estado]!;
            return (
              <article key={p.id} className="flex flex-col overflow-hidden rounded-xl bg-white text-stone-900 shadow-lg">
                <button type="button" onClick={() => setDetalle(p.id)} className={`px-3 py-2 text-left text-white ${color(min)}`}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-lg font-bold">{mesa}</span>
                    <span className="flex items-center gap-1 text-sm font-semibold tabular-nums" suppressHydrationWarning>
                      <Icono nombre="reloj" className="h-4 w-4" />
                      {min}′
                    </span>
                  </span>
                  <span className="flex justify-between text-xs opacity-90">
                    <span>
                      #{p.numero}
                      {piso ? ` · ${piso}` : ""}
                      {estacion === "Todas" ? ` · ${p.estacion}` : ""}
                    </span>
                    <span suppressHydrationWarning>
                      {new Date(p.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })}
                    </span>
                  </span>
                </button>
                {p.estado === "preparando" && (
                  <p className="bg-sky-100 px-3 py-0.5 text-xs font-semibold text-sky-800">En preparación</p>
                )}
                <ul className="flex-1 divide-y divide-stone-100 px-3 py-1">
                  {(p.pedido_items ?? []).map((i) => (
                    <li key={i.id}>
                      <button
                        type="button"
                        onClick={() => alternarItem(i)}
                        className={`flex w-full gap-2 py-1.5 text-left ${i.listo ? "text-stone-400 line-through" : ""}`}
                      >
                        <span className="w-6 shrink-0 text-right font-bold tabular-nums">{i.cantidad}×</span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold leading-tight">{i.nombre}</span>
                          {i.nota && (
                            <span className="block rounded bg-amber-100 px-1 text-xs font-medium text-amber-900">{i.nota}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {p.nota && <p className="mx-3 mb-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">Nota: {p.nota}</p>}
                <button
                  type="button"
                  onClick={() => cambiar(p, sig.estado)}
                  className={`m-2 mt-0 rounded-lg py-2.5 text-sm font-bold uppercase tracking-wide text-white ${sig.clase}`}
                >
                  {sig.texto}
                </button>
              </article>
            );
          })}
        </div>

        <aside className="space-y-2 rounded-xl bg-white/5 p-3">
          <p className="text-sm font-semibold text-emerald-300">Listos para llevar ({listos.length})</p>
          {listos.length === 0 && (
            <p className="text-xs text-stone-400">Lo que termines aparece aquí hasta que el mesero lo entregue.</p>
          )}
          {listos.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-lg bg-emerald-900/50 px-3 py-2">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setDetalle(p.id)}>
                <span className="block font-semibold">{lugar(p).mesa}</span>
                <span className="block truncate text-xs text-stone-300">
                  {(p.pedido_items ?? []).map((i) => `${i.cantidad} ${i.nombre}`).join(", ")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => cambiar(p, "entregado")}
                className="rounded-md bg-white/15 px-2 py-1 text-xs font-semibold hover:bg-white/25"
              >
                Entregado
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setVerEntregados(!verEntregados)}
            className="pt-2 text-xs text-stone-400 underline"
          >
            {verEntregados ? "Ocultar" : "Ver"} entregados recientes
          </button>
          {verEntregados &&
            entregados.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setDetalle(p.id)}
                className="block w-full truncate text-left text-xs text-stone-400 hover:text-white"
              >
                #{p.numero} · {lugar(p).mesa} · {(p.pedido_items ?? []).map((i) => i.nombre).join(", ")}
              </button>
            ))}
        </aside>
      </div>

      {elegido && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setDetalle(null)}>
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white p-5 text-stone-900 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-2xl font-bold">{lugar(elegido).mesa}</p>
                <p className="text-sm text-stone-500">
                  Comanda #{elegido.numero} · {elegido.estacion} · {NOMBRE_ESTADO[elegido.estado]}
                  {lugar(elegido).piso ? ` · ${lugar(elegido).piso}` : ""}
                </p>
                <p className="text-sm text-stone-500" suppressHydrationWarning>
                  Pedido a las{" "}
                  {new Date(elegido.created_at).toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}{" "}
                  ({minutosDesde(elegido.created_at, ahora)} min) ·{" "}
                  {elegido.origen === "cliente" ? "desde el QR" : "por el mesero"}
                  {elegido.nombre ? ` · ${elegido.nombre}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetalle(null)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100"
                aria-label="Cerrar"
              >
                <Icono nombre="cerrar" />
              </button>
            </div>
            <ul className="mt-4 space-y-2">
              {(elegido.pedido_items ?? []).map((i) => (
                <li key={i.id} className="flex gap-3 text-lg">
                  <span className="w-8 text-right font-bold">{i.cantidad}×</span>
                  <span className="flex-1">
                    <span className={`font-semibold ${i.listo ? "text-stone-400 line-through" : ""}`}>{i.nombre}</span>
                    {i.nota && <span className="block text-sm text-amber-700">{i.nota}</span>}
                    {i.comensal && <span className="block text-xs text-stone-400">Comensal {i.comensal}</span>}
                  </span>
                </li>
              ))}
            </ul>
            {elegido.nota && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">Nota: {elegido.nota}</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              {elegido.estado !== "nuevo" && elegido.estado !== "pendiente" && (
                <button
                  type="button"
                  className="boton-secundario"
                  onClick={() => cambiar(elegido, elegido.estado === "listo" ? "preparando" : "nuevo")}
                >
                  Volver atrás
                </button>
              )}
              {SIGUIENTE[elegido.estado] && (
                <button
                  type="button"
                  className={`ml-auto rounded-lg px-4 py-2.5 text-sm font-bold text-white ${SIGUIENTE[elegido.estado]!.clase}`}
                  onClick={() => {
                    cambiar(elegido, SIGUIENTE[elegido.estado]!.estado);
                    setDetalle(null);
                  }}
                >
                  {SIGUIENTE[elegido.estado]!.texto}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
