import { requerirRestaurante } from "@/lib/panel";
import type { Categoria, Plato, Seccion } from "@/lib/types";
import { FormMarca } from "./FormMarca";

export default async function PanelMarca() {
  const { supabase, restaurante } = await requerirRestaurante();

  // La vista previa muestra la carta real del restaurante, tal como la ve el cliente.
  const [{ data: categorias }, { data: platos }] = await Promise.all([
    supabase.from("categorias").select("*").eq("restaurante_id", restaurante.id).eq("visible", true).order("orden"),
    supabase.from("platos").select("*").eq("restaurante_id", restaurante.id).eq("disponible", true).order("orden"),
  ]);
  const secciones: Seccion[] = ((categorias ?? []) as Categoria[])
    .map((c) => ({ ...c, platos: ((platos ?? []) as Plato[]).filter((p) => p.categoria_id === c.id) }))
    .filter((c) => c.platos.length > 0);

  return <FormMarca restaurante={restaurante} secciones={secciones} />;
}
