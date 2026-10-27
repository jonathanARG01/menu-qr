import type { SupabaseClient } from "@supabase/supabase-js";

// País del restaurante: de él salen la zona horaria por defecto, el formato de fechas del panel y el código de
// WhatsApp que se agrega a los teléfonos anotados sin él. La moneda se elige aparte en Marca (se sugiere la del país).
export type Pais = {
  codigo: string;
  nombre: string;
  moneda: string;
  zona: string;
  // Formato de fechas y números del panel (siempre en español).
  locale: string;
  // Lo que va antes del número local en WhatsApp y cuántos dígitos tiene ese número local.
  prefijo: string;
  digitos: number;
};

export const PAISES: Pais[] = [
  { codigo: "CL", nombre: "Chile", moneda: "CLP", zona: "America/Santiago", locale: "es-CL", prefijo: "56", digitos: 9 },
  {
    codigo: "AR",
    nombre: "Argentina",
    moneda: "ARS",
    zona: "America/Argentina/Buenos_Aires",
    locale: "es-AR",
    prefijo: "549",
    digitos: 10,
  },
  { codigo: "BO", nombre: "Bolivia", moneda: "BOB", zona: "America/La_Paz", locale: "es-BO", prefijo: "591", digitos: 8 },
  { codigo: "BR", nombre: "Brasil", moneda: "BRL", zona: "America/Sao_Paulo", locale: "es-419", prefijo: "55", digitos: 11 },
  { codigo: "CO", nombre: "Colombia", moneda: "COP", zona: "America/Bogota", locale: "es-CO", prefijo: "57", digitos: 10 },
  { codigo: "CR", nombre: "Costa Rica", moneda: "CRC", zona: "America/Costa_Rica", locale: "es-CR", prefijo: "506", digitos: 8 },
  { codigo: "EC", nombre: "Ecuador", moneda: "USD", zona: "America/Guayaquil", locale: "es-EC", prefijo: "593", digitos: 9 },
  { codigo: "ES", nombre: "España", moneda: "EUR", zona: "Europe/Madrid", locale: "es-ES", prefijo: "34", digitos: 9 },
  { codigo: "US", nombre: "Estados Unidos", moneda: "USD", zona: "America/New_York", locale: "es-US", prefijo: "1", digitos: 10 },
  { codigo: "GT", nombre: "Guatemala", moneda: "GTQ", zona: "America/Guatemala", locale: "es-GT", prefijo: "502", digitos: 8 },
  { codigo: "MX", nombre: "México", moneda: "MXN", zona: "America/Mexico_City", locale: "es-MX", prefijo: "52", digitos: 10 },
  { codigo: "PA", nombre: "Panamá", moneda: "USD", zona: "America/Panama", locale: "es-PA", prefijo: "507", digitos: 8 },
  { codigo: "PY", nombre: "Paraguay", moneda: "PYG", zona: "America/Asuncion", locale: "es-PY", prefijo: "595", digitos: 9 },
  { codigo: "PE", nombre: "Perú", moneda: "PEN", zona: "America/Lima", locale: "es-PE", prefijo: "51", digitos: 9 },
  {
    codigo: "DO",
    nombre: "República Dominicana",
    moneda: "DOP",
    zona: "America/Santo_Domingo",
    locale: "es-DO",
    prefijo: "1",
    digitos: 10,
  },
  { codigo: "UY", nombre: "Uruguay", moneda: "UYU", zona: "America/Montevideo", locale: "es-UY", prefijo: "598", digitos: 8 },
  { codigo: "VE", nombre: "Venezuela", moneda: "USD", zona: "America/Caracas", locale: "es-VE", prefijo: "58", digitos: 10 },
];

export const PAIS_BASE = PAISES[0];

export const paisDe = (codigo?: string | null) => PAISES.find((p) => p.codigo === codigo) ?? PAIS_BASE;

// Zonas horarias para elegir (las de Chile primero, con Magallanes e Isla de Pascua).
export const ZONAS: [string, string][] = [
  ["America/Santiago", "Chile (continental)"],
  ["America/Punta_Arenas", "Chile (Magallanes)"],
  ["Pacific/Easter", "Chile (Isla de Pascua)"],
  ["America/Argentina/Buenos_Aires", "Argentina"],
  ["America/La_Paz", "Bolivia"],
  ["America/Sao_Paulo", "Brasil (São Paulo)"],
  ["America/Bogota", "Colombia"],
  ["America/Costa_Rica", "Costa Rica"],
  ["America/Guayaquil", "Ecuador"],
  ["Europe/Madrid", "España"],
  ["America/New_York", "Estados Unidos (Este)"],
  ["America/Chicago", "Estados Unidos (Centro)"],
  ["America/Los_Angeles", "Estados Unidos (Pacífico)"],
  ["America/Guatemala", "Guatemala"],
  ["America/Mexico_City", "México (Centro)"],
  ["America/Cancun", "México (Cancún)"],
  ["America/Tijuana", "México (Tijuana)"],
  ["America/Panama", "Panamá"],
  ["America/Asuncion", "Paraguay"],
  ["America/Lima", "Perú"],
  ["America/Santo_Domingo", "República Dominicana"],
  ["America/Montevideo", "Uruguay"],
  ["America/Caracas", "Venezuela"],
];

export type Region = { locale: string; zona: string };

// Fecha u hora en la zona del local (no la del navegador ni la del servidor, que está en UTC).
export function formatoFecha(iso: string | number | Date, region: Region, opciones: Intl.DateTimeFormatOptions) {
  const fecha = new Date(iso);
  try {
    return fecha.toLocaleString(region.locale, { timeZone: region.zona, ...opciones });
  } catch {
    return fecha.toLocaleString(PAIS_BASE.locale, opciones);
  }
}

export const formatoHora = (iso: string | number | Date, region: Region) =>
  formatoFecha(iso, region, { hour: "2-digit", minute: "2-digit", hour12: false });

export const formatoNumero = (n: number, region: Region, opciones?: Intl.NumberFormatOptions) =>
  Number(n).toLocaleString(region.locale, opciones);

// WhatsApp necesita el número con código de país. Si lo anotaron sin él, se agrega el del país del local.
export function numeroWhatsapp(telefono: string, pais: Pais = PAIS_BASE) {
  let d = telefono.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  return d.length <= pais.digitos ? `${pais.prefijo}${d}` : d;
}

// País que sugiere la zona horaria del navegador al crear la cuenta (Chile si no se reconoce).
export function paisPorZona(zona?: string | null) {
  if (!zona) return PAIS_BASE;
  if (zona === "America/Punta_Arenas" || zona === "Pacific/Easter") return PAIS_BASE;
  if (zona.startsWith("America/Argentina/")) return paisDe("AR");
  if (zona.startsWith("Europe/Madrid") || zona === "Atlantic/Canary") return paisDe("ES");
  if (["America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles"].includes(zona)) return paisDe("US");
  if (
    [
      "America/Monterrey",
      "America/Merida",
      "America/Cancun",
      "America/Tijuana",
      "America/Chihuahua",
      "America/Hermosillo",
      "America/Mazatlan",
    ].includes(zona)
  )
    return paisDe("MX");
  return PAISES.find((p) => p.zona === zona) ?? PAIS_BASE;
}

// Al crear un restaurante: moneda, país y zona horaria del país elegido (se pueden cambiar después).
export async function aplicarPais(supabase: SupabaseClient, restauranteId: string, codigo: string) {
  const pais = paisDe(codigo);
  return supabase
    .from("restaurantes")
    .update({ moneda: pais.moneda, ajustes: { pais: pais.codigo, zona_horaria: pais.zona } })
    .eq("id", restauranteId);
}
