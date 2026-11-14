import { NextResponse } from "next/server";
import { enlaceGuardar, googleWalletActivo } from "@/lib/google";
import { datosWallet, leerTarjeta, sitioDe } from "@/lib/servidor";
import { limpiarCodigo } from "@/lib/tipos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// "Guardar en Google Wallet": arma el pase firmado de la tarjeta y lleva a Google para guardarlo.
export async function GET(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const codigo = limpiarCodigo((await params).codigo);
  const sitio = sitioDe(request);
  if (!googleWalletActivo()) return NextResponse.redirect(`${sitio}/t/${codigo}?wallet=no`);
  const t = await leerTarjeta(codigo);
  if (!t) return NextResponse.redirect(`${sitio}/t/${codigo}`);
  return NextResponse.redirect(enlaceGuardar(datosWallet(t, sitio)));
}
