import { cargarPanel } from "@/lib/panel";
import { Cobrar } from "@/components/panel/Cobrar";

export const metadata = { title: "Sumar con QR" };

export default async function PaginaCobrar() {
  const { negocio, programa, sucursal } = await cargarPanel();
  return <Cobrar negocio={negocio} programa={programa} sucursal={sucursal ? { id: sucursal.id, nombre: sucursal.nombre } : null} />;
}
