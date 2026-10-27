import { requerirSeccion } from "@/lib/panel";
import { Personalizar } from "./Personalizar";

export default async function PanelPersonalizar() {
  const { restaurante, ajustes } = await requerirSeccion("personalizar");
  if (restaurante.ajustes === undefined) {
    return (
      <p className="tarjeta p-5 text-sm text-suave">
        Para personalizar el panel falta ejecutar el SQL 0004_salon.sql en Supabase.
      </p>
    );
  }
  return <Personalizar restauranteId={restaurante.id} moneda={restaurante.moneda} iniciales={ajustes} />;
}
