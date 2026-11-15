import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { avisarCliente } from "@/lib/avisos";
import { leerTarjeta, sitioDe } from "@/lib/servidor";
import { limpiarCodigo, unidad, type TarjetaPublica } from "@/lib/tipos";

export const runtime = "nodejs";

// Qué decirle al cliente según lo último que pasó en su tarjeta.
function mensajeDe(t: TarjetaPublica) {
  const m = t.movimientos[0];
  const p = t.programa;
  if (!m || !p) return null;
  if (m.tipo === "canje") return { titulo: t.negocio.nombre, cuerpo: `Canjeaste ${m.nota || p.premio}. ¡Que lo disfrutes!` };
  if (m.tipo !== "sello") return null;
  if (m.origen === "reto") return { titulo: "¡Lograste un reto! 🏅", cuerpo: `${m.nota ?? "Reto"} en ${t.negocio.nombre}: ganaste ${m.cantidad} ${unidad(p, m.cantidad)}.` };
  if (p.tipo === "puntos") {
    const proximo = (t.catalogo ?? []).filter((r) => !r.agotado && r.puntos > t.puntos).sort((a, b) => a.puntos - b.puntos)[0];
    const alcanza = (t.catalogo ?? []).filter((r) => !r.agotado && r.puntos <= t.puntos).length;
    return {
      titulo: `¡Sumaste ${m.cantidad.toLocaleString("es-CL")} ${unidad(p, m.cantidad)}!`,
      cuerpo: alcanza
        ? `Tienes ${t.puntos.toLocaleString("es-CL")} ${p.nombre_puntos}: ya puedes canjear premios en ${t.negocio.nombre}.`
        : proximo
          ? `Te faltan ${(proximo.puntos - t.puntos).toLocaleString("es-CL")} para ${proximo.titulo} en ${t.negocio.nombre}.`
          : `Tienes ${t.puntos.toLocaleString("es-CL")} ${p.nombre_puntos} en ${t.negocio.nombre}.`,
    };
  }
  const sumados = m.cantidad === 1 ? "un sello" : `${m.cantidad} sellos`;
  if (t.premios > 0 && t.sellos < m.cantidad)
    return {
      titulo: "¡Completaste tu tarjeta! 🎉",
      cuerpo: `Tienes ${p.premio} en ${t.negocio.nombre}. Muéstrale tu tarjeta al equipo.`,
    };
  const faltan = p.meta - t.sellos;
  const doble = t.dia_doble && (m.origen === "qr" || m.origen === "equipo") && m.cantidad >= 2;
  const hito = (p.hitos ?? []).find((h) => t.sellos >= h.sellos && t.sellos - m.cantidad < h.sellos);
  if (hito) return { titulo: `¡Ganaste ${hito.premio}! 🎀`, cuerpo: `Llegaste a ${hito.sellos} sellos en ${t.negocio.nombre}. Pídelo en tu próxima visita.` };
  return {
    titulo: doble ? `¡Día de sello doble! Sumaste ${sumados}` : `¡Sumaste ${sumados}!`,
    cuerpo: `Te ${faltan === 1 ? "falta 1 sello" : `faltan ${faltan} sellos`} para ${p.premio} en ${t.negocio.nombre}.`,
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
