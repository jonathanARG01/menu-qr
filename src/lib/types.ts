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
  activo: boolean;
};

export type Categoria = {
  id: string;
  restaurante_id: string;
  nombre: string;
  orden: number;
  visible: boolean;
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
};

export type Mesa = {
  id: string;
  restaurante_id: string;
  numero: string;
};
