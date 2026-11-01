import type { Restaurante } from "@/lib/types";

// Platovi Sellos: tarjeta digital de sellos que se contrata aparte del plan (migración 0024).
// Todo lo de sellos vive en src/lib/sellos, src/app/s y src/app/panel/sellos, y en las tablas sellos_* de la base,
// para poder venderlo después como producto independiente sin desarmar el resto de Platovi.

export const NOMBRE_SELLOS = "Platovi Sellos";

// Precio del complemento (CLP al mes, por local). Grupo: todas las sucursales.
export const PRECIO_SELLOS = { local: 12990, grupo: 19990 };

export type ReglaSellos = "visita" | "monto";

export type ProgramaSellos = {
  activo: boolean;
  meta: number;
  premio: string;
  regla: ReglaSellos;
  monto_por_sello: number;
  bienvenida: number;
  max_por_dia: number;
  color: string;
  icono: IconoSello;
  diseno: DisenoSello;
  condiciones: string;
};

export const PROGRAMA_BASE: ProgramaSellos = {
  activo: true,
  meta: 10,
  premio: "Un café de regalo",
  regla: "visita",
  monto_por_sello: 10000,
  bienvenida: 1,
  max_por_dia: 1,
  color: "#23345c",
  icono: "cafe",
  diseno: "clasica",
  condiciones: "",
};

// Lo que se dibuja en cada sello de la tarjeta.
export const ICONOS_SELLO = {
  cafe: "☕",
  pizza: "🍕",
  burger: "🍔",
  sushi: "🍣",
  helado: "🍦",
  dona: "🍩",
  cerveza: "🍺",
  copa: "🍷",
  taco: "🌮",
  pan: "🥐",
  estrella: "⭐",
  corazon: "❤️",
} as const;
export type IconoSello = keyof typeof ICONOS_SELLO;
export const emojiSello = (i: string | undefined) => ICONOS_SELLO[(i ?? "") as IconoSello] ?? ICONOS_SELLO.estrella;

// Diseños de la tarjeta (columna sellos_programas.diseno, migración 0025). Todos usan el color, el logo y el dibujo del local.
export const DISENOS_SELLO = {
  clasica: { nombre: "Clásica", texto: "Tu color, simple y clara." },
  boleto: { nombre: "Boleto", texto: "Ticket de papel con troquel y código de barras." },
  epoca: { nombre: "De época", texto: "Papel crema, marco ornamental y sellos de goma." },
  neon: { nombre: "Neón", texto: "Fondo oscuro con sellos que brillan." },
  pasaporte: { nombre: "Pasaporte", texto: "Letras doradas y un sello distinto en cada visita." },
  editorial: { nombre: "Editorial", texto: "Blanca, mínima, con el número en grande." },
  aurora: { nombre: "Aurora", texto: "Degradado de tu color con vidrio esmerilado." },
  pizarra: { nombre: "Pizarra", texto: "Tiza sobre pizarra con marco de madera." },
  camino: { nombre: "Camino", texto: "Cada sello avanza por un camino hasta el premio." },
  circulo: { nombre: "Círculo", texto: "Los sellos rodean tu logo como un reloj." },
  pop: { nombre: "Pop", texto: "Bordes gruesos, sombra dura y puntos de cómic." },
  premium: { nombre: "Premium", texto: "Negra con dorado, como una tarjeta de crédito." },
} as const;
export type DisenoSello = keyof typeof DISENOS_SELLO;
export const disenoSello = (d: string | undefined): DisenoSello => (d && d in DISENOS_SELLO ? (d as DisenoSello) : "clasica");

export type EstadoTarjeta = {
  codigo: string;
  nombre: string;
  sellos: number;
  premios: number;
  total_sellos: number;
  canjes: number;
  acepta_avisos: boolean;
  created_at: string;
  ultima_at: string | null;
};

export type MovimientoPublico = {
  tipo: "sello" | "canje" | "ajuste";
  cantidad: number;
  origen: "qr" | "manual" | "bienvenida" | "migracion" | "anulada";
  created_at: string;
};

export type TarjetaPublica = EstadoTarjeta & {
  activa: boolean;
  restaurante: { nombre: string; slug: string; logo_url: string | null; color: string; restaurante_id: string };
  programa: ProgramaSellos | null;
  movimientos: MovimientoPublico[];
};

// Fila de sellos_tarjetas que ve el equipo en el panel.
export type FilaTarjeta = EstadoTarjeta & {
  id: string;
  restaurante_id: string;
  cliente_id: string | null;
  telefono: string | null;
  email: string | null;
  cumpleanos: string | null;
};

export const sellosContratado = (r: Pick<Restaurante, "complementos"> | null | undefined) =>
  r?.complementos?.sellos?.activo === true;

// Cuántos sellos faltan para el próximo premio.
export const faltan = (t: Pick<EstadoTarjeta, "sellos">, p: Pick<ProgramaSellos, "meta">) => Math.max(0, p.meta - t.sellos);

// Códigos de tarjeta y de sello: letras y números sin los que se confunden.
export const limpiarCodigo = (t: string) =>
  t
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);

// Saca el código de tarjeta de lo que se escaneó (el enlace /s/CODIGO o el código solo).
export function codigoDeEscaneo(texto: string) {
  const m = texto.match(/\/s\/([A-Za-z0-9]{6,12})(?:[/?#]|$)/);
  return limpiarCodigo(m ? m[1] : texto);
}

// Enlaces públicos.
export const rutaTarjeta = (codigo: string) => `/s/${codigo}`;
export const rutaUnirse = (slug: string, sello?: string) => `/s/unirse/${slug}${sello ? `?sello=${sello}` : ""}`;

// En el celular del cliente se recuerda su tarjeta de cada local (para el QR de la precuenta).
export const claveLocal = (slug: string) => `sellos:${slug}`;

export const textoRegla = (p: Pick<ProgramaSellos, "regla" | "monto_por_sello">, formato: (n: number) => string) =>
  p.regla === "monto" ? `1 sello por cada ${formato(Number(p.monto_por_sello))} de consumo` : "1 sello por visita";
