import { cargarPanelDueno } from "@/lib/panel";
import { Configurar } from "@/components/panel/Configurar";

export const metadata = { title: "Tu tarjeta" };

export default async function PaginaTarjeta() {
  const { supabase, negocio, programa, incluye } = await cargarPanelDueno();
  const { data: cupones } = await supabase.from("cupones").select("id, titulo").eq("negocio_id", negocio.id).eq("activo", true);
  const puede = {
    puntos: incluye("puntos"),
    premios: incluye("premios"),
    niveles: incluye("niveles"),
    referidos: incluye("referidos"),
    cupones: incluye("cupones"),
  };
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Tu tarjeta</h1>
        <p className="text-sm text-suave">Sellos o puntos, el premio, el diseño y los detalles para que vuelvan.</p>
      </div>
      <Configurar negocio={negocio} programa={programa} puede={puede} cupones={cupones ?? []} />
    </div>
  );
}
