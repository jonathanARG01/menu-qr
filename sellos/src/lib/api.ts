import { clientePublico } from "./servidor";

// API para cajas, sistemas propios e IA (plan Cadena). La clave (tds_...) se crea en el panel → API e IA,
// y la base de datos valida cada llamada (api_negocio): aquí solo se traduce de HTTP a funciones.

export function claveDe(request: Request) {
  const h = request.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(\S+)$/i);
  return m ? m[1] : (request.headers.get("x-api-key") ?? "").trim();
}

const texto = (v: unknown, max = 120) => (v === undefined || v === null || v === "" ? null : String(v).slice(0, max));
const numero = (v: unknown) => (v === undefined || v === null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

export const HERRAMIENTAS = {
  sumar_visita: {
    descripcion:
      "Suma una visita (sellos o puntos según la tarjeta del negocio) a un cliente, buscándolo por código de tarjeta o teléfono. Si no existe y vienen nombre y teléfono, crea su tarjeta. Con 'monto', calcula los sellos o puntos por compra.",
    parametros: {
      codigo: { type: "string", description: "Código de la tarjeta (el de /t/CODIGO)" },
      telefono: { type: "string", description: "Teléfono del cliente" },
      nombre: { type: "string", description: "Nombre (solo para crear la tarjeta si no existe)" },
      monto: { type: "number", description: "Monto de la compra (si la regla es por monto o la tarjeta es de puntos)" },
      sucursal: { type: "string", description: "Id del local (plan Cadena)" },
    },
    rpc: "api_sellar",
    args: (a: Record<string, unknown>) => ({
      p_codigo: texto(a.codigo),
      p_telefono: texto(a.telefono),
      p_nombre: texto(a.nombre, 60),
      p_monto: numero(a.monto),
      p_sucursal: texto(a.sucursal, 40),
    }),
    escribe: true,
  },
  ver_tarjeta: {
    descripcion: "Muestra la tarjeta de un cliente: sellos o puntos, premios por canjear, nivel, cupones y últimos movimientos.",
    parametros: {
      codigo: { type: "string", description: "Código de la tarjeta" },
      telefono: { type: "string", description: "Teléfono del cliente" },
    },
    rpc: "api_tarjeta",
    args: (a: Record<string, unknown>) => ({ p_codigo: texto(a.codigo), p_telefono: texto(a.telefono) }),
    escribe: false,
  },
  listar_clientes: {
    descripcion:
      "Lista clientes del negocio. Segmentos: todos, cerca (cerca del premio), premio (con premio sin canjear), dormidos (no vienen hace 'dias'), nuevos, cumple (cumpleaños este mes), frecuentes, vip, nivel:<nombre>. Se puede buscar por nombre.",
    parametros: {
      segmento: { type: "string", description: "Grupo de clientes (por defecto todos)" },
      dias: { type: "number", description: "Días sin venir para 'dormidos' (por defecto 30)" },
      texto: { type: "string", description: "Buscar por nombre" },
      limite: { type: "number", description: "Máximo de clientes (1 a 500, por defecto 50)" },
    },
    rpc: "api_clientes",
    args: (a: Record<string, unknown>) => ({
      p_segmento: texto(a.segmento, 40) ?? "todos",
      p_dias: numero(a.dias) ?? 30,
      p_texto: texto(a.texto, 60),
      p_limite: numero(a.limite) ?? 50,
    }),
    escribe: false,
  },
  resumen: {
    descripcion:
      "Resumen del programa y métricas del negocio en los últimos 'dias': visitas, clientes nuevos, los que volvieron, premios canjeados, costo de premios, visitas por semana y día, y mejores clientes.",
    parametros: { dias: { type: "number", description: "Período en días (por defecto 30)" } },
    rpc: "api_resumen",
    args: (a: Record<string, unknown>) => ({ p_dias: numero(a.dias) ?? 30 }),
    escribe: false,
  },
} as const;
export type Herramienta = keyof typeof HERRAMIENTAS;

export async function ejecutar(clave: string, h: Herramienta, a: Record<string, unknown>) {
  if (!clave) return { error: "Falta la clave de API (Authorization: Bearer tds_...)", estado: 401 };
  const def = HERRAMIENTAS[h];
  const { data, error } = await clientePublico().rpc(def.rpc, { p_clave: clave, ...def.args(a) });
  if (error) {
    const estado = /no válida/.test(error.message) ? 401 : /plan/.test(error.message) ? 402 : 400;
    return { error: error.message, estado };
  }
  return { datos: data ?? null, estado: 200 };
}
