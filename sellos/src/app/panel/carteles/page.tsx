import { cargarPanelGestor } from "@/lib/panel";
import { Carteles } from "@/components/panel/Carteles";

export const metadata = { title: "QR para unirse" };

export default async function PaginaCarteles() {
  const { negocio, programa } = await cargarPanelGestor();
  return <Carteles negocio={negocio} programa={programa} />;
}
