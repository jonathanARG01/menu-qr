import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { clientePublico } from "@/lib/servidor";
import { PROGRAMA_BASE, limpiarCodigo, type ProgramaSellos } from "@/lib/tipos";
import { Unirse, type DatosUnirse } from "./Unirse";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ sello?: string; ref?: string }> };

async function leer(slug: string): Promise<DatosUnirse | null> {
  const { data } = await clientePublico().rpc("negocio_publico", { p_slug: slug });
  if (!data) return null;
  const d = data as Omit<DatosUnirse, "programa"> & { programa: ProgramaSellos };
  return { ...d, programa: { ...PROGRAMA_BASE, ...d.programa } };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await leer((await params).slug);
  return {
    title: d ? `Tu tarjeta · ${d.negocio.nombre}` : "Tu tarjeta",
    robots: { index: false },
  };
}

// Página a la que lleva el QR "Únete" del cartel y el QR de un solo uso del equipo (?sello=CODIGO).
export default async function PaginaUnirse({ params, searchParams }: Props) {
  const [{ slug }, { sello, ref }] = await Promise.all([params, searchParams]);
  const datos = await leer(slug);
  if (!datos) notFound();
  const codigoRef = ref ? limpiarCodigo(ref) : "";
  const { data: invita } = codigoRef
    ? await clientePublico().rpc("quien_invita", { p_slug: slug, p_codigo: codigoRef })
    : { data: null };
  return (
    <Unirse
      datos={datos}
      sello={sello ? limpiarCodigo(sello) : null}
      referido={invita ? { codigo: codigoRef, nombre: String(invita) } : null}
    />
  );
}
