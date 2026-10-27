import { createClient } from "@/lib/supabase/server";
import { leerNiveles, type Descuento } from "@/lib/referidos";
import { AdminReferidos, type FilaReferidos } from "./AdminReferidos";

export const metadata = { title: "Referidos · Administración" };
export const dynamic = "force-dynamic";

// El acceso (solo superadmin) lo controla el layout; las funciones de la base lo vuelven a comprobar.
export default async function PaginaReferidos() {
  const supabase = await createClient();
  const [filas, config, descuentos] = await Promise.all([
    supabase.rpc("admin_referidos"),
    supabase.from("referidos_config").select("activo, niveles").maybeSingle(),
    supabase.from("descuentos_referido").select("*").order("referidos"),
  ]);
  const error = filas.error ?? config.error;

  if (error) {
    return (
      <p className="tarjeta p-5 text-sm text-red-700">
        {error.message.includes("referidos") ? "Falta ejecutar el SQL 0012_referidos.sql en Supabase." : error.message}
      </p>
    );
  }
  return (
    <AdminReferidos
      filas={(filas.data ?? []) as FilaReferidos[]}
      activo={config.data?.activo ?? true}
      niveles={leerNiveles(config.data?.niveles)}
      descuentos={(descuentos.data ?? []) as Descuento[]}
    />
  );
}
