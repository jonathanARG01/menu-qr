import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ARMADOS, DEMOS, DIAS_PRUEBA, PERIODOS, PLANES } from "@/components/inicio/datos";
import { WHATSAPP_VENTAS } from "@/lib/planes";
import { PRECIO_SELLOS } from "@/lib/sellos/tipos";
import { urlTutorial } from "@/lib/tutoriales";
import "./vendedores.css";

export const metadata: Metadata = {
  title: "Guía para vendedores · Platovi",
  description: "Todo lo que necesita saber quien vende Platovi: qué hace, precios, demos, objeciones y tutoriales.",
  // Es para el equipo de venta: se comparte por link, no hace falta que aparezca en Google.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0b0e14" };

// Guía para quien sale a buscar clientes. Los precios, demos y tutoriales salen de los mismos datos del sitio,
// así que se actualizan solos. No va nada privado (comisiones, rutas internas): la página es pública.

const IVA = 0.19;
const miles = (n: number) => `$${new Intl.NumberFormat("es-CL").format(Math.round(n))}`;

// Demos de Valparaíso primero (las que más sirven en la calle), después las de la landing.
const DEMOS_VALPO = [
  { slug: "cafe-del-pintor", nombre: "Café del Pintor", tipo: "Cafetería · Valparaíso" },
  { slug: "il-paparazzo", nombre: "Il Paparazzo", tipo: "Ristorante y winebar · Valparaíso" },
  { slug: "pastalegre", nombre: "Pastalegre", tipo: "Pastas · Cerro Alegre" },
  { slug: "doris", nombre: "Doris Restaurant", tipo: "Cocina porteña · Barrio Puerto" },
];
// Aroma Café queda fuera: es la cuenta de pruebas y a veces tiene platos de prueba.
const DEMOS_GUIA = [...DEMOS_VALPO, ...DEMOS.filter((d) => d.slug !== "aroma-cafe")];

const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const ICONOS = {
  cliente: (
    <svg {...svg}>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </svg>
  ),
  mesero: (
    <svg {...svg}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <circle cx="17.5" cy="17.5" r="3.5" />
    </svg>
  ),
  cocina: (
    <svg {...svg}>
      <path d="M6 13.9V20h12v-6.1" />
      <path d="M6 14a4 4 0 1 1 2.3-7.3 4.5 4.5 0 0 1 7.4 0A4 4 0 1 1 18 14Z" />
    </svg>
  ),
  dueno: (
    <svg {...svg}>
      <path d="M3 21h18" />
      <path d="M5 21V8l7-5 7 5v13" />
      <path d="M9 21v-6h6v6" />
    </svg>
  ),
  loyalty: (
    <svg {...svg}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <circle cx="8" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="16" cy="12" r="1.6" />
    </svg>
  ),
};

function Nuevo() {
  return <span className="vend-nuevo">Nuevo</span>;
}

const ROLES: { icono: keyof typeof ICONOS; titulo: string; puntos: React.ReactNode[] }[] = [
  {
    icono: "cliente",
    titulo: "El cliente en la mesa",
    puntos: [
      "Escanea el QR con la cámara. No baja ninguna app.",
      "Ve la carta con fotos en su idioma: español, inglés, portugués, francés, italiano, alemán, holandés y chino.",
      "Pide desde la mesa o por WhatsApp, con notas para la cocina.",
      "Llama al mesero o pide la cuenta con un toque.",
      <>
        Al pedir la cuenta por separado, marca de quién es cada plato y ve el detalle y el total de cada persona, con su nombre. <Nuevo />
      </>,
      "Elige propina y medio de pago. Puede pagar online con tarjeta (Mercado Pago del local).",
      "Reserva mesa desde un link y recibe aviso por WhatsApp cuando su mesa está lista.",
    ],
  },
  {
    icono: "mesero",
    titulo: "El mesero o garzón",
    puntos: [
      "Ve el salón completo en el plano: libre, ocupada, llamando, pidiendo la cuenta.",
      <>
        Cuatro formas de ver el salón: simple, a color, en 3D o como maqueta con los comensales sentados. <Nuevo />
      </>,
      <>
        Indicadores que se prenden y apagan: tiempo en la mesa, pedidos atrasados, total de cada mesa, mesas por limpiar y mapa de calor. <Nuevo />
      </>,
      <>
        Anota el nombre de cada comensal en mesas grandes y cobra a cada uno lo suyo. <Nuevo />
      </>,
      "Abre mesas, toma pedidos, confirma los que llegan por QR y lleva lo que la cocina terminó.",
      "Cobra todo junto, en partes iguales, por consumo o un monto libre, con propina.",
      "Trabaja desde su celular; cada cobro y propina queda a su nombre.",
    ],
  },
  {
    icono: "cocina",
    titulo: "Cocina y barra",
    puntos: [
      "Las comandas llegan solas a la pantalla, separadas por estación (cocina, barra…).",
      "Con un toque empiezan a preparar y con otro terminan; el mesero y el cliente reciben el aviso.",
      "Cada comanda muestra cuánto tiempo lleva esperando.",
      "Marcan lo que se acabó y desaparece de la carta al instante.",
      "Sirve cualquier tablet o un televisor con navegador.",
    ],
  },
  {
    icono: "dueno",
    titulo: "El dueño o administrador",
    puntos: [
      "Arma la carta: platos, fotos, precios, opciones (tamaño, agregados) e íconos. También la importa desde Excel.",
      "Elige entre decenas de diseños de carta (nuevos cada mes), con su logo y sus colores.",
      "Imprime los QR por mesa. Si cambia un precio, el QR sigue siendo el mismo.",
      "Dibuja el plano del salón con pisos, terraza o playa.",
      "Suma a su equipo con correo y rol, y les pone PIN para descuentos o anulaciones.",
      <>
        Promos por horario (happy hour, menú del día) o para fechas puntuales y rangos con calendario, como Navidad. <Nuevo />
      </>,
      "Reservas por turnos y lista de espera.",
      <>
        Caja con cuadre por medio de pago, propinas por persona y gastos. Al cerrar ve lo que quedó pendiente por cobrar y el fondo del turno siguiente. <Nuevo />
      </>,
      "Estadísticas, reportes y clientes frecuentes. Con el plan Grupo, varias sucursales en un solo panel.",
      "Enciende solo lo que usa: un café chico puede usar solo la carta.",
    ],
  },
];

const OBJECIONES: [string, React.ReactNode][] = [
  [
    "«Es caro.»",
    <>
      Una sola reimpresión de la carta cuesta más que un mes del plan Carta. Y el plan Pro reemplaza la comanda en papel, el sistema de
      cocina y el cuadre de caja. Además <b>no hay permanencia</b>: si no le sirve, lo deja.
    </>,
  ],
  [
    "«Mis clientes son mayores, no usan QR.»",
    "La carta en papel puede seguir. El QR se abre con la cámara, sin app, y el mesero puede tomar el pedido igual desde su celular. El sistema sirve aunque el cliente nunca escanee.",
  ],
  [
    "«No tengo tiempo para cargar la carta.»",
    <>
      <b>Se la cargamos nosotros gratis</b> (armado básico, sin límite de platos). Basta con una foto de la carta actual.
    </>,
  ],
  ["«¿Tengo que comprar equipos?»", "No. Funciona en el celular, tablet o computador que ya tiene. Para la cocina sirve cualquier tablet o un televisor con navegador."],
  ["«¿Y si se cae internet?»", "Los clientes ven la carta con sus propios datos móviles, así que la carta sigue funcionando."],
  [
    "«¿Cobran comisión por pedido?»",
    "No. Solo el plan mensual. En el cobro online, Mercado Pago cobra su comisión habitual al local, y el dinero llega directo a la cuenta del local.",
  ],
  [
    "«Ya uso otro sistema.»",
    "Pregunta cuánto paga y qué le falta. Muchos cobran aparte las mesas o la pantalla de cocina, o no tienen carta con fotos e idiomas. Platovi Pro trae todo eso en un solo precio.",
  ],
  [
    "«Lo voy a pensar.»",
    `Ofrécele la prueba de ${DIAS_PRUEBA} días sin tarjeta: «Te dejo la carta armada esta semana y la pruebas con tus clientes. Si no te gusta, no pagas nada.»`,
  ],
];

const TUTORIALES_GUIA = [
  { id: "administrador" as const, icono: "dueno" as const, titulo: "Administrador del local", texto: "Carta, QR, plano, equipo, caja y reportes" },
  { id: "mesero" as const, icono: "mesero" as const, titulo: "Mesero o garzón", texto: "Salón, comensales, pedidos, avisos y cobro" },
  { id: "cocina" as const, icono: "cocina" as const, titulo: "Cocina y barra", texto: "Comandas, preparación y agotados" },
];

export default function PaginaVendedores() {
  const whatsapp = `+${WHATSAPP_VENTAS.replace(/^(\d{2})(\d)(\d{4})(\d{4})$/, "$1 $2 $3 $4")}`;
  const descuentos = PERIODOS.filter((p) => p.descuento > 0)
    .map((p) => `${p.nombre.toLowerCase()} −${Math.round(p.descuento * 100)} %`)
    .join(", ");
  const basico = ARMADOS.find((a) => a.id === "basico")!;
  const completo = ARMADOS.find((a) => a.id === "completo")!;

  return (
    <div className="vend">
      <div className="vend-wrap vend-top">
        <Link href="/" aria-label="Platovi, inicio">
          <Logo oscuro className="text-xl" />
        </Link>
        <nav>
          <Link href="/tutoriales-por-rol">Tutoriales</Link>
          <Link href="/">platovi.cl</Link>
        </nav>
      </div>

      <header className="vend-hero">
        <div className="vend-wrap">
          <p className="vend-eyebrow">Guía para vendedores</p>
          <h1>
            La carta QR que también <span className="vend-serif">atiende</span> el local
          </h1>
          <p className="vend-lead">
            Platovi es una carta digital con QR para restaurantes, cafés y bares. El cliente escanea, ve la carta en su idioma y pide desde la
            mesa. El local maneja salón, cocina, caja y reservas desde el celular, sin comprar equipos.
          </p>
          <div className="vend-pitch">
            «¿Cuánto te cuesta cada vez que cambias un precio y reimprimes la carta? Con Platovi tu carta vive en un QR: la cambias desde el
            celular en un minuto, el turista la lee en su idioma y puede pedir desde la mesa. Te armamos la carta gratis y la pruebas{" "}
            {DIAS_PRUEBA} días sin poner tarjeta.»
            <small>El argumento en 30 segundos. Dilo con tus palabras.</small>
          </div>
        </div>
      </header>

      <nav className="vend-indice" aria-label="Secciones">
        <div className="vend-wrap">
          <a href="#quien">A quién buscar</a>
          <a href="#roles">Qué hace</a>
          <a href="#precios">Precios</a>
          <a href="#demos">Demos</a>
          <a href="#demo5">Demo en 5 min</a>
          <a href="#objeciones">Objeciones</a>
          <a href="#competencia">Competencia</a>
          <a href="#tutoriales">Tutoriales</a>
          <a href="#cierre">Cerrar la venta</a>
        </div>
      </nav>

      <section id="quien" className="vend-sec">
        <div className="vend-wrap">
          <div className="vend-cab">
            <p className="vend-eyebrow">Prospectos</p>
            <h2>A quién buscar</h2>
          </div>
          <div className="vend-grid vend-g2">
            <div className="vend-card">
              <h3>Los mejores clientes</h3>
              <ul className="vend-lista">
                <li>Cafés, restaurantes, bares, picadas y pizzerías.</li>
                <li>Locales con turistas: la carta en otros idiomas les ahorra explicaciones.</li>
                <li>Locales que cambian precios o platos seguido y reimprimen la carta.</li>
                <li>Locales con salón y meseros que hoy anotan en papel.</li>
              </ul>
            </div>
            <div className="vend-card">
              <h3>Cómo acercarte</h3>
              <ul className="vend-lista">
                <li>Habla con el dueño o el administrador, no con el mesero de turno.</li>
                <li>Ve fuera de la hora punta: media tarde es ideal.</li>
                <li>Lleva el celular listo con una demo abierta (abajo están los links).</li>
                <li>No vendas «un sistema»: muestra cómo se ve su propia carta en un QR.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="roles" className="vend-sec alt">
        <div className="vend-wrap">
          <div className="vend-cab">
            <p className="vend-eyebrow">El sistema</p>
            <h2>Qué hace Platovi para cada persona del local</h2>
            <p className="vend-lead">
              Cada persona entra con su propia cuenta y ve solo lo que le sirve. Funciona en el celular, tablet o computador que el local ya
              tiene.
            </p>
          </div>
          <div className="vend-grid vend-g2">
            {ROLES.map((r) => (
              <div key={r.titulo} className="vend-card">
                <h3>
                  <span className="vend-ico">{ICONOS[r.icono]}</span>
                  {r.titulo}
                </h3>
                <ul className="vend-lista">
                  {r.puntos.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="vend-card" style={{ marginTop: 14 }}>
            <h3>
              <span className="vend-ico">{ICONOS.loyalty}</span>
              Platovi Loyalty (módulo aparte)
            </h3>
            <p>
              Tarjeta de sellos digital: el cliente escanea el QR de su precuenta y suma un sello, sin descargar nada. Al completar la tarjeta
              gana su premio. Sirve para que el cliente vuelva y para pedir reseñas. Se contrata aparte del plan.
            </p>
          </div>
        </div>
      </section>

      <section id="precios" className="vend-sec">
        <div className="vend-wrap">
          <div className="vend-cab">
            <p className="vend-eyebrow">En pesos chilenos</p>
            <h2>Planes y precios</h2>
            <p className="vend-lead">
              Precios mensuales por local, más IVA. Sin permanencia, sin comisión por pedido y con {DIAS_PRUEBA} días de prueba gratis sin
              poner tarjeta.
            </p>
          </div>
          <div className="vend-grid vend-g3">
            {PLANES.map((p) => (
              <div key={p.id} className={`vend-card vend-plan${"destacado" in p && p.destacado ? " dest" : ""}`}>
                <h3>
                  {p.nombre}
                  {"destacado" in p && p.destacado && <span className="vend-nuevo">El más vendido</span>}
                </h3>
                <div className="vend-precio">
                  {miles(p.precio)} <small>/ mes + IVA</small>
                </div>
                <div className="vend-coniva">{miles(p.precio * (1 + IVA))} con IVA</div>
                <p className="vend-para">{p.para}</p>
                <ul className="vend-lista">
                  {p.incluye.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="vend-tabla">
            <table>
              <thead>
                <tr>
                  <th>Extra</th>
                  <th>Qué incluye</th>
                  <th style={{ textAlign: "right" }}>Precio + IVA</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <b>Armado {basico.nombre}</b>
                  </td>
                  <td>{basico.incluye.join(". ")}. Promo de lanzamiento, solo al contratar un plan mensual.</td>
                  <td className="n vend-gratis">{basico.precio === 0 ? "Gratis" : miles(basico.precio)}</td>
                </tr>
                <tr>
                  <td>
                    <b>Armado {completo.nombre}</b>
                  </td>
                  <td>{completo.incluye.join(". ")}.</td>
                  <td className="n">{miles(completo.precio)} pago único</td>
                </tr>
                <tr>
                  <td>
                    <b>Platovi Loyalty</b>
                  </td>
                  <td>Tarjeta de sellos digital para que el cliente vuelva.</td>
                  <td className="n">
                    {miles(PRECIO_SELLOS.local)} / mes por local
                    <br />
                    <span style={{ fontWeight: 500, color: "var(--v-suave)" }}>{miles(PRECIO_SELLOS.grupo)} / mes en Grupo</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="vend-nota">
            <b>Descuentos por pagar por adelantado:</b> {descuentos}. El IVA es del 19 %. Platovi es una marca de Brote Digital SpA, empresa
            chilena, y emite factura.
          </p>
        </div>
      </section>

      <section id="demos" className="vend-sec alt">
        <div className="vend-wrap">
          <div className="vend-cab">
            <p className="vend-eyebrow">Para mostrar</p>
            <h2>Demos que puedes abrir en el celular</h2>
            <p className="vend-lead">
              Cartas de ejemplo reales, cada una con un diseño distinto. Ábrelas tú o deja que el dueño las escanee. Elige la que más se parezca a
              su local.
            </p>
          </div>
          <div className="vend-grid vend-g4">
            {DEMOS_GUIA.map((d) => (
              <a key={d.slug} className="vend-demo" href={`/${d.slug}`} target="_blank" rel="noopener">
                <b>{d.nombre}</b>
                <span>{d.tipo}</span>
                <code>platovi.cl/{d.slug}</code>
              </a>
            ))}
          </div>
          <p className="vend-nota">
            En <Link href="/">platovi.cl</Link>, la sección «Así se ve un servicio» muestra en animación todo el recorrido: pedido, salón, cocina,
            cobro y Loyalty. Sirve para mostrar el panel sin entrar a una cuenta.
          </p>
        </div>
      </section>

      <section id="demo5" className="vend-sec">
        <div className="vend-wrap">
          <div className="vend-cab">
            <p className="vend-eyebrow">En orden</p>
            <h2>La demo en 5 minutos</h2>
          </div>
          <ol className="vend-pasos">
            <li>
              <div>
                <b>Pásale tu celular</b> con una demo abierta, o que escanee el QR con el suyo.
              </div>
            </li>
            <li>
              <div>
                <b>Que cambie el idioma</b> de la carta con un toque. Al dueño con turistas esto lo convence solo.
              </div>
            </li>
            <li>
              <div>
                <b>Que agregue un plato y envíe un pedido</b> de prueba, con una nota para la cocina.
              </div>
            </li>
            <li>
              <div>
                <b>Muestra platovi.cl</b>, sección «Así se ve un servicio»: el pedido llega a cocina y aparece en el mapa de mesas.
              </div>
            </li>
            <li>
              <div>
                <b>Cierra con:</b> «Esto mismo, con tu carta y tu logo. Te la armamos gratis y la pruebas {DIAS_PRUEBA} días.»
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section id="objeciones" className="vend-sec alt">
        <div className="vend-wrap">
          <div className="vend-cab">
            <p className="vend-eyebrow">Respuestas cortas</p>
            <h2>Objeciones frecuentes</h2>
          </div>
          {OBJECIONES.map(([o, r]) => (
            <details key={o}>
              <summary>{o}</summary>
              <p>{r}</p>
            </details>
          ))}
        </div>
      </section>

      <section id="competencia" className="vend-sec">
        <div className="vend-wrap">
          <div className="vend-cab">
            <p className="vend-eyebrow">Referencia</p>
            <h2>Cómo se compara</h2>
            <p className="vend-lead">Precios publicados por cada empresa en sus sitios a fines de 2026. Úsalos como referencia, pueden cambiar.</p>
          </div>
          <div className="vend-tabla">
            <table>
              <thead>
                <tr>
                  <th>Sistema</th>
                  <th>Precio de referencia</th>
                  <th>Lo que hay que saber</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <b>Platovi Pro</b>
                  </td>
                  <td className="n">{miles(PLANES.find((p) => p.id === "pro")!.precio)} + IVA</td>
                  <td>Carta QR con fotos e idiomas, pedidos, mesas, cocina, caja y reservas incluidos.</td>
                </tr>
                <tr>
                  <td>Fudo</td>
                  <td className="n">desde $25.500 + IVA</td>
                  <td>Las mesas (+$4.500) y la pantalla de cocina (+$9.500) se cobran aparte.</td>
                </tr>
                <tr>
                  <td>Toteat</td>
                  <td className="n">desde $39.900 + IVA</td>
                  <td>Además cobra un porcentaje de la venta.</td>
                </tr>
                <tr>
                  <td>Norte Gestión</td>
                  <td className="n">1 a 2 UF + IVA</td>
                  <td>Fuerte en inventario y costos. La carta QR solo viene en el plan de 2 UF, sin fotos ni idiomas.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="tutoriales" className="vend-sec alt">
        <div className="vend-wrap">
          <div className="vend-cab">
            <p className="vend-eyebrow">Para aprender el sistema</p>
            <h2>Tutoriales por rol</h2>
            <p className="vend-lead">
              Paso a paso con pantallazos del panel. Son los mismos que usa el equipo de cada local para capacitarse, así que también sirven para
              mostrárselos al cliente.
            </p>
          </div>
          <div className="vend-grid vend-g3">
            {TUTORIALES_GUIA.map((t) => (
              <Link key={t.id} className="vend-tuto" href={urlTutorial(t.id)}>
                <span className="vend-ico">{ICONOS[t.icono]}</span>
                <div>
                  <b>{t.titulo}</b>
                  <span>{t.texto}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="cierre" className="vend-sec vend-no">
        <div className="vend-wrap">
          <div className="vend-cab">
            <p className="vend-eyebrow">Para no prometer de más</p>
            <h2>Lo que Platovi todavía no hace</h2>
          </div>
          <div className="vend-card">
            <ul className="vend-lista">
              <li>No emite boleta electrónica del SII al cliente final (el local sigue usando su máquina o sistema de boletas).</li>
              <li>No lleva inventario ni costo por plato.</li>
              <li>No está conectado a PedidosYa, Uber Eats ni Rappi.</li>
            </ul>
            <p className="vend-nota">Si un local necesita algo de esto, anótalo y avísanos: nos ayuda a decidir qué construir primero.</p>
          </div>

          <div className="vend-cab" style={{ marginTop: 40 }}>
            <p className="vend-eyebrow">Cuando el local dice que sí</p>
            <h2>Cómo cerrar la venta</h2>
          </div>
          <ol className="vend-pasos">
            <li>
              <div>
                <b>Pide una foto de la carta actual</b> y el logo del local, si tiene.
              </div>
            </li>
            <li>
              <div>
                <b>Anota</b> nombre del local, dueño, teléfono, cuántas mesas tiene y qué plan le interesa.
              </div>
            </li>
            <li>
              <div>
                <b>Mándalo por WhatsApp.</b> Armamos la carta, activamos la prueba de {DIAS_PRUEBA} días y coordinamos la capacitación.
              </div>
            </li>
          </ol>
          <div className="vend-contacto">
            <a className="vend-chip" href={`https://wa.me/${WHATSAPP_VENTAS}`} target="_blank" rel="noopener">
              WhatsApp ventas: {whatsapp}
            </a>
            <span className="vend-chip">hola@platovi.cl</span>
          </div>
        </div>
      </section>

      <footer className="vend-wrap vend-pie">Platovi · Brote Digital SpA · Hecho en Valparaíso, Chile.</footer>
    </div>
  );
}
