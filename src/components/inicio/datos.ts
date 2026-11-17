import type { IdEscena } from "./Recorrido";
// Contenido del sitio de venta. Los precios, testimonios y preguntas se cambian aquí, sin tocar el diseño.

export const MONEDA = "CLP";

// Precios mensuales en pesos chilenos (más IVA: el IVA del 19 % se suma al cobrar). Los períodos más largos aplican el descuento de PERIODOS.
export const PLANES = [
  {
    id: "carta",
    nombre: "Carta",
    precio: 24990,
    para: "Para mostrar la carta con QR y olvidarte de reimprimir.",
    incluye: [
      "Carta QR ilimitada con fotos",
      "Decenas de diseños (y nuevos cada mes), tu logo y tus colores",
      "Idiomas para turistas, y sumamos el que pidas",
      "QR por mesa listos para imprimir",
      "Platos destacados, agotados y promos por horario",
    ],
  },
  {
    id: "pro",
    nombre: "Pro",
    precio: 34990,
    destacado: true,
    para: "Para atender el salón completo desde el celular.",
    incluye: [
      "Todo lo del plan Carta",
      "Pedidos desde la mesa y por WhatsApp",
      "Mapa de mesas, cocina en vivo y caja",
      "Cuenta dividida, propinas y cobro online",
      "Reservas, lista de espera y estadísticas",
    ],
  },
  {
    id: "grupo",
    nombre: "Grupo",
    precio: 54990,
    para: "Para marcas con varios locales.",
    incluye: [
      "Todo lo del plan Pro",
      "Hasta 5 sucursales con su propia carta",
      "Estadísticas por local",
      "Un solo panel para todos los locales",
      "Soporte prioritario por WhatsApp 24/7",
    ],
  },
] as const;

// Períodos de pago del selector de precios: meses que se cobran juntos y descuento sobre el precio mensual.
export const PERIODOS = [
  { id: "mensual", nombre: "Mensual", meses: 1, descuento: 0 },
  { id: "trimestral", nombre: "3 meses", meses: 3, descuento: 0.05 },
  { id: "semestral", nombre: "Semestral", meses: 6, descuento: 0.1 },
  { id: "anual", nombre: "Anual", meses: 12, descuento: 0.15 },
] as const;

// Armado de la carta, en dos niveles. Cada nivel incluye lo del anterior.
// Básico gratis como promo de lanzamiento (solo con un plan mensual contratado); Completo de pago único.
export const ARMADOS = [
  {
    id: "basico",
    nombre: "Básico",
    precio: 0,
    nota: "Promo de lanzamiento, al contratar cualquier plan",
    para: "Tu carta cargada y los QR listos, de regalo.",
    incluye: [
      "Carga de todos tus platos, sin límite, con precios y descripciones",
      "Elección del diseño de la carta",
      "QR por mesa en PDF, listos para imprimir",
    ],
  },
  {
    id: "completo",
    nombre: "Completo",
    precio: 24990,
    nota: "Pago único",
    destacado: true,
    para: "La carta con fotos y el equipo listo para usarla.",
    incluye: [
      "Todo lo del Básico, sin límite de platos",
      "Fotos de los platos editadas",
      "Traducciones revisadas y platos destacados",
      "Ajustes del salón y cuentas del equipo",
      "Capacitación en tu local",
      "Plano del salón con todas las mesas y pisos, en 3D",
      "Los primeros 2 meses, cargamos tus platos nuevos",
    ],
  },
] as const;

export const DIAS_PRUEBA = 14;

export const MODULOS: { icono: string; titulo: string; texto: string }[] = [
  { icono: "carta", titulo: "Carta QR con decenas de diseños", texto: "Del café de barrio al bar de cócteles, con diseños nuevos cada mes. Cambias precios y fotos desde el celular y se actualiza al instante." },
  { icono: "externo", titulo: "La carta en el idioma de cada turista", texto: "Español, inglés, portugués, francés, italiano, alemán, holandés y chino. ¿Necesitas otro? Pídelo y lo agregamos. El turista elige el suyo con un toque." },
  { icono: "whatsapp", titulo: "Pedidos por WhatsApp", texto: "El cliente arma su pedido y te llega con la mesa y el total. Sin comisiones por pedido." },
  { icono: "salon", titulo: "Salón y mapa de mesas", texto: "Dibuja tu local por pisos, ve qué mesa está libre, ocupada o pidiendo la cuenta." },
  { icono: "cocina", titulo: "Pantalla de cocina", texto: "Las comandas llegan en vivo por estación, se ordenan y avisan al mesero cuando están listas." },
  { icono: "caja", titulo: "Caja", texto: "Apertura y cierre con cuadre por medio de pago, para saber cuánto entró en el turno." },
  { icono: "reservas", titulo: "Reservas y lista de espera", texto: "Tus clientes reservan desde un link y les avisas cuando su mesa está lista." },
  { icono: "check", titulo: "Cobro online con Mercado Pago", texto: "El cliente paga desde la mesa con tarjeta. El dinero va directo a tu cuenta de Mercado Pago." },
  { icono: "personas", titulo: "Pagos divididos y propinas", texto: "Divide por persona, en partes iguales o por consumo, con la propina sugerida que tú definas." },
  { icono: "sucursales", titulo: "Sucursales", texto: "Varios locales con su carta, sus mesas y su equipo, administrados desde una sola cuenta." },
  { icono: "estadisticas", titulo: "Estadísticas", texto: "Qué platos se miran y se piden más, y en qué horarios se llena el local." },
  { icono: "referidos", titulo: "Referidos", texto: "Recomienda Platovi a otro local y gana descuentos en tu plan cuando se suma." },
];

export const PASOS: [string, string][] = [
  ["Nos mandas tu carta", "Una foto de la carta actual basta. La cargamos con fotos y traducciones, o la armas tú en minutos."],
  ["Pones los QR en las mesas", "Cada mesa tiene su QR con tu logo, en un cartel, un servilletero o una placa. Si cambias un precio, el QR sigue siendo el mismo."],
  ["Tus clientes escanean y piden", "Con la cámara del celular, sin bajar ninguna app. El pedido llega a cocina y tú ves el salón en vivo."],
];

// Recorrido por el sistema con capturas reales (en public/inicio).
// Recorrido "Así se ve un servicio": cada paso tiene su maqueta animada en Recorrido.tsx (escena).
export const RECORRIDO: { etiqueta: string; titulo: string; texto: string; puntos: string[]; escena: IdEscena; ancho?: boolean }[] = [
  {
    etiqueta: "En la mesa",
    titulo: "El cliente pide desde su celular",
    texto: "Escanea el QR, elige en la carta y envía el pedido con su número de mesa. Si necesita algo, llama al mesero o pide la cuenta con un toque.",
    puntos: ["Carta en su idioma", "Notas para la cocina", "Llamar al mesero o pedir la cuenta"],
    escena: "pedido",
  },
  {
    etiqueta: "Salón",
    titulo: "Todo tu local en una pantalla",
    texto: "Dibuja el salón con sus pisos, terraza o playa. Cada mesa cambia de color cuando se ocupa, titila cuando llaman al mesero o piden la cuenta, y los avisos aparecen al costado. Elige cómo verlo: simple, a color, en 3D o como maqueta con los comensales sentados.",
    puntos: ["Vista simple, a color, 3D o maqueta", "Varios pisos, terraza y playa", "Pantalla completa para el mostrador", "Avisos con sonido distinto para cada caso"],
    escena: "salon",
    ancho: true,
  },
  {
    etiqueta: "Cocina",
    titulo: "Las comandas llegan solas a la cocina",
    texto: "Cada estación ve lo suyo: la barra las bebidas, la cocina los platos. Con un toque empiezan a preparar, con otro lo terminan, y al cliente le llega el aviso a su celular.",
    puntos: ["Separado por cocina y barra", "Tiempo de espera en cada comanda", "Aviso al cliente cuando está listo"],
    escena: "cocina",
  },
  {
    etiqueta: "Cuenta",
    titulo: "Cobra como quieran pagar",
    texto: "El mesero toca Cobrar y elige: todo junto, en partes iguales, cada uno lo suyo o un monto libre. Con propina sugerida, medio de pago por persona y cierre de caja al final del turno.",
    puntos: ["Cuenta dividida en segundos", "Propina en porcentaje o monto", "Efectivo, tarjetas o transferencia"],
    escena: "cobro",
  },
  {
    etiqueta: "Vuelven",
    titulo: "Y el cliente vuelve",
    texto: "Con Platovi Loyalty, el cliente escanea el QR de su precuenta y suma un sello en su tarjeta digital. Después lo invitamos a dejar una reseña y, si deja de venir, le llega un recordatorio.",
    puntos: ["Tarjeta de sellos sin descargar nada", "Reseñas en Google", "Campañas para que vuelvan"],
    escena: "loyalty",
  },
  {
    etiqueta: "A tu medida",
    titulo: "Tu carta, tu estilo, tu forma de trabajar",
    texto: "Elige entre decenas de diseños, pon tus colores y tu logo, ofrece la carta en idiomas para turistas y enciende solo los módulos que usas. Todo se cambia cuando quieras y se ve al instante.",
    puntos: ["Decenas de diseños, nuevos cada mes", "Tus colores y tu logo", "Activa solo lo que usas"],
    escena: "personalizar",
  },
];

export const SERVICIOS: [string, string][] = [
  ["Armado de la carta", "Cargamos platos, precios, fotos y traducciones por ti, sin límite de platos. El armado básico va de regalo con tu plan."],
  ["QR impresos", "Te entregamos el PDF con un QR por mesa, listo para la imprenta."],
  ["Capacitación del equipo", "Una sesión para meseros, cocina y caja, en tu local o por videollamada."],
  ["Soporte por WhatsApp 24/7", "Hablas con una persona, no con un bot. Escríbenos a la hora que quieras, todos los días: siempre te respondemos."],
];

// Cartas de ejemplo publicadas en el sistema (cada una con un diseño distinto).
export const DEMOS: { slug: string; nombre: string; tipo: string; color: string }[] = [
  { slug: "aroma-cafe", nombre: "Aroma Café", tipo: "Cafetería", color: "#0f172a" },
  { slug: "trattoria-roma", nombre: "Trattoria Roma", tipo: "Restaurante italiano", color: "#7f1d1d" },
  { slug: "bar-medianoche", nombre: "Bar Medianoche", tipo: "Coctelería", color: "#1e1b4b" },
  { slug: "jardin-veggie", nombre: "Jardín Veggie", tipo: "Vegetariano", color: "#a16207" },
  { slug: "horno-de-barrio", nombre: "Horno de Barrio", tipo: "Pizzería", color: "#78350f" },
  { slug: "neon-tokio", nombre: "Neón Tokio", tipo: "Cocina asiática", color: "#701a75" },
  { slug: "casa-verdi", nombre: "Casa Verdi", tipo: "Alta cocina", color: "#1c1917" },
  { slug: "jugos-del-huerto", nombre: "Jugos del Huerto", tipo: "Juguería", color: "#15803d" },
];

// Reemplazar por testimonios reales apenas existan. Mientras ejemplo sea true, se muestran marcados como ejemplo.
export const TESTIMONIOS: { texto: string; nombre: string; local: string; ejemplo?: boolean }[] = [
  {
    texto: "Antes reimprimíamos la carta cada vez que subía un precio. Ahora lo cambio desde el celular en la mañana y listo.",
    nombre: "Dueña de cafetería",
    local: "Providencia, Santiago",
    ejemplo: true,
  },
  {
    texto: "La cocina ve los pedidos al tiro y los meseros ya no corren con papelitos. En hora punta se nota.",
    nombre: "Administrador de restaurante",
    local: "Viña del Mar",
    ejemplo: true,
  },
  {
    texto: "Los turistas leen la carta en su idioma y piden solos. Nos ahorra muchas explicaciones en temporada.",
    nombre: "Encargado de bar",
    local: "Puerto Varas",
    ejemplo: true,
  },
];

export const PREGUNTAS: [string, string][] = [
  ["¿Necesito comprar equipos?", "No. Funciona en el celular, tablet o computador que ya tienes. Para la cocina sirve cualquier tablet o un televisor con navegador."],
  ["¿El cliente tiene que bajar una app?", "No. Escanea el QR con la cámara y la carta se abre en el navegador."],
  ["¿Cobran comisión por pedido?", "No. Pagas el plan mensual y nada más. En el cobro online, Mercado Pago cobra su comisión habitual."],
  ["¿Cuánto cuesta que ustedes carguen la carta?", "Por la promo de lanzamiento, el armado básico es gratis al contratar cualquier plan: cargamos todos tus platos, sin importar cuántos sean, y te dejamos los QR listos. El armado completo, con fotos, traducciones revisadas, plano del salón en 3D y capacitación, cuesta $24.990 + IVA, también sin límite de platos."],
  ["¿Hay permanencia?", "No. Es mes a mes y puedes cancelar cuando quieras. Si pagas cada 3, 6 o 12 meses, tienes descuento."],
  ["¿Cuántos diseños de carta hay?", "Decenas, para cafés, restaurantes, bares y más, y sumamos diseños nuevos cada mes. Todos llevan tu logo y tus colores, y puedes cambiar de diseño cuando quieras."],
  ["¿En qué idiomas se puede ver la carta?", "Hoy en español, inglés, portugués, francés, italiano, alemán, holandés y chino. Si tu local necesita otro idioma, solo pídelo y lo agregamos al sistema."],
  ["¿Sirve fuera de Chile?", "Sí. Cada local elige su país, moneda, zona horaria e idiomas."],
  ["¿Qué pasa si se cae internet en el local?", "La carta la ven tus clientes con sus propios datos móviles, así que sigue funcionando."],
];
