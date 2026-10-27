import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { leerAjustes } from "@/lib/salon";
import { EsperaCliente } from "@/components/publico/EsperaCliente";
import { obtenerCarta } from "../datos";

// Sin caché: así se abre o se cierra al instante cuando el restaurante cambia sus ajustes.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const carta = await obtenerCarta((await params).slug);
  return { title: carta ? `Lista de espera · ${carta.restaurante.nombre}` : "Lista de espera" };
}

export default async function Espera({ params }: Params) {
  const carta = await obtenerCarta((await params).slug);
  if (!carta) notFound();
  if (!leerAjustes(carta.restaurante.ajustes).modulos.reservas) notFound();
  return <EsperaCliente restaurante={carta.restaurante} sucursales={carta.sucursales} />;
}
