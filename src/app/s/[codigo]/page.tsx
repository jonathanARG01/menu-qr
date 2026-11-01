import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { googleWalletActivo } from "@/lib/sellos/google";
import { leerTarjeta } from "@/lib/sellos/servidor";
import { limpiarCodigo } from "@/lib/sellos/tipos";
import { TarjetaCliente } from "./TarjetaCliente";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ codigo: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await leerTarjeta(limpiarCodigo((await params).codigo));
  const titulo = t ? `Mi tarjeta · ${t.restaurante.nombre}` : "Tarjeta de sellos";
  return {
    title: titulo,
    robots: { index: false },
    // Para guardarla en la pantalla de inicio del iPhone (y recibir avisos ahí).
    appleWebApp: { capable: true, title: t?.restaurante.nombre ?? "Mi tarjeta", statusBarStyle: "default" },
  };
}

// La tarjeta del cliente: se abre con el enlace o escaneando su QR.
export default async function PaginaTarjeta({ params }: Props) {
  const codigo = limpiarCodigo((await params).codigo);
  const t = codigo ? await leerTarjeta(codigo) : null;
  if (!t) notFound();
  return <TarjetaCliente inicial={t} googleWallet={googleWalletActivo()} />;
}
