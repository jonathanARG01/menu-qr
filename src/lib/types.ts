import type { Ajustes } from "./salon";

// Textos traducidos por idioma: {"en": {"nombre": "...", "descripcion": "..."}}
export type Traducciones = Partial<Record<string, Record<string, string | undefined>>>;

export const TEMAS = [
  "clasico",
  "noir",
  "esmeralda",
  "street",
  "retro",
  "bistro",
  "veggie",
  "forno",
  "oriente",
  "neon",
  "tropical",
  "jugos",
  "batidos",
  "gala",
  "vitrina",
  "cinta",
  "trattoria",
  "kraft",
  "madera",
  "coctel",
  "revista",
] as const;
export type Tema = (typeof TEMAS)[number];

export type Restaurante = {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  logo_url: string | null;
  color_primario: string;
  color_fondo: string;
  moneda: string;
  whatsapp: string | null;
  plan: "free" | "carta" | "pro" | "grupo";
  // Puede faltar si aún no se ejecutó la migración 0002.
  tema?: Tema;
  activo: boolean;
  // Pueden faltar si aún no se ejecutó la migración 0003.
  idiomas?: string[];
  traducciones?: Traducciones;
  pedidos_whatsapp?: boolean;
  // Puede faltar si aún no se ejecutó la migración 0004.
  ajustes?: Partial<Ajustes>;
  // Puede faltar si aún no se ejecutó la migración 0012.
  ciclo?: "mensual" | "trimestral" | "semestral" | "anual";
  // Prueba de 14 días y plan pago (migración 0016). prueba_fin null: no vence.
  prueba_inicio?: string | null;
  prueba_fin?: string | null;
  plan_inicio?: string | null;
  pausa_motivo?: "prueba" | "manual" | null;
};

export type Categoria = {
  id: string;
  restaurante_id: string;
  nombre: string;
  orden: number;
  visible: boolean;
  traducciones?: Traducciones;
  // Pantalla a la que van sus comandas (Cocina, Barra…). Requiere la migración 0004.
  estacion?: string;
  // Categoría de la carta de ejemplo de una cuenta nueva (migración 0016).
  ejemplo?: boolean;
};

export type Plato = {
  id: string;
  restaurante_id: string;
  categoria_id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  foto_url: string | null;
  disponible: boolean;
  etiquetas: string[];
  orden: number;
  traducciones?: Traducciones;
  // Se muestra en la sección de destacados de la carta (migración 0007).
  destacado?: boolean;
  // Agotado hasta esa hora (lo marca la cocina; migración 0009).
  agotado_hasta?: string | null;
  // Plato de ejemplo de una cuenta nueva (migración 0016): se borra con "Borrar ejemplos".
  ejemplo?: boolean;
  // Solo en la carta: precio de lista cuando hay una promo vigente, y si está agotado ahora.
  precio_lista?: number;
  agotado?: boolean;
};

export type Promo = {
  id: string;
  restaurante_id: string;
  nombre: string;
  descripcion: string | null;
  // 0 = domingo … 6 = sábado; vacío = todos los días.
  dias: number[];
  desde: string;
  hasta: string;
  descuento: number;
  categorias: string[];
  platos: string[];
  activa: boolean;
  orden: number;
};

export type Mesa = {
  id: string;
  restaurante_id: string;
  numero: string;
  sucursal_id?: string | null;
  // Lugar en el plano (migración 0004): casillas de la cuadrícula del piso.
  piso_id?: string | null;
  x?: number;
  y?: number;
  ancho?: number;
  alto?: number;
  forma?: "cuadrada" | "redonda" | "rectangular";
  capacidad?: number;
};

export type Sucursal = {
  id: string;
  restaurante_id: string;
  slug: string;
  nombre: string;
  direccion: string | null;
  horario: string | null;
  whatsapp: string | null;
  orden: number;
  activa: boolean;
};

export type Seccion = Categoria & { platos: Plato[] };
