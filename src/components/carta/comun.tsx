import type { Plato, Restaurante, Seccion, Tema } from "@/lib/types";
import { formatoPrecio } from "@/lib/utils";
import { useCarta } from "./contexto";

export type PropsTema = {
  restaurante: Restaurante;
  secciones: Seccion[];
  // En el panel la carta se muestra dentro de un marco de teléfono.
  vistaPrevia?: boolean;
  // Barra inferior (mesa, WhatsApp y pedido); va dentro del diseño para heredar sus colores.
  pie?: React.ReactNode;
};

// Pestañas del selector de diseños en el panel.
export const GRUPOS_TEMA = [
  { id: "sencillos", nombre: "Sencillos" },
  { id: "elegantes", nombre: "Elegantes" },
  { id: "casuales", nombre: "Casuales" },
  { id: "bebidas", nombre: "Bares y bebidas" },
  { id: "premium", nombre: "Premium" },
] as const;

export type GrupoTema = (typeof GRUPOS_TEMA)[number]["id"];

export const TEMA_INFO: Record<Tema, { nombre: string; descripcion: string; acento: string; fondo: string; grupo: GrupoTema }> = {
  clasico: {
    nombre: "Clásico",
    descripcion: "Claro y sencillo, usa tus colores",
    acento: "#b45309",
    fondo: "#fffbf5",
    grupo: "sencillos",
  },
  noir: {
    nombre: "Noche",
    descripcion: "Oscuro y elegante, fotos grandes",
    acento: "#e8a33d",
    fondo: "#0f0f10",
    grupo: "elegantes",
  },
  esmeralda: {
    nombre: "Esmeralda",
    descripcion: "Verde gourmet con detalles dorados",
    acento: "#d4af6a",
    fondo: "#0e3b30",
    grupo: "elegantes",
  },
  street: {
    nombre: "Comida rápida",
    descripcion: "Negro con colores intensos",
    acento: "#ffc300",
    fondo: "#121212",
    grupo: "casuales",
  },
  retro: { nombre: "Retro", descripcion: "Crema y café con mostaza", acento: "#f2b134", fondo: "#3a2c25", grupo: "casuales" },
  bistro: {
    nombre: "Bistró",
    descripcion: "Verde intenso, letras pintadas y platos redondos",
    acento: "#f5c518",
    fondo: "#1d4a2f",
    grupo: "casuales",
  },
  veggie: {
    nombre: "Dorado",
    descripcion: "Verde oscuro con marco y letras doradas",
    acento: "#d9b25f",
    fondo: "#14291b",
    grupo: "elegantes",
  },
  forno: {
    nombre: "Forno",
    descripcion: "Blanco con pinceladas, ideal para pizzerías",
    acento: "#c8302b",
    fondo: "#f3f2ee",
    grupo: "sencillos",
  },
  oriente: {
    nombre: "Oriente",
    descripcion: "Verde y crema con ondas, cocina asiática",
    acento: "#2f6b4f",
    fondo: "#f3eedd",
    grupo: "elegantes",
  },
  neon: {
    nombre: "Neón",
    descripcion: "Negro con luces de neón y brochazos",
    acento: "#ff2bd6",
    fondo: "#07070b",
    grupo: "bebidas",
  },
  tropical: {
    nombre: "Tropical",
    descripcion: "Negro con hojas y neón, para tragos",
    acento: "#ff3fa4",
    fondo: "#0b0d0c",
    grupo: "bebidas",
  },
  jugos: {
    nombre: "Natural",
    descripcion: "Selva verde y etiquetas de colores, para jugos",
    acento: "#8cc63f",
    fondo: "#0f2a17",
    grupo: "bebidas",
  },
  batidos: {
    nombre: "Soleado",
    descripcion: "Amarillo alegre con números, para batidos",
    acento: "#3b1f0e",
    fondo: "#ffc62a",
    grupo: "bebidas",
  },
  gala: {
    nombre: "Gala",
    descripcion: "Verde profundo y dorado, cada plato como un afiche",
    acento: "#c9a96a",
    fondo: "#12302a",
    grupo: "elegantes",
  },
  vitrina: {
    nombre: "Vitrina",
    descripcion: "Tarjetas de vidrio sobre verde oscuro",
    acento: "#8bc34a",
    fondo: "#1b231d",
    grupo: "elegantes",
  },
  cinta: {
    nombre: "Cinta",
    descripcion: "Papel claro con cintas verdes y precios en rojo",
    acento: "#d62828",
    fondo: "#efe6d3",
    grupo: "casuales",
  },
  trattoria: {
    nombre: "Trattoria",
    descripcion: "Pizarra negra con los colores de Italia",
    acento: "#d7263d",
    fondo: "#151515",
    grupo: "casuales",
  },
  kraft: {
    nombre: "Kraft",
    descripcion: "Papel crema y etiquetas de cartón",
    acento: "#c0392b",
    fondo: "#f4ede1",
    grupo: "sencillos",
  },
  madera: {
    nombre: "Madera",
    descripcion: "Mesa de madera y platos en cuadrícula",
    acento: "#f4a261",
    fondo: "#6b4423",
    grupo: "sencillos",
  },
  coctel: {
    nombre: "Cóctel",
    descripcion: "Pizarra negra, letras gastadas y precios grandes",
    acento: "#ff5fa2",
    fondo: "#0d0d0d",
    grupo: "bebidas",
  },
  revista: {
    nombre: "Revista",
    descripcion: "Se hojea como una revista, con sonido de página",
    acento: "#b8452f",
    fondo: "#f5efe6",
    grupo: "premium",
  },
};

export const ICONOS: Record<string, string> = {
  vegetariano: "🌿",
  vegano: "🌱",
  "sin gluten": "🌾",
  picante: "🌶️",
  nuevo: "✨",
  recomendado: "⭐",
};

// Precio del plato tal como se muestra en cada diseño: con el precio anterior tachado si hay promo, o "Agotado".
export const precio = (plato: Plato, restaurante: Restaurante) => <PrecioPlato plato={plato} moneda={restaurante.moneda} />;

function PrecioPlato({ plato, moneda }: { plato: Plato; moneda: string }) {
  const { t } = useCarta();
  if (plato.agotado) {
    return (
      <span className="whitespace-nowrap">
        <s className="opacity-50">{formatoPrecio(plato.precio, moneda)}</s>{" "}
        <span className="rounded bg-current/15 px-1 text-[0.75em] font-semibold uppercase tracking-wide">{t("agotado")}</span>
      </span>
    );
  }
  if (plato.precio_lista !== undefined) {
    return (
      <span className="whitespace-nowrap">
        <s className="mr-1 text-[0.75em] font-normal opacity-60">{formatoPrecio(plato.precio_lista, moneda)}</s>
        {formatoPrecio(plato.precio, moneda)}
      </span>
    );
  }
  return <>{formatoPrecio(plato.precio, moneda)}</>;
}

export const idSeccion = (id: string) => `c-${id}`;

export function Etiquetas({ plato, className = "" }: { plato: Plato; className?: string }) {
  const { t } = useCarta();
  if (plato.etiquetas.length === 0) return null;
  return (
    <span className={`flex flex-wrap gap-x-3 gap-y-1 text-xs ${className}`}>
      {plato.etiquetas.map((et) => (
        <span key={et}>
          {ICONOS[et] ?? "•"} {t(et as Parameters<typeof t>[0])}
        </span>
      ))}
    </span>
  );
}

export function Foto({ plato, className }: { plato: Plato; className: string }) {
  const { ajustes } = useCarta();
  if (!plato.foto_url) {
    if (!ajustes.imagenes_defecto) return null;
    return (
      <span
        aria-hidden
        className={`flex items-center justify-center ${className}`}
        style={{ background: "color-mix(in srgb, currentColor 8%, transparent)" }}
      >
        <SinFoto plato={plato} />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={plato.foto_url} alt={plato.nombre} loading="lazy" decoding="async" className={className} />;
}

// Emoji de reserva para los diseños de platos redondos cuando el plato no tiene foto.
const TRAGOS: [RegExp, string][] = [
  [/martini|cosmopolitan/, "🍸"],
  [/negroni|fernet|whisky|sour|vermu|campari|aperol|spritz/, "🥃"],
  [/caipi|daiquiri|colada|pitufo|mojito|sunrise|fizz|lagoon|panther|beach|jungle|paraguayo|trago|coctel/, "🍹"],
];

const EMOJIS: [RegExp, string][] = [
  [/risotto/, "🍛"],
  [/milanesa|matambre|asado|vacio|entrana/, "🥩"],
  [
    /pizza|margarit[ah]|pepperoni|prosciutto|cuatro quesos|carnes|hongos|mussarela|muzzarella|calabresa|hawaiana|suprema|marinara|diavola|capricciosa|caprese/,
    "🍕",
  ],
  [/calzone|rollito|lumpia|spring|empanad|gyoza/, "🥟"],
  [/hamburgues|burger/, "🍔"],
  [/pancho|hot dog|salchicha/, "🌭"],
  [/quesadilla|taco|burrito|nacho/, "🌮"],
  [/papas/, "🍟"],
  [/medialuna|croissant/, "🥐"],
  [/sandwich|sanguch|tostado|lomito|wrap|chivito/, "🥪"],
  [/panqueque|waffle/, "🥞"],
  ...TRAGOS,
  [/ roll|sushi|philadelphia|california|tuna|maki/, "🍣"],
  [/fideo|ramen|soba|mie |noodle|pasta/, "🍜"],
  [/sopa|tom yum|tom yam|miso|caldo|gazpacho/, "🍲"],
  [/biryani|masala|tikka|curry|arroz|risotto/, "🍛"],
  [/sorrentino|ravioles|noquis|lasagna|tallarines/, "🍝"],
  [/provoleta|burrata|queso/, "🧀"],
  [/malbec|vino|torrontes|espumante|cabernet|champagne/, "🍷"],
  [/kabab|falafel|medall/, "🧆"],
  [/bruschetta| pan /, "🥖"],
  [/langostin|camar|shrimp/, "🍤"],
  [/pescado|salmon|merluza|trucha|atun|abadejo/, "🐟"],
  [/huevo|omelette|revuelto/, "🍳"],
  [/pollo|alita|ayam/, "🍗"],
  [/carne|daging|teriyaki|bife/, "🥩"],
  [/edamame|arveja/, "🫛"],
  [/tofu/, "🥢"],
  [/mochi/, "🍡"],
  [/cheesecake|torta|tarta|tiramisu|mil hojas/, "🍰"],
  [/brownie|chocolate/, "🍫"],
  [/galleta|cookie|alfajor/, "🍪"],
  [/dona|donut|berlin|bola de fraile/, "🍩"],
  [/helado|affogato/, "🍨"],
  [/gulab|rasmalai|flan/, "🍮"],
  [/bubble/, "🧋"],
  [/cafe|capuch|cappuccino|espresso|v60/, "☕"],
  [/matcha| te |latte/, "🍵"],
  [/batido|shake|licuado|smoothie|leche/, "🥛"],
  [/limonada|jugo de limon/, "🍋"],
  [/ (verde|tropical|conga|purace|rojo|mixto|detox|naranja|zanahoria) |jugo/, "🧃"],
  [/cerveza| pinta| ipa |lager|stout|porron|chopp/, "🍺"],
  [/ agua /, "💧"],
  [/gaseosa|cola|lima-limon|soda/, "🥤"],
  [/cactus/, "🌵"],
  [/planta|calathea|pothos|monstera|haworthia|dracaena|croton|helecho/, "🪴"],
  [/ensalada|verdura|vegetal/, "🥗"],
];

const normalizar = (texto: string) => ` ${texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")} `;

// Busca por el nombre; si no encuentra, por la descripción (así "Banana" con "masa y muzzarella" sale como pizza).
export const emojiPlato = (nombre: string, descripcion?: string | null) => {
  const buscar = (texto: string) => EMOJIS.find(([re]) => re.test(normalizar(texto)))?.[1];
  const desc = normalizar(descripcion ?? "");
  // Si lleva alcohol es un trago, aunque se llame como una pizza ("Margarita").
  if (/tequila|vodka| ron[ ,]| gin[ ,]|cachaza|whisky|licor|campari|vermut|fernet/.test(desc)) {
    return TRAGOS.find(([re]) => re.test(normalizar(nombre)))?.[1] ?? "🍹";
  }
  const porDescripcion = /masa|mozzarella|muzzarella|mussarela/.test(desc) ? "🍕" : undefined;
  return buscar(nombre) ?? porDescripcion ?? (descripcion ? buscar(descripcion) : undefined) ?? "🍽️";
};

// Imágenes por defecto para platos sin foto (Fluent Emoji 3D de Microsoft, licencia MIT; en public/defecto).
const ARCHIVO: Record<string, string> = {
  "🍕": "pizza",
  "🥟": "empanada",
  "🍔": "hamburguesa",
  "🌭": "pancho",
  "🌮": "taco",
  "🍟": "papas",
  "🥞": "panqueque",
  "🥐": "medialuna",
  "🥪": "sandwich",
  "🍸": "coctel",
  "🥃": "vaso",
  "🍹": "trago",
  "🍣": "sushi",
  "🍜": "fideos",
  "🍲": "sopa",
  "🍛": "curry",
  "🍝": "pasta",
  "🧀": "queso",
  "🍷": "vino",
  "🧆": "falafel",
  "🥖": "pan",
  "🍤": "langostino",
  "🐟": "pescado",
  "🍳": "huevo",
  "🍗": "pollo",
  "🥩": "carne",
  "🫛": "arveja",
  "🥢": "palillos",
  "🍡": "dango",
  "🍰": "torta",
  "🍫": "chocolate",
  "🍪": "galleta",
  "🍩": "dona",
  "🍨": "helado",
  "🍮": "flan",
  "🧋": "bubble",
  "☕": "cafe",
  "🍵": "te",
  "🥛": "batido",
  "🍋": "limon",
  "🧃": "jugo",
  "🍺": "cerveza",
  "💧": "agua",
  "🥤": "gaseosa",
  "🌵": "cactus",
  "🪴": "planta",
  "🥗": "ensalada",
};

export const imagenDefecto = (nombre: string, descripcion?: string | null) =>
  `/defecto/${ARCHIVO[emojiPlato(nombre, descripcion)] ?? "plato"}.webp`;

// Lo que va en el lugar de la foto: la imagen por defecto si el restaurante la activó, si no el emoji.
export function SinFoto({ plato }: { plato: Plato }) {
  const { ajustes } = useCarta();
  if (!ajustes.imagenes_defecto) return <>{emojiPlato(plato.nombre, plato.descripcion)}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imagenDefecto(plato.nombre, plato.descripcion)}
      alt=""
      loading="lazy"
      decoding="async"
      className="h-[68%] w-[68%] object-contain drop-shadow-md"
    />
  );
}

// Foto circular del plato; sin foto, la imagen por defecto o un emoji para que el diseño no quede vacío.
export function FotoRedonda({ plato, className, style }: { plato: Plato; className: string; style?: React.CSSProperties }) {
  if (plato.foto_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={plato.foto_url}
        alt={plato.nombre}
        loading="lazy"
        decoding="async"
        className={`aspect-square rounded-full object-cover ${className}`}
        style={style}
      />
    );
  }
  return (
    <span aria-hidden className={`flex aspect-square items-center justify-center rounded-full ${className}`} style={style}>
      <SinFoto plato={plato} />
    </span>
  );
}

export function Logo({
  restaurante,
  className,
  style,
}: {
  restaurante: Restaurante;
  className: string;
  style?: React.CSSProperties;
}) {
  if (!restaurante.logo_url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={restaurante.logo_url} alt={`Logo de ${restaurante.nombre}`} className={className} style={style} />;
}

export function CartaVacia({ className = "" }: { className?: string }) {
  const { t } = useCarta();
  return <p className={`py-16 text-center opacity-70 ${className}`}>{t("vacia")}</p>;
}

// Separa una descripción en ingredientes, para los diseños que los muestran en lista.
export const ingredientes = (descripcion: string | null) =>
  (descripcion ?? "")
    .split(/\s*[,;+·]\s*|\s+y\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
