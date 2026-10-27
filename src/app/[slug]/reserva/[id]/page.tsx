import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MiReserva } from "@/components/publico/MiReserva";
import { obtenerCarta } from "../../datos";

// Sin caché: muestra el estado actual de la reserva.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string; id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const carta = await obtenerCarta((await params).slug);
  return { title: carta ? `Tu reserva · ${carta.restaurante.nombre}` : "Tu reserva", robots: { index: false } };
}

export default async function Reserva({ params }: Params) {
  const { slug, id } = await params;
  const carta = await obtenerCarta(slug);
  if (!carta || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return <MiReserva restaurante={carta.restaurante} id={id} />;
}
