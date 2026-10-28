// Programa de referidos: un restaurante invita a otro con su link y gana descuentos en su suscripción.
// La base de datos (migraciones 0012 y 0017) cuenta los referidos y entrega los descuentos; aquí se leen,
// se muestran y se calcula cuánto cobrar.
//
// Los descuentos temporales se miden en MESES, pague como pague el restaurante:
//   · Mensual: se restan del próximo cobro y gastan 1 mes.
//   · Cada 3, 6 o 12 meses: primero va el descuento del período y después el de referidos, solo sobre los meses
//     que cubre ese cobro (un cobro anual gasta hasta 12 meses de descuento).
//   · Los permanentes se restan de todos los meses.

import { PRECIO_PLAN, cicloDe, type PlanPago } from "./planes";

// periodos = meses con descuento; null = permanente.
export type Nivel = { nombre: string; referidos: number; porcentaje: number; periodos: number | null; prioridad: boolean };

export type ConfigReferidos = { activo: boolean; niveles: Nivel[] };

export type Descuento = {
  id: string;
  restaurante_id: string;
  nombre: string | null;
  referidos: number;
  porcentaje: number;
  periodos: number | null;
  periodos_usados: number;
  prioridad: boolean;
  created_at: string;
};

export type EstadoReferido = "pendiente" | "confirmado" | "anulado";

export const NOMBRE_ESTADO_REFERIDO: Record<EstadoReferido, string> = {
  pendiente: "Todavía en prueba",
  confirmado: "Contrató un plan",
  anulado: "No cuenta",
};

export const NIVELES_BASE: Nivel[] = [
  { nombre: "Bronce", referidos: 1, porcentaje: 10, periodos: 1, prioridad: false },
  { nombre: "Plata", referidos: 5, porcentaje: 15, periodos: 1, prioridad: false },
  { nombre: "Oro", referidos: 10, porcentaje: 20, periodos: null, prioridad: true },
  { nombre: "Diamante", referidos: 50, porcentaje: 100, periodos: 12, prioridad: true },
  { nombre: "Platino", referidos: 100, porcentaje: 100, periodos: null, prioridad: true },
];

// Colores de cada nivel según su nombre; los que inventes después usan el color de la marca.
const MEDALLAS: Record<string, string> = {
  bronce: "bg-orange-100 text-orange-800 ring-orange-300",
  plata: "bg-slate-100 text-slate-700 ring-slate-300",
  oro: "bg-amber-100 text-amber-800 ring-amber-300",
  diamante: "bg-sky-100 text-sky-800 ring-sky-300",
  platino: "bg-violet-100 text-violet-800 ring-violet-300",
};
export const colorNivel = (nombre: string | null | undefined) =>
  MEDALLAS[(nombre ?? "").trim().toLowerCase()] ?? "bg-marca-claro text-marca-tinta ring-marca/30";

// Nombre a mostrar de un nivel o de un descuento ganado (los de antes de la 0017 pueden no tenerlo).
export const nombreNivel = (n: { nombre?: string | null; referidos: number }) =>
  n.nombre?.trim() || `Nivel ${n.referidos}`;

export function leerNiveles(guardado: unknown): Nivel[] {
  if (!Array.isArray(guardado)) return NIVELES_BASE;
  return guardado
    .map((n) => ({
      nombre: String(n?.nombre ?? "").trim(),
      referidos: Number(n?.referidos),
      porcentaje: Number(n?.porcentaje),
      periodos: n?.periodos == null || n?.periodos === "" ? null : Number(n.periodos),
      prioridad: Boolean(n?.prioridad),
    }))
    .filter((n) => n.referidos > 0 && n.porcentaje > 0)
    .sort((a, b) => a.referidos - b.referidos);
}

// Link que comparte cada restaurante: lleva al registro con su dirección como código.
export const urlInvitacion = (base: string, slug: string) => `${base}/registro?ref=${encodeURIComponent(slug)}`;

const mayorPermanente = (descuentos: Descuento[]) =>
  Math.max(0, ...descuentos.filter((d) => d.periodos == null).map((d) => Number(d.porcentaje)));

// Descuento del próximo mes: el permanente, o el primer temporal que le queden meses si es mayor.
export function descuentoVigente(descuentos: Descuento[]) {
  const permanente = mayorPermanente(descuentos);
  const temporal = descuentos
    .filter((d) => d.periodos != null && d.periodos_usados < d.periodos)
    .sort((a, b) => a.referidos - b.referidos)[0];
  const usaTemporal = temporal && Number(temporal.porcentaje) > permanente;
  return {
    porcentaje: usaTemporal ? Number(temporal.porcentaje) : permanente,
    permanente: !usaTemporal && permanente > 0,
    // Meses con descuento temporal que le quedan por usar.
    mesesPendientes: descuentos.reduce(
      (n, d) => n + (d.periodos == null || Number(d.porcentaje) <= permanente ? 0 : d.periodos - d.periodos_usados),
      0,
    ),
    prioridad: descuentos.some((d) => d.prioridad),
  };
}

export type Cobro = {
  meses: number;
  // Precio de lista por los meses del cobro, sin ningún descuento.
  lista: number;
  // Descuento por pagar varios meses juntos (5 %, 10 % o 15 %).
  descuentoCiclo: number;
  porcentajeCiclo: number;
  // Lo que se cobraría sin referidos.
  base: number;
  // Lo que se resta por referidos y el detalle: qué nivel cubre cuántos meses.
  descuentoReferidos: number;
  // temporal: gasta meses al anotar el cobro.
  detalle: { nombre: string; porcentaje: number; meses: number; temporal: boolean }[];
  total: number;
};

// Cuánto cobrarle a un restaurante en su próximo cobro, con el mismo orden que usa admin_registrar_cobro:
// mes a mes, el primer temporal que le quede y sea mayor que el permanente; si no, el permanente.
export function calcularCobro(plan: string, ciclo: string | undefined, descuentos: Descuento[]): Cobro {
  const c = cicloDe(ciclo);
  const mensual = PRECIO_PLAN[plan as PlanPago] ?? 0;
  const lista = mensual * c.meses;
  const base = lista * (1 - c.descuento);
  const porMes = base / c.meses;
  const permanente = mayorPermanente(descuentos);
  const quedan = new Map(descuentos.map((d) => [d.id, d.periodos == null ? 0 : d.periodos - d.periodos_usados]));
  const temporales = descuentos
    .filter((d) => d.periodos != null && Number(d.porcentaje) > permanente)
    .sort((a, b) => a.referidos - b.referidos);
  const detalle = new Map<string, Cobro["detalle"][number]>();
  let descuento = 0;

  for (let i = 0; i < c.meses; i++) {
    const t = temporales.find((d) => (quedan.get(d.id) ?? 0) > 0);
    const aplicado = t ?? descuentos.find((d) => d.periodos == null && Number(d.porcentaje) === permanente);
    if (!aplicado) continue;
    if (t) quedan.set(t.id, (quedan.get(t.id) ?? 0) - 1);
    const pct = Number(aplicado.porcentaje);
    descuento += (porMes * pct) / 100;
    const fila = detalle.get(aplicado.id) ?? { nombre: nombreNivel(aplicado), porcentaje: pct, meses: 0, temporal: !!t };
    fila.meses++;
    detalle.set(aplicado.id, fila);
  }

  const total = Math.max(0, Math.round(base - descuento));
  return {
    meses: c.meses,
    lista,
    descuentoCiclo: Math.round(lista - base),
    porcentajeCiclo: Math.round(c.descuento * 100),
    base: Math.round(base),
    descuentoReferidos: Math.round(base) - total,
    detalle: [...detalle.values()],
    total,
  };
}

const meses = (n: number) => `${n} ${n === 1 ? "mes" : "meses"}`;

// "10 % de descuento durante 1 mes", "12 meses gratis", "gratis para siempre"...
export function textoNivel(n: Pick<Nivel, "porcentaje" | "periodos" | "prioridad">) {
  const gratis = Number(n.porcentaje) >= 100;
  const premio =
    n.periodos == null
      ? gratis
        ? "gratis para siempre"
        : `${n.porcentaje} % de descuento para siempre`
      : gratis
        ? `${meses(n.periodos)} gratis`
        : `${n.porcentaje} % de descuento durante ${meses(n.periodos)}`;
  return `${premio}${n.prioridad ? " + acceso prioritario a las mejoras" : ""}`;
}
