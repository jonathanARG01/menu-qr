"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Seccion } from "@/lib/salon";

// Avisos del menú lateral: cuántas cosas nuevas llegaron a cada sección desde la última vez que se entró a ella.
// "Visto" se guarda en este equipo, por persona y restaurante, con la hora del servidor de lo último que se vio
// (así un reloj del teléfono adelantado o atrasado no esconde ni repite avisos). Usa el tiempo real que ya existe
// para pedidos, cuentas y reservas: no necesita SQL.

export type SeccionAviso = Extract<Seccion, "salon" | "llevar" | "cocina" | "reservas">;
export type AvisosMenu = Partial<Record<SeccionAviso, number>>;

const SECCIONES_AVISO: SeccionAviso[] = ["salon", "llevar", "cocina", "reservas"];
const RUTA: Record<SeccionAviso, string> = {
  salon: "/panel/salon",
  llevar: "/panel/llevar",
  cocina: "/panel/cocina",
  reservas: "/panel/reservas",
};
// Solo se mira lo del último día: lo anterior ya no es "nuevo".
const VENTANA_MS = 24 * 60 * 60 * 1000;

type FilaPedido = {
  id: string;
  sucursal_id: string | null;
  origen: string;
  estado: string;
  tipo?: string | null;
  creado_por?: string | null;
  created_at: string;
  actualizado_at: string;
};
type FilaCuenta = { id: string; sucursal_id: string | null; mesa_id: string | null; aviso: { at?: string } | null };
type FilaReserva = { id: string; sucursal_id: string | null; created_at: string };

// Cada evento: a qué sección va y la hora (del servidor) en que pasó.
type Evento = { seccion: SeccionAviso; at: string };

function leerVistos(clave: string): Partial<Record<SeccionAviso, string>> {
  try {
    return JSON.parse(localStorage.getItem(clave) ?? "{}") ?? {};
  } catch {
    return {};
  }
}
function guardarVistos(clave: string, v: Partial<Record<SeccionAviso, string>>) {
  try {
    localStorage.setItem(clave, JSON.stringify(v));
  } catch {}
}

const mayor = (a: string | undefined, b: string | undefined) =>
  !a ? b : !b ? a : new Date(a).getTime() >= new Date(b).getTime() ? a : b;

export function useAvisosMenu({
  restauranteId,
  usuarioId,
  secciones,
  ruta,
  localFijo,
}: {
  restauranteId: string;
  usuarioId: string;
  secciones: Seccion[];
  ruta: string;
  // undefined = todos los locales; null = el principal; texto = id de la sucursal.
  localFijo?: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const clave = `panel-vistos:${restauranteId}:${usuarioId}`;
  const activas = useMemo(
    () => SECCIONES_AVISO.filter((s) => secciones.includes(s)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [secciones.join(",")],
  );
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [avisos, setAvisos] = useState<AvisosMenu>({});
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  const actual = activas.find((s) => ruta === RUTA[s] || ruta.startsWith(`${RUTA[s]}/`));

  const cargar = useCallback(async () => {
    if (activas.length === 0) return;
    const desde = new Date(Date.now() - VENTANA_MS).toISOString();
    const quiere = (s: SeccionAviso) => activas.includes(s);
    const [pedidos, cuentas, reservas] = await Promise.all([
      quiere("salon") || quiere("llevar") || quiere("cocina")
        ? supabase
            .from("pedidos")
            .select("id, sucursal_id, origen, estado, tipo, creado_por, created_at, actualizado_at")
            .eq("restaurante_id", restauranteId)
            .gte("actualizado_at", desde)
            .limit(500)
        : Promise.resolve({ data: [] as FilaPedido[] }),
      quiere("salon")
        ? supabase
            .from("cuentas")
            .select("id, sucursal_id, mesa_id, aviso")
            .eq("restaurante_id", restauranteId)
            .eq("estado", "abierta")
            .not("aviso", "is", null)
        : Promise.resolve({ data: [] as FilaCuenta[] }),
      quiere("reservas")
        ? supabase
            .from("reservas")
            .select("id, sucursal_id, created_at")
            .eq("restaurante_id", restauranteId)
            .gte("created_at", desde)
            .limit(500)
        : Promise.resolve({ data: [] as FilaReserva[] }),
    ]);
    const delLocal = (s: string | null) => localFijo === undefined || (s ?? null) === localFijo;
    const lista: Evento[] = [];
    for (const p of (pedidos.data ?? []) as FilaPedido[]) {
      if (!delLocal(p.sucursal_id) || p.estado === "cancelado") continue;
      // Lo que cargó uno mismo no es un aviso para uno mismo.
      const mio = !!usuarioId && p.creado_por === usuarioId;
      const tipo = p.tipo ?? "mesa";
      if (tipo === "mesa" && p.origen === "cliente" && !mio) lista.push({ seccion: "salon", at: p.created_at });
      if (tipo !== "mesa" && !mio) lista.push({ seccion: "llevar", at: p.created_at });
      // Cocina: comandas que llegaron (o que el mesero marchó después) y aún nadie empezó.
      if (p.estado === "nuevo") lista.push({ seccion: "cocina", at: p.actualizado_at });
    }
    for (const c of (cuentas.data ?? []) as FilaCuenta[]) {
      // Llama al mesero, pide la cuenta o pagó online desde la mesa.
      if (c.mesa_id && c.aviso?.at && delLocal(c.sucursal_id)) lista.push({ seccion: "salon", at: c.aviso.at });
    }
    for (const r of (reservas.data ?? []) as FilaReserva[]) {
      if (delLocal(r.sucursal_id)) lista.push({ seccion: "reservas", at: r.created_at });
    }
    setEventos(lista.filter((e) => activas.includes(e.seccion)));
  }, [supabase, restauranteId, usuarioId, activas, localFijo]);

  // Cuenta lo nuevo de cada sección. La sección abierta queda vista; la primera vez, todo lo que ya había también.
  useEffect(() => {
    if (!eventos) return;
    const vistos = leerVistos(clave);
    const ultimo: Partial<Record<SeccionAviso, string>> = {};
    for (const e of eventos) ultimo[e.seccion] = mayor(ultimo[e.seccion], e.at);
    let cambio = false;
    for (const s of activas) {
      if (vistos[s] === undefined || s === actual) {
        const nuevo = mayor(vistos[s], ultimo[s]) ?? new Date(Date.now() - VENTANA_MS).toISOString();
        if (nuevo !== vistos[s]) {
          vistos[s] = nuevo;
          cambio = true;
        }
      }
    }
    if (cambio) guardarVistos(clave, vistos);
    const cuenta: AvisosMenu = {};
    for (const e of eventos) {
      const visto = vistos[e.seccion];
      if (e.seccion !== actual && (!visto || new Date(e.at).getTime() > new Date(visto).getTime())) {
        cuenta[e.seccion] = (cuenta[e.seccion] ?? 0) + 1;
      }
    }
    setAvisos(cuenta);
  }, [eventos, actual, activas, clave]);

  // Otra pestaña del mismo equipo entró a una sección: se borra también aquí.
  useEffect(() => {
    const alCambiar = (e: StorageEvent) => e.key === clave && setEventos((x) => (x ? [...x] : x));
    window.addEventListener("storage", alCambiar);
    return () => window.removeEventListener("storage", alCambiar);
  }, [clave]);

  const programar = useCallback(() => {
    if (espera.current) clearTimeout(espera.current);
    espera.current = setTimeout(cargar, 400);
  }, [cargar]);

  useEffect(() => {
    if (activas.length === 0) return;
    const filtro = `restaurante_id=eq.${restauranteId}`;
    let canal: ReturnType<typeof supabase.channel> | null = null;
    let cerrado = false;
    (async () => {
      // Con la sesión del usuario: como anónimo el canal "conecta" pero no recibe nada (ver useServicio).
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) await supabase.realtime.setAuth(data.session.access_token);
      if (cerrado) return;
      canal = supabase.channel(`menu-avisos-${restauranteId}`);
      if (activas.some((s) => s !== "reservas"))
        canal = canal.on("postgres_changes", { event: "*", schema: "public", table: "pedidos", filter: filtro }, programar);
      if (activas.includes("salon"))
        canal = canal.on("postgres_changes", { event: "*", schema: "public", table: "cuentas", filter: filtro }, programar);
      if (activas.includes("reservas"))
        canal = canal.on("postgres_changes", { event: "*", schema: "public", table: "reservas", filter: filtro }, programar);
      canal.subscribe((estado) => estado === "SUBSCRIBED" && programar());
    })();
    // Respaldo por si el tiempo real se corta: cada 30 segundos mientras el panel está a la vista.
    const intervalo = setInterval(() => document.visibilityState === "visible" && cargar(), 30000);
    const alVolver = () => document.visibilityState === "visible" && cargar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      cerrado = true;
      if (canal) supabase.removeChannel(canal);
      if (espera.current) clearTimeout(espera.current);
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [supabase, restauranteId, activas, programar, cargar]);

  return avisos;
}

// "9+" para no ensanchar el menú.
export const textoAviso = (n: number) => (n > 9 ? "9+" : String(n));
