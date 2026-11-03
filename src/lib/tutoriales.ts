// Tutoriales de capacitación por rol (página /tutoriales-por-rol).
// Cada paso muestra capturas reales del panel (public/tutoriales) con marcas numeradas:
// el número de cada explicación en `marcas` es el mismo que se ve sobre la imagen.

export type IdTutorial = "administrador" | "mesero" | "cocina";

export type Imagen = { src: string; alt: string; pie?: string; marcas?: Record<number, string> };

export type Paso = {
  id: string;
  titulo: string;
  resumen: string;
  imagenes: Imagen[];
  // Instrucciones en orden, para hacerlo uno mismo.
  pasos?: string[];
  consejo?: string;
};

export type Tutorial = {
  id: IdTutorial;
  rol: string;
  titulo: string;
  bajada: string;
  icono: "personalizar" | "salon" | "cocina";
  puntos: [string, string, string];
  duracion: string;
  pasos: Paso[];
};

// El rol del panel (usuarios.rol) y su tutorial.
export function tutorialDeRol(rol: string | null | undefined): IdTutorial {
  if (rol === "mesero") return "mesero";
  if (rol === "cocina") return "cocina";
  return "administrador";
}

export const RUTA_TUTORIALES = "/tutoriales-por-rol";
export const urlTutorial = (id: IdTutorial) => `${RUTA_TUTORIALES}?rol=${id}`;

const ENTRAR: Paso = {
  id: "entrar",
  titulo: "Entra a tu cuenta",
  resumen:
    "Cada persona del equipo tiene su propia cuenta y ve solo lo que su rol le permite. El administrador te invita con tu correo: te llega un enlace para crear tu contraseña y desde ese día entras siempre por platovi.cl/login.",
  imagenes: [
    {
      src: "login",
      alt: "Pantalla para entrar al panel de Platovi con correo y contraseña",
      marcas: {
        1: "Tu correo, el mismo con el que te invitaron.",
        2: "Tu contraseña. El ojo de la derecha la muestra para revisar que esté bien escrita.",
        3: "Entrar: te lleva directo a tu pantalla de trabajo.",
        4: "¿La olvidaste? Te llega un correo para crear una nueva.",
      },
    },
  ],
  pasos: [
    "Abre platovi.cl/login en el celular, la tableta o el computador del local.",
    "Escribe tu correo y tu contraseña, y toca Entrar.",
    "En el celular, agrega el panel a la pantalla de inicio (Compartir → Agregar a inicio en iPhone, o Instalar app en Android) para abrirlo como una app.",
  ],
  consejo: "No compartas tu cuenta: todo lo que haces queda a tu nombre (pedidos, cobros y propinas).",
};

export const TUTORIALES: Tutorial[] = [
  // ──────────────────────────── ADMINISTRADOR ────────────────────────────
  {
    id: "administrador",
    rol: "Administrador",
    titulo: "Administrador del local",
    bajada: "Deja el restaurante listo para atender: carta, QR, plano de mesas, equipo, cobros y reportes.",
    icono: "personalizar",
    puntos: ["Carta, precios y diseño", "Plano, QR y equipo", "Caja, reportes y ajustes"],
    duracion: "25 min",
    pasos: [
      ENTRAR,
      {
        id: "panel",
        titulo: "Conoce el panel",
        resumen:
          "El menú de la izquierda ordena todo en tres grupos. Como administrador ves todas las secciones; el mesero y la cocina ven solo las que tú eliges.",
        imagenes: [
          {
            src: "dueno-panel",
            alt: "Panel del administrador con el menú lateral",
            marcas: {
              1: "Servicio: lo del día a día (Salón, Para llevar, Cocina, Reservas y Caja).",
              2: "Carta: platos, promos, diseño (Marca) y códigos QR.",
              3: "Negocio: estadísticas, reportes, clientes, sucursales, equipo y ajustes.",
              4: "Ayuda por WhatsApp, Novedades y este tutorial, siempre a mano.",
              5: "Tu perfil: cambia entre modo claro y oscuro o cierra sesión.",
            },
          },
        ],
      },
      {
        id: "carta",
        titulo: "Arma tu carta",
        resumen:
          "La carta es la primera pantalla. Los cambios se ven al instante en el QR: no hay que volver a imprimir nada.",
        imagenes: [
          {
            src: "dueno-carta",
            alt: "Editor de la carta con categorías y platos",
            marcas: {
              1: "Nuevo plato: suma un plato a la categoría que elijas.",
              2: "Categorías: tócalas para saltar a cada una. Se ordenan arrastrando.",
              3: "Precio: escríbelo directo en la fila y se guarda solo.",
              5: "Interruptor: apágalo para esconder el plato de la carta sin borrarlo.",
              6: "Estación: a qué pantalla de preparación va la categoría (Cocina, Barra…).",
              7: "Resumen: platos visibles, agotados, destacados y sin foto.",
            },
          },
        ],
        pasos: [
          "Crea primero las categorías (abajo de la lista: Nueva categoría).",
          "Toca Nuevo plato o cualquier plato para editarlo.",
          "La estrella ★ de cada fila lo marca como destacado: aparece arriba, en la fila de destacados de la carta.",
        ],
      },
      {
        id: "plato",
        titulo: "Crea o edita un plato",
        resumen: "Cada plato tiene foto, nombre, precio y, si quieres, opciones para elegir (tamaño, punto de la carne, agregados).",
        imagenes: [
          {
            src: "dueno-nuevo-plato",
            alt: "Ventana para crear un plato nuevo",
            marcas: {
              1: "Foto: súbela desde el celular o el computador.",
              2: "Nombre del plato tal como lo verá el cliente.",
              3: "Precio en pesos. Abajo puedes poner otro precio para llevar o delivery.",
              4: "Categoría donde aparece.",
              5: "Opciones para elegir: tamaños o agregados, con o sin costo extra.",
              6: "Etiquetas: vegetariano, vegano, sin gluten, picante o nuevo.",
              7: "Guardar: queda publicado al instante.",
            },
          },
        ],
        consejo: "¿Se acabó un plato en pleno servicio? La cocina lo marca como agotado y vuelve solo al día siguiente.",
      },
      {
        id: "importar",
        titulo: "Importa la carta desde Excel",
        resumen: "Si ya tienes la carta en una planilla (o en otro sistema como Fudo), la cargas completa en segundos.",
        imagenes: [
          {
            src: "dueno-importar",
            alt: "Ventana para importar la carta desde Excel",
            marcas: {
              1: "Descarga la plantilla con las columnas correctas.",
              3: "O copia las filas desde Excel o Google Sheets y pégalas aquí, con la fila de títulos.",
              4: "Importar platos: crea las categorías que falten y suma los platos.",
            },
          },
        ],
        pasos: ["Al final de la carta toca Importar carta desde Excel.", "Revisa la vista previa antes de confirmar."],
      },
      {
        id: "marca",
        titulo: "Elige el diseño y tus datos",
        resumen:
          "En Marca eliges cómo se ve la carta (más de 20 diseños), subes tu logo, escribes tu WhatsApp y activas los idiomas para turistas.",
        imagenes: [
          {
            src: "dueno-marca",
            alt: "Sección Marca con los diseños de carta y la vista previa",
            marcas: {
              2: "Toca un diseño para probarlo. Puedes cambiarlo cuando quieras.",
              3: "Vista previa: así la ve tu cliente en el celular.",
              4: "Imágenes por defecto para los platos que aún no tienen foto.",
            },
          },
          {
            src: "dueno-marca-datos",
            alt: "Datos del restaurante e idiomas de la carta",
            pie: "Más abajo: logo, nombre, moneda, WhatsApp e idiomas de la carta.",
          },
        ],
      },
      {
        id: "qr",
        titulo: "Imprime los códigos QR",
        resumen:
          "Hay un QR general (para la puerta, Instagram o el mostrador) y uno por mesa, que avisa al mesero desde qué mesa piden.",
        imagenes: [
          {
            src: "dueno-qr",
            alt: "Sección QR con el código general y los códigos por mesa",
            marcas: {
              1: "Pon tu logo al centro del QR o usa el color de tu marca.",
              2: "QR general de la carta.",
              3: "Descárgalo en PNG (o SVG para imprenta).",
              4: "QR por mesa: elige desde qué mesa hasta cuál, o una mesa con nombre (Terraza 1).",
              5: "Descargar PDF: listo para imprimir y pegar en cada mesa.",
            },
          },
        ],
        consejo: "El QR apunta a la dirección de tu carta, no a un archivo: cambias platos y precios sin reimprimir.",
      },
      {
        id: "plano",
        titulo: "Dibuja el plano del salón",
        resumen:
          "El plano es igual a tu local: mesas, barra, cocina, entrada y terraza. Así el mesero encuentra cada mesa de un vistazo.",
        imagenes: [
          {
            src: "dueno-plano",
            alt: "Editor del plano del salón",
            marcas: {
              1: "Agregar mesa: cuadrada, redonda o larga.",
              2: "Agregar al plano: pasillo, pared, barra, baños, cocina, terraza, playa…",
              3: "Piso o salón: suma otro piso o una terraza.",
              4: "Listo: guarda el plano y vuelve a la atención.",
            },
          },
          {
            src: "dueno-plano-mesa",
            alt: "Ajustes de una mesa en el plano",
            pie: "Toca una mesa para cambiarle el número, la forma, cuántas personas caben, las sillas y el color.",
            marcas: { 1: "Número o nombre de la mesa.", 2: "Personas que caben.", 3: "Sillas, taburetes, bancas o sillones.", 4: "Color de la mesa." },
          },
        ],
        pasos: ["Entra a Salón y toca Editar plano.", "Arrastra cada mesa a su lugar.", "Toca Listo cuando termines."],
      },
      {
        id: "equipo",
        titulo: "Suma a tu equipo",
        resumen:
          "Invita a cada mesero y a la cocina con su correo. Cada uno entra con su cuenta y ve solo lo de su rol. Abajo de la lista está el resumen de lo que puede hacer cada rol.",
        imagenes: [
          {
            src: "dueno-equipo",
            alt: "Sección Equipo para invitar personas",
            marcas: {
              1: "Correo de la persona.",
              2: "Su rol: Administrador, Mesero o Cocina.",
              3: "Sumar: le llega un correo para crear su contraseña.",
              4: "Perfil y mesas: su foto o emoji, color y las mesas que atiende.",
            },
          },
          {
            src: "dueno-equipo-pin",
            alt: "PIN de autorización del equipo",
            pie: "PIN de autorización: para que un descuento o anular algo necesite la clave de un encargado.",
            marcas: { 1: "PIN de autorización.", 2: "Poner PIN de 4 a 6 números a cada persona." },
          },
        ],
        consejo: "Envíale a cada persona el tutorial de su rol: mesero y cocina tienen el suyo en esta misma página.",
      },
      {
        id: "personalizar",
        titulo: "Ajusta el sistema a tu local",
        resumen:
          "En Personalizar decides qué partes usas y cómo se cobra. Lo que apagas desaparece del panel; puedes volver a encenderlo cuando quieras.",
        imagenes: [
          {
            src: "dueno-personalizar",
            alt: "Personalizar: empezar rápido y partes del sistema",
            marcas: {
              1: "Empezar rápido: Solo carta, Café o local chico, o Restaurante completo.",
              2: "Enciende o apaga cada parte: salón, cocina, cobros, pedidos desde la mesa, para llevar…",
            },
          },
          {
            src: "dueno-personalizar-roles",
            alt: "Qué ve cada rol",
            pie: "Qué ve cada rol: marca las secciones que le aparecen al mesero y a la cocina.",
            marcas: { 1: "Qué ve cada rol." },
          },
          {
            src: "dueno-personalizar-cobro",
            alt: "Ajustes de propinas y cobro",
            pie: "Propinas sugeridas, medios de pago y si el mesero confirma los pedidos del QR antes de que lleguen a cocina.",
            marcas: { 1: "Propinas que se ofrecen al cobrar." },
          },
        ],
        consejo: "Cada cambio se guarda con el botón Guardar de la barra de abajo.",
      },
      {
        id: "promos",
        titulo: "Crea promos por horario",
        resumen: "Happy hour, menú del mediodía o trasnoche: se activan solas los días y horas que elijas.",
        imagenes: [
          {
            src: "dueno-promo",
            alt: "Ventana para crear una promo",
            marcas: {
              1: "Días en que corre la promo.",
              2: "Desde y hasta qué hora.",
              3: "Descuento en porcentaje.",
              4: "En qué platos o categorías (sin elegir nada, vale para toda la carta).",
            },
          },
        ],
      },
      {
        id: "reservas",
        titulo: "Reservas y lista de espera",
        resumen: "Anota reservas, recibe las que llegan desde la carta y maneja la fila de la puerta con aviso por WhatsApp.",
        imagenes: [
          {
            src: "dueno-reservas",
            alt: "Reservas y lista de espera",
            marcas: {
              1: "Nueva reserva: nombre, teléfono, personas, día y hora.",
              2: "A la lista de espera: para los que esperan en la puerta.",
              3: "Próximas reservas de los siguientes días.",
              4: "Mesa lista: le avisa al cliente por WhatsApp que ya puede pasar.",
            },
          },
        ],
      },
      {
        id: "caja",
        titulo: "Cierra la caja",
        resumen:
          "La caja suma todo lo cobrado en el turno: por medio de pago, propinas por persona y gastos. Al final cuentas el efectivo y el sistema te dice si sobra o falta.",
        imagenes: [
          {
            src: "dueno-caja",
            alt: "Caja del turno con ventas, propinas y medios de pago",
            marcas: {
              1: "Ventas, propinas, total cobrado, mesas cerradas y ticket promedio.",
              2: "Por medio de pago: efectivo, débito, crédito, transferencia…",
              3: "Propinas por persona del equipo.",
              4: "Gastos del turno o retiros a caja fuerte.",
              5: "Corte parcial: un resumen a mitad del turno sin cerrar la caja.",
            },
          },
          {
            src: "dueno-caja-cierre",
            alt: "Arqueo de efectivo y cierre de caja",
            pie: "Arqueo: escribe el efectivo que contaste y toca Cerrar caja. Queda guardado en Cierres anteriores.",
            marcas: { 1: "Cerrar caja." },
          },
        ],
        consejo: "Si quedan mesas abiertas al cerrar, lo que se cobre después entra en el turno siguiente.",
      },
      {
        id: "reportes",
        titulo: "Mira cómo va el negocio",
        resumen: "Reportes muestra ventas y propinas por mesero; Estadísticas muestra cuánta gente abre tu carta y a qué hora.",
        imagenes: [
          {
            src: "dueno-reportes",
            alt: "Reportes por mesero",
            marcas: {
              1: "Pestañas: por mesero, productos más vendidos, gastos y autorizaciones.",
              2: "Período: 7, 30 o 90 días.",
              3: "Por persona: mesas, comensales, ventas, propinas y tiempo por mesa.",
            },
          },
          {
            src: "dueno-estadisticas",
            alt: "Estadísticas de visitas a la carta",
            marcas: { 1: "Visitas a la carta.", 2: "Visitas por día.", 3: "Horarios con más visitas." },
          },
        ],
      },
      {
        id: "cliente",
        titulo: "Lo que ve tu cliente",
        resumen:
          "Al escanear el QR de la mesa, el cliente ve tu carta en su idioma, puede pedir, llamar al mesero y pedir la cuenta. Todo llega al salón como aviso.",
        imagenes: [{ src: "cliente-carta", alt: "Carta de Aroma Café en el celular del cliente" }],
        consejo: "Prueba tú mismo: escanea un QR de mesa y haz un pedido. Mira cómo le llega al mesero y a la cocina.",
      },
    ],
  },

  // ──────────────────────────── MESERO ────────────────────────────
  {
    id: "mesero",
    rol: "Mesero",
    titulo: "Mesero o garzón",
    bajada: "Atiende las mesas desde el celular: abre la mesa, toma el pedido, responde los avisos y cobra.",
    icono: "salon",
    puntos: ["Abrir mesas y tomar pedidos", "Avisos del cliente", "Cobrar y dividir la cuenta"],
    duracion: "15 min",
    pasos: [
      ENTRAR,
      {
        id: "salon",
        titulo: "Lee el salón de un vistazo",
        resumen:
          "Al entrar ves el plano con todas las mesas. El color te dice cómo está cada una y arriba aparecen los avisos que necesitan atención.",
        imagenes: [
          {
            src: "mesero-salon",
            alt: "Plano del salón con mesas de colores y avisos",
            marcas: {
              1: "Avisos: rojo = pedido por confirmar, azul = llama al mesero, violeta = pide la cuenta. Tócalos para ir a la mesa.",
              2: "Pisos o salones (Salón principal, Terraza) con mesas ocupadas y personas.",
              8: "Clientes en la lista de espera de la puerta.",
              3: "Buscar un plato: encuentra en qué mesas está pedido.",
              4: "Naranjo: mesa ocupada. Muestra personas/lugares y minutos desde que se abrió.",
              5: "Gris: mesa libre. La bolita con iniciales es el mesero a cargo.",
              6: "Verde con ✓: la cocina terminó un pedido; hay que llevarlo.",
              7: "Plano o Lista: la lista es más cómoda en el celular.",
            },
          },
        ],
        consejo: "Una mesa con un punto rojo en la esquina tiene un aviso sin atender.",
      },
      {
        id: "abrir",
        titulo: "Abre una mesa",
        resumen: "Cuando se sienta un cliente, toca su mesa en el plano y ábrela.",
        imagenes: [
          {
            src: "mesero-abrir",
            alt: "Abrir una mesa libre",
            marcas: {
              1: "¿Cuántos son? Ajusta con − y +.",
              2: "Abrir mesa: empieza a contar el tiempo y queda a tu nombre.",
              3: "Unir a una mesa abierta: si se suman a un grupo que ya está sentado.",
            },
          },
        ],
      },
      {
        id: "pedido",
        titulo: "Toma el pedido",
        resumen: "Toca los platos para sumarlos a la comanda. Cada plato puede llevar una nota y el comensal que lo pidió.",
        imagenes: [
          {
            src: "mesero-tomar",
            alt: "Tomar pedido con la carta y la comanda",
            marcas: {
              1: "Buscar plato por nombre.",
              2: "Categorías de la carta.",
              3: "Toca un plato para sumarlo; el número azul dice cuántos llevas.",
              4: "Nota para la cocina: sin sal, leche de avena, a punto…",
              5: "De quién es (Comensal 1, 2…): sirve para dividir la cuenta por consumo.",
              6: "Después: el plato queda en espera (por ejemplo, el fondo) hasta que lo marches.",
              7: "Enviar a cocina: la comanda aparece al instante en la pantalla de cocina.",
            },
          },
        ],
        pasos: [
          "En la mesa abierta toca + Tomar pedido.",
          "Toca cada plato; usa − y + para cambiar la cantidad.",
          "Revisa la comanda a la derecha y toca Enviar a cocina.",
        ],
        consejo: "Si se cae internet, la comanda queda guardada en el teléfono y se envía sola cuando vuelve la conexión.",
      },
      {
        id: "mesa",
        titulo: "Maneja la mesa abierta",
        resumen: "Desde la mesa ves todo lo pedido, en qué estado está cada comanda y el total.",
        imagenes: [
          {
            src: "mesero-mesa",
            alt: "Mesa abierta con comandas y total",
            marcas: {
              1: "Comensales: cámbialo si llega alguien más.",
              2: "Atiende: el mesero a cargo de la mesa.",
              3: "+ Tomar pedido: suma otra comanda.",
              4: "Cambiar de mesa o Juntar con otra.",
              5: "De quién es cada plato (Todos, C1, C2…).",
              6: "% Descuento o cortesía (puede pedir el PIN de un encargado).",
              7: "Imprimir la precuenta.",
              8: "Cobrar.",
            },
          },
        ],
        consejo: "El estado de cada comanda se ve a la derecha: Nuevo, Preparando, Listo o Entregado.",
      },
      {
        id: "avisos",
        titulo: "Responde los avisos del cliente",
        resumen:
          "El cliente puede pedir desde el QR, llamarte o pedir la cuenta desde su celular. Cada aviso suena distinto y aparece arriba del plano.",
        imagenes: [
          {
            src: "mesero-confirmar",
            alt: "Pedido hecho desde el QR esperando confirmación",
            pie: "Pedido desde el QR: revísalo con el cliente y confírmalo para que llegue a cocina.",
            marcas: { 1: "Desde el QR: lo pidió el cliente.", 2: "Confirmar y enviar a cocina." },
          },
          {
            src: "mesero-llama",
            alt: "Mesa que llama al mesero",
            pie: "Llama al mesero: ve a la mesa y marca Atendido.",
            marcas: {
              1: "Llama al mesero.",
              2: "Atendido: el aviso se apaga para todo el equipo.",
              3: "Si la mesa es de otro mesero, avísale o toca Pasármela para quedártela.",
            },
          },
          {
            src: "mesero-pide-cuenta",
            alt: "Mesa que pide la cuenta",
            pie: "Pide la cuenta: el cliente ya dijo cómo quiere pagar (partes iguales, propina y medio de pago).",
            marcas: { 1: "Cómo quiere pagar cada persona.", 2: "Atendido." },
          },
        ],
      },
      {
        id: "entregar",
        titulo: "Lleva lo que está listo",
        resumen: "Cuando la cocina termina un pedido, la mesa se pinta verde. Lleva los platos y márcalos como entregados.",
        imagenes: [
          {
            src: "mesero-listo",
            alt: "Comanda lista para entregar",
            marcas: { 1: "Listo: la cocina lo terminó.", 2: "Marcar entregado cuando lo dejas en la mesa." },
          },
        ],
      },
      {
        id: "cobrar",
        titulo: "Cobra la cuenta",
        resumen: "Elige cómo pagan, el medio de pago y la propina. La mesa se puede pagar en varias partes.",
        imagenes: [
          {
            src: "mesero-cobrar",
            alt: "Opciones para cobrar la cuenta",
            marcas: {
              1: "Todo junto: una persona paga la cuenta.",
              2: "Partes iguales: se divide el total entre todos.",
              3: "Cada uno lo suyo: según lo que consumió cada comensal.",
              4: "Monto libre: alguien paga una parte cualquiera.",
              5: "Propina al final: si la dejan después de pagar.",
            },
          },
          {
            src: "mesero-cobrar-iguales",
            alt: "Dividir la cuenta en partes iguales",
            pie: "Partes iguales: elige entre cuántos y cobra cada parte por separado.",
            marcas: { 1: "¿Entre cuántos?", 2: "Cada parte con su botón Cobrar." },
          },
          {
            src: "mesero-cobrar-medio",
            alt: "Medio de pago y propina",
            marcas: {
              1: "Medio de pago: efectivo, débito, crédito, transferencia o Mercado Pago.",
              2: "Propina: 10 %, 15 %, 20 %, un monto fijo u otro.",
              3: "La propina puede ir con otro medio (pagan con tarjeta y dejan propina en efectivo).",
              4: "Cobra: total con propina.",
            },
          },
          {
            src: "mesero-cobrar-final",
            alt: "Paga con y vuelto",
            pie: "En efectivo escribe con cuánto paga y el sistema calcula el vuelto.",
            marcas: { 1: "Paga con: billete que entrega el cliente.", 2: "Registrar pago." },
          },
          {
            src: "mesero-cobrado",
            alt: "Cuenta pagada",
            pie: "Cuando la cuenta está paga, cierra la mesa: queda libre para el próximo cliente.",
            marcas: { 1: "La cuenta está paga.", 2: "Cerrar mesa." },
          },
        ],
      },
      {
        id: "celular",
        titulo: "Trabaja desde el celular",
        resumen: "En el celular las mesas aparecen como lista y abajo tienes el menú de tus secciones.",
        imagenes: [
          {
            src: "mesero-celular",
            alt: "Salón en el celular del mesero",
            marcas: { 1: "Avisos de las mesas.", 2: "Toca una mesa para abrirla.", 3: "Menú de abajo: Salón y Cocina." },
          },
          {
            src: "mesero-celular-mesa",
            alt: "Mesa abierta en el celular",
            marcas: { 1: "Tomar pedido.", 2: "Cobrar." },
          },
        ],
        consejo: "Activa el sonido del teléfono: cada aviso suena distinto (cuenta, llamado, pedido listo).",
      },
      {
        id: "cocina",
        titulo: "Revisa cómo va la cocina",
        resumen: "Si tu administrador te lo activó, en Cocina ves las comandas en preparación y cuánto llevan esperando.",
        imagenes: [{ src: "mesero-cocina", alt: "Pantalla de cocina vista por el mesero" }],
      },
    ],
  },

  // ──────────────────────────── COCINA ────────────────────────────
  {
    id: "cocina",
    rol: "Cocina",
    titulo: "Cocina y barra",
    bajada: "Recibe las comandas al instante, prepáralas en orden y avisa al mesero cuando están listas.",
    icono: "cocina",
    puntos: ["Comandas en tiempo real", "Empezar y terminar", "Agotar platos"],
    duracion: "10 min",
    pasos: [
      {
        ...ENTRAR,
        resumen:
          "La cocina entra con su propia cuenta en una tableta o pantalla fija. Al entrar va directo a las comandas. El administrador te invita con tu correo y te llega un enlace para crear tu contraseña.",
        consejo: "Deja la pantalla siempre encendida y con el sonido activado.",
      },
      {
        id: "comanda",
        titulo: "Lee una comanda",
        resumen:
          "Cada tarjeta es un pedido. Las más antiguas van primero. El color de arriba cambia con el tiempo: verde recién llegó, naranjo lleva varios minutos y rojo está demorado.",
        imagenes: [
          {
            src: "cocina-comandas",
            alt: "Pantalla de comandas de cocina",
            marcas: {
              1: "Mesa, mesero que la tomó, minutos esperando y hora del pedido.",
              2: "Cantidad de cada plato (2×).",
              3: "Nota del mesero o del cliente: léela siempre.",
              4: "Empezar: tócalo cuando comienzas a prepararlo.",
              5: "La pantalla se actualiza sola cada 15 segundos.",
              6: "Listos para llevar a la mesa: lo que ya terminaste y espera al mesero.",
            },
          },
        ],
        consejo: "Arriba aparece cuando un pedido del QR espera que el mesero lo confirme: todavía no hay que prepararlo.",
      },
      {
        id: "empezar",
        titulo: "Empieza y termina cada pedido",
        resumen: "Dos toques por comanda: Empezar cuando la tomas y Terminar cuando está lista. El mesero ve cada cambio en su celular.",
        imagenes: [
          {
            src: "cocina-empezada",
            alt: "Comanda en preparación",
            pie: "Al tocar Empezar la comanda pasa a En preparación.",
            marcas: { 1: "En preparación.", 2: "Terminar: cuando el pedido está listo para salir." },
          },
          {
            src: "cocina-terminada",
            alt: "Pedidos listos para llevar",
            pie: "Al terminar, el pedido pasa a Listos para llevar y la mesa del mesero se pinta verde.",
            marcas: {
              1: "Listos para llevar a la mesa.",
              2: "Entregado: márcalo si el mesero ya lo retiró.",
              3: "Ver entregados recientes, por si necesitas revisar uno.",
            },
          },
        ],
      },
      {
        id: "vista",
        titulo: "Ordena la pantalla a tu gusto",
        resumen: "Puedes ver las comandas una por una o agrupadas por mesa, y filtrar por estación (cocina o barra).",
        imagenes: [
          {
            src: "cocina-herramientas",
            alt: "Herramientas de la pantalla de cocina",
            marcas: {
              1: "Separadas o Por mesa.",
              2: "Estación: Todas, Cocina o Barra (cada una puede tener su pantalla).",
              3: "Agotados.",
              4: "Sonido: encendido o silencio.",
              6: "Pantalla completa, ideal para una tableta en la pared.",
            },
          },
          {
            src: "cocina-por-mesa",
            alt: "Comandas agrupadas por mesa",
            pie: "Por mesa: junta todas las comandas de una mesa para que salgan juntas.",
            marcas: { 1: "Por mesa." },
          },
        ],
      },
      {
        id: "agotados",
        titulo: "Avisa lo que se acabó",
        resumen: "Si se terminó un ingrediente, agota el plato: desaparece de la carta del cliente al instante y vuelve solo al día siguiente a las 6 de la mañana.",
        imagenes: [
          {
            src: "cocina-agotados",
            alt: "Platos agotados",
            marcas: { 1: "Busca el plato.", 2: "Toca Hay para dejarlo Agotado (y otra vez para que vuelva)." },
          },
        ],
        consejo: "Avísale también al mesero que esté tomando pedidos en ese momento.",
      },
    ],
  },
];
