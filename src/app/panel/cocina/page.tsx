import { requerirSeccion } from "@/lib/panel";
import type { Cuenta, Pedido, Piso } from "@/lib/salon";
import type { Mesa } from "@/lib/types";
import { Cocina } from "./Cocina";
import type { PlatoAgotable } from "./Agotados";

export const dynamic = "force-dynamic";

export default async function PanelCocina() {
  const { supabase, restaurante, ajustes } = await requerirSeccion("cocina");
  const desde = new Date(Date.now() - 6 * 3600 * 1000).toISOString();

  const [pedidos, mesas, pisos, platos, categorias, cuentas, equipo] = await Promise.all([
    supabase
      .from("pedidos")
      .select("*, pedido_items(*)")
      .eq("restaurante_id", restaurante.id)
      .gte("created_at", desde)
      .order("created_at"),
    supabase.from("mesas").select("id, numero, piso_id, sucursal_id").eq("restaurante_id", restaurante.id),
    supabase.from("pisos").select("id, nombre").eq("restaurante_id", restaurante.id),
    // Sin la migración 0009 no existe agotado_hasta: se piden solo los platos y no hay agotados.
    supabase.from("platos").select("id, nombre, categoria_id, agotado_hasta").eq("restaurante_id", restaurante.id).order("orden"),
    supabase.from("categorias").select("id, nombre").eq("restaurante_id", restaurante.id).order("orden"),
    // Para la hora de retiro de los pedidos para llevar.
    supabase.from("cuentas").select("*").eq("restaurante_id", restaurante.id).eq("estado", "abierta"),
    // Para poner en la comanda quién la tomó (sin la migración 0014 no hay nombres y no se muestran).
    supabase.rpc("nombres_equipo", { p_restaurante: restaurante.id }),
  ]);
  const listaPlatos = platos.error
    ? ((await supabase.from("platos").select("id, nombre, categoria_id").eq("restaurante_id", restaurante.id).order("orden"))
        .data ?? [])
    : (platos.data ?? []);

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
      cuentasIniciales={(cuentas.data ?? []) as Cuenta[]}
      mesas={(mesas.data ?? []) as Mesa[]}
      pisos={(pisos.data ?? []) as Pick<Piso, "id" | "nombre">[]}
      platos={listaPlatos as PlatoAgotable[]}
      categorias={(categorias.data ?? []) as { id: string; nombre: string }[]}
      equipo={(equipo.data ?? []) as { user_id: string; nombre: string }[]}
    />
  );
}
