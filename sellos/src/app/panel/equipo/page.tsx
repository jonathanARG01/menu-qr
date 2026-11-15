import { cargarPanelDueno } from "@/lib/panel";
import { Equipo } from "@/components/panel/Equipo";

export const metadata = { title: "Equipo" };

export default async function PaginaEquipo() {
  const { supabase, negocio, usuario, sucursales } = await cargarPanelDueno();
  const [{ data: miembros }, { data: invitaciones }] = await Promise.all([
    supabase.from("miembros").select("user_id, rol, nombre, created_at, sucursal_id").eq("negocio_id", negocio.id).order("created_at"),
    supabase
      .from("invitaciones")
      .select("codigo, rol, nombre, expira_at, usada_at")
      .eq("negocio_id", negocio.id)
      .is("usada_at", null)
      .gt("expira_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);
  return <Equipo negocio={negocio} yo={usuario.id} miembros={miembros ?? []} invitaciones={invitaciones ?? []} sucursales={sucursales} />;
}
