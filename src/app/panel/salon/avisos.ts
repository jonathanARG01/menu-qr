"use client";

import { useEffect, useRef } from "react";
import type { Cuenta, Pedido } from "@/lib/salon";

// Avisos de las mesas (llama al mesero, pide la cuenta, pagó online, pedido por confirmar o listo). Cada aviso tiene
// una clave propia: si la mesa vuelve a llamar, es un aviso nuevo.
export function clavesAviso(cuentas: Cuenta[], pedidos: Pedido[]) {
  const lista: { clave: string; mesaId: string }[] = [];
  const mesaDe = new Map(cuentas.filter((c) => c.mesa_id).map((c) => [c.id, c.mesa_id!]));
  for (const c of cuentas) if (c.aviso && c.mesa_id) lista.push({ clave: `a:${c.id}:${c.aviso.at}`, mesaId: c.mesa_id });
  for (const p of pedidos) {
    const mesaId = p.cuenta_id && mesaDe.get(p.cuenta_id);
    if (mesaId && (p.estado === "pendiente" || p.estado === "listo")) lista.push({ clave: `p:${p.id}:${p.estado}`, mesaId });
  }
  return lista;
}

// Llama a alNuevo con la mesa del aviso más reciente cada vez que aparece uno (no con los que ya estaban al abrir).
export function useAvisoNuevo(cuentas: Cuenta[], pedidos: Pedido[], alNuevo: (mesaId: string) => void) {
  const vistos = useRef<Set<string> | null>(null);
  const callback = useRef(alNuevo);
  callback.current = alNuevo;
  useEffect(() => {
    const actuales = clavesAviso(cuentas, pedidos);
    if (vistos.current === null) {
      vistos.current = new Set(actuales.map((a) => a.clave));
      return;
    }
    const nuevos = actuales.filter((a) => !vistos.current!.has(a.clave));
    nuevos.forEach((a) => vistos.current!.add(a.clave));
    // Primero los del cliente (cuenta, mesero, pago) y después los de cocina.
    if (nuevos.length) callback.current(nuevos[0].mesaId);
  }, [cuentas, pedidos]);
}

// "Ir al piso del aviso": se recuerda en cada pantalla (encendido salvo que lo apaguen).
export function leerSeguirAvisos() {
  try {
    return localStorage.getItem("salon:seguir") !== "no";
  } catch {
    return true;
  }
}
export function guardarSeguirAvisos(v: boolean) {
  try {
    localStorage.setItem("salon:seguir", v ? "si" : "no");
  } catch {}
}
