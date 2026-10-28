"use client";

import { useEffect, useMemo, useState } from "react";
import { leerAjustes } from "@/lib/salon";
import { precioConPromo, promoVigente } from "@/lib/promos";
import { createClient } from "@/lib/supabase/client";
import type { Promo, Restaurante, Seccion } from "@/lib/types";

// La carta se sirve desde caché, pero lo que cambia durante el servicio se mira en vivo:
// los platos que la cocina marcó como agotados y las promos que están en horario.
export function useCartaViva(restaurante: Restaurante, secciones: Seccion[], promos: Promo[], vistaPrevia?: boolean) {
  const [ahora, setAhora] = useState<number | null>(null);
  const [agotados, setAgotados] = useState<Map<string, string> | null>(null);
  const ajustes = leerAjustes(restaurante.ajustes);
  const zona = ajustes.zona_horaria;
  // Sin mesa en el enlace y con pedidos para llevar por internet: se muestran los precios para llevar.
  const llevarOnline = ajustes.modulos.llevar && ajustes.llevar.online;
  const [paraLlevar, setParaLlevar] = useState(false);
  useEffect(() => {
    if (!vistaPrevia && llevarOnline) setParaLlevar(!new URLSearchParams(window.location.search).get("mesa"));
  }, [vistaPrevia, llevarOnline]);

  useEffect(() => {
    setAhora(Date.now());
    const id = setInterval(() => setAhora(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (vistaPrevia) return;
    let vivo = true;
    const consultar = async () => {
      if (document.visibilityState !== "visible") return;
      const { data, error } = await createClient()
        .from("platos")
        .select("id, agotado_hasta")
        .eq("restaurante_id", restaurante.id)
        .gt("agotado_hasta", new Date().toISOString());
      if (vivo && !error) setAgotados(new Map((data ?? []).map((p) => [p.id as string, p.agotado_hasta as string])));
    };
    consultar();
    const id = setInterval(consultar, 60000);
    document.addEventListener("visibilitychange", consultar);
    return () => {
      vivo = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", consultar);
    };
  }, [restaurante.id, vistaPrevia]);

  const vigentes = useMemo(
    () => (ahora === null ? [] : promos.filter((p) => promoVigente(p, zona, new Date(ahora)))),
    [promos, zona, ahora],
  );

  const vivas = useMemo(() => {
    if (!vigentes.length && !agotados?.size && ahora === null && !paraLlevar) return secciones;
    return secciones.map((s) => ({
      ...s,
      platos: s.platos.map((original) => {
        const p =
          paraLlevar && original.precio_llevar != null ? { ...original, precio: Number(original.precio_llevar) } : original;
        const hasta = agotados ? agotados.get(p.id) : p.agotado_hasta;
        const agotado = !!hasta && ahora !== null && Date.parse(hasta) > ahora;
        const precio = precioConPromo(p, vigentes);
        return precio !== Number(p.precio) || agotado || p !== original
          ? { ...p, precio, precio_lista: precio !== Number(p.precio) ? Number(p.precio) : undefined, agotado }
          : p;
      }),
    }));
  }, [secciones, vigentes, agotados, ahora, paraLlevar]);

  return { secciones: vivas, promos: vigentes };
}
