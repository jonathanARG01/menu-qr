import { NextResponse } from "next/server";
import { enlaceGuardar, googleWalletActivo } from "@/lib/sellos/google";
import { datosWallet, leerTarjeta, sitioDe } from "@/lib/sellos/servidor";
import { limpiarCodigo } from "@/lib/sellos/tipos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// "Guardar en Google Wallet": arma el pase firmado de la tarjeta y lleva a Google para guardarlo.
export async function GET(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const codigo = limpiarCodigo((await params).codigo);
  const sitio = sitioDe(request);
  if (!googleWalletActivo()) return NextResponse.redirect(`${sitio}/s/${codigo}?wallet=no`);
  const t = await leerTarjeta(codigo);
  if (!t) return NextResponse.redirect(`${sitio}/s/${codigo}`);
  return NextResponse.redirect(enlaceGuardar(datosWallet(t, sitio)));
}
