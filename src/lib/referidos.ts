// Programa de referidos: un restaurante invita a otro con su link y gana descuentos en su suscripción.
// La base de datos (migración 0012) cuenta los referidos y entrega los descuentos; aquí solo se leen y se muestran.

// periodos null = descuento permanente.
export type Nivel = { referidos: number; porcentaje: number; periodos: number | null; prioridad: boolean };

export type ConfigReferidos = { activo: boolean; niveles: Nivel[] };

export type Descuento = {
  id: string;
  restaurante_id: string;
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
  { referidos: 1, porcentaje: 10, periodos: 1, prioridad: false },
  { referidos: 3, porcentaje: 10, periodos: 1, prioridad: false },
  { referidos: 10, porcentaje: 20, periodos: null, prioridad: true },
];

export function leerNiveles(guardado: unknown): Nivel[] {
  if (!Array.isArray(guardado)) return NIVELES_BASE;
  return guardado
    .map((n) => ({
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

// Descuento que corresponde al próximo cobro: el permanente, o el primer temporal que le queden períodos si es mayor.
export function descuentoVigente(descuentos: Descuento[]) {
  const permanente = Math.max(0, ...descuentos.filter((d) => d.periodos == null).map((d) => Number(d.porcentaje)));
  const temporal = descuentos
    .filter((d) => d.periodos != null && d.periodos_usados < d.periodos)
    .sort((a, b) => a.referidos - b.referidos)[0];
  const usaTemporal = temporal && Number(temporal.porcentaje) > permanente;
  return {
    porcentaje: usaTemporal ? Number(temporal.porcentaje) : permanente,
    permanente: !usaTemporal && permanente > 0,
    // Períodos con descuento temporal que le quedan por usar.
    periodosPendientes: descuentos.reduce((n, d) => n + (d.periodos == null ? 0 : d.periodos - d.periodos_usados), 0),
    prioridad: descuentos.some((d) => d.prioridad),
  };
}

export function textoNivel(n: Nivel, ciclo?: "mensual" | "anual") {
  const periodo = ciclo === "anual" ? "año" : ciclo === "mensual" ? "mes" : "período";
  const duracion =
    n.periodos == null
      ? "para siempre"
      : n.periodos === 1
        ? `durante 1 ${periodo}`
        : `durante ${n.periodos} ${periodo === "mes" ? "meses" : periodo === "año" ? "años" : "períodos"}`;
  return `${n.porcentaje} % de descuento ${duracion}${n.prioridad ? " + acceso prioritario a las mejoras" : ""}`;
}
