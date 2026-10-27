import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { leerAjustes } from "@/lib/salon";
import { ReservarCliente } from "@/components/publico/ReservarCliente";
import { obtenerCarta } from "../datos";

// Sin caché: así se abre o se cierra al instante cuando el restaurante cambia sus ajustes.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const carta = await obtenerCarta((await params).slug);
  return { title: carta ? `Reservar · ${carta.restaurante.nombre}` : "Reservar" };
}

export default async function Reservar({ params }: Params) {
  const carta = await obtenerCarta((await params).slug);
  if (!carta) notFound();
  const ajustes = leerAjustes(carta.restaurante.ajustes);
  if (!ajustes.modulos.reservas || !ajustes.reservas.online) notFound();
  return <ReservarCliente restaurante={carta.restaurante} sucursales={carta.sucursales} />;
}
