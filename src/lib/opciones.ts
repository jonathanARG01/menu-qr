import type { GrupoOpciones, Plato } from "@/lib/types";
import type { OpcionElegida } from "@/lib/salon";

// Opciones de un plato (tamaño, acompañamiento, punto de cocción…), limpias de lo que venga mal guardado.
export function gruposDe(plato: Pick<Plato, "opciones">): GrupoOpciones[] {
  if (!Array.isArray(plato.opciones)) return [];
  return plato.opciones
    .map((g) => {
      const valores = (Array.isArray(g?.valores) ? g.valores : [])
        .map((v) => ({ nombre: String(v?.nombre ?? "").trim(), precio: Math.max(0, Number(v?.precio) || 0) }))
        .filter((v) => v.nombre);
      const max = Math.min(Math.max(1, Math.round(Number(g?.max) || 1)), valores.length || 1);
      return { nombre: String(g?.nombre ?? "").trim(), min: Math.min(Math.max(0, Math.round(Number(g?.min) || 0)), max), max, valores };
    })
    .filter((g) => g.nombre && g.valores.length);
}

export const tieneOpciones = (plato: Pick<Plato, "opciones">) => gruposDe(plato).length > 0;

export const extraOpciones = (o?: OpcionElegida[] | null) => (o ?? []).reduce((t, x) => t + Number(x.precio ?? 0), 0);

// Grupos obligatorios a los que les falta elegir.
export const faltanOpciones = (grupos: GrupoOpciones[], elegidas: OpcionElegida[]) =>
  grupos.filter((g) => elegidas.filter((e) => e.grupo === g.nombre).length < g.min);

// Misma combinación de plato y opciones = misma línea del pedido.
export const claveLinea = (platoId: string, o: OpcionElegida[]) =>
  o.length ? `${platoId}|${o.map((x) => `${x.grupo}:${x.valor}`).join("|")}` : platoId;
