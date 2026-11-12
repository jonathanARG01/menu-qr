"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icono } from "@/components/Icono";
import { INFO_TIPO, type NotificacionAdmin } from "@/lib/notificacionesAdmin";

// Campanita de /admin: lo que hicieron los restaurantes (cambios de carta y diseño, altas, clics en "Quiero el plan…",
// "Quiero Platovi Loyalty", ayuda y funciones de otro plan). Se actualiza sola cada 45 segundos y al volver a la pestaña.

type Filtro = "todas" | "ventas" | "carta";
const FILTROS: [Filtro, string][] = [
  ["todas", "Todas"],
  ["ventas", "Ventas"],
  ["carta", "Carta y diseño"],
];
const CADA = 45_000;

type Ctx = {
  lista: NotificacionAdmin[];
  sinLeer: number;
  abierto: boolean;
  setAbierto: (v: boolean | ((a: boolean) => boolean)) => void;
  falta: boolean;
  cargando: boolean;
  marcar: (ids: string[] | "todas") => void;
  borrarLeidas: () => void;
};
const Contexto = createContext<Ctx | null>(null);

function hace(fecha: string) {
  const s = Math.max(0, (Date.now() - new Date(fecha).getTime()) / 1000);
  if (s < 60) return "recién";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 7) {
    const d = Math.floor(s / 86400);
    return d === 1 ? "ayer" : `hace ${d} días`;
  }
  return new Date(fecha).toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

export function ProveedorNotificaciones({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [lista, setLista] = useState<NotificacionAdmin[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [falta, setFalta] = useState(false);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from("notificaciones_admin")
      .select("id, restaurante_id, restaurante, slug, tipo, detalle, cambios, veces, usuario_correo, leida, creado, actualizado")
      .order("actualizado", { ascending: false })
      .limit(80);
    setCargando(false);
    if (error) {
      // Sin la migración 0035 la tabla no existe.
      setFalta(/notificaciones_admin|does not exist|schema cache/.test(error.message));
      return;
    }
    setFalta(false);
    setLista((data ?? []) as NotificacionAdmin[]);
  }, [supabase]);

  useEffect(() => {
    cargar();
    const t = setInterval(() => document.visibilityState === "visible" && cargar(), CADA);
    const alVolver = () => document.visibilityState === "visible" && cargar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [cargar]);

  // Al abrir la campanita se trae lo último.
  useEffect(() => {
    if (abierto) cargar();
  }, [abierto, cargar]);

  const sinLeer = lista.filter((n) => !n.leida).length;

  // El número también en la pestaña del navegador.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\)\s*/, "");
    document.title = sinLeer ? `(${sinLeer > 99 ? "99+" : sinLeer}) ${base}` : base;
  }, [sinLeer]);

  const marcar = useCallback(
    async (ids: string[] | "todas") => {
      const objetivo = ids === "todas" ? lista.filter((n) => !n.leida).map((n) => n.id) : ids;
      if (!objetivo.length) return;
      setLista((l) => l.map((n) => (objetivo.includes(n.id) ? { ...n, leida: true } : n)));
      await supabase.from("notificaciones_admin").update({ leida: true }).in("id", objetivo);
    },
    [lista, supabase],
  );

  const borrarLeidas = useCallback(async () => {
    const ids = lista.filter((n) => n.leida).map((n) => n.id);
    if (!ids.length) return;
    setLista((l) => l.filter((n) => !n.leida));
    await supabase.from("notificaciones_admin").delete().in("id", ids);
  }, [lista, supabase]);

  return (
    <Contexto.Provider value={{ lista, sinLeer, abierto, setAbierto, falta, cargando, marcar, borrarLeidas }}>
      {children}
      <PanelNotificaciones />
    </Contexto.Provider>
  );
}

function useNotificaciones() {
  const c = useContext(Contexto);
  if (!c) throw new Error("Falta ProveedorNotificaciones");
  return c;
}

export function BotonCampana({ className = "" }: { className?: string }) {
  const { sinLeer, abierto, setAbierto } = useNotificaciones();
  return (
    <button
      type="button"
      onClick={() => setAbierto((a) => !a)}
      aria-label={sinLeer ? `Notificaciones: ${sinLeer} sin leer` : "Notificaciones"}
      aria-expanded={abierto}
      title="Notificaciones"
      data-campana
      className={`relative flex h-9 w-9 items-center justify-center rounded-full transition ${
        abierto ? "bg-stone-100 text-tinta" : "text-suave hover:bg-stone-100 hover:text-tinta"
      } ${className}`}
    >
      <Icono nombre="campana" className={`h-5 w-5 ${sinLeer ? "origin-top animate-[campana_1.2s_ease-in-out_2]" : ""}`} />
      {sinLeer > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-superficie">
          {sinLeer > 99 ? "99+" : sinLeer}
        </span>
      )}
    </button>
  );
}

function PanelNotificaciones() {
  const { lista, sinLeer, abierto, setAbierto, falta, cargando, marcar, borrarLeidas } = useNotificaciones();
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [abierta, setAbierta] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  // Se cierra con Escape o al tocar fuera (menos la propia campanita).
  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    const fuera = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (panel.current?.contains(t) || t.closest("[data-campana]")) return;
      setAbierto(false);
    };
    document.addEventListener("keydown", tecla);
    document.addEventListener("pointerdown", fuera);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.removeEventListener("pointerdown", fuera);
    };
  }, [abierto, setAbierto]);

  if (!abierto) return null;

  const visibles = lista.filter((n) =>
    filtro === "ventas" ? INFO_TIPO[n.tipo]?.venta : filtro === "carta" ? n.tipo === "carta" || n.tipo === "marca" : true,
  );
  const hayLeidas = lista.some((n) => n.leida);

  return (
    <div
      ref={panel}
      role="dialog"
      aria-label="Notificaciones"
      className="fixed inset-x-2 top-[3.75rem] z-50 flex max-h-[calc(100dvh-4.5rem)] flex-col overflow-hidden rounded-3xl border border-borde bg-superficie text-tinta shadow-[0_30px_70px_-25px_rgb(0_0_0/0.55)] sm:left-auto sm:right-4 sm:w-[26rem] lg:left-[16.5rem] lg:right-auto lg:top-3 lg:max-h-[calc(100dvh-1.5rem)]"
    >
      <div className="flex items-center gap-2 border-b border-borde px-4 pb-3 pt-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Notificaciones</p>
          <p className="text-xs text-suave">{sinLeer ? `${sinLeer} sin leer` : "Estás al día"} · lo que hacen tus restaurantes</p>
        </div>
        {sinLeer > 0 && (
          <button
            type="button"
            onClick={() => marcar("todas")}
            className="rounded-full px-2.5 py-1 text-xs font-semibold text-marca hover:bg-stone-100"
          >
            Marcar todo leído
          </button>
        )}
        <button
          type="button"
          onClick={() => setAbierto(false)}
          aria-label="Cerrar"
          className="flex h-8 w-8 items-center justify-center rounded-full text-suave hover:bg-stone-100 hover:text-tinta"
        >
          <Icono nombre="cerrar" className="h-4 w-4" />
        </button>
      </div>

      <div className="flex gap-1 px-3 py-2">
        {FILTROS.map(([id, texto]) => {
          const n = lista.filter(
            (x) =>
              !x.leida &&
              (id === "ventas" ? INFO_TIPO[x.tipo]?.venta : id === "carta" ? x.tipo === "carta" || x.tipo === "marca" : true),
          ).length;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setFiltro(id)}
              aria-pressed={filtro === id}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                filtro === id ? "bg-marca text-white" : "text-suave hover:bg-stone-100 hover:text-tinta"
              }`}
            >
              {texto}
              {n > 0 && (
                <span className={`rounded-full px-1.5 text-[10px] ${filtro === id ? "bg-white/25" : "bg-stone-100"}`}>{n}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {falta ? (
          <p className="m-2 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
            Falta ejecutar el SQL <code>0035_notificaciones_admin.sql</code> en Supabase (SQL Editor → New query → pegar → Run).
          </p>
        ) : cargando && !lista.length ? (
          <p className="p-6 text-center text-sm text-suave">Cargando…</p>
        ) : !visibles.length ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
              <Icono nombre="campana" className="h-6 w-6" />
            </span>
            <p className="text-sm font-semibold">Nada por aquí todavía</p>
            <p className="text-xs text-suave">
              Te avisaremos cuando un restaurante edite su carta, cambie su diseño o pida otro plan o Loyalty.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {visibles.map((n) => {
              const info = INFO_TIPO[n.tipo] ?? INFO_TIPO.carta;
              const expandida = abierta === n.id;
              const cambios = Array.isArray(n.cambios) ? n.cambios : [];
              return (
                <li
                  key={n.id}
                  className={`group relative rounded-2xl p-3 transition ${n.leida ? "hover:bg-stone-50" : "bg-amber-50/40 hover:bg-amber-50/70"}`}
                >
                  <div className="flex gap-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${info.tono}`}>
                      <Icono nombre={info.icono} className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="pr-5 text-sm leading-snug">
                        <span className="font-semibold">{n.restaurante || "Un restaurante"}</span> {info.titulo}
                        {n.veces > 1 && (
                          <span className="ml-1 rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold text-suave">
                            ×{n.veces}
                          </span>
                        )}
                      </p>
                      {n.detalle && <p className="mt-0.5 text-xs text-suave">{n.detalle}</p>}
                      {expandida && cambios.length > 1 && (
                        <ul className="mt-2 space-y-1 border-l-2 border-borde pl-3 text-xs text-suave">
                          {cambios.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                          {n.veces > cambios.length && <li className="italic">y {n.veces - cambios.length} cambios más…</li>}
                        </ul>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                        <span className="text-stone-400" title={new Date(n.actualizado).toLocaleString("es-CL")}>
                          {hace(n.actualizado)}
                        </span>
                        {n.usuario_correo && <span className="max-w-[12rem] truncate text-stone-400">{n.usuario_correo}</span>}
                        {cambios.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setAbierta(expandida ? null : n.id)}
                            className="font-semibold text-marca hover:underline"
                          >
                            {expandida ? "Ocultar" : `Ver ${cambios.length} cambios`}
                          </button>
                        )}
                        {n.slug && (
                          <Link
                            href={`/admin?q=${encodeURIComponent(n.slug)}`}
                            onClick={() => {
                              marcar([n.id]);
                              setAbierto(false);
                            }}
                            className="font-semibold text-marca hover:underline"
                          >
                            Ver restaurante
                          </Link>
                        )}
                        {n.slug && (n.tipo === "carta" || n.tipo === "marca") && (
                          <a
                            href={`/${n.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => marcar([n.id])}
                            className="font-semibold text-marca hover:underline"
                          >
                            Ver carta
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  {!n.leida && (
                    <button
                      type="button"
                      onClick={() => marcar([n.id])}
                      title="Marcar como leída"
                      aria-label="Marcar como leída"
                      className="absolute right-3 top-3.5 flex h-4 w-4 items-center justify-center"
                    >
                      <span className="h-2.5 w-2.5 rounded-full bg-marca-claro ring-4 ring-marca-claro/20" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {hayLeidas && !falta && (
        <div className="border-t border-borde px-4 py-2 text-right">
          <button type="button" onClick={borrarLeidas} className="text-xs font-medium text-suave hover:text-red-600">
            Borrar las leídas
          </button>
        </div>
      )}
    </div>
  );
}
