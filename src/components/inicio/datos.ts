// Contenido del sitio de venta. Los precios, testimonios y preguntas se cambian aquí, sin tocar el diseño.

export const MONEDA = "CLP";

// Precios mensuales en pesos chilenos (IVA incluido). Los períodos más largos aplican el descuento de PERIODOS.
export const PLANES = [
  {
    id: "carta",
    nombre: "Carta",
    precio: 17990,
    para: "Para mostrar la carta con QR y olvidarte de reimprimir.",
    incluye: [
      "Carta QR ilimitada con fotos",
      "21 diseños, tu logo y tus colores",
      "6 idiomas para turistas",
      "QR por mesa listos para imprimir",
      "Platos destacados, agotados y promos por horario",
    ],
  },
  {
    id: "pro",
    nombre: "Pro",
    precio: 24990,
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
    precio: 46990,
    para: "Para marcas con varios locales.",
    incluye: [
      "Todo lo del plan Pro",
      "Hasta 5 sucursales con su propia carta",
      "Estadísticas por local",
      "Un solo panel para todos los locales",
      "Soporte prioritario por WhatsApp",
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

export const ARMADO = { precio: 39990, texto: "Cargamos tu carta, fotos y traducciones, y te entregamos los QR para imprimir." };

export const DIAS_PRUEBA = 14;

export const MODULOS: { icono: string; titulo: string; texto: string }[] = [
  { icono: "carta", titulo: "Carta QR con 21 diseños", texto: "Del café de barrio al bar de cócteles. Cambias precios y fotos desde el celular y se actualiza al instante." },
  { icono: "externo", titulo: "6 idiomas", texto: "Español, inglés, portugués, francés, italiano y alemán. El turista elige el suyo con un toque." },
  { icono: "whatsapp", titulo: "Pedidos por WhatsApp", texto: "El cliente arma su pedido y te llega con la mesa y el total. Sin comisiones por pedido." },
  { icono: "salon", titulo: "Salón y mapa de mesas", texto: "Dibuja tu local por pisos, ve qué mesa está libre, ocupada o pidiendo la cuenta." },
  { icono: "cocina", titulo: "Pantalla de cocina", texto: "Las comandas llegan en vivo por estación, se ordenan y avisan al mesero cuando están listas." },
  { icono: "caja", titulo: "Caja", texto: "Apertura y cierre con cuadre por medio de pago, para saber cuánto entró en el turno." },
  { icono: "reservas", titulo: "Reservas y lista de espera", texto: "Tus clientes reservan desde un link y les avisas cuando su mesa está lista." },
  { icono: "check", titulo: "Cobro online con Mercado Pago", texto: "El cliente paga desde la mesa con tarjeta. El dinero va directo a tu cuenta de Mercado Pago." },
  { icono: "personas", titulo: "Pagos divididos y propinas", texto: "Divide por persona, en partes iguales o por consumo, con la propina sugerida que tú definas." },
  { icono: "sucursales", titulo: "Sucursales", texto: "Varios locales con su carta, sus mesas y su equipo, administrados desde una sola cuenta." },
  { icono: "estadisticas", titulo: "Estadísticas", texto: "Qué platos se miran y se piden más, y en qué horarios se llena el local." },
  { icono: "referidos", titulo: "Referidos", texto: "Recomienda Mesitto a otro local y gana descuentos en tu plan cuando se suma." },
];

export const PASOS: [string, string][] = [
  ["Nos mandas tu carta", "Una foto de la carta actual basta. La cargamos con fotos y traducciones, o la armas tú en minutos."],
  ["Pones los QR en las mesas", "Cada mesa tiene su QR con tu logo, en un cartel, un servilletero o una placa. Si cambias un precio, el QR sigue siendo el mismo."],
  ["Tus clientes escanean y piden", "Con la cámara del celular, sin bajar ninguna app. El pedido llega a cocina y tú ves el salón en vivo."],
];

// Recorrido por el sistema con capturas reales (en public/inicio).
export const RECORRIDO: { etiqueta: string; titulo: string; texto: string; puntos: string[]; imagen: string; alto: number; ancho: number; alt: string; movil?: string }[] = [
  {
    etiqueta: "En la mesa",
    titulo: "El cliente pide desde su celular",
    texto: "Escanea el QR, elige en la carta y envía el pedido con su número de mesa. Después le avisamos cuando la cocina empieza y cuando está listo.",
    puntos: ["Carta en su idioma", "Notas para la cocina", "Llamar al mesero o pedir la cuenta"],
    imagen: "/inicio/pedido-movil.webp",
    ancho: 600,
    alto: 1298,
    alt: "Carrito de pedido en el celular del cliente, listo para enviar a la mesa 15",
    movil: "/inicio/aviso-listo.webp",
  },
  {
    etiqueta: "Salón",
    titulo: "Todo tu local en una pantalla",
    texto: "Dibuja el salón con sus pisos, barra y pasillos. Cada mesa cambia de color cuando se ocupa, tiene un pedido listo o pide la cuenta, y los avisos aparecen al costado.",
    puntos: ["Vista simple, a color o en 3D", "Pantalla completa para el mostrador", "Avisos con sonido distinto para cada caso"],
    imagen: "/inicio/salon-3d.webp",
    ancho: 1440,
    alto: 740,
    alt: "Plano 3D del salón con las mesas numeradas y avisos de la mesa 15",
  },
  {
    etiqueta: "Cocina",
    titulo: "Las comandas llegan solas a la cocina",
    texto: "Cada estación ve lo suyo: la barra las bebidas, la cocina los platos. Se ordenan arrastrando y con un toque el mesero sabe que está listo para llevar.",
    puntos: ["Separado por cocina y barra", "Tiempo de espera en cada comanda", "Funciona en cualquier tablet o televisor"],
    imagen: "/inicio/cocina.webp",
    ancho: 1136,
    alto: 772,
    alt: "Pantalla de cocina con dos comandas de la mesa 15",
  },
  {
    etiqueta: "Cuenta",
    titulo: "Cobra como quieran pagar",
    texto: "Todo junto, en partes iguales, cada uno lo suyo o un monto libre. Con propina sugerida, medio de pago por persona y cierre de caja al final del turno.",
    puntos: ["Cuenta dividida en segundos", "Propina en porcentaje o monto", "Cobro online con Mercado Pago"],
    imagen: "/inicio/cobro.webp",
    ancho: 512,
    alto: 900,
    alt: "Cuenta de la mesa 15 dividida en seis partes iguales",
  },
  {
    etiqueta: "A tu medida",
    titulo: "Activa solo lo que usas",
    texto: "Un café chico no necesita lo mismo que un restaurante de dos pisos. Enciende o apaga cada parte del sistema y decide qué ve cada persona del equipo.",
    puntos: ["Solo carta, local chico o restaurante completo", "Roles para mesero, cocina y administración", "Se cambia cuando quieras"],
    imagen: "/inicio/personalizar.webp",
    ancho: 1184,
    alto: 900,
    alt: "Pantalla Personalizar con los módulos del sistema encendidos",
  },
];

export const SERVICIOS: [string, string][] = [
  ["Armado de la carta", "Cargamos platos, precios, fotos y traducciones por ti."],
  ["QR impresos", "Te entregamos el PDF con un QR por mesa, listo para la imprenta."],
  ["Capacitación del equipo", "Una sesión para meseros, cocina y caja, en tu local o por videollamada."],
  ["Soporte por WhatsApp", "Hablas con una persona, no con un bot, en horario de atención."],
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
  ["¿Hay permanencia?", "No. Es mes a mes y puedes cancelar cuando quieras. Si pagas cada 3, 6 o 12 meses, tienes descuento."],
  ["¿Sirve fuera de Chile?", "Sí. Cada local elige su país, moneda, zona horaria e idiomas."],
  ["¿Qué pasa si se cae internet en el local?", "La carta la ven tus clientes con sus propios datos móviles, así que sigue funcionando."],
];
