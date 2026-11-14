import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { clientePublico } from "@/lib/servidor";
import { PROGRAMA_BASE, limpiarCodigo, type ProgramaSellos } from "@/lib/tipos";
import { Unirse, type DatosUnirse } from "./Unirse";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ sello?: string }> };

async function leer(slug: string): Promise<DatosUnirse | null> {
  const { data } = await clientePublico().rpc("negocio_publico", { p_slug: slug });
  if (!data) return null;
  const d = data as Omit<DatosUnirse, "programa"> & { programa: ProgramaSellos };
  return { ...d, programa: { ...PROGRAMA_BASE, ...d.programa } };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await leer((await params).slug);
  return {
    title: d ? `Tarjeta de sellos · ${d.negocio.nombre}` : "Tarjeta de sellos",
    robots: { index: false },
  };
}

// Página a la que lleva el QR "Únete" del cartel y el QR de un solo uso del equipo (?sello=CODIGO).
export default async function PaginaUnirse({ params, searchParams }: Props) {
  const [{ slug }, { sello }] = await Promise.all([params, searchParams]);
  const datos = await leer(slug);
  if (!datos) notFound();
  return <Unirse datos={datos} sello={sello ? limpiarCodigo(sello) : null} />;
}
