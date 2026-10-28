import type { Pago } from "./salon";

// Resumen de un turno de caja a partir de los pagos registrados.

export type FilaMedio = { medio: string; ventas: number; propinas: number; cantidad: number };
export type FilaPersona = { id: string; nombre: string; cobros: number; ventas: number; propinas: number };

export type TotalesCaja = {
  ventas: number;
  propinas: number;
  cobros: number;
  mesas: number;
  comensales: number;
  online: number;
  medios: FilaMedio[];
  personas: FilaPersona[];
  // Gastos del turno (migración 0018): total y lo que salió en efectivo.
  gastos?: number;
  gastos_efectivo?: number;
  // Efectivo: fondo inicial + lo cobrado en efectivo (ventas y propinas) − los gastos pagados en efectivo.
  efectivo_esperado: number;
};

export type Gasto = {
  id: string;
  monto: number;
  detalle: string;
  medio: string;
  registrado_por: string | null;
  created_at: string;
};

export const esEfectivo = (medio: string) => /efectivo|cash/i.test(medio);

const redondear = (n: number) => Math.round(n * 100) / 100;

export function resumirCaja({
  pagos,
  cuentasCerradas,
  nombres,
  fondoInicial,
  gastos = [],
}: {
  pagos: Pago[];
  gastos?: Pick<Gasto, "monto" | "medio">[];
  cuentasCerradas: { comensales: number }[];
  nombres: Map<string, string>;
  fondoInicial: number;
}): TotalesCaja {
  const medios = new Map<string, FilaMedio>();
  const personas = new Map<string, FilaPersona>();
  const medio = (m: string) => {
    if (!medios.has(m)) medios.set(m, { medio: m, ventas: 0, propinas: 0, cantidad: 0 });
    return medios.get(m)!;
  };
  let ventas = 0;
  let propinas = 0;
  let online = 0;
  for (const p of pagos) {
    const monto = Number(p.monto);
    const propina = Number(p.propina);
    ventas += monto;
    propinas += propina;
    if (p.origen === "online") online += monto + propina;
    const m = medio(p.metodo);
    m.ventas += monto;
    m.cantidad += 1;
    if (propina > 0) medio(p.propina_metodo || p.metodo).propinas += propina;

    const id = p.origen === "online" ? "online" : (p.registrado_por ?? "sin");
    if (!personas.has(id)) {
      const nombre = id === "online" ? "Pagos online" : id === "sin" ? "Sin dato" : (nombres.get(id) ?? "Equipo");
      personas.set(id, { id, nombre, cobros: 0, ventas: 0, propinas: 0 });
    }
    const persona = personas.get(id)!;
    persona.cobros += 1;
    persona.ventas += monto;
    persona.propinas += propina;
  }
  const lista = [...medios.values()].map((m) => ({ ...m, ventas: redondear(m.ventas), propinas: redondear(m.propinas) }));
  const efectivo = lista.filter((m) => esEfectivo(m.medio)).reduce((s, m) => s + m.ventas + m.propinas, 0);
  const totalGastos = gastos.reduce((s, g) => s + Number(g.monto), 0);
  const gastosEfectivo = gastos.filter((g) => esEfectivo(g.medio)).reduce((s, g) => s + Number(g.monto), 0);
  return {
    ventas: redondear(ventas),
    propinas: redondear(propinas),
    cobros: pagos.length,
    mesas: cuentasCerradas.length,
    comensales: cuentasCerradas.reduce((s, c) => s + (c.comensales || 0), 0),
    online: redondear(online),
    medios: lista.sort((a, b) => b.ventas + b.propinas - (a.ventas + a.propinas)),
    personas: [...personas.values()].sort((a, b) => b.ventas - a.ventas),
    gastos: redondear(totalGastos),
    gastos_efectivo: redondear(gastosEfectivo),
    efectivo_esperado: redondear(fondoInicial + efectivo - gastosEfectivo),
  };
}
