import { requerirSeccion } from "@/lib/panel";
import type { Cuenta, Pago, Pedido, Piso } from "@/lib/salon";
import type { Categoria, Mesa, Plato, Sucursal } from "@/lib/types";
import { Salon } from "./Salon";

export const dynamic = "force-dynamic";

export default async function PanelSalon() {
  const { supabase, restaurante, admin, ajustes } = await requerirSeccion("salon");
  const rid = restaurante.id;

  const [pisos, mesas, sucursales, cuentas, categorias, platos] = await Promise.all([
    supabase.from("pisos").select("*").eq("restaurante_id", rid).order("orden").order("created_at"),
    supabase.from("mesas").select("*").eq("restaurante_id", rid),
    supabase.from("sucursales").select("*").eq("restaurante_id", rid).order("orden").order("created_at"),
    supabase.from("cuentas").select("*").eq("restaurante_id", rid).eq("estado", "abierta"),
    supabase.from("categorias").select("*").eq("restaurante_id", rid).order("orden").order("created_at"),
    supabase.from("platos").select("*").eq("restaurante_id", rid).order("orden").order("created_at"),
  ]);

  if (pisos.error || cuentas.error) {
    return (
      <div className="tarjeta mx-auto max-w-lg p-6">
        <h1 className="font-semibold">Falta un paso en la base de datos</h1>
        <p className="mt-2 text-sm text-suave">
          Para usar el salón ejecuta el SQL <code>0004_salon.sql</code> en Supabase (SQL Editor → New query → pegar → Run).
        </p>
      </div>
    );
  }

  const ids = (cuentas.data ?? []).map((c) => c.id);
  const desde = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
  const [pedidos, pagos] = await Promise.all([
    ids.length
      ? supabase.from("pedidos").select("*, pedido_items(*)").in("cuenta_id", ids).order("created_at")
      : supabase.from("pedidos").select("*, pedido_items(*)").eq("restaurante_id", rid).gte("created_at", desde),
    ids.length ? supabase.from("pagos").select("*").in("cuenta_id", ids).order("created_at") : Promise.resolve({ data: [] }),
  ]);

  return (
    <Salon
      restaurante={restaurante}
      admin={admin}
      ajustes={ajustes}
      pisosIniciales={(pisos.data ?? []) as Piso[]}
      mesasIniciales={(mesas.data ?? []) as Mesa[]}
      sucursales={(sucursales.data ?? []) as Sucursal[]}
      categorias={(categorias.data ?? []) as Categoria[]}
      platos={(platos.data ?? []) as Plato[]}
      servicio={{
        cuentas: (cuentas.data ?? []) as Cuenta[],
        pedidos: (pedidos.data ?? []) as Pedido[],
        pagos: (pagos.data ?? []) as Pago[],
      }}
    />
  );
}
