import { cargarPanelGestor } from "@/lib/panel";
import { Campanas, type FilaCampana } from "@/components/panel/Campanas";

export const metadata = { title: "Campañas" };

export default async function PaginaCampanas() {
  const { supabase, negocio, programa, sucursales, incluye } = await cargarPanelGestor();
  const [{ data: cupones }, { data: historial }] = await Promise.all([
    supabase.from("cupones").select("id, titulo").eq("negocio_id", negocio.id).eq("activo", true),
    supabase.from("campanas").select("*").eq("negocio_id", negocio.id).order("created_at", { ascending: false }).limit(30),
  ]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Campañas</h1>
        <p className="text-sm text-suave">Un mensaje al grupo justo de clientes para que vuelvan.</p>
      </div>
      <Campanas
        negocio={negocio}
        puede={{ campanas: incluye("campanas"), cupones: incluye("cupones") }}
        cupones={cupones ?? []}
        niveles={incluye("niveles") ? programa.niveles : []}
        sucursales={sucursales}
        historial={(historial ?? []) as FilaCampana[]}
      />
    </div>
  );
}
