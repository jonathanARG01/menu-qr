import type { Seccion } from "@/lib/types";

// Carta de ejemplo para la vista previa cuando el restaurante todavía no cargó platos.
const plato = (id: string, categoria_id: string, nombre: string, descripcion: string, precio: number, orden: number) => ({
  id,
  restaurante_id: "ejemplo",
  categoria_id,
  nombre,
  descripcion,
  precio,
  foto_url: null,
  disponible: true,
  etiquetas: [],
  orden,
});

export const SECCIONES_EJEMPLO: Seccion[] = [
  {
    id: "ej-entradas",
    restaurante_id: "ejemplo",
    nombre: "Entradas",
    orden: 0,
    visible: true,
    platos: [
      plato("ej-1", "ej-entradas", "Empanadas (3)", "Carne cortada a cuchillo", 8.5, 0),
      plato("ej-2", "ej-entradas", "Provoleta", "Orégano y aceite de oliva", 9, 1),
    ],
  },
  {
    id: "ej-principales",
    restaurante_id: "ejemplo",
    nombre: "Principales",
    orden: 1,
    visible: true,
    platos: [
      plato("ej-3", "ej-principales", "Bife de chorizo", "350 g, papas rústicas", 22, 0),
      plato("ej-4", "ej-principales", "Risotto de hongos", "Parmesano y trufa", 15.9, 1),
    ],
  },
];
