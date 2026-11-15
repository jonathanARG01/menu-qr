// Sellito: tarjeta digital de sellos para cualquier negocio. Producto de BROTE DIGITAL SpA, independiente de Platovi.
// Todo lo que nombra la marca sale de aquí: si cambia el nombre o el dominio, se cambia solo en este archivo.

export const MARCA = "Sellito";
export const LEMA = "La tarjeta de sellos que hace volver a tus clientes";
export const EMPRESA = "BROTE DIGITAL SpA";
export const DOMINIO = process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, "").replace(/\/$/, "") || "sellito.cl";
export const CORREO_CONTACTO = process.env.NEXT_PUBLIC_CORREO_CONTACTO || "hola@sellito.cl";
// WhatsApp de ventas (solo dígitos, con código de país). Se cambia con NEXT_PUBLIC_WHATSAPP_VENTAS.
export const WHATSAPP_VENTAS = (process.env.NEXT_PUBLIC_WHATSAPP_VENTAS || "").replace(/\D/g, "");

// Precios en CLP al mes, más IVA.
export const PLANES = {
  local: { nombre: "Local", precio: 19990, detalle: "1 local, clientes y sellos ilimitados" },
  cadena: { nombre: "Cadena", precio: 49990, detalle: "Hasta 5 locales, cada uno con su tarjeta y su equipo" },
} as const;
export type Plan = keyof typeof PLANES;
export const DIAS_PRUEBA = 14;

export const enlaceWhatsapp = (texto: string) =>
  WHATSAPP_VENTAS ? `https://wa.me/${WHATSAPP_VENTAS}?text=${encodeURIComponent(texto)}` : `mailto:${CORREO_CONTACTO}?subject=${encodeURIComponent(MARCA)}&body=${encodeURIComponent(texto)}`;
