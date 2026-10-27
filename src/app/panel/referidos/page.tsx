import { requerirSeccion } from "@/lib/panel";
import { leerNiveles, type Descuento, type EstadoReferido } from "@/lib/referidos";
import { Referidos } from "./Referidos";

export const dynamic = "force-dynamic";

export default async function PanelReferidos() {
  const { supabase, restaurante } = await requerirSeccion("referidos");
  const [config, descuentos, referidos] = await Promise.all([
    supabase.from("referidos_config").select("activo, niveles").maybeSingle(),
    supabase.from("descuentos_referido").select("*").eq("restaurante_id", restaurante.id).order("referidos"),
    supabase.rpc("mis_referidos", { p_restaurante: restaurante.id }),
  ]);

  if (config.error || referidos.error) {
    return (
      <p className="tarjeta p-5 text-sm text-suave">
        El programa de referidos todavía no está listo: falta ejecutar el SQL 0012_referidos.sql en Supabase.
      </p>
    );
  }

  return (
    <Referidos
      slug={restaurante.slug}
      nombre={restaurante.nombre}
      ciclo={restaurante.ciclo}
      activo={config.data?.activo ?? false}
      niveles={leerNiveles(config.data?.niveles)}
      descuentos={(descuentos.data ?? []) as Descuento[]}
      referidos={(referidos.data ?? []) as { nombre: string; estado: EstadoReferido; created_at: string }[]}
    />
  );
}
