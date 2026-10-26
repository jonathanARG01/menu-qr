import { requerirRestaurante } from "@/lib/panel";
import type { Mesa } from "@/lib/types";
import { GeneradorQR } from "./GeneradorQR";

export default async function PanelQR() {
  const { supabase, restaurante } = await requerirRestaurante();
  const { data: mesas } = await supabase.from("mesas").select("*").eq("restaurante_id", restaurante.id);
  return <GeneradorQR restaurante={restaurante} mesasIniciales={(mesas ?? []) as Mesa[]} />;
}
