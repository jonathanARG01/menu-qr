// Cuentas de las mesas: totales, división entre comensales y propinas.
// Se calcula en centavos para que las partes sumen exacto el total.

export type Propina =
  | { tipo: "ninguna" }
  | { tipo: "porcentaje"; valor: number; metodo?: string }
  | { tipo: "monto"; valor: number; metodo?: string }
  // La deja al final, cuando ya pagaron todos.
  | { tipo: "despues" };

export type LineaCuenta = { precio: number; cantidad: number; comensal: number | null };

const centavos = (n: number) => Math.round(Number(n) * 100);
const pesos = (c: number) => c / 100;

export function totalLineas(lineas: LineaCuenta[]) {
  return pesos(lineas.reduce((t, l) => t + centavos(l.precio) * l.cantidad, 0));
}

// Unidad mínima al repartir: si el monto es entero (lo común en pesos) se reparte en pesos enteros, si no en centavos.
const unidad = (monto: number) => (Number.isInteger(Number(monto)) ? 100 : 1);

// Reparte un monto en n partes iguales; lo que sobra va a las primeras (44.000 entre 6 = 7.334, 7.334, 7.333…).
export function partesIguales(total: number, n: number): number[] {
  const partes = Math.max(1, Math.floor(n));
  const u = unidad(total);
  const c = Math.round(centavos(total) / u);
  const base = Math.floor(c / partes);
  const resto = c - base * partes;
  return Array.from({ length: partes }, (_, i) => pesos((base + (i < resto ? 1 : 0)) * u));
}

// Lo que consumió cada comensal (posición 0 = comensal 1). Lo compartido o sin asignar se reparte entre todos.
export function consumoPorComensal(lineas: LineaCuenta[], comensales: number): number[] {
  const n = Math.max(1, comensales);
  const propio = Array.from({ length: n }, () => 0);
  let compartido = 0;
  for (const l of lineas) {
    const monto = centavos(l.precio) * l.cantidad;
    if (l.comensal && l.comensal >= 1 && l.comensal <= n) propio[l.comensal - 1] += monto;
    else compartido += monto;
  }
  const reparto = partesIguales(pesos(compartido), n).map(centavos);
  return propio.map((c, i) => pesos(c + reparto[i]));
}

export function montoPropina(base: number, propina: Propina | undefined | null): number {
  if (!propina) return 0;
  if (propina.tipo === "porcentaje") {
    const u = unidad(base);
    return pesos(Math.round((centavos(base) * Math.max(0, propina.valor)) / 100 / u) * u);
  }
  if (propina.tipo === "monto") return Math.max(0, Number(propina.valor) || 0);
  return 0;
}

export function describirPropina(propina: Propina | undefined | null, formato: (n: number) => string): string {
  if (!propina || propina.tipo === "ninguna") return "Sin propina";
  if (propina.tipo === "despues") return "Propina al final";
  const valor = propina.tipo === "porcentaje" ? `${propina.valor}%` : formato(propina.valor);
  return propina.metodo ? `${valor} en ${propina.metodo.toLowerCase()}` : valor;
}
