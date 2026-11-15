import { cargarPanel } from "@/lib/panel";
import { COLUMNAS_TARJETA, type Cupon, type FilaTarjeta, type Premio } from "@/lib/tipos";
import { Tarjetas } from "@/components/panel/Tarjetas";

export const metadata = { title: "Clientes" };

export default async function PaginaClientes() {
  const { supabase, negocio, programa, dueno, gestor, sucursal, incluye } = await cargarPanel();
  const [{ data }, { data: pide }, { data: catalogo }, { data: cupones }] = await Promise.all([
    supabase
      .from("tarjetas")
      .select(COLUMNAS_TARJETA)
      .eq("negocio_id", negocio.id)
      .order("ultima_at", { ascending: false, nullsFirst: false })
      .limit(5000),
    supabase.rpc("pide_pin", { p_negocio: negocio.id }),
    programa.tipo === "puntos" && incluye("puntos")
      ? supabase.from("premios").select("*").eq("negocio_id", negocio.id).eq("activo", true).order("puntos")
      : Promise.resolve({ data: [] }),
    gestor && incluye("cupones") ? supabase.from("cupones").select("*").eq("negocio_id", negocio.id).eq("activo", true) : Promise.resolve({ data: [] }),
  ]);
  return (
    <Tarjetas
      negocio={negocio}
      programa={programa}
      dueno={dueno}
      pidePin={pide === true}
      iniciales={(data ?? []) as FilaTarjeta[]}
      extras={{ sucursal: sucursal?.id ?? null, gestor, catalogo: (catalogo ?? []) as Premio[], cupones: (cupones ?? []) as Cupon[] }}
    />
  );
}
