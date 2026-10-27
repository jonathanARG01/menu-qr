import { createClient } from "@/lib/supabase/server";
import { ListaAdmin, type FilaAdmin } from "./ListaAdmin";

export const metadata = { title: "Restaurantes · Administración" };
export const dynamic = "force-dynamic";

// El acceso (solo superadmin) lo controla el layout; la función de la base lo vuelve a comprobar.
export default async function Admin() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_restaurantes");

  if (error) {
    return (
      <p className="tarjeta p-5 text-sm text-red-700">
        {/prueba_|ejemplos|pausa_motivo|does not exist/.test(error.message)
          ? "Falta ejecutar el SQL 0016_prueba_planes.sql en Supabase."
          : error.message}
      </p>
    );
  }
  return <ListaAdmin filas={(data ?? []) as FilaAdmin[]} />;
}
