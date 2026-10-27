import { requerirSeccion } from "@/lib/panel";
import type { Cuenta, Pago, Pedido } from "@/lib/salon";
import type { Categoria, Plato, Sucursal } from "@/lib/types";
import { Llevar } from "./Llevar";

export const dynamic = "force-dynamic";

export default async function PanelLlevar() {
  const { supabase, restaurante, admin, ajustes } = await requerirSeccion("llevar");
  const rid = restaurante.id;

  const [cuentas, categorias, platos, sucursales, prueba] = await Promise.all([
    supabase.from("cuentas").select("*").eq("restaurante_id", rid).eq("estado", "abierta"),
    supabase.from("categorias").select("*").eq("restaurante_id", rid).order("orden").order("created_at"),
    supabase.from("platos").select("*").eq("restaurante_id", rid).order("orden").order("created_at"),
    supabase.from("sucursales").select("*").eq("restaurante_id", rid).order("orden").order("created_at"),
    // Sin la migración 0014 las cuentas no tienen "tipo".
    supabase.from("cuentas").select("tipo").eq("restaurante_id", rid).limit(1),
  ]);
  if (cuentas.error || prueba.error) {
    return (
      <div className="tarjeta mx-auto max-w-lg p-6">
        <h1 className="font-semibold">Falta un paso en la base de datos</h1>
        <p className="mt-2 text-sm text-suave">
          Para usar pedidos para llevar y delivery ejecuta el SQL <code>0014_llevar_clientes_recordatorios.sql</code> en Supabase
          (SQL Editor → New query → pegar → Run).
        </p>
      </div>
    );
  }

  const ids = (cuentas.data ?? []).map((c) => c.id);
  const [pedidos, pagos] = await Promise.all([
    ids.length
      ? supabase.from("pedidos").select("*, pedido_items(*)").in("cuenta_id", ids).order("created_at")
      : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("pagos").select("*").in("cuenta_id", ids).order("created_at") : Promise.resolve({ data: [] }),
  ]);

  return (
    <Llevar
      restaurante={restaurante}
      admin={admin}
      ajustes={ajustes}
      categorias={(categorias.data ?? []) as Categoria[]}
      platos={(platos.data ?? []) as Plato[]}
      sucursales={(sucursales.data ?? []) as Sucursal[]}
      servicio={{
        cuentas: (cuentas.data ?? []) as Cuenta[],
        pedidos: (pedidos.data ?? []) as Pedido[],
        pagos: (pagos.data ?? []) as Pago[],
      }}
    />
  );
}
