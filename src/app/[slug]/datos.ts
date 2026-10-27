import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/server";
import type { Categoria, Plato, Promo, Restaurante, Sucursal } from "@/lib/types";
import { leerAjustes } from "@/lib/salon";
import { limitarAjustes, moduloIncluido, pedidosWhatsappIncluido, pruebaVencida } from "@/lib/planes";

export const obtenerCarta = cache(async (slug: string) => {
  const supabase = createPublicClient();
  const { data: guardado } = await supabase.from("restaurantes").select("*").eq("slug", slug).eq("activo", true).maybeSingle();
  // Al vencer la prueba deja de verse al momento, aunque el envío diario todavía no lo haya pausado.
  if (!guardado || pruebaVencida(guardado)) return null;
  // Lo que el plan no incluye (pedidos, reservas, cobro online…) no aparece en la carta.
  const restaurante: Restaurante = {
    ...guardado,
    ajustes: guardado.ajustes == null ? guardado.ajustes : limitarAjustes(leerAjustes(guardado.ajustes), guardado.plan),
    pedidos_whatsapp: Boolean(guardado.pedidos_whatsapp) && pedidosWhatsappIncluido(guardado.plan),
  };

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
    restaurante,
    secciones,
    sucursales: moduloIncluido(restaurante.plan, "sucursales") ? ((sucursales ?? []) as Sucursal[]) : [],
    promos: (promos ?? []) as Promo[],
  };
});

// Restaurante que existe pero no muestra su carta ahora (pausado o con la prueba vencida). Sin la migración 0016: null.
export const obtenerPausada = cache(async (slug: string) => {
  const { data } = await createPublicClient().rpc("carta_pausada", { p_slug: slug });
  const fila = (Array.isArray(data) ? data[0] : null) as {
    nombre: string;
    logo_url: string | null;
    color_primario: string;
  } | null;
  return fila ?? null;
});
