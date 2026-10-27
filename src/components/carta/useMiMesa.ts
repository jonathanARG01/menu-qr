"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EstadoPedido } from "@/lib/salon";

export type LineaMesa = { nombre: string; precio: number; cantidad: number; comensal: number | null };
export type PedidoMesa = { numero: number; estado: EstadoPedido; estacion?: string; items: LineaMesa[] };
export type DatosMesa = {
  mesa: string;
  capacidad: number;
  cuenta: null | { comensales: number; pagado: number; pedidos: PedidoMesa[] };
};

// Estados que se le avisan al comensal: la cocina empezó, terminó, o el mesero lo entregó.
export type EstadoAvisado = "preparando" | "listo" | "entregado";
export type AvisoPedido = { id: number; estado: EstadoAvisado; pedidos: number[]; items: LineaMesa[] };

const RANGO: Record<EstadoPedido, number> = { pendiente: 0, nuevo: 1, preparando: 2, listo: 3, entregado: 4, cancelado: -1 };
const AVISADOS: EstadoAvisado[] = ["preparando", "listo", "entregado"];
const enCurso = (d: DatosMesa | null) => !!d?.cuenta?.pedidos.some((p) => p.estado !== "entregado" && p.estado !== "cancelado");

// La mesa del cliente siempre al día: consulta seguido mientras hay algo en la cocina y más espaciado si no,
// y arma un aviso cada vez que un pedido avanza (no al abrir la carta).
export function useMiMesa({
  restauranteId,
  sucursalId,
  mesa,
  activo,
}: {
  restauranteId: string;
  sucursalId: string | null;
  mesa: string | null;
  activo: boolean;
}) {
  const [datos, setDatos] = useState<DatosMesa | null>(null);
  const [avisos, setAvisos] = useState<AvisoPedido[]>([]);
  const previos = useRef<Map<number, EstadoPedido> | null>(null);
  const ultimo = useRef<DatosMesa | null>(null);
  const siguienteId = useRef(1);
  const ultimaVez = useRef(0);

  const recargar = useCallback(async () => {
    if (!activo || !mesa) return;
    const { data, error } = await createClient().rpc("mi_mesa", {
      p_restaurante: restauranteId,
      p_sucursal: sucursalId,
      p_mesa: mesa,
    });
    if (error) return;
    const d = (data as DatosMesa | null) ?? { mesa, capacidad: 0, cuenta: null };
    ultimo.current = d;
    setDatos(d);

    const pedidos = d.cuenta?.pedidos ?? [];
    const antes = previos.current;
    previos.current = new Map(pedidos.map((p) => [p.numero, p.estado]));
    if (!antes) return;

    // Si en una misma consulta avanzaron varios pedidos al mismo estado, va un solo aviso.
    const nuevos: AvisoPedido[] = [];
    for (const estado of AVISADOS) {
      const cambiaron = pedidos.filter((p) => p.estado === estado && RANGO[estado] > RANGO[antes.get(p.numero) ?? "nuevo"]);
      if (cambiaron.length)
        nuevos.push({
          id: siguienteId.current++,
          estado,
          pedidos: cambiaron.map((p) => p.numero),
          items: cambiaron.flatMap((p) => p.items),
        });
    }
    if (!nuevos.length) return;
    const tocados = new Set(nuevos.flatMap((a) => a.pedidos));
    // Un aviso viejo del mismo pedido ya no sirve (si no vio "en preparación" y ya está listo, solo ve "listo").
    setAvisos((lista) => [
      ...lista.map((a) => ({ ...a, pedidos: a.pedidos.filter((n) => !tocados.has(n)) })).filter((a) => a.pedidos.length),
      ...nuevos,
    ]);
  }, [activo, restauranteId, sucursalId, mesa]);

  // Cada 5 segundos mira si toca consultar: seguido si hay algo en la cocina, cada 30 si no.
  useEffect(() => {
    if (!activo || !mesa) return;
    let ocupado = false;
    const tic = async (forzar = false) => {
      if (ocupado || document.visibilityState !== "visible") return;
      if (!forzar && !enCurso(ultimo.current) && Date.now() - ultimaVez.current < 30000) return;
      ocupado = true;
      ultimaVez.current = Date.now();
      await recargar();
      ocupado = false;
    };
    tic(true);
    const id = setInterval(tic, 5000);
    const alVolver = () => tic(true);
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [activo, mesa, recargar]);

  const descartar = useCallback((id: number) => setAvisos((lista) => lista.filter((a) => a.id !== id)), []);

  return { datos, recargar, avisos, descartar };
}
