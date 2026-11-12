import { createHmac, timingSafeEqual } from "crypto";

// Acceso a la lista privada de prospectos. Todo depende de dos variables de Vercel que solo conoce Jonathan:
// PROSPECTOS_RUTA (el trozo secreto de la URL, /p/<ruta>) y PROSPECTOS_CLAVE (la contraseña).
// Sin alguna de las dos la página no existe (404). Cambiar la clave cierra todas las sesiones abiertas.

const limpiar = (v?: string) => (v ?? "").trim();

export const rutaSecreta = () => limpiar(process.env.PROSPECTOS_RUTA);
const clave = () => process.env.PROSPECTOS_CLAVE ?? "";

export const COOKIE_PROSPECTOS = "pv_prospectos";

function iguales(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// La ruta debe ser larga para que no se pueda adivinar.
export function rutaValida(token: string) {
  const r = rutaSecreta();
  return r.length >= 16 && !!clave() && iguales(token, r);
}

export const claveCorrecta = (intento: string) => !!clave() && iguales(intento, clave());

// Valor de la cookie de sesión: firma con la clave, así no guarda la clave y deja de valer si la clave cambia.
export const valorSesion = () => createHmac("sha256", clave()).update(`prospectos:${rutaSecreta()}`).digest("hex");

export const sesionValida = (cookie?: string) => !!cookie && !!clave() && iguales(cookie, valorSesion());
