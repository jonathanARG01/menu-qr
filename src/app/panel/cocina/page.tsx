import { requerirSeccion } from "@/lib/panel";
import type { Pedido, Piso } from "@/lib/salon";
import type { Mesa } from "@/lib/types";
import { Cocina } from "./Cocina";

export const dynamic = "force-dynamic";

export default async function PanelCocina() {
  const { supabase, restaurante, ajustes } = await requerirSeccion("cocina");
  const desde = new Date(Date.now() - 6 * 3600 * 1000).toISOString();

  const [pedidos, mesas, pisos] = await Promise.all([
    supabase
      .from("pedidos")
      .select("*, pedido_items(*)")
      .eq("restaurante_id", restaurante.id)
      .gte("created_at", desde)
      .order("created_at"),
    supabase.from("mesas").select("id, numero, piso_id, sucursal_id").eq("restaurante_id", restaurante.id),
    supabase.from("pisos").select("id, nombre").eq("restaurante_id", restaurante.id),
  ]);

  if (pedidos.error) {
    return (
      <div className="tarjeta mx-auto max-w-lg p-6">
        <h1 className="font-semibold">Falta un paso en la base de datos</h1>
        <p className="mt-2 text-sm text-suave">
          Para usar la pantalla de cocina ejecuta el SQL <code>0004_salon.sql</code> en Supabase.
        </p>
      </div>
    );
  }

  return (
    <Cocina
      restaurante={restaurante}
      ajustes={ajustes}
      pedidosIniciales={(pedidos.data ?? []) as Pedido[]}
      mesas={(mesas.data ?? []) as Mesa[]}
      pisos={(pisos.data ?? []) as Pick<Piso, "id" | "nombre">[]}
    />
  );
}
