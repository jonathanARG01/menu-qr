import { requerirSeccion } from "@/lib/panel";
import { EditorEquipo, type Miembro } from "./EditorEquipo";

export const dynamic = "force-dynamic";

export default async function PanelEquipo() {
  const { supabase, restaurante } = await requerirSeccion("equipo");
  const [{ data, error }, { data: mesas }, { data: pisos }] = await Promise.all([
    supabase.rpc("equipo", { p_restaurante: restaurante.id }),
    // Para asignar mesas a cada mesero.
    supabase.from("mesas").select("id, numero, piso_id").eq("restaurante_id", restaurante.id),
    supabase.from("pisos").select("id, nombre, orden").eq("restaurante_id", restaurante.id).order("orden"),
  ]);
  const listaPisos = (pisos ?? []) as { id: string; nombre: string }[];
  const elegibles = ((mesas ?? []) as { id: string; numero: string; piso_id: string | null }[])
    .map((m) => ({ id: m.id, numero: m.numero, piso: listaPisos.find((p) => p.id === m.piso_id)?.nombre ?? null }))
    .sort(
      (a, b) =>
        listaPisos.findIndex((p) => p.nombre === a.piso) - listaPisos.findIndex((p) => p.nombre === b.piso) ||
        a.numero.localeCompare(b.numero, "es", { numeric: true }),
    );

  if (error) {
    return (
      <p className="tarjeta p-5 text-sm text-suave">
        {error.message.includes("equipo")
          ? "Para sumar meseros y cocina falta ejecutar el SQL 0004_salon.sql en Supabase."
          : error.message}
      </p>
    );
  }
  return <EditorEquipo restauranteId={restaurante.id} iniciales={(data ?? []) as Miembro[]} mesas={elegibles} />;
}
