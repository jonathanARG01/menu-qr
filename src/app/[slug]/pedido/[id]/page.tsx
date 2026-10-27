import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeguimientoPedido } from "@/components/publico/SeguimientoPedido";
import { obtenerCarta } from "../../datos";

// Sin caché: el estado del pedido lo consulta el teléfono cada pocos segundos.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string; id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const carta = await obtenerCarta((await params).slug);
  return { title: carta ? `Tu pedido · ${carta.restaurante.nombre}` : "Tu pedido", robots: { index: false } };
}

export default async function Pedido({ params }: Params) {
  const { slug, id } = await params;
  const carta = await obtenerCarta(slug);
  if (!carta || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return <SeguimientoPedido restaurante={carta.restaurante} id={id} />;
}
