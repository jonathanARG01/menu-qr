import { CORREO_CONTACTO, DOMINIO } from "./marca";

// Textos legales públicos de Sellito (/terminos y /privacidad). Se editan aquí, sin tocar el diseño.

export type SeccionLegal = { titulo: string; parrafos: string[]; lista?: [string, string][]; nota?: string };

export const EMPRESA = {
  razon: "BROTE DIGITAL SpA",
  rut: "78.555.133-8",
  domicilio: "El Vergel 722, Cerro La Cruz, Valparaíso, Chile",
  correo: CORREO_CONTACTO,
};

export const ACTUALIZADO = "14 de noviembre de 2026";

export const TERMINOS: SeccionLegal[] = [
  {
    titulo: "Quiénes somos",
    parrafos: [
      `Sellito es un servicio de ${EMPRESA.razon}, RUT ${EMPRESA.rut}, con domicilio en ${EMPRESA.domicilio}. Contacto: ${EMPRESA.correo}. Al crear una cuenta o usar ${DOMINIO} aceptas estos términos.`,
    ],
  },
  {
    titulo: "El servicio",
    parrafos: [
      `Sellito es una plataforma web de tarjetas digitales de sellos (programa de fidelización) para negocios de cualquier rubro. Permite crear la tarjeta del negocio, que sus clientes se unan con un código QR, sumar sellos, canjear premios y enviar avisos automáticos. Las funciones de cada plan se describen en ${DOMINIO}.`,
    ],
  },
  {
    titulo: "Cuentas",
    parrafos: [
      `Para usar el panel debes ser mayor de 18 años y actuar en nombre de un negocio. Eres responsable de la veracidad de los datos de tu cuenta, de las claves de tu equipo y de todo lo que se haga con ellas. Avisa a ${EMPRESA.correo} si sospechas un acceso no autorizado.`,
    ],
  },
  {
    titulo: "Prueba gratuita",
    parrafos: [
      "Las cuentas nuevas tienen 14 días de prueba sin costo. Al terminar, la cuenta se pausa hasta que contrates un plan; no se cobra nada automáticamente sin tu autorización.",
    ],
  },
  {
    titulo: "Planes, precios y pagos",
    parrafos: [
      "Los precios publicados se expresan en pesos chilenos más IVA y se pagan por anticipado cada mes. Los cambios de precio se avisan por correo con al menos 30 días de anticipación. Si un pago se atrasa más de 10 días, podemos suspender la cuenta hasta que se regularice, sin borrar tu información. No se reembolsan períodos ya iniciados, salvo falla grave del servicio atribuible a nosotros.",
    ],
  },
  {
    titulo: "Tu contenido",
    parrafos: [
      "El nombre, logo, premios, condiciones y textos que subes siguen siendo tuyos. Nos autorizas a alojarlos y mostrarlos solo para prestar el servicio. Eres responsable de que la información sea correcta y legal, de cumplir los premios que ofreces y de tener derecho a usar las imágenes que subas.",
    ],
  },
  {
    titulo: "Uso aceptable",
    parrafos: [
      "No puedes usar Sellito para actividades ilegales, para enviar spam, para vender productos prohibidos, ni para intentar acceder a cuentas o datos de otros, copiar la plataforma o afectar su funcionamiento. Podemos suspender cuentas que incumplan esta regla.",
    ],
  },
  {
    titulo: "Clientes del negocio",
    parrafos: [
      "Quienes escanean el QR pueden unirse a la tarjeta de sellos del negocio. Los premios, sus condiciones y la atención son responsabilidad del negocio. Sellito no vende los productos o servicios del negocio ni responde por la entrega de sus premios.",
    ],
  },
  {
    titulo: "Disponibilidad y soporte",
    parrafos: [
      "Buscamos que la plataforma esté disponible el 99 % del tiempo cada mes, sin contar mantenciones avisadas ni fallas de internet o de proveedores de nube. Damos soporte por WhatsApp y correo.",
    ],
  },
  {
    titulo: "Propiedad intelectual",
    parrafos: [
      `La plataforma, su código, diseños, marca Sellito y logos pertenecen a ${EMPRESA.razon}. Tu suscripción te da derecho a usarla, no a copiarla ni revenderla.`,
    ],
  },
  {
    titulo: "Responsabilidad",
    parrafos: [
      "Prestamos el servicio con cuidado profesional. Nuestra responsabilidad total se limita a lo que pagaste en los 3 meses anteriores al hecho, y no responde por lucro cesante ni daños indirectos, salvo dolo o culpa grave. Nada de esto limita los derechos irrenunciables que te da la ley.",
    ],
  },
  {
    titulo: "Término",
    parrafos: [
      `Puedes cerrar tu cuenta cuando quieras escribiendo a ${EMPRESA.correo}. Durante los 30 días siguientes puedes pedir una copia de tus clientes y sus sellos; después, la información se elimina, salvo la que debamos conservar por ley.`,
    ],
  },
  {
    titulo: "Cambios a estos términos",
    parrafos: ["Si cambian en algo importante, te avisaremos por correo o en el panel al menos 15 días antes de que rijan."],
  },
  {
    titulo: "Ley y tribunales",
    parrafos: ["Estos términos se rigen por la ley chilena. Cualquier controversia se somete a los tribunales de Valparaíso."],
  },
];

export const PRIVACIDAD: SeccionLegal[] = [
  {
    titulo: "Quién es responsable",
    parrafos: [
      `${EMPRESA.razon}, RUT ${EMPRESA.rut}, domicilio ${EMPRESA.domicilio}, dueña del servicio Sellito. Contacto para temas de datos personales: ${EMPRESA.correo}.`,
    ],
  },
  {
    titulo: "Leyes que aplicamos",
    parrafos: [
      "Tratamos los datos según la Ley 19.628 sobre Protección de la Vida Privada y la Ley 21.719, que la moderniza y rige desde el 1 de diciembre de 2026.",
    ],
  },
  {
    titulo: "Qué datos recogemos",
    parrafos: [],
    lista: [
      [
        "Negocios y su equipo",
        "nombre del negocio, nombre y correo de quien crea la cuenta, teléfono, datos de facturación (razón social, RUT, giro, dirección) y nombre, correo y rol de las personas del equipo.",
      ],
      [
        "Clientes de los negocios",
        "nombre, teléfono, y si los entregan, correo y fecha de cumpleaños, además de sus sellos, premios y canjes.",
      ],
      [
        "Datos técnicos",
        "dirección IP, tipo de dispositivo y navegador, páginas visitadas, y datos guardados en el navegador (cookies y almacenamiento local) para mantener la sesión y recordar la tarjeta en el celular.",
      ],
    ],
    nota: "No recogemos datos de tarjetas de pago: los pagos los procesa el proveedor de pagos directamente.",
  },
  {
    titulo: "Para qué los usamos",
    parrafos: [
      "Para prestar el servicio (la tarjeta de sellos, sus premios y sus avisos), crear y proteger cuentas, cobrar y emitir documentos tributarios, dar soporte, generar estadísticas para el negocio y mejorar Sellito. No vendemos datos personales ni los usamos para publicidad de terceros.",
    ],
  },
  {
    titulo: "Quién decide sobre los datos de los clientes",
    parrafos: [
      "Cada negocio es el responsable de los datos de sus clientes y decide para qué los usa (por ejemplo, avisos de su tarjeta de sellos). Sellito actúa como encargado: los trata solo por cuenta del negocio y según sus instrucciones. Si eres cliente y quieres ejercer tus derechos, puedes escribir al negocio o a nosotros, y lo coordinaremos. Para los datos de las cuentas de los negocios, Sellito es el responsable.",
    ],
  },
  {
    titulo: "Base legal",
    parrafos: [
      "Tratamos los datos para cumplir el contrato con el negocio, con el consentimiento del cliente cuando entrega datos opcionales (como cumpleaños o teléfono para la tarjeta de sellos), por obligaciones legales y tributarias, y por interés legítimo en la seguridad del servicio.",
    ],
  },
  {
    titulo: "Proveedores y transferencias internacionales",
    parrafos: [
      "Usamos proveedores que guardan o procesan datos por nosotros: Supabase (base de datos), Vercel (alojamiento del sitio) y Google Wallet (si el cliente guarda ahí su tarjeta). Algunos tienen servidores fuera de Chile, como en Estados Unidos. Elegimos proveedores con medidas de seguridad y compromisos de protección de datos adecuados.",
    ],
  },
  {
    titulo: "Cuánto tiempo los guardamos",
    parrafos: [
      "Mientras la cuenta del negocio esté activa. Al cerrar la cuenta, borramos o anonimizamos los datos dentro de 30 días, salvo los que la ley nos obliga a guardar más tiempo (por ejemplo, información tributaria, hasta 6 años). El negocio puede pedir una copia de sus datos antes del cierre.",
    ],
  },
  {
    titulo: "Seguridad",
    parrafos: [
      "Usamos conexiones cifradas (HTTPS), contraseñas protegidas, permisos por rol para que cada persona del equipo vea solo lo que le corresponde, y reglas de acceso en la base de datos que separan la información de cada negocio. Si ocurre una vulneración que afecte tus datos, avisaremos a los afectados y a la autoridad según la ley.",
    ],
  },
  {
    titulo: "Tus derechos",
    parrafos: [
      `Puedes pedir acceso a tus datos, rectificarlos, suprimirlos, oponerte a su uso, pedir su portabilidad o su bloqueo temporal. Escríbenos a ${EMPRESA.correo} indicando tu nombre, el negocio (si eres cliente) y qué necesitas. Respondemos dentro de 30 días corridos. Si no quedas conforme, puedes reclamar ante la Agencia de Protección de Datos Personales.`,
    ],
  },
  {
    titulo: "Menores de edad",
    parrafos: [
      "Sellito no está dirigido a menores de 14 años. Si un menor nos entregó datos sin autorización de sus padres, escríbenos y los borraremos.",
    ],
  },
  {
    titulo: "Cookies",
    parrafos: [
      "Usamos solo las necesarias para que el sitio funcione (sesión y recordar tu tarjeta). No usamos cookies de publicidad. Puedes borrarlas desde tu navegador, aunque algunas funciones pueden dejar de andar.",
    ],
  },
  {
    titulo: "Cambios",
    parrafos: [
      "Si cambiamos esta política, publicaremos la nueva versión aquí con su fecha, y avisaremos por correo a los negocios cuando el cambio sea importante.",
    ],
  },
  {
    titulo: "Contacto",
    parrafos: [`${EMPRESA.razon}, ${EMPRESA.correo}, ${EMPRESA.domicilio}.`],
  },
];
