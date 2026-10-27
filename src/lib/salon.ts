import type { Propina } from "./cuenta";

// Gestión de salón: roles, secciones del panel, ajustes de cada restaurante y tipos de mesas, pedidos y pagos.

// ── Roles ─────────────────────────────────────
// "staff" es el dueño del servicio entrando como soporte: tiene los mismos permisos que el administrador.
export type Rol = "dueno" | "staff" | "mesero" | "cocina";

export const NOMBRE_ROL: Record<Rol, string> = {
  dueno: "Administrador",
  staff: "Soporte",
  mesero: "Mesero",
  cocina: "Cocina",
};

export const esAdmin = (rol?: string | null) => rol === "dueno" || rol === "staff";

// ── Secciones del panel ───────────────────────
export type Seccion =
  | "salon"
  | "cocina"
  | "carta"
  | "marca"
  | "qr"
  | "estadisticas"
  | "sucursales"
  | "equipo"
  | "personalizar"
  | "referidos";

export type InfoSeccion = { id: Seccion; href: string; texto: string; grupo: "Servicio" | "Carta" | "Negocio"; ayuda: string };

export const SECCIONES: InfoSeccion[] = [
  { id: "salon", href: "/panel/salon", texto: "Salón", grupo: "Servicio", ayuda: "Plano de mesas, pedidos y cobros" },
  { id: "cocina", href: "/panel/cocina", texto: "Cocina", grupo: "Servicio", ayuda: "Comandas en tiempo real" },
  { id: "carta", href: "/panel", texto: "Carta", grupo: "Carta", ayuda: "Platos, precios y categorías" },
  { id: "marca", href: "/panel/marca", texto: "Marca", grupo: "Carta", ayuda: "Diseño, logo, idiomas" },
  { id: "qr", href: "/panel/qr", texto: "QR", grupo: "Carta", ayuda: "Códigos para imprimir" },
  { id: "estadisticas", href: "/panel/estadisticas", texto: "Estadísticas", grupo: "Negocio", ayuda: "Visitas y lo más pedido" },
  { id: "sucursales", href: "/panel/sucursales", texto: "Sucursales", grupo: "Negocio", ayuda: "Locales del mismo negocio" },
  { id: "equipo", href: "/panel/equipo", texto: "Equipo", grupo: "Negocio", ayuda: "Meseros, cocina y administradores" },
  {
    id: "personalizar",
    href: "/panel/personalizar",
    texto: "Personalizar",
    grupo: "Negocio",
    ayuda: "Qué se ve y cómo se cobra",
  },
  { id: "referidos", href: "/panel/referidos", texto: "Invitar y ahorrar", grupo: "Negocio", ayuda: "Tu link y tus descuentos" },
];

// Lo que cada rol puede llegar a ver. El administrador elige, dentro de esto, qué le aparece a cada uno.
// La base de datos aplica los permisos de verdad: un mesero no puede cambiar precios aunque llegue a la pantalla.
export const PERMITIDAS: Record<"mesero" | "cocina", Seccion[]> = {
  mesero: ["salon", "cocina", "estadisticas"],
  cocina: ["cocina", "salon"],
};

// ── Ajustes (restaurantes.ajustes) ─────────────
export type Modulo = "salon" | "cocina" | "cobros" | "pedidos_mesa" | "estadisticas" | "sucursales" | "equipo";

export type Ajustes = {
  // Partes del sistema en uso. Lo apagado desaparece del panel (y de la carta, si corresponde).
  modulos: Record<Modulo, boolean>;
  // Qué secciones ve cada rol.
  vistas: { mesero: Seccion[]; cocina: Seccion[] };
  // Los pedidos que hace el cliente desde la carta esperan que un mesero los confirme antes de ir a cocina.
  confirmar_pedidos: boolean;
  propinas: {
    activas: boolean;
    porcentajes: number[];
    montos: number[];
    // Permite escribir cualquier porcentaje o monto.
    libre: boolean;
    // Porcentaje marcado de entrada (null: ninguno).
    sugerida: number | null;
  };
  metodos_pago: string[];
  // Pantallas de preparación: cada categoría de la carta manda sus comandas a una.
  estaciones: string[];
  // Minutos tras los que una comanda se pinta en amarillo y en rojo.
  alertas: { amarillo: number; rojo: number };
  // Sonido al pasar de página en el diseño Revista (archivos en public/sonidos).
  sonido_hoja: SonidoHoja;
  // Los platos sin foto muestran una imagen ilustrada según lo que son (archivos en public/defecto).
  imagenes_defecto: boolean;
};

export const SONIDOS_HOJA = ["papel", "hojas", "diario", "ninguno"] as const;
export type SonidoHoja = (typeof SONIDOS_HOJA)[number];

export const AJUSTES_BASE: Ajustes = {
  modulos: {
    salon: true,
    cocina: true,
    cobros: true,
    pedidos_mesa: false,
    estadisticas: true,
    sucursales: true,
    equipo: true,
  },
  vistas: { mesero: ["salon", "cocina"], cocina: ["cocina"] },
  confirmar_pedidos: false,
  propinas: { activas: true, porcentajes: [10, 15, 20], montos: [500, 1000, 2000], libre: true, sugerida: 10 },
  metodos_pago: ["Efectivo", "Tarjeta de débito", "Tarjeta de crédito", "Transferencia", "Mercado Pago"],
  estaciones: ["Cocina", "Barra"],
  alertas: { amarillo: 10, rojo: 20 },
  sonido_hoja: "papel",
  imagenes_defecto: false,
};

// Une lo guardado con los valores por defecto (lo que falte o venga mal se completa).
export function leerAjustes(guardado?: Partial<Ajustes> | null): Ajustes {
  const g = guardado ?? {};
  const listaNumeros = (v: unknown, base: number[]) =>
    Array.isArray(v) ? v.map(Number).filter((n) => Number.isFinite(n) && n > 0) : base;
  const listaTextos = (v: unknown, base: string[]) => (Array.isArray(v) ? v.map(String).filter((t) => t.trim()) : base);
  const propinas = { ...AJUSTES_BASE.propinas, ...(g.propinas ?? {}) };
  return {
    modulos: { ...AJUSTES_BASE.modulos, ...(g.modulos ?? {}) },
    vistas: {
      mesero: listaTextos(g.vistas?.mesero, AJUSTES_BASE.vistas.mesero) as Seccion[],
      cocina: listaTextos(g.vistas?.cocina, AJUSTES_BASE.vistas.cocina) as Seccion[],
    },
    confirmar_pedidos: g.confirmar_pedidos ?? AJUSTES_BASE.confirmar_pedidos,
    propinas: {
      ...propinas,
      porcentajes: listaNumeros(propinas.porcentajes, AJUSTES_BASE.propinas.porcentajes),
      montos: listaNumeros(propinas.montos, AJUSTES_BASE.propinas.montos),
    },
    metodos_pago: listaTextos(g.metodos_pago, AJUSTES_BASE.metodos_pago),
    estaciones: listaTextos(g.estaciones, AJUSTES_BASE.estaciones),
    alertas: { ...AJUSTES_BASE.alertas, ...(g.alertas ?? {}) },
    imagenes_defecto: g.imagenes_defecto === true,
    sonido_hoja: SONIDOS_HOJA.includes(g.sonido_hoja as SonidoHoja) ? (g.sonido_hoja as SonidoHoja) : AJUSTES_BASE.sonido_hoja,
  };
}

// Módulo del que depende cada sección (las que no figuran están siempre).
const MODULO_DE: Partial<Record<Seccion, Modulo>> = {
  salon: "salon",
  cocina: "cocina",
  estadisticas: "estadisticas",
  sucursales: "sucursales",
  equipo: "equipo",
};

// Secciones que ve esta persona, en el orden del menú.
export function seccionesVisibles(rol: string | undefined, ajustes: Ajustes): InfoSeccion[] {
  const encendida = (s: Seccion) => {
    const m = MODULO_DE[s];
    return !m || ajustes.modulos[m];
  };
  if (esAdmin(rol)) return SECCIONES.filter((s) => encendida(s.id));
  if (rol !== "mesero" && rol !== "cocina") return [];
  const elegidas = ajustes.vistas[rol];
  return SECCIONES.filter((s) => PERMITIDAS[rol].includes(s.id) && elegidas.includes(s.id) && encendida(s.id));
}

// ── Plano ─────────────────────────────────────
export type TipoElemento = "pasillo" | "pared" | "barra" | "bano" | "cocina" | "entrada" | "escalera" | "planta" | "caja";

export const ELEMENTOS: Record<TipoElemento, { texto: string; bloquea: boolean; ancho: number; alto: number }> = {
  pasillo: { texto: "Pasillo", bloquea: true, ancho: 8, alto: 2 },
  pared: { texto: "Pared", bloquea: true, ancho: 6, alto: 1 },
  barra: { texto: "Barra", bloquea: true, ancho: 6, alto: 2 },
  bano: { texto: "Baños", bloquea: true, ancho: 3, alto: 3 },
  cocina: { texto: "Cocina", bloquea: true, ancho: 5, alto: 4 },
  entrada: { texto: "Entrada", bloquea: true, ancho: 3, alto: 1 },
  escalera: { texto: "Escalera", bloquea: true, ancho: 3, alto: 3 },
  caja: { texto: "Caja", bloquea: true, ancho: 3, alto: 2 },
  planta: { texto: "Planta", bloquea: false, ancho: 1, alto: 1 },
};

export type Elemento = { id: string; tipo: TipoElemento; x: number; y: number; ancho: number; alto: number; texto?: string };

export type Piso = {
  id: string;
  restaurante_id: string;
  sucursal_id: string | null;
  nombre: string;
  orden: number;
  columnas: number;
  filas: number;
  norte: "arriba" | "derecha" | "abajo" | "izquierda";
  elementos: Elemento[];
};

// ── Servicio ──────────────────────────────────
export type EstadoPedido = "pendiente" | "nuevo" | "preparando" | "listo" | "entregado" | "cancelado";

export const NOMBRE_ESTADO: Record<EstadoPedido, string> = {
  pendiente: "Por confirmar",
  nuevo: "Nuevo",
  preparando: "Preparando",
  listo: "Listo",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export type Aviso = { tipo: "cuenta" | "mozo"; detalle?: SolicitudCuenta | null; at: string };

export type Cuenta = {
  id: string;
  restaurante_id: string;
  sucursal_id: string | null;
  mesa_id: string | null;
  mesa_numero: string | null;
  estado: "abierta" | "cerrada" | "anulada";
  comensales: number;
  aviso: Aviso | null;
  abierta_at: string;
  cerrada_at: string | null;
};

export type PedidoItem = {
  id: string;
  pedido_id: string;
  restaurante_id: string;
  plato_id: string | null;
  nombre: string;
  precio: number;
  cantidad: number;
  nota: string | null;
  comensal: number | null;
  listo: boolean;
  created_at: string;
};

export type Pedido = {
  id: string;
  numero: number;
  restaurante_id: string;
  cuenta_id: string | null;
  sucursal_id: string | null;
  mesa_numero: string | null;
  estacion: string;
  origen: "cliente" | "personal";
  estado: EstadoPedido;
  nombre: string | null;
  nota: string | null;
  // Orden manual en la pantalla de cocina (migración 0005); sin valor va por hora de llegada.
  orden?: number | null;
  created_at: string;
  actualizado_at: string;
  pedido_items?: PedidoItem[];
};

export type Pago = {
  id: string;
  cuenta_id: string;
  parte: string | null;
  monto: number;
  propina: number;
  metodo: string;
  propina_metodo: string | null;
  created_at: string;
};

// Lo que el cliente elige al pedir la cuenta desde la carta.
export type SolicitudCuenta = {
  modo: "junto" | "iguales" | "consumo";
  partes?: number;
  propina?: Propina;
  metodo?: string;
  // Al dividir, el medio de pago de cada persona (posición 0 = persona 1); vacío si no lo eligió.
  metodos?: string[];
  monto?: number;
};

// "5" → "Mesa 5"; si ya la llamaron "Mesa 5", "Terraza 2" o "Barra", queda como está.
export const nombreMesa = (numero: string | null | undefined) =>
  !numero ? "Mostrador" : /^\d+$/.test(numero.trim()) ? `Mesa ${numero.trim()}` : numero.trim();
