import { cargarPanelDueno } from "@/lib/panel";
import { DatosNegocio } from "@/components/panel/DatosNegocio";

export const metadata = { title: "Negocio" };

export default async function PaginaNegocio() {
  const { supabase, negocio, usuario } = await cargarPanelDueno();
  const { data: yo } = await supabase
    .from("miembros")
    .select("pin_hash")
    .eq("negocio_id", negocio.id)
    .eq("user_id", usuario.id)
    .maybeSingle();
  return <DatosNegocio negocio={negocio} tienePin={!!yo?.pin_hash} />;
}
