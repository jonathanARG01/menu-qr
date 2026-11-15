import { cargarPanelDueno } from "@/lib/panel";
import { Carteles } from "@/components/panel/Carteles";

export const metadata = { title: "QR para unirse · Sellito" };

export default async function PaginaCarteles() {
  const { negocio, programa } = await cargarPanelDueno();
  return <Carteles negocio={negocio} programa={programa} />;
}
