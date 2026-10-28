import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VistaReparto } from "@/components/publico/VistaReparto";
import { obtenerCarta } from "../../datos";

// Sin caché: el repartidor ve el pedido al día y marca la entrega.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string; token: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const carta = await obtenerCarta((await params).slug);
  return { title: carta ? `Reparto · ${carta.restaurante.nombre}` : "Reparto", robots: { index: false } };
}

export default async function Reparto({ params }: Params) {
  const { slug, token } = await params;
  const carta = await obtenerCarta(slug);
  if (!carta || !/^[0-9a-f-]{36}$/i.test(token)) notFound();
  return <VistaReparto restaurante={carta.restaurante} token={token} />;
}
