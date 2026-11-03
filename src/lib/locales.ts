// Locales del panel: el principal (lo que no tiene sucursal, id null) y las sucursales.
// El local elegido se recuerda en este equipo y lo comparten Salón, QR y Para llevar.

type ConNombre = { nombre: string };

// Nombre del local principal: el que el dueño le puso en Sucursales, o el del restaurante.
export function nombrePrincipal(restaurante: ConNombre, ajustes?: { nombre_principal?: string } | null) {
  return ajustes?.nombre_principal?.trim() || restaurante.nombre;
}

// Rótulo para los selectores: "Aroma Café (principal)".
export function rotuloPrincipal(restaurante: ConNombre, ajustes?: { nombre_principal?: string } | null) {
  return `${nombrePrincipal(restaurante, ajustes)} (principal)`;
}

// Misma clave que usaba el Salón, para no perder lo ya elegido.
const clave = (restauranteId: string) => `salon:local:${restauranteId}`;

// undefined: nada guardado (o no válido); null: el principal; texto: id de la sucursal.
export function leerLocalGuardado(restauranteId: string, sucursales: { id: string }[]): string | null | undefined {
  try {
    const guardado = localStorage.getItem(clave(restauranteId));
    if (guardado === "principal") return null;
    if (guardado && sucursales.some((s) => s.id === guardado)) return guardado;
  } catch {}
  return undefined;
}

export function guardarLocal(restauranteId: string, id: string | null) {
  try {
    localStorage.setItem(clave(restauranteId), id ?? "principal");
  } catch {}
}
