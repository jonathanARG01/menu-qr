import { requerirSeccion } from "@/lib/panel";
import { EditorEquipo, type Miembro } from "./EditorEquipo";

export const dynamic = "force-dynamic";

export default async function PanelEquipo() {
  const { supabase, restaurante } = await requerirSeccion("equipo");
  const { data, error } = await supabase.rpc("equipo", { p_restaurante: restaurante.id });

  if (error) {
    return (
      <p className="tarjeta p-5 text-sm text-suave">
        {error.message.includes("equipo")
          ? "Para sumar meseros y cocina falta ejecutar el SQL 0004_salon.sql en Supabase."
          : error.message}
      </p>
    );
  }
  return <EditorEquipo restauranteId={restaurante.id} iniciales={(data ?? []) as Miembro[]} />;
}
