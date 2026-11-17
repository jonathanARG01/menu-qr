import type { DisenoSello, IconoSello, TipoTarjeta } from "./tipos";

// Tarjeta armada en el demo de la página de venta. Se guarda en este navegador (localStorage) para que,
// al crear la cuenta, el panel la deje lista con ese diseño, el logo y la foto de fondo.
export type ConfigDemo = {
  negocio: string;
  rubro: string;
  tipo: TipoTarjeta;
  cashback: boolean;
  meta: number;
  premio: string;
  color: string;
  icono: IconoSello;
  diseno: DisenoSello;
  textoClaro: boolean;
  logo: string | null; // data URL (WebP chico)
  fondo: string | null; // data URL ya difuminada
  difuminado: number;
  // La dirección con la que se registró: solo se aplica a ese negocio (nunca a uno que ya existía).
  slug?: string;
  guardado: number;
};

const CLAVE = "club-demo";
const VIGENCIA = 7 * 24 * 3600 * 1000;

export function guardarDemo(c: ConfigDemo) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(c));
    return true;
  } catch {
    // Sin espacio (fotos muy grandes): se guarda sin imágenes.
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ ...c, logo: null, fondo: null }));
    } catch {}
    return false;
  }
}

export function leerDemo(): ConfigDemo | null {
  try {
    const c = JSON.parse(localStorage.getItem(CLAVE) || "null") as ConfigDemo | null;
    if (!c || Date.now() - (c.guardado ?? 0) > VIGENCIA) return null;
    return c;
  } catch {
    return null;
  }
}

export function borrarDemo() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {}
}

export async function dataUrlABlob(url: string) {
  return (await fetch(url)).blob();
}
