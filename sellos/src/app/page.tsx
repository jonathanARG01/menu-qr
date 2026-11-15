import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Inclinable } from "@/components/Inclinable";
import { TarjetaVisual } from "@/components/TarjetaVisual";
import { DESCUENTOS, DIAS_PRUEBA, EMPRESA, EN_TODOS, MARCA, PLANES, enlaceWhatsapp, type Plan } from "@/lib/marca";
import { RUBROS, type IdRubro } from "@/lib/rubros";
import { PROGRAMA_BASE, emojiSello, type DisenoSello, type ProgramaSellos } from "@/lib/tipos";
import { formatoPrecio } from "@/lib/utils";

// Página de venta.

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

const PASOS: [string, string, string][] = [
  ["1", "Arma tu tarjeta en 2 minutos", "Sellos, puntos o cashback, el premio y tu diseño. Sube tu logo o pídenos uno a tu medida."],
  ["2", "Tu cliente escanea y se une", "Pone su nombre y teléfono. La tarjeta queda en su celular, sin bajar ninguna app."],
  ["3", "Sumas sellos al cobrar", "Escaneas su tarjeta y tocas “+1 sello”, o le muestras un QR que sirve una sola vez."],
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
  ["⭐", "Más reseñas en Google", "Después de cada sello, la tarjeta invita a dejar reseña."],
  ["👥", "Usuarios ilimitados", "Dueño, encargados y equipo, cada uno con su cuenta y sus permisos."],
  ["📊", "Métricas en vivo", "Visitas, clientes que vuelven, costo de premios y exportar a Excel."],
];

const PREGUNTAS: [string, string][] = [
  ["¿Mis clientes tienen que bajar una app?", "No. Escanean un QR con la cámara, ponen su nombre y teléfono, y listo. Pueden guardarla en Google Wallet o en la pantalla de inicio del iPhone."],
  ["¿Y si el cliente cambia de celular?", "Vuelve a escanear el QR y pone el mismo teléfono: recupera su tarjeta con todos sus sellos."],
  ["¿Sirve para mi rubro?", "Sirve para cualquier negocio donde los clientes vuelven, chico o grande: cafés, bares, restaurantes, picadas de barrio, canchas de pádel, fútbol y tenis, peluquerías, estilistas, barberías, hoteles, tiendas, gimnasios…"],
  ["¿Necesito un computador?", "No. Todo funciona desde el celular: tu panel, el escáner y el QR para sumar sellos."],
  ["¿Puedo pasar los sellos de mis tarjetas de papel?", "Sí. Creas la tarjeta del cliente desde el panel y le sumas los sellos que ya tenía."],
  ["¿Qué pasa si dejo de pagar?", "Tus clientes y sus sellos quedan guardados. Solo se pausa la suma de sellos nuevos hasta que vuelvas."],
];

export default function Inicio() {
  const wa = enlaceWhatsapp(`Hola, quiero saber más de ${MARCA} para mi negocio.`);
  return (
    <div className="bg-fondo">
      <header className="sticky top-0 z-30 border-b border-borde/70 bg-fondo/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link href="/" aria-label="Inicio">
            <Logo className="text-2xl" />
          </Link>
          <nav className="ml-auto flex items-center gap-1 text-sm sm:gap-3">
            <a href="#precios" className="hidden px-2 py-1 text-suave hover:text-tinta sm:block">
              Precios
            </a>
            <Link href="/entrar" className="px-2 py-1 text-suave hover:text-tinta">
              Entrar
            </Link>
            <Link href="/registro" className="boton py-2">
              Prueba gratis
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 85% 20%, rgb(255 207 92 / 0.35), transparent 50%), radial-gradient(ellipse at 10% 90%, rgb(196 61 34 / 0.12), transparent 50%)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:py-20 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-marca ring-1 ring-marca/20">
              Sellos, puntos y cashback · {DIAS_PRUEBA} días gratis
            </p>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              Clientes que vuelven, <span className="text-marca">sello a sello.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-suave">
              Cambia la tarjeta de cartón por una en el celular de tu cliente: sellos, puntos o cashback, premios, niveles y
              campañas. Para cafés, bares, canchas, peluquerías, hoteles y cualquier negocio, chico o grande.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/registro" className="boton px-6 py-3 text-base">
                Crear mi tarjeta gratis
              </Link>
              <a href={wa} target="_blank" rel="noopener noreferrer" className="boton-secundario px-6 py-3 text-base">
                Hablar con nosotros
              </a>
            </div>
            <p className="mt-3 text-sm text-suave">Sin tarjeta de crédito. Lista en 2 minutos.</p>
          </div>
          <div className="relative mx-auto h-[520px] w-full max-w-[420px]">
            {MUESTRAS.map((m, i) => (
              <div
                key={m.local}
                className="absolute left-1/2 w-[340px] max-w-[92vw]"
                style={{
                  top: `${i * 125}px`,
                  transform: `translateX(calc(-50% + ${(i - 1) * 28}px)) rotate(${(i - 1) * 4}deg)`,
                  zIndex: i,
                }}
              >
                <Inclinable>
                  <TarjetaVisual
                    local={m.local}
                    programa={ejemplo(m.rubro, m.diseno)}
                    sellos={m.sellos}
                    nombre={m.nombre}
                  />
                </Inclinable>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-borde bg-white py-8">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-center text-sm font-medium text-suave">Para cualquier negocio donde los clientes vuelven</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {(Object.keys(RUBROS) as IdRubro[])
              .filter((r) => r !== "otro")
              .map((r) => (
                <Link
                  key={r}
                  href={`/registro?rubro=${r}`}
                  className="rounded-full border border-borde bg-fondo px-3 py-1.5 text-sm hover:border-marca/50"
                >
                  {emojiSello(RUBROS[r].icono)} {RUBROS[r].nombre}
                </Link>
              ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold tracking-tight">Así de simple</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PASOS.map(([n, titulo, texto]) => (
            <div key={n} className="tarjeta p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-marca text-lg font-bold text-white">{n}</span>
              <h3 className="mt-4 text-lg font-semibold">{titulo}</h3>
              <p className="mt-1 text-suave">{texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#2a1712] py-16 text-orange-50">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight">Todo lo que hace volver a un cliente</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FUNCIONES.map(([icono, titulo, texto]) => (
              <div key={titulo} className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                <p className="text-2xl" aria-hidden>
                  {icono}
                </p>
                <h3 className="mt-2 font-semibold">{titulo}</h3>
                <p className="mt-1 text-sm text-orange-100/70">{texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold tracking-tight">Diseños premium, o uno a tu medida</h2>
        <p className="mt-2 text-center text-suave">
          Decenas de diseños con tu logo y tu color, todos incluidos.{" "}
          <Link href="/disenos" className="font-semibold text-marca hover:underline">
            Ver todos
          </Link>
        </p>
        <div className="mt-10 grid grid-cols-1 justify-items-center gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ["cafe", "Café del Cerro", "billetera", 6],
              ["futbol", "Fútbol 7 El Arco", "isometrica", 6],
              ["bar", "Bar La Ola", "coleccion", 5],
              ["hotel", "Hostal Mirador", "premium", 3],
              ["picada", "La Picá de la Tía", "pizarra", 5],
              ["peluqueria", "Salón Bella", "neon", 4],
            ] as [IdRubro, string, DisenoSello, number][]
          ).map(([r, local, d, s]) => (
            <div key={local} className="w-full max-w-[340px]">
              <TarjetaVisual local={local} programa={ejemplo(r, d)} sellos={Math.min(s, RUBROS[r].meta - 1)} nombre="Cliente" />
            </div>
          ))}
        </div>
      </section>

      <section id="precios" className="border-t border-borde bg-white py-16">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight">Precios simples</h2>
          <p className="mt-2 text-center text-suave">
            {DIAS_PRUEBA} días gratis para probar con tus clientes reales. Sin contrato: cancelas cuando quieras.
          </p>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {(Object.keys(PLANES) as Plan[]).map((id) => {
              const p = PLANES[id];
              return (
                <div key={id} className={`tarjeta flex flex-col p-6 ${id === "pro" ? "ring-2 ring-marca" : ""}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{p.nombre}</p>
                    {id === "pro" && <span className="rounded-full bg-marca/10 px-2 py-0.5 text-xs font-semibold text-marca">El más elegido</span>}
                  </div>
                  <p className="mt-2 text-4xl font-extrabold">
                    {formatoPrecio(p.precio, "CLP")}
                    <span className="text-base font-normal text-suave"> + IVA / mes</span>
                  </p>
                  <p className="mt-1 text-sm text-suave">{p.detalle}</p>
                  <ul className="mt-4 flex-1 space-y-1.5 text-sm">
                    {p.incluye.map((x) => (
                      <li key={x}>✓ {x}</li>
                    ))}
                  </ul>
                  <Link href="/registro" className={`${id === "pro" ? "boton" : "boton-secundario"} mt-6 py-3`}>
                    Empezar gratis
                  </Link>
                </div>
              );
            })}
          </div>
          <div className="mt-6 rounded-2xl bg-fondo p-6">
            <p className="font-semibold">En todos los planes</p>
            <ul className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
              {EN_TODOS.map((x) => (
                <li key={x}>✓ {x}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-suave">
              Pagando por adelantado: {DESCUENTOS.map((d) => `${d.meses} meses −${d.descuento} %`).join(" · ")}.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold tracking-tight">Preguntas frecuentes</h2>
        <div className="mt-8 space-y-3">
          {PREGUNTAS.map(([p, r]) => (
            <details key={p} className="tarjeta group p-5">
              <summary className="cursor-pointer list-none font-semibold">
                {p} <span className="float-right text-suave group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-suave">{r}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="px-4 pb-16">
        <div className="mx-auto max-w-4xl rounded-3xl bg-marca px-6 py-12 text-center text-white">
          <h2 className="text-3xl font-bold tracking-tight">Tu primer cliente con tarjeta, hoy.</h2>
          <p className="mt-2 text-white/85">Créala gratis, imprime el QR y déjalo en tu mesón.</p>
          <Link href="/registro" className="mt-6 inline-flex rounded-lg bg-acento px-6 py-3 font-semibold text-tinta">
            Crear mi tarjeta gratis
          </Link>
        </div>
      </section>

      <footer className="border-t border-borde py-8 text-sm text-suave">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4">
          <Logo className="text-lg" />
          <span>
            © {new Date().getFullYear()} {EMPRESA}
          </span>
          <span className="ml-auto flex gap-4">
            <Link href="/terminos" className="hover:text-tinta">
              Términos
            </Link>
            <Link href="/privacidad" className="hover:text-tinta">
              Privacidad
            </Link>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="hover:text-tinta">
              Contacto
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
