import type { SupabaseClient } from "@supabase/supabase-js";
import type { Ajustes, Modulo, Seccion } from "./salon";
import type { Restaurante } from "./types";
import { paisDe } from "./region";

// Planes de Mesitto: qué incluye cada uno y la prueba de 14 días. La lista de precios del sitio de venta está en
// components/inicio/datos.ts; lo que se habilita en el panel y en la carta sale de aquí.

export type Plan = Restaurante["plan"];
// Planes pagos, de menor a mayor.
export type PlanPago = Exclude<Plan, "free">;

export const NOMBRE_PLAN: Record<Plan, string> = { free: "Prueba", carta: "Carta", pro: "Pro", grupo: "Grupo" };

export const DIAS_PRUEBA = 14;
// Durante la prueba se usa todo lo del plan Pro (sucursales quedan para Grupo).
export const PLAN_DE_PRUEBA: PlanPago = "pro";

const ORDEN: PlanPago[] = ["carta", "pro", "grupo"];

// Plan mínimo de cada módulo. Lo que no figura viene en todos (carta, diseños, idiomas, QR, promos).
const MODULO_PLAN: Record<Modulo, PlanPago> = {
  salon: "pro",
  llevar: "pro",
  cocina: "pro",
  cobros: "pro",
  pedidos_mesa: "pro",
  reservas: "pro",
  clientes: "pro",
  estadisticas: "pro",
  equipo: "pro",
  sucursales: "grupo",
};

// Plan mínimo de cada sección del panel (las que no figuran están en todos).
const SECCION_PLAN: Partial<Record<Seccion, PlanPago>> = {
  salon: "pro",
  llevar: "pro",
  cocina: "pro",
  reservas: "pro",
  caja: "pro",
  estadisticas: "pro",
  reportes: "pro",
  clientes: "pro",
  equipo: "pro",
  sucursales: "grupo",
};

// Los pedidos por WhatsApp desde la carta son del plan Pro.
export const PLAN_PEDIDOS_WHATSAPP: PlanPago = "pro";

// Con qué plan se habilita todo mientras dura la prueba.
export const planEfectivo = (plan: Plan | undefined): PlanPago => (!plan || plan === "free" ? PLAN_DE_PRUEBA : plan);

const alcanza = (plan: Plan | undefined, minimo: PlanPago) => ORDEN.indexOf(planEfectivo(plan)) >= ORDEN.indexOf(minimo);

export const moduloIncluido = (plan: Plan | undefined, m: Modulo) => alcanza(plan, MODULO_PLAN[m]);
export const planDeModulo = (m: Modulo) => MODULO_PLAN[m];

export const seccionIncluida = (plan: Plan | undefined, s: Seccion) => !SECCION_PLAN[s] || alcanza(plan, SECCION_PLAN[s]!);
export const planDeSeccion = (s: Seccion): PlanPago => SECCION_PLAN[s] ?? "carta";

export const pedidosWhatsappIncluido = (plan: Plan | undefined) => alcanza(plan, PLAN_PEDIDOS_WHATSAPP);

// Apaga lo que el plan no incluye. No se guarda: si sube de plan, vuelve todo como lo había dejado.
export function limitarAjustes(ajustes: Ajustes, plan: Plan | undefined): Ajustes {
  const modulos = { ...ajustes.modulos };
  for (const m of Object.keys(modulos) as Modulo[]) modulos[m] = modulos[m] && moduloIncluido(plan, m);
  return {
    ...ajustes,
    modulos,
    cobro_online: { activo: ajustes.cobro_online.activo && modulos.cobros },
    reservas: { ...ajustes.reservas, online: ajustes.reservas.online && modulos.reservas },
    llevar: { ...ajustes.llevar, online: ajustes.llevar.online && modulos.llevar },
  };
}

// Al guardar con el plan limitado: lo que el plan no incluye se guarda como estaba, para no perderlo.
export function conservarBloqueado(editado: Ajustes, guardado: Ajustes, plan: Plan | undefined): Ajustes {
  const modulos = { ...editado.modulos };
  for (const m of Object.keys(modulos) as Modulo[]) if (!moduloIncluido(plan, m)) modulos[m] = guardado.modulos[m];
  return {
    ...editado,
    modulos,
    cobro_online: moduloIncluido(plan, "cobros") ? editado.cobro_online : guardado.cobro_online,
    reservas: {
      ...editado.reservas,
      online: moduloIncluido(plan, "reservas") ? editado.reservas.online : guardado.reservas.online,
    },
    llevar: { ...editado.llevar, online: moduloIncluido(plan, "llevar") ? editado.llevar.online : guardado.llevar.online },
  };
}

// ── Prueba ────────────────────────────────────
const DIA = 86400000;

export type EstadoPrueba = {
  // Días de prueba en total, usados y restantes (los restantes redondean hacia arriba: "queda 1 día" hasta el final).
  total: number;
  usados: number;
  quedan: number;
  vencida: boolean;
  fin: Date;
};

// null: no está en prueba (tiene plan pago) o no vence nunca (demos, o se la dejaste sin vencimiento).
export function estadoPrueba(
  r: Pick<Restaurante, "plan" | "prueba_inicio" | "prueba_fin">,
  ahora = Date.now(),
): EstadoPrueba | null {
  if (r.plan !== "free" || !r.prueba_fin) return null;
  const fin = Date.parse(r.prueba_fin);
  const inicio = r.prueba_inicio ? Date.parse(r.prueba_inicio) : fin - DIAS_PRUEBA * DIA;
  const total = Math.max(1, Math.round((fin - inicio) / DIA));
  const quedan = Math.max(0, Math.ceil((fin - ahora) / DIA));
  return { total, usados: Math.min(total, Math.max(0, total - quedan)), quedan, vencida: fin <= ahora, fin: new Date(fin) };
}

// La carta pública deja de verse al vencer la prueba, aunque el envío diario todavía no la haya pausado.
export const pruebaVencida = (r: Pick<Restaurante, "plan" | "prueba_inicio" | "prueba_fin">) => !!estadoPrueba(r)?.vencida;

// ── Cuenta nueva ──────────────────────────────
// Cuánto vale 1 peso chileno en cada moneda (aprox.), para que los platos de ejemplo tengan precios creíbles.
const FACTOR_EJEMPLO: Record<string, number> = {
  CLP: 1,
  ARS: 1.6,
  BOB: 0.0073,
  BRL: 0.0055,
  COP: 4.3,
  CRC: 0.53,
  USD: 0.001,
  EUR: 0.001,
  GTQ: 0.008,
  MXN: 0.019,
  PYG: 8,
  PEN: 0.004,
  DOP: 0.064,
  UYU: 0.042,
};

export const factorEjemplo = (moneda: string) => FACTOR_EJEMPLO[moneda] ?? 1;

// Después de crear un restaurante: moneda, país y zona del país elegido (se pueden cambiar después) y, si se pide,
// la carta de ejemplo. Diseño Vitrina, imágenes por defecto y la prueba de 14 días los pone la base (0016).
export async function prepararRestaurante(
  supabase: SupabaseClient,
  restauranteId: string,
  codigoPais: string,
  { ejemplo = true }: { ejemplo?: boolean } = {},
) {
  const pais = paisDe(codigoPais);
  const { data } = await supabase.from("restaurantes").select("ajustes").eq("id", restauranteId).maybeSingle();
  await supabase
    .from("restaurantes")
    .update({ moneda: pais.moneda, ajustes: { ...(data?.ajustes ?? {}), pais: pais.codigo, zona_horaria: pais.zona } })
    .eq("id", restauranteId);
  // Sin la migración 0016 la función no existe: el restaurante queda vacío, como antes.
  if (ejemplo) {
    await supabase.rpc("cargar_carta_ejemplo", { p_restaurante: restauranteId, p_factor: factorEjemplo(pais.moneda) });
  }
}

// WhatsApp de ventas de Mesitto (para "quiero contratar"). Se configura en Vercel; sin él, no se muestra el botón.
export const WHATSAPP_VENTAS = (process.env.NEXT_PUBLIC_WHATSAPP_VENTAS || "56941497083").replace(/\D/g, "");

export const enlaceContratar = (restaurante: string, plan?: string) =>
  WHATSAPP_VENTAS
    ? `https://wa.me/${WHATSAPP_VENTAS}?text=${encodeURIComponent(
        `Hola, soy de ${restaurante} y quiero contratar Mesitto${plan ? ` (plan ${plan})` : ""}.`,
      )}`
    : null;

// ── Plan pago ─────────────────────────────────
// Días desde que empezó el plan y en qué parte del período va (mes o año, según cómo paga), para el contador de /admin.
export function periodoPlan(inicio: string, ciclo: "mensual" | "anual" = "mensual", ahora = new Date()) {
  const desde = new Date(`${inicio}T00:00:00`);
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const dias = Math.max(0, Math.round((hoy.getTime() - desde.getTime()) / DIA));
  const paso = ciclo === "anual" ? 12 : 1;
  // Inicio del período actual: se suman meses (o años) mientras no pasen de hoy.
  let n = 0;
  const sumar = (k: number) => new Date(desde.getFullYear(), desde.getMonth() + k * paso, desde.getDate());
  while (sumar(n + 1) <= hoy) n++;
  const actual = sumar(n);
  const proximo = sumar(n + 1);
  const total = Math.round((proximo.getTime() - actual.getTime()) / DIA);
  const transcurridos = Math.round((hoy.getTime() - actual.getTime()) / DIA);
  return { dias, periodos: n, total, transcurridos, quedan: total - transcurridos, proximo, futuro: hoy < desde };
}
