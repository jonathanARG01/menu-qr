import { cargarPanel } from "@/lib/panel";
import { Cobrar } from "@/components/panel/Cobrar";

export const metadata = { title: "Sumar con QR · Sellito" };

export default async function PaginaCobrar() {
  const { negocio, programa } = await cargarPanel();
  return <Cobrar negocio={negocio} programa={programa} />;
}
