import { cargarPanelGestor } from "@/lib/panel";
import { Premios } from "@/components/panel/Premios";
import type { Cupon, Premio, PromocionFila, Reto } from "@/lib/tipos";

export const metadata = { title: "Premios y cupones" };

export default async function PaginaPremios() {
  const { supabase, negocio, programa, incluye } = await cargarPanelGestor();
  const [{ data: premios }, { data: cupones }, { data: promociones }, { data: retos }] = await Promise.all([
    supabase.from("premios").select("*").eq("negocio_id", negocio.id).order("orden").order("puntos"),
    supabase.from("cupones").select("*").eq("negocio_id", negocio.id).order("created_at", { ascending: false }),
    supabase.from("promociones").select("*").eq("negocio_id", negocio.id).order("desde", { ascending: false }).limit(50),
    supabase.from("retos").select("*").eq("negocio_id", negocio.id).order("visitas"),
  ]);
  return (
    <Premios
      negocio={negocio}
      programa={programa}
      puede={{
        premios: incluye("premios"),
        cupones: incluye("cupones"),
        promociones: incluye("promociones"),
        retos: incluye("retos"),
        puntos: incluye("puntos"),
      }}
      premios={(premios ?? []) as Premio[]}
      cupones={(cupones ?? []) as Cupon[]}
      promociones={(promociones ?? []) as PromocionFila[]}
      retos={(retos ?? []) as Reto[]}
    />
  );
}
