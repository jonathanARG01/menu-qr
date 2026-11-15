import { NextResponse } from "next/server";
import { HERRAMIENTAS, claveDe, ejecutar, type Herramienta } from "@/lib/api";
import { MARCA } from "@/lib/marca";

export const runtime = "nodejs";

// Servidor MCP (Model Context Protocol, HTTP sin estado) para conectar la tarjeta con Claude, ChatGPT u otra IA.
// Se conecta con la URL https://<dominio>/api/mcp y el encabezado "Authorization: Bearer tds_...".

type Pedido = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

const herramientas = () =>
  (Object.keys(HERRAMIENTAS) as Herramienta[]).map((nombre) => ({
    name: nombre,
    description: HERRAMIENTAS[nombre].descripcion,
    inputSchema: { type: "object", properties: HERRAMIENTAS[nombre].parametros },
    annotations: { readOnlyHint: !HERRAMIENTAS[nombre].escribe },
  }));

async function atender(p: Pedido, clave: string) {
  const ok = (result: unknown) => ({ jsonrpc: "2.0", id: p.id ?? null, result });
  const mal = (code: number, message: string) => ({ jsonrpc: "2.0", id: p.id ?? null, error: { code, message } });
  switch (p.method) {
    case "initialize":
      return ok({
        protocolVersion: String(p.params?.protocolVersion ?? "2025-06-18"),
        capabilities: { tools: {} },
        serverInfo: { name: MARCA, version: "1.0.0" },
        instructions: "Herramientas para la tarjeta de sellos o puntos de un negocio: sumar visitas, ver tarjetas, listar clientes y ver métricas.",
      });
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: herramientas() });
    case "tools/call": {
      const nombre = String(p.params?.name ?? "") as Herramienta;
      if (!(nombre in HERRAMIENTAS)) return mal(-32602, `No existe la herramienta ${nombre}`);
      const r = await ejecutar(clave, nombre, (p.params?.arguments ?? {}) as Record<string, unknown>);
      return ok({
        content: [{ type: "text", text: r.error ? r.error : JSON.stringify(r.datos) }],
        isError: Boolean(r.error),
      });
    }
    default:
      return mal(-32601, `Método no soportado: ${p.method}`);
  }
}

export async function POST(request: Request) {
  const clave = claveDe(request);
  if (!clave)
    return NextResponse.json({ error: "Falta la clave (Authorization: Bearer tds_...)" }, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
  const cuerpo = (await request.json().catch(() => null)) as Pedido | Pedido[] | null;
  if (!cuerpo) return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON no válido" } }, { status: 400 });
  const lista = Array.isArray(cuerpo) ? cuerpo : [cuerpo];
  // Notificaciones (sin id) no llevan respuesta.
  const respuestas = await Promise.all(lista.filter((p) => p.id !== undefined).map((p) => atender(p, clave)));
  if (!respuestas.length) return new NextResponse(null, { status: 202 });
  return NextResponse.json(Array.isArray(cuerpo) ? respuestas : respuestas[0]);
}

export async function GET() {
  return NextResponse.json({ error: "Usa POST (MCP sin estado)" }, { status: 405, headers: { Allow: "POST" } });
}
