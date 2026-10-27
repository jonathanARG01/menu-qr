import { requerirSeccion } from "@/lib/panel";
import { Reservas } from "./Reservas";

export const dynamic = "force-dynamic";

export default async function PanelReservas() {
  const { restaurante, ajustes } = await requerirSeccion("reservas");
  return <Reservas restaurante={restaurante} ajustes={ajustes} />;
}
