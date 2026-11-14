import type { IconoSello } from "./tipos";

// Rubros: cada uno trae una tarjeta sugerida (sellos, premio, dibujo y color) y las palabras de su mundo.
// El negocio puede cambiar todo después; esto es para que parta listo en un minuto.
export type Rubro = {
  nombre: string;
  icono: IconoSello;
  meta: number;
  premio: string;
  color: string;
  // "visita", "corte", "lavado"…: lo que cuenta como un sello.
  visita: string;
};

export const RUBROS = {
  cafe: { nombre: "Cafetería", icono: "cafe", meta: 10, premio: "Un café de regalo", color: "#6b3e26", visita: "café" },
  peluqueria: { nombre: "Peluquería", icono: "tijera", meta: 6, premio: "Un corte gratis", color: "#7c3a6b", visita: "visita" },
  barberia: { nombre: "Barbería", icono: "barberia", meta: 6, premio: "Un corte gratis", color: "#1f2937", visita: "corte" },
  unas: { nombre: "Uñas y manicure", icono: "unas", meta: 6, premio: "Una manicure gratis", color: "#be185d", visita: "visita" },
  estetica: { nombre: "Estética y spa", icono: "spa", meta: 8, premio: "Un tratamiento de regalo", color: "#0f766e", visita: "sesión" },
  panaderia: { nombre: "Panadería y pastelería", icono: "pan", meta: 10, premio: "Un dulce de regalo", color: "#b45309", visita: "compra" },
  heladeria: { nombre: "Heladería", icono: "helado", meta: 8, premio: "Un helado de regalo", color: "#db2777", visita: "helado" },
  restaurante: { nombre: "Restaurante o comida", icono: "burger", meta: 10, premio: "Un plato de regalo", color: "#b91c1c", visita: "visita" },
  bar: { nombre: "Bar o cervecería", icono: "cerveza", meta: 8, premio: "Una cerveza de regalo", color: "#92400e", visita: "visita" },
  lavado: { nombre: "Lavado de autos", icono: "auto", meta: 8, premio: "Un lavado gratis", color: "#1d4ed8", visita: "lavado" },
  gimnasio: { nombre: "Gimnasio o deporte", icono: "pesa", meta: 12, premio: "Una clase gratis", color: "#111827", visita: "clase" },
  mascotas: { nombre: "Mascotas y veterinaria", icono: "huella", meta: 8, premio: "Un baño gratis para tu mascota", color: "#15803d", visita: "visita" },
  tienda: { nombre: "Tienda", icono: "bolsa", meta: 10, premio: "Un descuento de regalo", color: "#4338ca", visita: "compra" },
  ropa: { nombre: "Ropa y accesorios", icono: "polera", meta: 8, premio: "10% de descuento", color: "#0f172a", visita: "compra" },
  floreria: { nombre: "Florería y plantas", icono: "flor", meta: 8, premio: "Un ramo de regalo", color: "#be123c", visita: "compra" },
  lavanderia: { nombre: "Lavandería", icono: "gota", meta: 10, premio: "Un lavado gratis", color: "#0369a1", visita: "lavado" },
  otro: { nombre: "Otro rubro", icono: "estrella", meta: 10, premio: "Un regalo de la casa", color: "#23345c", visita: "visita" },
} as const satisfies Record<string, Rubro>;

export type IdRubro = keyof typeof RUBROS;
export const rubroDe = (id: string | null | undefined): Rubro => RUBROS[(id ?? "") as IdRubro] ?? RUBROS.otro;
