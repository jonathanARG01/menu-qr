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

export const TEMA_INFO: Record<Tema, { nombre: string; descripcion: string; acento: string; fondo: string }> = {
  clasico: { nombre: "Clásico", descripcion: "Claro y sencillo, usa tus colores", acento: "#b45309", fondo: "#fffbf5" },
  noir: { nombre: "Noche", descripcion: "Oscuro y elegante, fotos grandes", acento: "#e8a33d", fondo: "#0f0f10" },
  esmeralda: { nombre: "Esmeralda", descripcion: "Verde gourmet con detalles dorados", acento: "#d4af6a", fondo: "#0e3b30" },
  street: { nombre: "Comida rápida", descripcion: "Negro con colores intensos", acento: "#ffc300", fondo: "#121212" },
  retro: { nombre: "Retro", descripcion: "Crema y café con mostaza", acento: "#f2b134", fondo: "#3a2c25" },
  bistro: {
    nombre: "Bistró",
    descripcion: "Verde intenso, letras pintadas y platos redondos",
    acento: "#f5c518",
    fondo: "#1d4a2f",
  },
  veggie: { nombre: "Dorado", descripcion: "Verde oscuro con marco y letras doradas", acento: "#d9b25f", fondo: "#14291b" },
  forno: { nombre: "Forno", descripcion: "Blanco con pinceladas, ideal para pizzerías", acento: "#c8302b", fondo: "#f3f2ee" },
  oriente: { nombre: "Oriente", descripcion: "Verde y crema con ondas, cocina asiática", acento: "#2f6b4f", fondo: "#f3eedd" },
  neon: { nombre: "Neón", descripcion: "Negro con luces de neón y brochazos", acento: "#ff2bd6", fondo: "#07070b" },
};

export const ICONOS: Record<string, string> = {
  vegetariano: "🌿",
  vegano: "🌱",
  "sin gluten": "🌾",
  picante: "🌶️",
  nuevo: "✨",
  recomendado: "⭐",
};

export const precio = (plato: Plato, restaurante: Restaurante) => formatoPrecio(plato.precio, restaurante.moneda);

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
  if (!plato.foto_url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={plato.foto_url} alt={plato.nombre} loading="lazy" decoding="async" className={className} />;
}

// Emoji de reserva para los diseños de platos redondos cuando el plato no tiene foto.
const EMOJIS: [RegExp, string][] = [
  [/pizza|margarita|pepperoni|prosciutto|cuatro quesos|carnes|hongos/, "🍕"],
  [/hamburgues|burger/, "🍔"],
  [/papas/, "🍟"],
  [/rollito|lumpia|spring|empanad|gyoza/, "🥟"],
  [/roll|sushi|philadelphia|california|tuna|maki/, "🍣"],
  [/fideo|ramen|soba|mie |noodle|pasta/, "🍜"],
  [/sopa|tom yum|tom yam|miso|caldo/, "🍲"],
  [/biryani|masala|tikka|curry|arroz/, "🍛"],
  [/kabab|falafel|medall/, "🧆"],
  [/bruschetta|pan /, "🥖"],
  [/langostin|camar|shrimp/, "🍤"],
  [/pollo|alita|ayam/, "🍗"],
  [/carne|daging|teriyaki|bife/, "🥩"],
  [/edamame|arveja/, "🫛"],
  [/tofu/, "🥢"],
  [/mochi/, "🍡"],
  [/cheesecake|torta|tarta/, "🍰"],
  [/helado/, "🍨"],
  [/gulab|rasmalai|flan/, "🍮"],
  [/bubble/, "🧋"],
  [/matcha|té |latte/, "🍵"],
  [/limonada|jugo/, "🍋"],
  [/ensalada|verdura|vegetal/, "🥗"],
];

const emojiPlato = (nombre: string) => {
  const n = ` ${nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")} `;
  return EMOJIS.find(([re]) => re.test(n))?.[1] ?? "🍽️";
};

// Foto circular del plato; sin foto, un plato con un emoji para que el diseño no quede vacío.
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
      {emojiPlato(plato.nombre)}
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
