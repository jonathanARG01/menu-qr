import { requerirRestaurante } from "@/lib/panel";
import { FormMarca } from "./FormMarca";

export default async function PanelMarca() {
  const { restaurante } = await requerirRestaurante();
  return <FormMarca restaurante={restaurante} />;
}
