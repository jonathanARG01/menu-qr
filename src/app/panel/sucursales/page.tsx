import { requerirSeccion } from "@/lib/panel";
import type { Sucursal } from "@/lib/types";
import { EditorSucursales } from "./EditorSucursales";

export default async function PanelSucursales() {
  const { supabase, restaurante } = await requerirSeccion("sucursales");
  const { data, error } = await supabase
    .from("sucursales")
    .select("*")
    .eq("restaurante_id", restaurante.id)
    .order("orden")
    .order("created_at");

  if (error) {
    return (
      <p className="tarjeta p-5 text-sm text-suave">
        Para usar sucursales falta ejecutar el SQL 0003_idiomas_pedidos_sucursales.sql en Supabase.
      </p>
    );
  }
  return <EditorSucursales restaurante={restaurante} iniciales={(data ?? []) as Sucursal[]} />;
}
