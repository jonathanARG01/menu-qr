import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { avisarCliente } from "@/lib/sellos/avisos";
import { leerTarjeta, sitioDe } from "@/lib/sellos/servidor";
import { limpiarCodigo, type TarjetaPublica } from "@/lib/sellos/tipos";

export const runtime = "nodejs";

// Qué decirle al cliente según lo último que pasó en su tarjeta.
function mensajeDe(t: TarjetaPublica) {
  const m = t.movimientos[0];
  const p = t.programa;
  if (!m || !p) return null;
  if (m.tipo === "canje") return { titulo: t.restaurante.nombre, cuerpo: `Canjeaste ${p.premio}. ¡Que lo disfrutes!` };
  if (m.tipo !== "sello") return null;
  const sumados = m.cantidad === 1 ? "un sello" : `${m.cantidad} sellos`;
  if (t.premios > 0 && t.sellos < m.cantidad)
    return {
      titulo: "¡Completaste tu tarjeta! 🎉",
      cuerpo: `Tienes ${p.premio} en ${t.restaurante.nombre}. Muéstrale tu tarjeta al mesero.`,
    };
  const faltan = p.meta - t.sellos;
  const doble = t.dia_doble && (m.origen === "qr" || m.origen === "manual") && m.cantidad >= 2;
  return {
    titulo: doble ? `¡Día de sello doble! Sumaste ${sumados}` : `¡Sumaste ${sumados}!`,
    cuerpo: `Te ${faltan === 1 ? "falta 1 sello" : `faltan ${faltan} sellos`} para ${p.premio} en ${t.restaurante.nombre}.`,
  };
}

// Después de sumar un sello o canjear un premio (desde la tarjeta o el panel), actualiza la tarjeta en Google Wallet
// y avisa al celular del cliente. Solo actúa si el último movimiento es de hace menos de 3 minutos: llamarlo de nuevo
// no sirve para mandar avisos a nadie.
export async function POST(request: Request) {
  const cuerpo = (await request.json().catch(() => ({}))) as { codigo?: string };
  const codigo = limpiarCodigo(cuerpo.codigo ?? "");
  const t = codigo ? await leerTarjeta(codigo) : null;
  const ultimo = t?.movimientos[0];
  if (!t || !ultimo || Date.now() - Date.parse(ultimo.created_at) > 3 * 60000) return NextResponse.json({ enviados: 0 });
  return NextResponse.json(await avisarCliente(createAdminClient(), t, mensajeDe(t), sitioDe(request)));
}
