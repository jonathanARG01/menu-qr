import { cargarPanelDueno } from "@/lib/panel";
import { Integraciones } from "@/components/panel/Integraciones";

export const metadata = { title: "API e IA" };

export default async function PaginaIntegraciones() {
  const { supabase, negocio, sucursales, incluye } = await cargarPanelDueno();
  const { data: claves } = await supabase
    .from("api_claves")
    .select("id, nombre, prefijo, ultimo_uso, created_at")
    .eq("negocio_id", negocio.id)
    .order("created_at");
  return <Integraciones negocio={negocio} claves={claves ?? []} sucursales={sucursales} puede={incluye("api")} />;
}
