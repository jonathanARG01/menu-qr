import Link from "next/link";
import { Inclinable } from "@/components/Inclinable";
import { TarjetaVisual } from "@/components/TarjetaVisual";
import { Etiqueta, SitioClub, Titulo, retraso } from "@/components/sitio/Marco";
import { PreciosPlanes } from "@/components/sitio/Precios";
import { FormContacto } from "@/components/sitio/Contacto";
import { DIAS_PRUEBA, EN_TODOS, MARCA, enlaceWhatsapp } from "@/lib/marca";
import { RUBROS, type IdRubro } from "@/lib/rubros";
import { PROGRAMA_BASE, emojiSello, type DisenoSello, type ProgramaSellos } from "@/lib/tipos";

// Página de venta (mismo lenguaje visual que platovi.cl, con la paleta jade y coral de Club de Clientes).

const ejemplo = (rubro: IdRubro, diseno: DisenoSello, extra: Partial<ProgramaSellos> = {}): ProgramaSellos => ({
  ...PROGRAMA_BASE,
  meta: RUBROS[rubro].meta,
  premio: RUBROS[rubro].premio,
  icono: RUBROS[rubro].icono,
  color: RUBROS[rubro].color,
  diseno,
  ...extra,
});

const MUESTRAS: { rubro: IdRubro; local: string; diseno: DisenoSello; sellos: number; nombre: string }[] = [
  { rubro: "barberia", local: "Barbería Don Pepe", diseno: "dorada", sellos: 4, nombre: "Matías" },
  { rubro: "padel", local: "Pádel Club Viña", diseno: "holografica", sellos: 7, nombre: "Camila" },
  { rubro: "unas", local: "Nails Studio", diseno: "cristal", sellos: 3, nombre: "Fernanda" },
];

const CIFRAS: [number, string, string][] = [
  [2, "minutos", "para armar tu tarjeta"],
  [10, "segundos", "para que tu cliente se una"],
  [0, "apps", "que descargar"],
  [DIAS_PRUEBA, "días", "gratis para probar"],
];

const PASOS: [string, string, string][] = [
  ["Arma tu tarjeta en 2 minutos", "Sellos, puntos o cashback, el premio y tu diseño. Sube tu logo o pídenos uno a tu medida.", "✨"],
  ["Tu cliente escanea y se une", "Pone su nombre y teléfono. La tarjeta queda en su celular, sin bajar ninguna app.", "📲"],
  ["Sumas sellos al cobrar", "Escaneas su tarjeta y tocas “+1 sello”, o le muestras un QR que sirve una sola vez.", "✅"],
  ["Vuelve por su premio", "Cuando completa la tarjeta canjea su premio, y tú ves en vivo quién vuelve y quién no.", "🎁"],
];

const FUNCIONES: [string, string, string][] = [
  ["⭐", "Sellos, puntos o cashback", "Tarjeta de sellos, de puntos por compra o de cashback, con catálogo de premios con fotos."],
  ["🎀", "Premios en el camino", "Un premio chico a mitad de tarjeta para que no la abandonen."],
  ["👑", "Niveles y retos", "Bronce, Plata, Oro según las visitas, y retos con insignias."],
  ["🤝", "Trae a un amigo", "Cada cliente comparte su enlace y los dos ganan."],
  ["📣", "Campañas por grupo", "VIP, frecuentes, dormidos o cerca del premio: un mensaje con un toque."],
  ["🎟️", "Cupones y promociones", "Doble puntos el fin de semana, cupones de cumpleaños y regalos."],
  ["🏪", "Varios locales", "Una tarjeta para toda tu cadena, con métricas y equipo por local."],
  ["🤖", "Conectado a tu IA", "API para tu caja y conexión con Claude o ChatGPT: “¿quién no viene hace un mes?”."],
  ["📲", "En el celular del cliente", "Tarjeta web y Google Wallet. Nada de cartoncitos que se pierden."],
  ["🔒", "Sin trampas", "QR de un solo uso, máximo de sellos por día y PIN del dueño para canjear."],
  ["🔥", "Días dobles", "Llena los días flojos: ese día cada visita vale el doble."],
  ["🎂", "Regalo de cumpleaños", "Sellos de regalo y un saludo automático el día de su cumpleaños."],
  ["👋", "“Te extrañamos”", "Si alguien deja de venir, le llega un aviso (con regalo si quieres)."],
  ["💬", "Más reseñas en Google", "Después de cada sello, la tarjeta invita a dejar reseña."],
  ["👥", "Usuarios ilimitados", "Dueño, encargados y equipo, cada uno con su cuenta y sus permisos."],
  ["📊", "Métricas en vivo", "Visitas, clientes que vuelven, costo de premios y exportar a Excel."],
];

const DISENOS: [IdRubro, string, DisenoSello, number][] = [
  ["cafe", "Café del Cerro", "billetera", 6],
  ["futbol", "Fútbol 7 El Arco", "isometrica", 6],
  ["bar", "Bar La Ola", "coleccion", 5],
  ["hotel", "Hostal Mirador", "premium", 3],
  ["picada", "La Picá de la Tía", "pizarra", 5],
  ["peluqueria", "Salón Bella", "neon", 4],
];

const PREGUNTAS: [string, string][] = [
  ["¿Mis clientes tienen que bajar una app?", "No. Escanean un QR con la cámara, ponen su nombre y teléfono, y listo. Pueden guardarla en Google Wallet o en la pantalla de inicio del iPhone."],
  ["¿Y si el cliente cambia de celular?", "Vuelve a escanear el QR y pone el mismo teléfono: recupera su tarjeta con todos sus sellos."],
  ["¿Sirve para mi rubro?", "Sirve para cualquier negocio donde los clientes vuelven, chico o grande: cafés, bares, restaurantes, picadas de barrio, canchas de pádel, fútbol y tenis, peluquerías, estilistas, barberías, hoteles, tiendas, gimnasios…"],
  ["¿Necesito un computador?", "No. Todo funciona desde el celular: tu panel, el escáner y el QR para sumar sellos."],
  ["¿Puedo pasar los sellos de mis tarjetas de papel?", "Sí. Creas la tarjeta del cliente desde el panel y le sumas los sellos que ya tenía."],
  ["¿Qué pasa si dejo de pagar?", "Tus clientes y sus sellos quedan guardados. Solo se pausa la suma de sellos nuevos hasta que vuelvas."],
];

function Aviso({ className, style, icono, titulo, texto }: { className: string; style?: React.CSSProperties; icono: string; titulo: string; texto: string }) {
  return (
    <div className={`vidrio-club flotar-club absolute z-20 flex items-center gap-3 rounded-2xl px-3.5 py-2.5 shadow-xl shadow-black/15 ${className}`} style={{ background: "var(--club-vidrio-fuerte)", ...style }}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg" style={{ background: "var(--club-brillo)" }}>
        {icono}
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold">{titulo}</span>
        <span className="block text-xs text-suave">{texto}</span>
      </span>
    </div>
  );
}

export default function Inicio() {
  const wa = enlaceWhatsapp(`Hola, quiero saber más de ${MARCA} para mi negocio.`);
  const rubros = (Object.keys(RUBROS) as IdRubro[]).filter((r) => r !== "otro");
  return (
    <SitioClub>
      {/* ── Portada ── */}
      <section className="fondo-club relative -mt-[4.25rem] overflow-hidden pb-24 pt-32 sm:pt-36">
        <span aria-hidden className="orbe-club flotar-lento-club left-[2%] top-44 h-14 w-14 opacity-80 max-sm:hidden" />
        <span aria-hidden className="orbe-club coral orbe-difuso flotar-lento-club bottom-24 right-[42%] h-10 w-10" style={retraso(2500)} />
        <span aria-hidden className="orbe-club coral flotar-lento-club right-[4%] top-36 h-24 w-24 max-lg:hidden" style={retraso(1200)} />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="vidrio-club entrada-club inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold">
              <span className="h-2 w-2 rounded-full bg-club-jade latido-club" />
              Sellos, puntos y cashback · {DIAS_PRUEBA} días gratis
            </p>
            <h1 className="entrada-club mt-6 text-balance text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-7xl" style={retraso(120)}>
              Clientes que vuelven, <span className="texto-jade font-acento pr-2 text-[1.08em] font-normal italic">sello a sello.</span>
            </h1>
            <p className="entrada-club mt-6 max-w-xl text-lg leading-relaxed text-suave" style={retraso(240)}>
              Cambia la tarjeta de cartón por una en el celular de tu cliente: sellos, puntos o cashback, premios, niveles y campañas. Para
              cafés, bares, canchas, peluquerías, hoteles y cualquier negocio, chico o grande.
            </p>
            <div className="entrada-club mt-8 flex flex-wrap gap-3" style={retraso(360)}>
              <Link href="/registro" className="boton-jade px-6 py-3.5 text-base">
                Crear mi tarjeta gratis <span className="flecha">→</span>
              </Link>
              <a href={wa} target="_blank" rel="noopener noreferrer" className="boton-capsula px-6 py-3.5 text-base">
                Hablar con nosotros
              </a>
            </div>
            <p className="entrada-club mt-4 text-sm text-suave" style={retraso(480)}>
              Sin tarjeta de crédito · Lista en 2 minutos · Cancelas cuando quieras
            </p>
          </div>

          <div className="entrada-club relative mx-auto h-[540px] w-full max-w-[440px]" style={retraso(300)}>
            <div aria-hidden className="halo-club absolute inset-x-6 inset-y-0 rounded-full" />
            <div className="tema-fijo absolute inset-0 pt-10">
              {MUESTRAS.map((m, i) => (
                <div
                  key={m.local}
                  className="absolute left-1/2 w-[340px] max-w-[86vw]"
                  style={{ top: `${40 + i * 125}px`, transform: `translateX(calc(-50% + ${(i - 1) * 28}px)) rotate(${(i - 1) * 4}deg)`, zIndex: i }}
                >
                  <Inclinable>
                    <TarjetaVisual local={m.local} programa={ejemplo(m.rubro, m.diseno)} sellos={m.sellos} nombre={m.nombre} />
                  </Inclinable>
                </div>
              ))}
            </div>
            <Aviso className="-left-2 top-6 sm:-left-10" icono="✅" titulo="+1 sello para Camila" texto="Pádel Club Viña · recién" />
            <Aviso className="-right-2 bottom-10 sm:-right-8" style={retraso(1500)} icono="🎁" titulo="¡Premio listo!" texto="Matías completó su tarjeta" />
          </div>
        </div>
        <svg aria-hidden viewBox="0 0 1440 80" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-14 w-full text-club-fondo-2 sm:h-20">
          <path d="M0 80V40C240 0 480 0 720 30s480 50 720 10v40Z" fill="currentColor" />
        </svg>
      </section>

      {/* ── Cifras ── */}
      <section className="bg-club-fondo-2 pb-16">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-5 lg:grid-cols-4">
          {CIFRAS.map(([n, unidad, texto], i) => (
            <div key={texto} data-revelar="" style={retraso(i * 90)} className="tarjeta-club p-6 text-center">
              <p className="font-titulo text-4xl font-extrabold tracking-tight sm:text-5xl">
                <span data-contar={n} className="texto-jade tabular-nums">
                  {n}
                </span>{" "}
                <span className="text-xl font-semibold text-suave sm:text-2xl">{unidad}</span>
              </p>
              <p className="mt-1 text-sm text-suave">{texto}</p>
            </div>
          ))}
        </div>

        {/* Cinta de rubros */}
        <div className="cinta-club mt-14 overflow-hidden" aria-label="Rubros">
          <div className="cinta-club-pista flex w-max gap-3">
            {[0, 1].map((copia) => (
              <div key={copia} className={`flex gap-3 ${copia ? "cinta-club-duplicado" : ""}`} aria-hidden={copia ? true : undefined}>
                {rubros.map((r) => (
                  <Link
                    key={r}
                    href={`/registro?rubro=${r}`}
                    tabIndex={copia ? -1 : undefined}
                    className="vidrio-club whitespace-nowrap rounded-full px-4 py-2 text-sm transition hover:border-club-jade/60 hover:text-club-jade-texto"
                  >
                    {emojiSello(RUBROS[r].icono)} {RUBROS[r].nombre}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cómo funciona ── */}
      <section id="como-funciona" className="scroll-mt-24 py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div data-revelar="" className="mx-auto max-w-2xl text-center">
            <Etiqueta centro>Cómo funciona</Etiqueta>
            <Titulo centro acento="así de simple.">
              Del cartón al celular,
            </Titulo>
          </div>
          <ol className="relative mt-16 grid gap-6 md:grid-cols-4">
            <span aria-hidden className="absolute left-[12%] right-[12%] top-6 hidden h-px md:block" style={{ background: "linear-gradient(90deg, transparent, var(--club-jade), var(--club-coral), transparent)" }} />
            {PASOS.map(([titulo, texto, icono], i) => (
              <li key={titulo} data-revelar="" style={retraso(i * 120)} className="relative text-center">
                <span className="nodo-club latido-club relative mx-auto grid h-12 w-12 place-items-center rounded-full font-titulo text-lg font-bold text-[#04201a]" style={{ background: "var(--jade-degradado)", ...retraso(i * 500) }}>
                  {i + 1}
                </span>
                <div className="tarjeta-club mt-6 p-6">
                  <p className="text-3xl" aria-hidden>
                    {icono}
                  </p>
                  <h3 className="mt-3 text-lg font-semibold">{titulo}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-suave">{texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Funciones ── */}
      <section id="funciones" className="scroll-mt-24 bg-club-fondo-2 py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid items-end gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div data-revelar="izquierda">
              <Etiqueta>Funciones</Etiqueta>
              <Titulo acento="vuelva otra vez.">Todo lo que hace que un cliente</Titulo>
            </div>
            <p data-revelar="derecha" className="text-lg leading-relaxed text-suave">
              Tarjeta, premios, campañas y métricas en un solo lugar. Lo prendes y apagas cuando quieras desde tu panel.
            </p>
          </div>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FUNCIONES.map(([icono, titulo, texto], i) => (
              <div key={titulo} data-revelar="" style={retraso((i % 4) * 80)} className="tarjeta-club p-6">
                <span className="icono-club h-12 w-12 text-2xl" aria-hidden>
                  {icono}
                </span>
                <h3 className="mt-5 font-semibold">{titulo}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-suave">{texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Diseños ── */}
      <section id="disenos" className="scroll-mt-24 py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div data-revelar="" className="mx-auto max-w-2xl text-center">
            <Etiqueta centro>Diseños</Etiqueta>
            <Titulo centro acento="o uno a tu medida.">
              Diseños premium,
            </Titulo>
            <p className="mt-4 text-suave">Decenas de diseños con tu logo y tu color, todos incluidos y con nuevos cada mes.</p>
          </div>
          <div className="tema-fijo mt-14 grid grid-cols-1 justify-items-center gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {DISENOS.map(([r, local, d, s], i) => (
              <div key={local} data-revelar="zoom" style={retraso((i % 3) * 110)} className="w-full max-w-[340px]">
                <Inclinable>
                  <TarjetaVisual local={local} programa={ejemplo(r, d)} sellos={Math.min(s, RUBROS[r].meta - 1)} nombre="Cliente" />
                </Inclinable>
              </div>
            ))}
          </div>
          <div data-revelar="" className="mt-12 text-center">
            <Link href="/disenos" className="boton-capsula">
              Ver todos los diseños <span className="flecha">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Diseño a medida (bloque de contraste) ── */}
      <section className="px-3 sm:px-5">
        <div
          data-revelar="zoom"
          className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] rounded-tr-[6rem] rounded-bl-[6rem] bg-club-contraste px-6 py-14 text-club-contraste-tinta sm:px-12 sm:py-16"
        >
          <div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgb(52_214_168/0.35),transparent)]" />
          <div aria-hidden className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgb(255_122_89/0.3),transparent)]" />
          <div className="relative grid items-center gap-10 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-club-coral">Incluido en todos los planes</p>
              <h2 className="mt-4 text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                Tu tarjeta, con <span className="font-acento text-[1.12em] font-normal italic text-club-coral">tu cara.</span>
              </h2>
              <p className="mt-4 max-w-xl leading-relaxed text-club-contraste-suave">
                Mándanos tu logo, una foto de tu local o tu arte, y te armamos un diseño a la medida de tu negocio. Sin costo extra, en
                cualquier plan.
              </p>
            </div>
            <ul className="grid gap-3">
              {EN_TODOS.map((x) => (
                <li key={x} className="flex items-start gap-3 rounded-2xl border border-club-contraste-tinta/10 bg-club-contraste-tinta/5 px-4 py-3 text-sm">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-[#04201a]" style={{ background: "var(--jade-degradado)" }}>
                    ✓
                  </span>
                  {x}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Precios ── */}
      <section id="precios" className="scroll-mt-24 py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div data-revelar="" className="mx-auto max-w-2xl text-center">
            <Etiqueta centro>Precios</Etiqueta>
            <Titulo centro acento="sin letra chica.">
              Precios simples,
            </Titulo>
            <p className="mt-4 text-suave">
              {DIAS_PRUEBA} días gratis para probar con tus clientes reales. Sin contrato: cancelas cuando quieras. Precios en pesos chilenos.
            </p>
          </div>
          <PreciosPlanes />
        </div>
      </section>

      {/* ── Preguntas ── */}
      <section id="preguntas" className="scroll-mt-24 bg-club-fondo-2 py-24">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 lg:grid-cols-[1fr_1.4fr]">
          <div data-revelar="izquierda">
            <Etiqueta>Preguntas</Etiqueta>
            <Titulo acento="frecuentes.">Preguntas</Titulo>
            <p className="mt-4 text-suave">¿Te queda alguna duda? Escríbenos y te respondemos el mismo día.</p>
            <a href="#contacto" className="boton-capsula mt-6">
              Hacer una pregunta <span className="flecha">→</span>
            </a>
          </div>
          <div className="space-y-3">
            {PREGUNTAS.map(([p, r], i) => (
              <details key={p} data-revelar="" style={retraso(i * 70)} className="pregunta-club vidrio-club group rounded-3xl px-6 py-5 transition hover:border-club-jade/40">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {p}
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-borde text-lg text-club-jade-texto transition duration-300 group-open:rotate-45 group-open:bg-club-jade group-open:text-[#04201a]">
                    +
                  </span>
                </summary>
                <p className="pt-3 leading-relaxed text-suave">{r}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contacto ── */}
      <section id="contacto" className="scroll-mt-24 py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-[1fr_1.3fr]">
          <div data-revelar="izquierda">
            <Etiqueta>Contacto</Etiqueta>
            <Titulo acento="te ayudamos.">Hablemos de tu negocio,</Titulo>
            <p className="mt-4 leading-relaxed text-suave">
              Te mostramos cómo se vería tu tarjeta, te ayudamos a elegir el premio y dejamos todo listo para que partas hoy.
            </p>
            <ul className="mt-8 space-y-4 text-sm">
              {[
                ["⚡", "Respuesta rápida", "Normalmente en minutos, todos los días."],
                ["🎨", "Diseño incluido", "Te armamos la tarjeta con tu logo."],
                ["🇨🇱", "Hecho en Chile", "Precios en pesos y boleta o factura."],
              ].map(([icono, t, d]) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="icono-club h-11 w-11 text-xl" aria-hidden>
                    {icono}
                  </span>
                  <span>
                    <span className="block font-semibold">{t}</span>
                    <span className="block text-suave">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div data-revelar="derecha">
            <FormContacto />
          </div>
        </div>
      </section>

      {/* ── Cierre ── */}
      <section className="px-3 pb-10 sm:px-5">
        <div data-revelar="zoom" className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-[#04140f] px-6 py-16 text-center text-[#eaf6f1] sm:py-20">
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_50%_70%_at_20%_0%,rgb(52_214_168/0.35),transparent),radial-gradient(ellipse_45%_60%_at_90%_100%,rgb(255_122_89/0.28),transparent)]" />
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.07)_1px,transparent_1px)] bg-[size:22px_22px]" />
          <div className="relative">
            <h2 className="mx-auto max-w-3xl text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Tu primer cliente con tarjeta, <span className="font-acento text-[1.1em] font-normal italic text-[#7ff0cb]">hoy.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[#a9c3bb]">Créala gratis, imprime el QR y déjalo en tu mesón. En {DIAS_PRUEBA} días ves la diferencia.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/registro" className="boton-jade px-7 py-3.5 text-base">
                Crear mi tarjeta gratis <span className="flecha">→</span>
              </Link>
              <a href={wa} target="_blank" rel="noopener noreferrer" className="boton-jade boton-coral px-7 py-3.5 text-base">
                Hablar por WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>
    </SitioClub>
  );
}
