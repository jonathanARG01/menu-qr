import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Carta } from "@/components/carta/Carta";
import { obtenerCarta } from "./datos";

// La carta se sirve desde caché y se regenera al guardar en el panel (y cada 5 min por si acaso).
export const revalidate = 300;

// Ninguna carta se genera al compilar: cada una se crea en la primera visita y queda en caché.
export function generateStaticParams() {
  return [];
}

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const carta = await obtenerCarta((await params).slug);
  if (!carta) return { title: "Carta no encontrada" };
  const { restaurante } = carta;
  return {
    title: `${restaurante.nombre} · Carta`,
    description: restaurante.descripcion ?? `Carta de ${restaurante.nombre}`,
    openGraph: { title: restaurante.nombre, images: restaurante.logo_url ? [restaurante.logo_url] : [] },
    icons: restaurante.logo_url ? { icon: restaurante.logo_url, apple: restaurante.logo_url } : undefined,
    // Se puede "Agregar a inicio" como app (en iPhone es lo que habilita los avisos del pedido).
    appleWebApp: { capable: true, title: restaurante.nombre, statusBarStyle: "default" },
  };
}

export default async function CartaPublica({ params }: Params) {
  const carta = await obtenerCarta((await params).slug);
  if (!carta) notFound();
  const { restaurante, secciones, sucursales } = carta;

  return <Carta restaurante={restaurante} secciones={secciones} sucursales={sucursales} />;
}
