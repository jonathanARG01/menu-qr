// Textos traducidos por idioma: {"en": {"nombre": "...", "descripcion": "..."}}
export type Traducciones = Partial<Record<string, Record<string, string | undefined>>>;

export const TEMAS = ["clasico", "noir", "esmeralda", "street", "retro"] as const;
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
};

export type Categoria = {
  id: string;
  restaurante_id: string;
  nombre: string;
  orden: number;
  visible: boolean;
  traducciones?: Traducciones;
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
};

export type Mesa = {
  id: string;
  restaurante_id: string;
  numero: string;
  sucursal_id?: string | null;
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
