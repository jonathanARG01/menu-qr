import { requerirSeccion } from "@/lib/panel";
import type { Categoria, Plato, Promo } from "@/lib/types";
import { EditorPromos } from "./EditorPromos";

export const dynamic = "force-dynamic";

export default async function PanelPromos() {
  const { supabase, restaurante, ajustes } = await requerirSeccion("promos");
  const [promos, categorias, platos] = await Promise.all([
    supabase.from("promos").select("*").eq("restaurante_id", restaurante.id).order("orden").order("created_at"),
    supabase.from("categorias").select("*").eq("restaurante_id", restaurante.id).order("orden"),
    supabase.from("platos").select("id, nombre, categoria_id, precio").eq("restaurante_id", restaurante.id).order("orden"),
  ]);

  if (promos.error) {
    return (
      <div className="tarjeta mx-auto max-w-lg p-6">
        <h1 className="font-semibold">Falta un paso en la base de datos</h1>
        <p className="mt-2 text-sm text-suave">
          Para crear promos ejecuta el SQL <code>0009_caja_reservas_cobro_online.sql</code> en Supabase.
        </p>
      </div>
    );
  }

  return (
    <EditorPromos
      restaurante={restaurante}
      zona={ajustes.zona_horaria}
      iniciales={(promos.data ?? []) as Promo[]}
      categorias={(categorias.data ?? []) as Categoria[]}
      platos={(platos.data ?? []) as Pick<Plato, "id" | "nombre" | "categoria_id" | "precio">[]}
    />
  );
}
