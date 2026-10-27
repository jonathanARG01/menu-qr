import { requerirSeccion } from "@/lib/panel";
import type { ClienteResumen } from "../salon/ClienteCuenta";
import { Clientes } from "./Clientes";

export const dynamic = "force-dynamic";

export default async function PanelClientes() {
  const { supabase, restaurante, admin, ajustes } = await requerirSeccion("clientes");
  const { data, error } = await supabase
    .from("clientes_resumen")
    .select("*")
    .eq("restaurante_id", restaurante.id)
    .order("visitas", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(3000);

  if (error) {
    return (
      <div className="tarjeta mx-auto max-w-lg p-6">
        <h1 className="font-semibold">Falta un paso en la base de datos</h1>
        <p className="mt-2 text-sm text-suave">
          Para guardar clientes frecuentes ejecuta el SQL <code>0014_llevar_clientes_recordatorios.sql</code> en Supabase (SQL
          Editor → New query → pegar → Run).
        </p>
      </div>
    );
  }

  return <Clientes restaurante={restaurante} admin={admin} ajustes={ajustes} iniciales={(data ?? []) as ClienteResumen[]} />;
}
