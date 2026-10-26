import { requerirRestaurante } from "@/lib/panel";
import type { Categoria, Plato } from "@/lib/types";
import { EditorCarta } from "./EditorCarta";

export default async function PanelCarta() {
  const { supabase, restaurante } = await requerirRestaurante();

  const [{ data: categorias }, { data: platos }] = await Promise.all([
    supabase.from("categorias").select("*").eq("restaurante_id", restaurante.id).order("orden").order("created_at"),
    supabase.from("platos").select("*").eq("restaurante_id", restaurante.id).order("orden").order("created_at"),
  ]);

  return (
    <EditorCarta
      restaurante={restaurante}
      categoriasIniciales={(categorias ?? []) as Categoria[]}
      platosIniciales={(platos ?? []) as Plato[]}
    />
  );
}
