import { createClient } from "@/lib/supabase/server";
import { ListaAdmin, type FilaAdmin } from "./ListaAdmin";

export const metadata = { title: "Restaurantes · Administración" };
export const dynamic = "force-dynamic";

// El acceso (solo superadmin) lo controla el layout; la función de la base lo vuelve a comprobar.
export default async function Admin({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const [{ data, error }, complementos] = await Promise.all([
    supabase.rpc("admin_restaurantes"),
    // Sin la migración 0024 no existe: nadie tiene complementos.
    supabase.rpc("admin_complementos"),
  ]);
  const sellos = new Set(
    ((complementos.data ?? []) as { id: string; complementos: { sellos?: { activo?: boolean } } | null }[])
      .filter((c) => c.complementos?.sellos?.activo === true)
      .map((c) => c.id),
  );

  if (error) {
    return (
      <p className="tarjeta p-5 text-sm text-red-700">
        {/prueba_|ejemplos|pausa_motivo|does not exist/.test(error.message)
          ? "Falta ejecutar el SQL 0016_prueba_planes.sql en Supabase."
          : error.message}
      </p>
    );
  }
  const filas = ((data ?? []) as FilaAdmin[]).map((f) => ({ ...f, sellos: sellos.has(f.id) }));
  return <ListaAdmin key={q ?? ""} filas={filas} complementos={!complementos.error} buscar={q ?? ""} />;
}
