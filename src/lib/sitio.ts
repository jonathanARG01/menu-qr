import { leerRedes, type Redes } from "./redes";

// Datos de contacto y redes del sitio de venta (tabla sitio_ajustes, SQL 0028). Los edita el superadmin en /admin/sitio.
export type ContactoSitio = {
  whatsapp: string;
  correo: string;
  telefono: string;
  ubicacion: string;
  horario: string;
  // Correo donde te llegan los mensajes del formulario (si falta, el de contacto).
  aviso_correo: string;
};

export const CONTACTO_BASE: ContactoSitio = {
  whatsapp: "56941497083",
  correo: "hola@platovi.cl",
  telefono: "+56 9 4149 7083",
  ubicacion: "Chile · atendemos en todo el país y el extranjero",
  horario: "Todos los días, las 24 horas",
  aviso_correo: "hola@platovi.cl",
};

// Redes que se muestran en el sitio (la "tienda" y Tripadvisor son cosas de la carta de un restaurante).
export const REDES_SITIO = ["instagram", "facebook", "tiktok", "youtube", "x", "web"] as const;

export type AjustesSitio = { contacto: ContactoSitio; redes: Redes };

export function leerContacto(g: unknown): ContactoSitio {
  const o = (g && typeof g === "object" ? g : {}) as Record<string, unknown>;
  const texto = (k: keyof ContactoSitio, max = 160) => (typeof o[k] === "string" ? (o[k] as string).slice(0, max) : CONTACTO_BASE[k]);
  return {
    whatsapp: texto("whatsapp", 20).replace(/\D/g, ""),
    correo: texto("correo", 120),
    telefono: texto("telefono", 30),
    ubicacion: texto("ubicacion"),
    horario: texto("horario"),
    aviso_correo: texto("aviso_correo", 120),
  };
}

export const leerAjustesSitio = (fila?: { contacto?: unknown; redes?: unknown } | null): AjustesSitio => ({
  contacto: leerContacto(fila?.contacto),
  redes: leerRedes(fila?.redes),
});
