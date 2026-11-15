"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cuenta, Pedido } from "@/lib/salon";
import { minutosDesde } from "@/lib/useServicio";

// Indicadores que se pueden prender o apagar desde el salón (botón "Indicadores"). Se guardan en cada dispositivo:
// la pantalla del salón puede llevar el mapa de calor y el teléfono del mesero solo sus mesas y los relojes.
export type PrefIndicadores = {
  // 1. Reloj sobre la mesa: ámbar o rojo si lleva rato sin pedir, sin pedir nada más o esperando la cuenta.
  tiempo: boolean;
  // 2. La mesa parpadea si un pedido lleva más de `atraso` minutos en cocina sin estar listo.
  atrasados: boolean;
  // 3. Total consumido en cada mesa y del salón (en mesas abiertas y cobrado en el turno).
  totales: boolean;
  // 4. Color de cada mesero en sus mesas; "resaltar" apaga las demás.
  zonas: boolean;
  // 6. Después de cobrar, la mesa queda "por limpiar" hasta que alguien la marca lista.
  limpiar: boolean;
  // 8. Mapa de calor: qué mesas venden más o rotan más.
  calor: boolean;
  // Minutos (null: los de "Alertas de cocina" en Personalizar).
  atraso: number | null;
  sinPedir: number;
  sinMas: number;
  espera: number;
  // Zonas: "todas", "mias" o el id de un mesero.
  resaltar: string;
  // Mapa de calor: qué se mide y cuántos días hacia atrás.
  calorMide: "ventas" | "rotacion";
  calorDias: 7 | 30 | 90;
};

export const PREF_INDICADORES: PrefIndicadores = {
  tiempo: true,
  atrasados: true,
  totales: true,
  zonas: false,
  limpiar: false,
  calor: false,
  atraso: null,
  sinPedir: 5,
  sinMas: 20,
  espera: 3,
  resaltar: "todas",
  calorMide: "ventas",
  calorDias: 30,
};

const CLAVE = "salon:indicadores";

export function leerPrefIndicadores(): PrefIndicadores {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) ?? "null") as Partial<PrefIndicadores> | null;
    return { ...PREF_INDICADORES, ...(g ?? {}) };
  } catch {
    return PREF_INDICADORES;
  }
}

export function guardarPrefIndicadores(p: PrefIndicadores) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(p));
  } catch {
    // Sin almacenamiento (modo privado): dura hasta recargar.
  }
}

// corto: lo que cabe sobre la mesa en el plano ("pedir", "postre?", "cuenta", "mesero").
// Minutos para mostrar corto: "45′", "5 h 25′", "11 d 21 h".
export function duracion(min: number) {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m}′`;
  if (m < 1440) return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}′` : ""}`;
  const h = Math.floor((m % 1440) / 60);
  return `${Math.floor(m / 1440)} d${h ? ` ${h} h` : ""}`;
}

export type Reloj = {
  nivel: "ambar" | "rojo";
  min: number;
  motivo: "sin_pedir" | "sin_mas" | "espera";
  texto: string;
  corto: string;
};

export const COLOR_RELOJ = { ambar: "#f59e0b", rojo: "#dc2626" } as const;

// ¿La mesa necesita que alguien pase? Rojo al doble del tiempo del ámbar.
export function relojDe(
  cuenta: Cuenta,
  suyos: Pedido[],
  ahora: number,
  pref: Pick<PrefIndicadores, "sinPedir" | "sinMas" | "espera">,
): Reloj | undefined {
  const nivel = (min: number, base: number) => (min >= base * 2 ? "rojo" : min >= base ? "ambar" : null);
  // Pidió la cuenta o llamó al mesero y nadie ha ido.
  if (cuenta.aviso && cuenta.aviso.tipo !== "pago") {
    const min = minutosDesde(cuenta.aviso.at, ahora);
    const n = nivel(min, pref.espera);
    if (n)
      return {
        nivel: n,
        min,
        motivo: "espera",
        corto: cuenta.aviso.tipo === "cuenta" ? "cuenta" : "mesero",
        texto: cuenta.aviso.tipo === "cuenta" ? `Espera la cuenta · ${duracion(min)}` : `Espera al mesero · ${duracion(min)}`,
      };
  }
  const vivos = suyos.filter((p) => p.estado !== "cancelado");
  // Se sentaron y todavía no piden nada.
  if (!vivos.length) {
    const min = minutosDesde(cuenta.abierta_at, ahora);
    const n = nivel(min, pref.sinPedir);
    return n ? { nivel: n, min, motivo: "sin_pedir", corto: "pedir", texto: `Sin pedir · ${duracion(min)}` } : undefined;
  }
  // Ya se les sirvió todo y no han pedido nada más (postre, café, otra ronda).
  if (vivos.every((p) => p.estado === "entregado")) {
    const ultimo = vivos.reduce((t, p) => (p.actualizado_at > t ? p.actualizado_at : t), vivos[0].actualizado_at);
    const min = minutosDesde(ultimo, ahora);
    const n = nivel(min, pref.sinMas);
    return n ? { nivel: n, min, motivo: "sin_mas", corto: "postre?", texto: `Sin pedir más · ${duracion(min)}` } : undefined;
  }
  return undefined;
}

// Un pedido "en cocina" de hace más de 6 horas no es un atraso: quedó olvidado (cuenta de prueba, sin cerrar).
const OLVIDADO = 6 * 60;

// Minutos del pedido más atrasado en cocina (en preparación o recién llegado), si pasa el límite.
export function atrasoDe(suyos: Pedido[], ahora: number, limite: number) {
  let peor = 0;
  for (const p of suyos) {
    if (p.estado !== "nuevo" && p.estado !== "preparando") continue;
    const min = minutosDesde(p.created_at, ahora);
    if (min >= limite && min < OLVIDADO && min > peor) peor = min;
  }
  return peor || undefined;
}

// Colores para los meseros que no eligieron uno en su perfil.
const PALETA_ZONAS = ["#2563eb", "#db2777", "#16a34a", "#9333ea", "#ea580c", "#0891b2", "#ca8a04", "#4f46e5"];
export const colorZona = (color: string | null | undefined, i: number) => color || PALETA_ZONAS[i % PALETA_ZONAS.length];

// Escala del mapa de calor: azul (poco) → amarillo → rojo (mucho).
export function colorCalor(t: number) {
  const paradas = [
    [59, 130, 246],
    [34, 197, 94],
    [250, 204, 21],
    [249, 115, 22],
    [220, 38, 38],
  ];
  const x = Math.max(0, Math.min(1, t)) * (paradas.length - 1);
  const i = Math.min(paradas.length - 2, Math.floor(x));
  const f = x - i;
  const c = paradas[i].map((v, k) => Math.round(v + (paradas[i + 1][k] - v) * f));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export type DatoCalor = { ventas: number; visitas: number; minutos: number };

// Ventas, visitas y minutos promedio de cada mesa en los últimos días (cuentas cerradas).
// Las mesas unidas se reparten la cuenta en partes iguales.
export function useCalor(supabase: SupabaseClient, restauranteId: string, activo: boolean, dias: number) {
  const [datos, setDatos] = useState<Map<string, DatoCalor> | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    async function cargar() {
      const desde = new Date(Date.now() - dias * 86400000).toISOString();
      const { data, error } = await supabase
        .from("cuentas")
        .select("mesa_id, mesas_unidas, abierta_at, cerrada_at, pagos(monto)")
        .eq("restaurante_id", restauranteId)
        .eq("estado", "cerrada")
        .not("mesa_id", "is", null)
        .gte("cerrada_at", desde)
        .limit(5000);
      if (!vivo) return;
      if (error) {
        setError(true);
        return;
      }
      setError(false);
      const mapa = new Map<string, DatoCalor & { conTiempo: number }>();
      for (const c of (data ?? []) as {
        mesa_id: string;
        mesas_unidas: string[] | null;
        abierta_at: string;
        cerrada_at: string | null;
        pagos: { monto: number }[] | null;
      }[]) {
        const ids = [c.mesa_id, ...(c.mesas_unidas ?? [])];
        const venta = (c.pagos ?? []).reduce((t, p) => t + Number(p.monto), 0) / ids.length;
        const min = c.cerrada_at ? (new Date(c.cerrada_at).getTime() - new Date(c.abierta_at).getTime()) / 60000 : 0;
        for (const id of ids) {
          const d = mapa.get(id) ?? { ventas: 0, visitas: 0, minutos: 0, conTiempo: 0 };
          d.ventas += venta;
          d.visitas += 1;
          // Las que quedaron abiertas días (se olvidaron de cerrarlas) no cuentan para el promedio.
          if (min > 0 && min < 6 * 60) {
            d.minutos += min;
            d.conTiempo += 1;
          }
          mapa.set(id, d);
        }
      }
      setDatos(
        new Map(
          [...mapa].map(([id, d]) => [id, { ventas: d.ventas, visitas: d.visitas, minutos: d.conTiempo ? d.minutos / d.conTiempo : 0 }]),
        ),
      );
    }
    cargar();
    const id = setInterval(cargar, 5 * 60000);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, [supabase, restauranteId, activo, dias]);
  return { datos: activo ? datos : null, error };
}

// Lo cobrado en mesas desde el último cierre de caja completo de este local (o desde las 0:00 si no hay).
export function useCobradoTurno(
  supabase: SupabaseClient,
  restauranteId: string,
  sucursalId: string | null,
  conLocales: boolean,
  activo: boolean,
  cambio: number,
) {
  const [cobrado, setCobrado] = useState<number | null>(null);
  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    (async () => {
      let consulta = supabase
        .from("cierres_caja")
        .select("hasta, tipo, sucursal_id")
        .eq("restaurante_id", restauranteId)
        .order("hasta", { ascending: false })
        .limit(20);
      if (conLocales) consulta = sucursalId ? consulta.eq("sucursal_id", sucursalId) : consulta.is("sucursal_id", null);
      const { data: cierres } = await consulta;
      const ultimo = ((cierres ?? []) as { hasta: string; tipo?: string | null }[]).find((c) => c.tipo !== "parcial");
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const desde = ultimo?.hasta ?? hoy.toISOString();
      const { data, error } = await supabase
        .from("pagos")
        .select("monto, cuentas!inner(tipo, sucursal_id, mesa_id)")
        .eq("restaurante_id", restauranteId)
        .gte("created_at", desde)
        .limit(5000);
      if (!vivo || error) return;
      const total = ((data ?? []) as unknown as {
        monto: number;
        cuentas: { tipo?: string | null; sucursal_id: string | null; mesa_id: string | null } | null;
      }[])
        .filter((p) => p.cuentas?.mesa_id && (!p.cuentas.tipo || p.cuentas.tipo === "mesa"))
        .filter((p) => !conLocales || (p.cuentas?.sucursal_id ?? null) === sucursalId)
        .reduce((t, p) => t + Number(p.monto), 0);
      setCobrado(total);
    })();
    return () => {
      vivo = false;
    };
  }, [supabase, restauranteId, sucursalId, conLocales, activo, cambio]);
  return activo ? cobrado : null;
}

export type PorLimpiar = { cuentaId: string; mesaId: string; mesas: string[]; desde: string };

// Mesas cobradas en las últimas 4 horas que nadie ha marcado como limpias (migración 0040: cuentas.limpia_at).
export function usePorLimpiar(supabase: SupabaseClient, restauranteId: string, activo: boolean, abiertas: Cuenta[]) {
  const [lista, setLista] = useState<PorLimpiar[]>([]);
  const [faltaSql, setFaltaSql] = useState(false);
  // Se vuelve a consultar cuando se abre o se cierra una cuenta, y cada 20 segundos por si otro la marcó.
  const firma = useMemo(
    () =>
      abiertas
        .map((c) => c.id)
        .sort()
        .join(","),
    [abiertas],
  );
  const [pulso, setPulso] = useState(0);
  useEffect(() => {
    if (!activo) return;
    const id = setInterval(() => document.visibilityState === "visible" && setPulso((n) => n + 1), 20000);
    return () => clearInterval(id);
  }, [activo]);
  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    (async () => {
      const desde = new Date(Date.now() - 4 * 3600000).toISOString();
      const { data, error } = await supabase
        .from("cuentas")
        .select("id, mesa_id, mesas_unidas, cerrada_at")
        .eq("restaurante_id", restauranteId)
        .eq("estado", "cerrada")
        .not("mesa_id", "is", null)
        .is("limpia_at", null)
        .gte("cerrada_at", desde)
        .order("cerrada_at", { ascending: false });
      if (!vivo) return;
      if (error) {
        setFaltaSql(/limpia_at/.test(error.message ?? ""));
        setLista([]);
        return;
      }
      setFaltaSql(false);
      setLista(
        ((data ?? []) as { id: string; mesa_id: string; mesas_unidas: string[] | null; cerrada_at: string }[]).map((c) => ({
          cuentaId: c.id,
          mesaId: c.mesa_id,
          mesas: [c.mesa_id, ...(c.mesas_unidas ?? [])],
          desde: c.cerrada_at,
        })),
      );
    })();
    return () => {
      vivo = false;
    };
  }, [supabase, restauranteId, activo, firma, pulso]);

  async function marcarLista(cuentaIds: string[]) {
    setLista((l) => l.filter((x) => !cuentaIds.includes(x.cuentaId)));
    const { error } = await supabase.from("cuentas").update({ limpia_at: new Date().toISOString() }).in("id", cuentaIds);
    if (error) setPulso((n) => n + 1);
    return error;
  }

  return { lista: activo ? lista : [], faltaSql: activo && faltaSql, marcarLista };
}
