import { requerirSeccion } from "@/lib/panel";
import type { Mesa, Sucursal } from "@/lib/types";
import { GeneradorQR } from "./GeneradorQR";

export default async function PanelQR({ searchParams }: { searchParams: Promise<{ sucursal?: string }> }) {
  const { supabase, restaurante, ajustes } = await requerirSeccion("qr");
  const [{ data: mesas }, { data: sucursales }, { data: pisos }] = await Promise.all([
    supabase.from("mesas").select("*").eq("restaurante_id", restaurante.id),
    // Sin la migración 0003 la tabla no existe y queda vacío.
    supabase.from("sucursales").select("*").eq("restaurante_id", restaurante.id).order("orden").order("created_at"),
    // Para distinguir las mesas con el mismo número en pisos distintos.
    supabase.from("pisos").select("id, nombre").eq("restaurante_id", restaurante.id),
  ]);
  return (
    <GeneradorQR
      restaurante={restaurante}
      mesasIniciales={(mesas ?? []) as Mesa[]}
      sucursales={(sucursales ?? []) as Sucursal[]}
      sucursalInicial={(await searchParams).sucursal}
      reservas={ajustes.modulos.reservas}
      pisos={(pisos ?? []) as { id: string; nombre: string }[]}
    />
  );
}
