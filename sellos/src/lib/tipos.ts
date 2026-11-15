// Tipos y textos de la tarjeta de sellos y puntos. Nace de Platovi Loyalty, pero sin nada
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
  // 0002: puntos, premios intermedios, niveles, referidos y diseño a medida
  tipo: TipoTarjeta;
  puntos_cada: number;
  puntos_regalo: number;
  nombre_puntos: string;
  costo_premio: number | null;
  hitos: Hito[];
  niveles: Nivel[];
  referido_regalo: number;
  cumple_cupon: string | null;
  fondo_url: string | null;
  texto_claro: boolean;
};

export type TipoTarjeta = "sellos" | "puntos";
// Premio intermedio: "a los 5 sellos, un café chico".
export type Hito = { sellos: number; premio: string };
// Nivel por visitas: Bronce, Plata, Oro… (doble = suma el doble).
export type Nivel = { nombre: string; visitas: number; beneficio: string; doble: boolean };

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
  tipo: "sellos",
  puntos_cada: 100,
  puntos_regalo: 100,
  nombre_puntos: "puntos",
  costo_premio: null,
  hitos: [],
  niveles: [],
  referido_regalo: 1,
  cumple_cupon: null,
  fondo_url: null,
  texto_claro: true,
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
  pelota: "⚽",
  tenis: "🎾",
  padel: "🏓",
  trofeo: "🏆",
  cama: "🛏️",
  llave: "🔑",
  olla: "🍲",
  empanada: "🥟",
  completo: "🌭",
  diamante: "💎",
  corona: "👑",
  peineta: "🪮",
  medalla: "🏅",
  fuego: "🔥",
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
  billetera: { nombre: "Billetera de cristal", texto: "Las tarjetas salen en abanico de una carpeta de vidrio." },
  holografica: { nombre: "Holográfica", texto: "Carta de colección con marco de vidrio y arcoíris que se mueve." },
  dorada: { nombre: "Dorada", texto: "Marco de oro que brilla sobre negro." },
  cristal: { nombre: "Cristal", texto: "Vidrio esmerilado sobre manchas de tu color." },
  coleccion: { nombre: "Colección", texto: "Carta brillante dentro de un estuche de acrílico." },
  isometrica: { nombre: "Isométrica 3D", texto: "En perspectiva, con canto grueso y sellos en relieve." },
  medida: { nombre: "A medida", texto: "Tu foto o tu arte de fondo: la hacemos a la medida de tu negocio." },
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
  plan: "inicial" | "pro" | "cadena";
  max_locales: number;
  latitud: number | null;
  longitud: number | null;
  estado: "prueba" | "activo" | "pausado";
  prueba_hasta: string;
  created_at: string;
};

export type Rol = "dueno" | "encargado" | "empleado";
export const NOMBRE_ROL: Record<Rol, string> = { dueno: "Dueño", encargado: "Encargado", empleado: "Equipo" };
export const TEXTO_ROL: Record<Rol, string> = {
  dueno: "Todo: tarjeta, plan, equipo, locales y API.",
  encargado: "Campañas, premios, cupones y métricas. No ve el plan ni el equipo.",
  empleado: "Suma sellos o puntos y entrega premios.",
};

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
  puntos: number;
  total_puntos: number;
  visitas: number;
  hitos_canjeados: number[];
  nivel?: Nivel | null;
};

export type Origen =
  | "qr"
  | "equipo"
  | "manual"
  | "bienvenida"
  | "cumpleanos"
  | "regreso"
  | "migracion"
  | "referido"
  | "api"
  | "premio"
  | "cupon"
  | "reto";

export type MovimientoPublico = {
  tipo: "sello" | "canje" | "ajuste";
  cantidad: number;
  origen: Origen;
  created_at: string;
  unidad?: TipoTarjeta;
  nota?: string | null;
};

export type Promocion = { titulo: string; multiplicador: number; hasta: string };
export type PremioCatalogo = {
  id: string;
  titulo: string;
  descripcion: string;
  imagen_url: string | null;
  categoria: string;
  puntos: number;
  destacado: boolean;
  agotado: boolean;
  hasta: string | null;
};
export type RetoPublico = { titulo: string; insignia: string; visitas: number; dias: number; regalo: number; logrados: number; avance: number };
export type CuponPublico = { titulo: string; detalle: string; vence_at: string | null };

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
    moneda?: string;
    latitud?: number | null;
    longitud?: number | null;
  };
  programa: ProgramaSellos | null;
  movimientos: MovimientoPublico[];
  dia_doble?: boolean;
  promocion?: Promocion | null;
  catalogo?: PremioCatalogo[];
  retos?: RetoPublico[];
  locales?: { nombre: string; latitud: number | null; longitud: number | null }[];
  cupones?: CuponPublico[];
};

// Fila de tarjetas que ve el equipo en el panel.
export type FilaTarjeta = EstadoTarjeta & {
  id: string;
  negocio_id: string;
  telefono: string | null;
  email: string | null;
  cumpleanos: string | null;
  referido_por: string | null;
  sucursal_id: string | null;
};
export const COLUMNAS_TARJETA =
  "id, negocio_id, codigo, nombre, telefono, email, cumpleanos, acepta_avisos, sellos, premios, total_sellos, canjes, created_at, ultima_at, puntos, total_puntos, visitas, hitos_canjeados, referido_por, sucursal_id";

export type Sucursal = { id: string; negocio_id: string; nombre: string; direccion: string | null; latitud: number | null; longitud: number | null };
export type Cupon = { id: string; negocio_id: string; titulo: string; detalle: string; dias: number | null; costo: number | null; activo: boolean };
export type Premio = {
  id: string;
  negocio_id: string;
  titulo: string;
  descripcion: string;
  imagen_url: string | null;
  categoria: string;
  puntos: number;
  stock: number | null;
  desde: string | null;
  hasta: string | null;
  costo: number | null;
  destacado: boolean;
  activo: boolean;
  orden: number;
};
export type PromocionFila = { id: string; negocio_id: string; titulo: string; multiplicador: number; desde: string; hasta: string; activo: boolean };
export type Reto = { id: string; negocio_id: string; titulo: string; insignia: string; visitas: number; dias: number; regalo: number; activo: boolean };

// Segmentos para campañas (igual que public.segmento()).
export const SEGMENTOS = {
  todos: { nombre: "Todos", texto: "Todos los que aceptaron avisos." },
  cerca: { nombre: "Cerca del premio", texto: "A 2 sellos o menos (o casi con los puntos de un premio)." },
  premio: { nombre: "Con premio por canjear", texto: "Ya ganaron y no han venido a buscarlo." },
  dormidos: { nombre: "Dormidos", texto: "No vienen hace un tiempo." },
  nuevos: { nombre: "Nuevos", texto: "Se unieron en los últimos 30 días." },
  cumple: { nombre: "Cumpleaños del mes", texto: "Están de cumpleaños este mes." },
  frecuentes: { nombre: "Frecuentes", texto: "4 visitas o más en los últimos 60 días." },
  vip: { nombre: "VIP", texto: "El 10 % que más viene (10 visitas o más)." },
} as const;
export type Segmento = keyof typeof SEGMENTOS;

// "sellos", "puntos" o el nombre que el negocio le puso ("pesos" en cashback).
export const unidad = (p: Pick<ProgramaSellos, "tipo" | "nombre_puntos">, n = 2) =>
  p.tipo === "puntos" ? (n === 1 ? p.nombre_puntos.replace(/s$/, "") : p.nombre_puntos) : n === 1 ? "sello" : "sellos";
// El siguiente premio intermedio que le falta canjear o ganar.
export const hitosDe = (p: Pick<ProgramaSellos, "hitos">) => [...(p.hitos ?? [])].sort((a, b) => a.sellos - b.sellos);

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
export const claveLocal = (slug: string) => `club:${slug}`;

export const textoRegla = (
  p: Pick<ProgramaSellos, "regla" | "monto_por_sello" | "tipo" | "puntos_cada" | "nombre_puntos">,
  formato: (n: number) => string,
) =>
  p.tipo === "puntos"
    ? `1 ${unidad(p, 1)} por cada ${formato(Number(p.puntos_cada))} de compra`
    : p.regla === "monto"
      ? `1 sello por cada ${formato(Number(p.monto_por_sello))} de compra`
      : "1 sello por visita";

// Días que le quedan de prueba (negativo si ya venció).
export function diasPrueba(n: Pick<Negocio, "prueba_hasta">) {
  const hasta = Date.parse(`${n.prueba_hasta}T23:59:59`);
  return Math.floor((hasta - Date.now()) / 86400000);
}
export const vigente = (n: Pick<Negocio, "estado" | "prueba_hasta">) =>
  n.estado === "activo" || (n.estado === "prueba" && diasPrueba(n) >= 0);
