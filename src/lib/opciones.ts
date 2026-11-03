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
      // "todas": se pueden marcar todas las opciones del grupo, aunque después se agreguen más.
      const todas = g?.todas === true && valores.length > 1;
      const max = todas ? valores.length : Math.min(Math.max(1, Math.round(Number(g?.max) || 1)), valores.length || 1);
      const min = Math.min(Math.max(0, Math.round(Number(g?.min) || 0)), max);
      return { nombre: String(g?.nombre ?? "").trim(), min, max, ...(todas ? { todas } : {}), valores };
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

export type TextosRegla = { uno: string; hastaN: string; eligeN: string; entreN: string; todas: string };

export const TEXTOS_REGLA: TextosRegla = {
  uno: "Elige 1",
  hastaN: "Hasta {n}",
  eligeN: "Elige {n}",
  entreN: "Elige de {min} a {max}",
  todas: "Elige las que quieras",
};

// Cómo se elige en un grupo, en palabras: "Elige 1", "Hasta 3", "Elige 2", "Elige de 2 a 4", "Elige las que quieras".
export function reglaGrupo(g: GrupoOpciones, t: TextosRegla = TEXTOS_REGLA) {
  if (g.max === 1) return t.uno;
  if (g.min === g.max) return t.eligeN.replace("{n}", String(g.max));
  if (g.min > 0) return t.entreN.replace("{min}", String(g.min)).replace("{max}", String(g.max));
  if (g.todas || g.max >= g.valores.length) return t.todas;
  return t.hastaN.replace("{n}", String(g.max));
}
