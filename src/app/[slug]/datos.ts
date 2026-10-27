import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/server";
import type { Categoria, Plato, Promo, Restaurante, Sucursal } from "@/lib/types";

export const obtenerCarta = cache(async (slug: string) => {
  const supabase = createPublicClient();
  const { data: restaurante } = await supabase.from("restaurantes").select("*").eq("slug", slug).eq("activo", true).maybeSingle();
  if (!restaurante) return null;

  // RLS ya filtra categorías ocultas y platos agotados; se repite aquí por claridad.
  const [{ data: categorias }, { data: platos }, { data: sucursales }, { data: promos }] = await Promise.all([
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
    // Si aún no se ejecutó la migración 0003 la tabla no existe y queda vacío.
    supabase
      .from("sucursales")
      .select("*")
      .eq("restaurante_id", restaurante.id)
      .eq("activa", true)
      .order("orden")
      .order("created_at"),
    // Promos por horario (migración 0009). La carta decide en el teléfono cuáles están vigentes.
    supabase.from("promos").select("*").eq("restaurante_id", restaurante.id).eq("activa", true).order("orden"),
  ]);

  const lista = (platos ?? []) as Plato[];
  const secciones = ((categorias ?? []) as Categoria[])
    .map((c) => ({ ...c, platos: lista.filter((p) => p.categoria_id === c.id) }))
    .filter((c) => c.platos.length > 0);

  return {
    restaurante: restaurante as Restaurante,
    secciones,
    sucursales: (sucursales ?? []) as Sucursal[],
    promos: (promos ?? []) as Promo[],
  };
});
