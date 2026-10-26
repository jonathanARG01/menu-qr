import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/server";
import type { Categoria, Plato, Restaurante } from "@/lib/types";

export const obtenerCarta = cache(async (slug: string) => {
  const supabase = createPublicClient();
  const { data: restaurante } = await supabase.from("restaurantes").select("*").eq("slug", slug).eq("activo", true).maybeSingle();
  if (!restaurante) return null;

  // RLS ya filtra categorías ocultas y platos agotados; se repite aquí por claridad.
  const [{ data: categorias }, { data: platos }] = await Promise.all([
    supabase
      .from("categorias")
      .select("*")
      .eq("restaurante_id", restaurante.id)
      .eq("visible", true)
      .order("orden")
      .order("created_at"),
    supabase
      .from("platos")
      .select("*")
      .eq("restaurante_id", restaurante.id)
      .eq("disponible", true)
      .order("orden")
      .order("created_at"),
  ]);

  const lista = (platos ?? []) as Plato[];
  const secciones = ((categorias ?? []) as Categoria[])
    .map((c) => ({ ...c, platos: lista.filter((p) => p.categoria_id === c.id) }))
    .filter((c) => c.platos.length > 0);

  return { restaurante: restaurante as Restaurante, secciones };
});
