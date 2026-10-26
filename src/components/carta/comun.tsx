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
