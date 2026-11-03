import type { Propina } from "./cuenta";
import { PAIS_BASE, paisDe, type Region } from "./region";
import { leerRedes, REDES_VACIAS, type Redes } from "./redes";

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
  | "llevar"
  | "cocina"
  | "reservas"
  | "caja"
  | "carta"
  | "promos"
  | "marca"
  | "qr"
  | "estadisticas"
  | "reportes"
  | "clientes"
  | "sellos"
  | "sucursales"
  | "equipo"
  | "personalizar"
  | "referidos";

export type InfoSeccion = { id: Seccion; href: string; texto: string; grupo: "Servicio" | "Carta" | "Negocio"; ayuda: string };

export const SECCIONES: InfoSeccion[] = [
  { id: "salon", href: "/panel/salon", texto: "Salón", grupo: "Servicio", ayuda: "Plano de mesas, pedidos y cobros" },
  { id: "llevar", href: "/panel/llevar", texto: "Para llevar", grupo: "Servicio", ayuda: "Pedidos para llevar y delivery" },
  { id: "cocina", href: "/panel/cocina", texto: "Cocina", grupo: "Servicio", ayuda: "Comandas en tiempo real" },
  { id: "reservas", href: "/panel/reservas", texto: "Reservas", grupo: "Servicio", ayuda: "Reservas y lista de espera" },
  { id: "caja", href: "/panel/caja", texto: "Caja", grupo: "Servicio", ayuda: "Cierre de caja del turno" },
  { id: "carta", href: "/panel", texto: "Carta", grupo: "Carta", ayuda: "Platos, precios y categorías" },
  { id: "promos", href: "/panel/promos", texto: "Promos", grupo: "Carta", ayuda: "Descuentos por día y hora" },
  { id: "marca", href: "/panel/marca", texto: "Marca", grupo: "Carta", ayuda: "Diseño, logo, idiomas" },
  { id: "qr", href: "/panel/qr", texto: "QR", grupo: "Carta", ayuda: "Códigos para imprimir" },
  { id: "estadisticas", href: "/panel/estadisticas", texto: "Estadísticas", grupo: "Negocio", ayuda: "Visitas y lo más pedido" },
  { id: "reportes", href: "/panel/reportes", texto: "Reportes", grupo: "Negocio", ayuda: "Ventas y propinas por mesero" },
  { id: "clientes", href: "/panel/clientes", texto: "Clientes", grupo: "Negocio", ayuda: "Clientes frecuentes" },
  {
    id: "sellos",
    href: "/panel/sellos",
    texto: "Loyalty Cards",
    grupo: "Negocio",
    ayuda: "Tarjetas de sellos y premios en el celular",
  },
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
  mesero: ["salon", "llevar", "cocina", "reservas", "caja", "clientes", "sellos", "estadisticas"],
  cocina: ["cocina", "salon", "llevar"],
};

// ── Ajustes (restaurantes.ajustes) ─────────────
export type Modulo =
  "salon" | "llevar" | "cocina" | "cobros" | "pedidos_mesa" | "reservas" | "clientes" | "estadisticas" | "sucursales" | "equipo";

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
  // País del local (código ISO): formato de fechas del panel y código de WhatsApp. Ver lib/region.ts.
  pais: string;
  // Zona horaria del local: define el "día" de la caja, las promos y hasta cuándo dura un agotado.
  zona_horaria: string;
  reservas: {
    // El cliente puede reservar desde la carta (queda pendiente hasta que lo confirmen).
    online: boolean;
    // Minutos que se guarda una mesa reservada antes de liberarla.
    tolerancia: number;
    // Aviso al celular del cliente unas horas antes (si lo activó al reservar); si no, el panel ofrece WhatsApp.
    recordatorio: boolean;
    horas_antes: number;
  };
  // Pedidos para llevar y delivery (sección Para llevar).
  llevar: {
    // El cliente puede pedir desde la carta, sin mesa.
    online: boolean;
    delivery: boolean;
    // Costo de envío del delivery (0: gratis).
    envio: number;
    // Minutos que tarda un pedido: la hora de retiro más temprana que se ofrece.
    minutos: number;
    // Los pedidos de internet esperan que alguien los acepte antes de ir a cocina.
    confirmar: boolean;
    // Desde la carta se paga con Mercado Pago antes de que el pedido pase a cocina.
    pago_obligatorio: boolean;
  };
  resenas: {
    // Al cerrar la mesa se le pregunta al cliente cómo estuvo todo.
    pedir: boolean;
    // Enlace para dejar una reseña en Google (a los que ponen 4 o 5 estrellas).
    google_url: string;
  };
  cobro_online: {
    // El cliente puede pagar desde la carta con Mercado Pago (requiere conectar la cuenta).
    activo: boolean;
  };
  // Los platos sin foto muestran una imagen ilustrada según lo que son (archivos en public/defecto).
  imagenes_defecto: boolean;
  // Redes sociales y sitio web que se muestran al final de la carta (ver lib/redes.ts).
  redes: Redes;
  // Miniatura del plato en las comandas de cocina y en los avisos del salón.
  miniaturas: boolean;
  // Foto, emoji o iniciales de cada persona del equipo en el plano, la mesa y las comandas.
  avatares: boolean;
  // Orden del equipo que eligió el administrador (correos, de arriba abajo). Los que no figuran van al final.
  orden_equipo: string[];
  // Total de referencia en otras monedas (para turistas): cuánto vale 1 unidad de cada una en la moneda del local.
  otras_monedas: OtraMoneda[];
  // Migración 0023: un mesero necesita el PIN de un encargado para anular, quitar algo ya marchado o descontar.
  pin_autorizacion: boolean;
  // Precuenta con la marca del local: logo, mensaje de agradecimiento, QR para reseñar y datos al pie.
  ticket: AjustesTicket;
};

export type AjustesTicket = {
  logo: boolean;
  mensaje: string;
  // QR a la reseña de Google (usa resenas.google_url).
  qr_resena: boolean;
  // RUT, dirección, wifi, Instagram… (una línea por renglón).
  pie: string;
};

export const TICKET_BASE: AjustesTicket = { logo: true, mensaje: "¡Gracias por tu visita!", qr_resena: true, pie: "" };

export type OtraMoneda = { codigo: string; tasa: number };

export const SONIDOS_HOJA = ["papel", "hojas", "diario", "ninguno"] as const;
export type SonidoHoja = (typeof SONIDOS_HOJA)[number];

export const AJUSTES_BASE: Ajustes = {
  modulos: {
    salon: true,
    cocina: true,
    cobros: true,
    pedidos_mesa: false,
    reservas: false,
    llevar: true,
    clientes: true,
    estadisticas: true,
    sucursales: true,
    equipo: true,
  },
  vistas: { mesero: ["salon", "cocina"], cocina: ["cocina"] },
  confirmar_pedidos: false,
  propinas: { activas: true, porcentajes: [10, 15, 20], montos: [1000, 2000, 5000], libre: true, sugerida: 10 },
  metodos_pago: ["Efectivo", "Tarjeta de débito", "Tarjeta de crédito", "Transferencia", "Mercado Pago"],
  estaciones: ["Cocina", "Barra"],
  alertas: { amarillo: 10, rojo: 20 },
  sonido_hoja: "papel",
  pais: PAIS_BASE.codigo,
  zona_horaria: PAIS_BASE.zona,
  reservas: { online: false, tolerancia: 15, recordatorio: true, horas_antes: 3 },
  llevar: { online: false, delivery: false, envio: 0, minutos: 30, confirmar: true, pago_obligatorio: false },
  resenas: { pedir: true, google_url: "" },
  cobro_online: { activo: false },
  imagenes_defecto: false,
  redes: REDES_VACIAS,
  miniaturas: true,
  avatares: true,
  orden_equipo: [],
  otras_monedas: [],
  pin_autorizacion: false,
  ticket: TICKET_BASE,
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
    redes: leerRedes(g.redes),
    miniaturas: g.miniaturas !== false,
    avatares: g.avatares !== false,
    orden_equipo: listaTextos(g.orden_equipo, []).slice(0, 200),
    otras_monedas: Array.isArray(g.otras_monedas)
      ? g.otras_monedas
          .map((m) => ({
            codigo: String(m?.codigo ?? "")
              .toUpperCase()
              .slice(0, 3),
            tasa: Number(m?.tasa),
          }))
          .filter((m) => /^[A-Z]{3}$/.test(m.codigo) && Number.isFinite(m.tasa) && m.tasa > 0)
          .slice(0, 3)
      : [],
    pin_autorizacion: g.pin_autorizacion === true,
    ticket: {
      logo: g.ticket?.logo !== false,
      mensaje: typeof g.ticket?.mensaje === "string" ? g.ticket.mensaje.slice(0, 120) : TICKET_BASE.mensaje,
      qr_resena: g.ticket?.qr_resena !== false,
      pie: typeof g.ticket?.pie === "string" ? g.ticket.pie.slice(0, 300) : "",
    },
    sonido_hoja: SONIDOS_HOJA.includes(g.sonido_hoja as SonidoHoja) ? (g.sonido_hoja as SonidoHoja) : AJUSTES_BASE.sonido_hoja,
    pais: paisDe(g.pais).codigo,
    zona_horaria: typeof g.zona_horaria === "string" && g.zona_horaria ? g.zona_horaria : paisDe(g.pais).zona,
    reservas: { ...AJUSTES_BASE.reservas, ...(g.reservas ?? {}) },
    llevar: { ...AJUSTES_BASE.llevar, ...(g.llevar ?? {}) },
    resenas: { ...AJUSTES_BASE.resenas, ...(g.resenas ?? {}) },
    cobro_online: { ...AJUSTES_BASE.cobro_online, ...(g.cobro_online ?? {}) },
  };
}

// Formato de fechas y zona horaria del local, para mostrar horas en el panel.
export const regionDe = (a: Pick<Ajustes, "pais" | "zona_horaria">): Region => ({
  locale: paisDe(a.pais).locale,
  zona: a.zona_horaria,
});

// Módulo del que depende cada sección (las que no figuran están siempre).
const MODULO_DE: Partial<Record<Seccion, Modulo>> = {
  salon: "salon",
  cocina: "cocina",
  reservas: "reservas",
  caja: "cobros",
  estadisticas: "estadisticas",
  llevar: "llevar",
  clientes: "clientes",
  reportes: "cobros",
  sucursales: "sucursales",
  equipo: "equipo",
};

// Secciones que ve esta persona, en el orden del menú. sellos: si el local contrató Platovi Sellos (el administrador
// ve la sección igual, con la oferta para contratarlo).
export function seccionesVisibles(rol: string | undefined, ajustes: Ajustes, sellos = false): InfoSeccion[] {
  const encendida = (s: Seccion) => {
    if (s === "sellos") return sellos || esAdmin(rol);
    const m = MODULO_DE[s];
    return !m || ajustes.modulos[m];
  };
  if (esAdmin(rol)) return SECCIONES.filter((s) => encendida(s.id));
  if (rol !== "mesero" && rol !== "cocina") return [];
  const elegidas = ajustes.vistas[rol];
  return SECCIONES.filter((s) => PERMITIDAS[rol].includes(s.id) && elegidas.includes(s.id) && encendida(s.id));
}

// ── Plano ─────────────────────────────────────
export type TipoElemento =
  | "pasillo"
  | "pared"
  | "barra"
  | "bano"
  | "cocina"
  | "entrada"
  | "escalera"
  | "planta"
  | "caja"
  // Calle y terraza
  | "toldo"
  | "vereda"
  | "calle"
  | "macetero"
  | "farol"
  // Playa
  | "palmera"
  | "sombrilla"
  | "arena"
  | "deck"
  | "mar"
  | "choza";

export type GrupoElemento = "local" | "calle" | "playa";
export const GRUPOS_ELEMENTO: { id: GrupoElemento; texto: string }[] = [
  { id: "local", texto: "Dentro del local" },
  { id: "calle", texto: "Calle y terraza" },
  { id: "playa", texto: "Playa y aire libre" },
];

// bloquea: las mesas no se pueden poner encima. suelo: es una zona del piso (vereda, arena, toldo…) que se dibuja
// debajo de todo y sobre la que sí van mesas. color: el color que trae al agregarlo (cada uno se puede cambiar).
export const ELEMENTOS: Record<
  TipoElemento,
  {
    texto: string;
    bloquea: boolean;
    ancho: number;
    alto: number;
    grupo: GrupoElemento;
    suelo?: boolean;
    color?: string;
    asientos?: boolean;
  }
> = {
  pasillo: { texto: "Pasillo", bloquea: true, ancho: 8, alto: 2, grupo: "local" },
  pared: { texto: "Pared", bloquea: true, ancho: 6, alto: 1, grupo: "local" },
  barra: { texto: "Barra", bloquea: true, ancho: 6, alto: 2, grupo: "local", asientos: true },
  bano: { texto: "Baños", bloquea: true, ancho: 3, alto: 3, grupo: "local" },
  cocina: { texto: "Cocina", bloquea: true, ancho: 5, alto: 4, grupo: "local" },
  entrada: { texto: "Entrada", bloquea: true, ancho: 3, alto: 1, grupo: "local" },
  escalera: { texto: "Escalera", bloquea: true, ancho: 3, alto: 3, grupo: "local" },
  caja: { texto: "Caja", bloquea: true, ancho: 3, alto: 2, grupo: "local" },
  planta: { texto: "Planta", bloquea: false, ancho: 1, alto: 1, grupo: "local" },
  toldo: { texto: "Toldo", bloquea: false, ancho: 8, alto: 4, grupo: "calle", suelo: true, color: "#b91c1c" },
  vereda: { texto: "Vereda", bloquea: false, ancho: 12, alto: 4, grupo: "calle", suelo: true },
  calle: { texto: "Calle", bloquea: true, ancho: 14, alto: 3, grupo: "calle" },
  macetero: { texto: "Macetero", bloquea: true, ancho: 2, alto: 1, grupo: "calle" },
  farol: { texto: "Farol", bloquea: false, ancho: 1, alto: 1, grupo: "calle" },
  palmera: { texto: "Palmera", bloquea: false, ancho: 2, alto: 2, grupo: "playa" },
  sombrilla: { texto: "Sombrilla", bloquea: false, ancho: 3, alto: 3, grupo: "playa", color: "#0e7490" },
  arena: { texto: "Arena", bloquea: false, ancho: 12, alto: 6, grupo: "playa", suelo: true },
  deck: { texto: "Deck de madera", bloquea: false, ancho: 10, alto: 5, grupo: "playa", suelo: true },
  mar: { texto: "Mar", bloquea: true, ancho: 14, alto: 3, grupo: "playa" },
  choza: { texto: "Quincho", bloquea: false, ancho: 4, alto: 4, grupo: "playa", asientos: true },
};

export type Lado = "arriba" | "abajo" | "izquierda" | "derecha";
export const LADOS: { id: Lado; texto: string }[] = [
  { id: "arriba", texto: "Arriba" },
  { id: "abajo", texto: "Abajo" },
  { id: "izquierda", texto: "Izquierda" },
  { id: "derecha", texto: "Derecha" },
];

// Asientos de una barra o quincho: taburetes o sillas altas en uno de sus lados.
export type AsientosElemento = { tipo: "taburete" | "silla"; n: number; lado: Lado };

export type Elemento = {
  id: string;
  tipo: TipoElemento;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  texto?: string;
  // Color elegido (si falta, el de siempre).
  color?: string;
  asientos?: AsientosElemento;
};

// Sillas de una mesa, elegidas a mano: por lado (mesas cuadradas y rectangulares) o alrededor (redondas).
// banca y sillon ocupan todo el lado; n es cuántas personas se sientan ahí.
export type TipoAsiento = "silla" | "taburete" | "banca" | "sillon";
export const TIPOS_ASIENTO: { id: TipoAsiento; texto: string; redonda: boolean }[] = [
  { id: "silla", texto: "Sillas", redonda: true },
  { id: "taburete", texto: "Taburetes", redonda: true },
  { id: "banca", texto: "Banca", redonda: false },
  { id: "sillon", texto: "Sillón", redonda: true },
];
export type LadoSillas = { tipo: TipoAsiento; n: number };
export type SillasMesa = Partial<Record<Lado | "alrededor", LadoSillas>>;

// Total de personas que entran con esas sillas.
export const personasSillas = (s: SillasMesa) => Object.values(s).reduce((t, l) => t + (l?.n ?? 0), 0);

// Sillas que se dibujan si no se eligieron a mano: repartidas por los lados largos (o alrededor si es redonda).
export function sillasAutomaticas(forma: string | undefined, capacidad: number, ancho: number, alto: number): SillasMesa {
  const n = Math.min(capacidad, 24);
  if (forma === "redonda") return { alrededor: { tipo: "silla", n } };
  const unLado = Math.ceil(n / 2);
  return ancho >= alto
    ? { arriba: { tipo: "silla", n: unLado }, abajo: { tipo: "silla", n: n - unLado } }
    : { izquierda: { tipo: "silla", n: unLado }, derecha: { tipo: "silla", n: n - unLado } };
}

// Colores para elegir en el plano (además del selector libre).
export const COLORES_PLANO = [
  "#7b5332",
  "#a8a29e",
  "#1f2937",
  "#b91c1c",
  "#ea580c",
  "#ca8a04",
  "#15803d",
  "#0e7490",
  "#1d4ed8",
  "#7c3aed",
  "#be185d",
  "#f5f5f4",
];

// Texto legible sobre un color de fondo.
export function textoSobre(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? "#1c1917" : "#ffffff";
}

// Mezcla un color con negro (t > 0) o blanco (t < 0) para sombras y brillos.
export function tono(hex: string, t: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const destino = t > 0 ? 0 : 255;
  const k = Math.abs(t);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (destino - v) * k));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

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
  // Foto o plano dibujado de fondo (migración 0009).
  fondo_url?: string | null;
  fondo_opacidad?: number;
};

// ── Servicio ──────────────────────────────────
// retenido: "dejar para después" (tiempos de servicio): no llega a cocina hasta que el mesero lo marcha.
export type EstadoPedido = "pendiente" | "retenido" | "nuevo" | "preparando" | "listo" | "entregado" | "cancelado";

export const NOMBRE_ESTADO: Record<EstadoPedido, string> = {
  pendiente: "Por confirmar",
  retenido: "En espera",
  nuevo: "Nuevo",
  preparando: "Preparando",
  listo: "Listo",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export type Aviso =
  | { tipo: "cuenta" | "mozo"; detalle?: SolicitudCuenta | null; at: string }
  // Pagó desde la carta con Mercado Pago (lo registra el servidor al confirmarse el pago).
  | { tipo: "pago"; detalle?: { monto: number; propina: number } | null; at: string };

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
  // Migración 0014: para llevar y delivery, cliente y quién atiende.
  tipo?: TipoCuenta;
  origen?: "personal" | "cliente";
  cliente_id?: string | null;
  cliente_nombre?: string | null;
  cliente_telefono?: string | null;
  direccion?: string | null;
  para_hora?: string | null;
  envio?: number;
  despachado_at?: string | null;
  mesero_id?: string | null;
  // Migración 0018: enlace del repartidor, cuándo lo entregó y si el cliente paga al retirar (falló Mercado Pago).
  reparto_token?: string;
  entregado_at?: string | null;
  paga_al_retirar?: boolean;
  // Migración 0019: otras mesas pegadas a esta que comparten la cuenta, y dónde quedaron en el plano mientras tanto.
  mesas_unidas?: string[];
  posiciones?: Record<string, { x: number; y: number }>;
};

// La cuenta abierta que ocupa una mesa: la suya o aquella a la que está unida.
export function cuentaDeMesa<C extends Pick<Cuenta, "estado" | "mesa_id" | "mesas_unidas">>(cuentas: C[], mesaId: string) {
  const abiertas = cuentas.filter((c) => c.estado === "abierta");
  return abiertas.find((c) => c.mesa_id === mesaId) ?? abiertas.find((c) => c.mesas_unidas?.includes(mesaId));
}

export type TipoCuenta = "mesa" | "llevar" | "delivery";
export const NOMBRE_TIPO: Record<TipoCuenta, string> = { mesa: "Mesa", llevar: "Para llevar", delivery: "Delivery" };

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
  // Opciones elegidas (migración 0018), con el extra ya sumado al precio.
  opciones?: OpcionElegida[];
  // Precio de carta antes de un descuento (migración 0023); vacío si no tiene descuento.
  precio_original?: number | null;
  created_at: string;
};

export type OpcionElegida = { grupo: string; valor: string; precio?: number };

// "Grande, papas fritas" para mostrar debajo del nombre del plato.
export const textoOpciones = (o?: OpcionElegida[] | null) => (o ?? []).map((x) => x.valor).join(", ");

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
  // De mesa, para llevar o delivery (migración 0014).
  tipo?: TipoCuenta;
  // Quién del equipo cargó la comanda (vacío si la pidió el cliente desde el QR).
  creado_por?: string | null;
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
  // "online": lo pagó el cliente desde la carta (migración 0009).
  origen?: "personal" | "online";
  registrado_por?: string | null;
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

// Nombre para mostrar de alguien del equipo a partir de la parte de su correo antes de la @
// ("eliana.perez" → "Eliana Perez"). Si queda vacío se deja tal cual.
export function nombreVisible(usuario: string) {
  const limpio = usuario
    .replace(/[._\-+]+/g, " ")
    .replace(/\d+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  if (!limpio) return usuario;
  return limpio.replace(/(^|\s)(\p{L})/gu, (_, e: string, l: string) => e + l.toUpperCase());
}
