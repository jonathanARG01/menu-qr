import { cargarPanel } from "@/lib/panel";
import { COLUMNAS_TARJETA, type FilaTarjeta } from "@/lib/tipos";
import { Tarjetas } from "@/components/panel/Tarjetas";

export const metadata = { title: "Clientes · Sellito" };

export default async function PaginaClientes() {
  const { supabase, negocio, programa, dueno } = await cargarPanel();
  const [{ data }, { data: pide }] = await Promise.all([
    supabase
      .from("tarjetas")
      .select(COLUMNAS_TARJETA)
      .eq("negocio_id", negocio.id)
      .order("ultima_at", { ascending: false, nullsFirst: false })
      .limit(5000),
    supabase.rpc("pide_pin", { p_negocio: negocio.id }),
  ]);
  return (
    <Tarjetas
      negocio={negocio}
      programa={programa}
      dueno={dueno}
      pidePin={pide === true}
      iniciales={(data ?? []) as FilaTarjeta[]}
    />
  );
}
