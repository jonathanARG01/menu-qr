// Tipos y textos de Sellito. Nace de Platovi Loyalty (src/lib/sellos/tipos.ts del repo de Platovi), pero sin nada
// de restaurantes: un "negocio" puede ser un café, una peluquería, una tienda…

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
  dias_dobles: number[]; // 0 = domingo … 6 = sábado
  pedir_resena: boolean;
  extranamos_dias: number; // 0 = apagado
  extranamos_sellos: number;
  cumple_sellos: number;
};

export const PROGRAMA_BASE: ProgramaSellos = {
  activo: true,
  meta: 10,
  premio: "Un regalo de la casa",
  regla: "visita",
  monto_por_sello: 10000,
  bienvenida: 1,
  max_por_dia: 1,
  color: "#23345c",
  icono: "estrella",
  diseno: "clasica",
  condiciones: "",
  dias_dobles: [],
  pedir_resena: true,
  extranamos_dias: 30,
  extranamos_sellos: 0,
  cumple_sellos: 1,
};

// Lo que se dibuja en cada sello de la tarjeta (los de comida vienen de Platovi; el resto, para otros rubros).
export const ICONOS_SELLO = {
  estrella: "⭐",
  corazon: "❤️",
  regalo: "🎁",
  cafe: "☕",
  pan: "🥐",
  dona: "🍩",
  cupcake: "🧁",
  helado: "🍦",
  pizza: "🍕",
  burger: "🍔",
  sushi: "🍣",
  taco: "🌮",
  cerveza: "🍺",
  copa: "🍷",
  tijera: "✂️",
  barberia: "💈",
  unas: "💅",
  spa: "💆",
  labial: "💄",
  auto: "🚗",
  pesa: "🏋️",
  huella: "🐾",
  bolsa: "🛍️",
  polera: "👕",
  flor: "🌸",
  planta: "🌿",
  gota: "💧",
  libro: "📚",
  diente: "🦷",
  rayo: "⚡",
} as const;
export type IconoSello = keyof typeof ICONOS_SELLO;
export const emojiSello = (i: string | undefined) => ICONOS_SELLO[(i ?? "") as IconoSello] ?? ICONOS_SELLO.estrella;

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

export type Negocio = {
  id: string;
  slug: string;
  nombre: string;
  rubro: string;
  logo_url: string | null;
  color: string;
  telefono: string | null;
  direccion: string | null;
  instagram: string | null;
  resena_url: string | null;
  pais: string;
  moneda: string;
  zona_horaria: string;
  pide_pin: boolean;
  plan: "local" | "cadena";
  estado: "prueba" | "activo" | "pausado";
  prueba_hasta: string;
  created_at: string;
};

export type Rol = "dueno" | "empleado";

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

export type Origen = "qr" | "equipo" | "manual" | "bienvenida" | "cumpleanos" | "regreso" | "migracion";

export type MovimientoPublico = {
  tipo: "sello" | "canje" | "ajuste";
  cantidad: number;
  origen: Origen;
  created_at: string;
};

export type TarjetaPublica = EstadoTarjeta & {
  activa: boolean;
  negocio: {
    id: string;
    nombre: string;
    slug: string;
    logo_url: string | null;
    color: string;
    rubro: string;
    telefono: string | null;
    instagram: string | null;
    pais: string;
    resena_url?: string | null;
  };
  programa: ProgramaSellos | null;
  movimientos: MovimientoPublico[];
  dia_doble?: boolean;
};

// Fila de tarjetas que ve el equipo en el panel.
export type FilaTarjeta = EstadoTarjeta & {
  id: string;
  negocio_id: string;
  telefono: string | null;
  email: string | null;
  cumpleanos: string | null;
};
export const COLUMNAS_TARJETA =
  "id, negocio_id, codigo, nombre, telefono, email, cumpleanos, acepta_avisos, sellos, premios, total_sellos, canjes, created_at, ultima_at";

const NOMBRES_DIA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];
export function textoDias(dias: number[]) {
  const n = ORDEN_DIAS.filter((d) => dias.includes(d)).map((d) => NOMBRES_DIA[d]);
  if (!n.length) return "";
  const t = n.length === 1 ? n[0] : `${n.slice(0, -1).join(", ")} y ${n[n.length - 1]}`;
  return t.charAt(0).toUpperCase() + t.slice(1);
}
export const letraDia = (d: number) => NOMBRES_DIA[d].charAt(0).toUpperCase() + NOMBRES_DIA[d].slice(1, 3);

export const faltan = (t: Pick<EstadoTarjeta, "sellos">, p: Pick<ProgramaSellos, "meta">) => Math.max(0, p.meta - t.sellos);

export const limpiarCodigo = (t: string) =>
  t
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);

// Saca el código de tarjeta de lo que se escaneó (el enlace /t/CODIGO o el código solo).
export function codigoDeEscaneo(texto: string) {
  const m = texto.match(/\/t\/([A-Za-z0-9]{6,12})(?:[/?#]|$)/);
  return limpiarCodigo(m ? m[1] : texto);
}

export const rutaTarjeta = (codigo: string) => `/t/${codigo}`;
export const rutaUnirse = (slug: string, sello?: string) => `/u/${slug}${sello ? `?sello=${sello}` : ""}`;

// En el celular del cliente se recuerda su tarjeta de cada negocio (para el QR de un solo uso).
export const claveLocal = (slug: string) => `sellito:${slug}`;

export const textoRegla = (p: Pick<ProgramaSellos, "regla" | "monto_por_sello">, formato: (n: number) => string) =>
  p.regla === "monto" ? `1 sello por cada ${formato(Number(p.monto_por_sello))} de compra` : "1 sello por visita";

// Días que le quedan de prueba (negativo si ya venció).
export function diasPrueba(n: Pick<Negocio, "prueba_hasta">) {
  const hasta = Date.parse(`${n.prueba_hasta}T23:59:59`);
  return Math.floor((hasta - Date.now()) / 86400000);
}
export const vigente = (n: Pick<Negocio, "estado" | "prueba_hasta">) =>
  n.estado === "activo" || (n.estado === "prueba" && diasPrueba(n) >= 0);
