"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nombreVisible } from "@/lib/salon";

// Alguien del equipo como lo ve todo el equipo (nombres_equipo): nombre, foto o emoji, color y mesas a cargo.
export type Persona = {
  user_id: string;
  nombre: string;
  rol: string;
  avatar?: string | null;
  color?: string | null;
  mesas?: string[] | null;
};

// Se pide una vez por restaurante y se comparte entre pantallas (plano, ficha de mesa, cocina).
let cache: { restaurante: string; lista: Persona[]; yo: string | null } | null = null;
let enCurso: Promise<void> | null = null;

export function olvidarEquipo() {
  cache = null;
}

export function useEquipo(supabase: SupabaseClient, restauranteId: string, iniciales?: Persona[]) {
  const [datos, setDatos] = useState<{ lista: Persona[]; yo: string | null }>(() =>
    cache?.restaurante === restauranteId ? cache : { lista: iniciales ?? [], yo: null },
  );

  useEffect(() => {
    if (cache?.restaurante === restauranteId) {
      setDatos(cache);
      return;
    }
    let vivo = true;
    enCurso ??= Promise.all([
      supabase.rpc("nombres_equipo", { p_restaurante: restauranteId }),
      supabase.auth.getUser(),
    ]).then(([{ data, error }, { data: sesion }]) => {
      if (!error) cache = { restaurante: restauranteId, lista: (data ?? []) as Persona[], yo: sesion.user?.id ?? null };
      enCurso = null;
    });
    enCurso.then(() => vivo && cache?.restaurante === restauranteId && setDatos(cache));
    return () => {
      vivo = false;
    };
  }, [supabase, restauranteId]);

  const persona = (id?: string | null) => (id ? datos.lista.find((p) => p.user_id === id) : undefined);
  return { equipo: datos.lista, yo: datos.yo, persona };
}

// Nombre para mostrar: el que eligió la persona, o el que sale de su correo.
export const nombrePersona = (p?: Pick<Persona, "nombre"> | null) => (p ? nombreVisible(p.nombre) : "");
