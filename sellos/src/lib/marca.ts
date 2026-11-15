// Tarjeta digital de sellos y puntos para cualquier negocio. Producto de BROTE DIGITAL SpA, independiente de Platovi.
// Todo lo que nombra la marca sale de aquí: cuando se elija el nombre definitivo, se cambia solo en este archivo
// (y el dominio con NEXT_PUBLIC_SITE_URL).

export const MARCA = process.env.NEXT_PUBLIC_MARCA || "Club de Clientes";
export const LEMA = "La tarjeta de sellos y puntos que hace volver a tus clientes";
export const EMPRESA = "BROTE DIGITAL SpA";
export const DOMINIO = process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, "").replace(/\/$/, "") || "localhost:3000";
export const CORREO_CONTACTO = process.env.NEXT_PUBLIC_CORREO_CONTACTO || "hola@platovi.cl";
// WhatsApp de ventas (solo dígitos, con código de país). Se cambia con NEXT_PUBLIC_WHATSAPP_VENTAS.
export const WHATSAPP_VENTAS = (process.env.NEXT_PUBLIC_WHATSAPP_VENTAS || "").replace(/\D/g, "");

// Lo que TODOS los planes traen (nunca se cobra aparte).
export const EN_TODOS = [
  "Clientes, sellos y equipo ilimitados",
  "Todos los diseños de tarjeta (nuevos cada mes)",
  "Diseño a medida de tu negocio, con tu foto o tu arte",
  "Google Wallet y aviso al celular",
  "Sello con QR, escaneando la tarjeta o con el teléfono",
  "Cumpleaños, día doble y “te extrañamos” automáticos",
];

// Precios en CLP al mes, más IVA. El Cadena incluye 5 locales; cada local extra se suma aparte.
export const PLANES = {
  inicial: {
    nombre: "Inicial",
    precio: 20990,
    detalle: "Para partir: la tarjeta de sellos completa en 1 local.",
    incluye: ["1 local", "Tarjeta de sellos con su premio", "Métricas básicas"],
  },
  pro: {
    nombre: "Pro",
    precio: 29990,
    detalle: "Todo para que vuelvan más seguido.",
    incluye: [
      "1 local",
      "Tarjeta de puntos o cashback, con catálogo de premios con fotos",
      "Premios intermedios, niveles y retos con insignias",
      "Campañas por segmento (VIP, frecuentes, dormidos…)",
      "Cupones, promociones por fecha y “trae a un amigo”",
      "Métricas completas, costo de premios y exportar a Excel",
    ],
  },
  cadena: {
    nombre: "Cadena",
    precio: 59990,
    detalle: "Para varios locales o franquicias.",
    incluye: [
      "Todo lo del Pro",
      "Hasta 5 locales (local extra $9.990)",
      "Métricas y campañas por local",
      "Equipo fijo por local y encargados",
      "API para tu caja o sistema",
      "Conexión con la IA (Claude, ChatGPT)",
    ],
  },
} as const;
export type Plan = keyof typeof PLANES;
export const LOCAL_EXTRA = 9990;
export const DIAS_PRUEBA = 30;
// Descuento por pagar por adelantado (igual que Platovi).
export const DESCUENTOS = [
  { meses: 3, descuento: 5 },
  { meses: 6, descuento: 10 },
  { meses: 12, descuento: 15 },
];

// Lo que se prende con cada plan (igual que plan_incluye() en la base de datos).
export type Funcion =
  | "campanas"
  | "metricas"
  | "premios"
  | "cupones"
  | "referidos"
  | "niveles"
  | "retos"
  | "promociones"
  | "puntos"
  | "sucursales"
  | "api";
export function incluye(n: { plan: string; estado: string }, f: Funcion) {
  if (n.estado === "prueba") return true;
  if (f === "sucursales" || f === "api") return n.plan === "cadena";
  return n.plan === "pro" || n.plan === "cadena";
}
export const planQueIncluye = (f: Funcion): Plan => (f === "sucursales" || f === "api" ? "cadena" : "pro");
export const nombrePlan = (p: string) => PLANES[(p in PLANES ? p : "inicial") as Plan].nombre;

export const enlaceWhatsapp = (texto: string) =>
  WHATSAPP_VENTAS ? `https://wa.me/${WHATSAPP_VENTAS}?text=${encodeURIComponent(texto)}` : `mailto:${CORREO_CONTACTO}?subject=${encodeURIComponent(MARCA)}&body=${encodeURIComponent(texto)}`;
