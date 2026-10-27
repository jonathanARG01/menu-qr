"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Cuenta, Pago, Pedido } from "@/lib/salon";

export type DatosServicio = { cuentas: Cuenta[]; pedidos: Pedido[]; pagos: Pago[] };

// Mesas abiertas, comandas y pagos del restaurante, siempre al día:
// escucha los cambios en tiempo real y, por si la conexión falla, vuelve a consultar cada 15 segundos.
export function useServicio(restauranteId: string, iniciales: DatosServicio) {
  const supabase = useMemo(() => createClient(), []);
  const [datos, setDatos] = useState(iniciales);
  const [enVivo, setEnVivo] = useState(false);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recargar = useCallback(async () => {
    const desde = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
    const { data: cuentas, error } = await supabase
      .from("cuentas")
      .select("*")
      .eq("restaurante_id", restauranteId)
      .eq("estado", "abierta");
    if (error) return;
    const ids = (cuentas ?? []).map((c) => c.id);
    const [recientes, deMesas, pagos] = await Promise.all([
      supabase
        .from("pedidos")
        .select("*, pedido_items(*)")
        .eq("restaurante_id", restauranteId)
        .gte("created_at", desde)
        .order("created_at"),
      ids.length
        ? supabase.from("pedidos").select("*, pedido_items(*)").in("cuenta_id", ids).order("created_at")
        : Promise.resolve({ data: [] }),
      ids.length ? supabase.from("pagos").select("*").in("cuenta_id", ids).order("created_at") : Promise.resolve({ data: [] }),
    ]);
    const porId = new Map<string, Pedido>();
    for (const p of [...((recientes.data ?? []) as Pedido[]), ...((deMesas.data ?? []) as Pedido[])]) porId.set(p.id, p);
    const pedidos = [...porId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (const p of pedidos) p.pedido_items?.sort((a, b) => a.created_at.localeCompare(b.created_at));
    setDatos({ cuentas: (cuentas ?? []) as Cuenta[], pedidos, pagos: (pagos.data ?? []) as Pago[] });
  }, [supabase, restauranteId]);

  // Varios cambios juntos (una comanda con 5 líneas) se resuelven con una sola consulta.
  const programar = useCallback(() => {
    if (espera.current) clearTimeout(espera.current);
    espera.current = setTimeout(recargar, 250);
  }, [recargar]);

  useEffect(() => {
    const filtro = `restaurante_id=eq.${restauranteId}`;
    const canal = supabase
      .channel(`servicio-${restauranteId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos", filter: filtro }, programar)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedido_items", filter: filtro }, programar)
      .on("postgres_changes", { event: "*", schema: "public", table: "cuentas", filter: filtro }, programar)
      .subscribe((estado) => setEnVivo(estado === "SUBSCRIBED"));

    const intervalo = setInterval(recargar, 15000);
    const alVolver = () => document.visibilityState === "visible" && recargar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      supabase.removeChannel(canal);
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [supabase, restauranteId, programar, recargar]);

  return { ...datos, setDatos, recargar, enVivo, supabase };
}

// Minutos desde una fecha, para los relojes de mesas y comandas (se actualiza cada 30 segundos).
export function useAhora(cada = 30000) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), cada);
    return () => clearInterval(id);
  }, [cada]);
  return ahora;
}

export const minutosDesde = (fecha: string, ahora: number) =>
  Math.max(0, Math.floor((ahora - new Date(fecha).getTime()) / 60000));

export function tiempo(min: number) {
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}
