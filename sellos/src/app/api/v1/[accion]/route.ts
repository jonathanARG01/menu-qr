import { NextResponse } from "next/server";
import { HERRAMIENTAS, claveDe, ejecutar, type Herramienta } from "@/lib/api";

export const runtime = "nodejs";

// REST: GET /api/v1/tarjeta?codigo= · GET /api/v1/clientes?segmento= · GET /api/v1/resumen?dias= · POST /api/v1/sellar
const RUTAS: Record<string, { h: Herramienta; metodo: "GET" | "POST" }> = {
  sellar: { h: "sumar_visita", metodo: "POST" },
  tarjeta: { h: "ver_tarjeta", metodo: "GET" },
  clientes: { h: "listar_clientes", metodo: "GET" },
  resumen: { h: "resumen", metodo: "GET" },
};

async function responder(request: Request, accion: string, metodo: "GET" | "POST") {
  const r = RUTAS[accion];
  if (!r || !(r.h in HERRAMIENTAS)) return NextResponse.json({ error: "No existe", rutas: Object.keys(RUTAS) }, { status: 404 });
  if (r.metodo !== metodo) return NextResponse.json({ error: `Usa ${r.metodo}` }, { status: 405 });
  const args =
    metodo === "GET"
      ? Object.fromEntries(new URL(request.url).searchParams)
      : ((await request.json().catch(() => ({}))) as Record<string, unknown>);
  const { datos, error, estado } = await ejecutar(claveDe(request), r.h, args);
  return NextResponse.json(error ? { error } : datos, { status: estado });
}

export async function GET(request: Request, { params }: { params: Promise<{ accion: string }> }) {
  return responder(request, (await params).accion, "GET");
}
export async function POST(request: Request, { params }: { params: Promise<{ accion: string }> }) {
  return responder(request, (await params).accion, "POST");
}
