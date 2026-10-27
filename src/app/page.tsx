import Image from "next/image";
import Link from "next/link";
import { Icono } from "@/components/Icono";
import { Logo } from "@/components/Logo";
import { PreciosPlanes } from "@/components/inicio/Precios";
import {
  ARMADO,
  DEMOS,
  DIAS_PRUEBA,
  MODULOS,
  PASOS,
  PREGUNTAS,
  RECORRIDO,
  SERVICIOS,
  TESTIMONIOS,
} from "@/components/inicio/datos";

const CARTA_EJEMPLO = "/aroma-cafe";

const clp = (n: number) => "$" + n.toLocaleString("es-CL");

const NAV: [string, string][] = [
  ["#modulos", "Módulos"],
  ["#demo", "Demo"],
  ["#precios", "Precios"],
  ["#preguntas", "Preguntas"],
];

// Sitio de venta: lo que ve un dueño de restaurante al entrar a la raíz.
export default function Inicio() {
  return (
    <div className="bg-fondo text-tinta">
      <Cabecera />
      <Portada />
      <Cifras />
      <Pasos />
      <Recorrido />
      <Modulos />
      <Demo />
      <Precios />
      <Servicios />
      <Testimonios />
      <Preguntas />
      <Cierre />
      <Pie />
    </div>
  );
}

function Contenedor({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-4 sm:px-6 ${className}`}>{children}</div>;
}

function Titulo({ etiqueta, titulo, texto }: { etiqueta: string; titulo: string; texto?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-wider text-marca">{etiqueta}</p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl">{titulo}</h2>
      {texto && <p className="mt-3 text-lg text-suave">{texto}</p>}
    </div>
  );
}

function Cabecera() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0f1626]/90 text-slate-50 backdrop-blur">
      <Contenedor className="flex h-16 items-center gap-6">
        <Link href="/" aria-label="Mesitto, inicio">
          <Logo oscuro className="text-2xl" />
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-slate-200/80 md:flex">
          {NAV.map(([href, texto]) => (
            <a key={href} href={href} className="hover:text-white">
              {texto}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-200/90 hover:text-white">
            Entrar
          </Link>
          <Link href="/registro" className="boton-acento">
            Crear cuenta
          </Link>
        </div>
      </Contenedor>
    </header>
  );
}

function Portada() {
  return (
    <section className="relative overflow-hidden bg-[#0f1626] text-slate-50">
      {/* Luz cálida y trama de puntos, como un salón de noche (la misma de las pantallas de acceso) */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 15% 0%, rgb(242 163 58 / 0.18), transparent 55%), radial-gradient(ellipse at 95% 100%, rgb(42 56 88 / 0.7), transparent 55%), radial-gradient(rgb(255 255 255 / 0.07) 1px, transparent 1px) 0 0/22px 22px",
        }}
      />
      <Contenedor className="relative grid items-center gap-12 py-16 lg:grid-cols-[1.15fr_1fr] lg:py-24">
        <div>
          <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-sm text-slate-300 ring-1 ring-white/15">
            Carta QR + gestión del salón, en un solo sistema
          </p>
          <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Tu restaurante, <span className="text-marca-claro">en un solo lugar.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-slate-200/80">
            Tus clientes escanean el QR, ven la carta en su idioma y piden desde la mesa. Tú ves el salón, la cocina y la caja
            en vivo, desde el celular. Sin reimprimir cartas ni pagar comisiones por pedido.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/registro" className="boton-acento px-5 py-3 text-base">
              Probar gratis {DIAS_PRUEBA} días
            </Link>
            <Link
              href={CARTA_EJEMPLO}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-5 py-3 text-base font-medium text-slate-50 hover:bg-white/10"
            >
              Ver carta de ejemplo <Icono nombre="externo" className="h-4 w-4" />
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-200/60">Sin tarjeta de crédito. Sin permanencia.</p>
        </div>

        <div className="relative mx-auto w-full max-w-[260px] sm:max-w-[320px]">
          <Telefono />
          {/* Avisos como los que llegan al panel */}
          <div aria-hidden className="pointer-events-none absolute inset-0 hidden text-sm font-semibold sm:block">
            <span className="absolute -left-24 top-16 rounded-full bg-violet-600 px-3 py-1.5 shadow-lg shadow-violet-900/40">
              $ Mesa 6 pide la cuenta
            </span>
            <span className="absolute -right-16 top-1/2 rounded-full bg-emerald-600 px-3 py-1.5 shadow-lg shadow-emerald-900/40">
              ✓ Mesa 2: pedido listo
            </span>
            <span className="absolute -left-20 bottom-20 rounded-full bg-sky-600 px-3 py-1.5 shadow-lg shadow-sky-900/40">
              ! Mesa 9 llama al mesero
            </span>
          </div>
        </div>
      </Contenedor>
    </section>
  );
}

// Teléfono con la carta de ejemplo real adentro: se puede recorrer sin salir de la página.
function Telefono() {
  return (
    <div className="relative rounded-[2.6rem] bg-stone-900 p-2.5 shadow-2xl shadow-black/60 ring-1 ring-white/15">
      <div className="absolute left-1/2 top-3.5 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-stone-900" />
      <div className="relative aspect-[9/19] overflow-hidden rounded-[2.1rem] bg-stone-800">
        <iframe
          src={CARTA_EJEMPLO}
          title="Carta de ejemplo de Aroma Café"
          loading="lazy"
          className="absolute left-0 top-0 h-[125%] w-[125%] origin-top-left scale-[0.8] border-0"
        />
      </div>
    </div>
  );
}

function Cifras() {
  const cifras: [string, string][] = [
    ["21", "diseños de carta"],
    ["6", "idiomas"],
    ["0 %", "comisión por pedido"],
    [`${DIAS_PRUEBA} días`, "de prueba gratis"],
  ];
  return (
    <section className="border-b border-borde bg-superficie">
      <Contenedor className="grid grid-cols-2 gap-6 py-8 sm:grid-cols-4">
        {cifras.map(([n, texto]) => (
          <div key={texto} className="text-center">
            <p className="text-3xl font-bold tracking-tight text-marca tabular-nums">{n}</p>
            <p className="text-sm text-suave">{texto}</p>
          </div>
        ))}
      </Contenedor>
    </section>
  );
}

function Pasos() {
  return (
    <section className="py-20">
      <Contenedor className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <Titulo etiqueta="Cómo funciona" titulo="Del QR a la mesa en un día" />
          <ol className="mt-10 space-y-7">
            {PASOS.map(([titulo, texto], i) => (
              <li key={titulo} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-marca-claro text-lg font-bold text-marca-tinta">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-lg font-semibold">{titulo}</h3>
                  <p className="mt-1 text-suave">{texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        {/* Fotos de QR en mesas reales y el gesto de escanear */}
        <div className="relative grid grid-cols-2 gap-4">
          <Image
            src="/inicio/cartel-qr-mesa.webp"
            alt="Cartel con código QR sobre la mesa de un restaurante"
            width={900}
            height={900}
            className="aspect-[4/5] h-full w-full rounded-3xl object-cover shadow-xl"
          />
          <div className="grid gap-4">
            <Image
              src="/inicio/servilletero-qr.webp"
              alt="Servilletero de madera con placa QR y número de mesa"
              width={765}
              height={1020}
              className="aspect-[4/3] h-full w-full rounded-3xl object-cover object-[50%_45%] shadow-xl"
            />
            <div className="flex items-center justify-center rounded-3xl bg-marca-tinta p-6">
              <Image src="/inicio/escanear-qr.webp" alt="Celular escaneando un código QR" width={1280} height={1103} className="h-auto w-full max-w-56" />
            </div>
          </div>
        </div>
      </Contenedor>
    </section>
  );
}

// Recorrido por el sistema con capturas reales, alternando imagen y texto.
function Recorrido() {
  return (
    <section className="border-t border-borde bg-[#0f1626] py-20 text-slate-50">
      <Contenedor>
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-marca-claro">El sistema por dentro</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl">Así se ve un servicio con Mesitto</h2>
          <p className="mt-3 text-lg text-slate-300">Capturas reales del sistema, desde que el cliente pide hasta que paga.</p>
        </div>
        <div className="mt-16 space-y-24">
          {RECORRIDO.map((r, i) => {
            const vertical = r.alto > r.ancho;
            return (
              <div key={r.titulo} className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
                <div className={`min-w-0 ${i % 2 ? "lg:order-2" : ""}`}>
                  <p className="text-sm font-semibold uppercase tracking-wider text-marca-claro">{r.etiqueta}</p>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-balance sm:text-3xl">{r.titulo}</h3>
                  <p className="mt-3 text-lg text-slate-300">{r.texto}</p>
                  <ul className="mt-6 space-y-2.5">
                    {r.puntos.map((pt) => (
                      <li key={pt} className="flex gap-2.5">
                        <Icono nombre="check" className="mt-1 h-4 w-4 shrink-0 text-marca-claro" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={`relative flex min-w-0 justify-center ${i % 2 ? "lg:order-1" : ""}`}>
                  <Image
                    src={r.imagen}
                    alt={r.alt}
                    width={r.ancho}
                    height={r.alto}
                    className={`h-auto rounded-2xl shadow-2xl shadow-black/50 ring-1 ring-white/10 ${vertical ? "w-full max-w-72" : "w-full"}`}
                  />
                  {r.movil && (
                    <Image
                      src={r.movil}
                      alt="Aviso al cliente: tu pedido está listo"
                      width={390}
                      height={844}
                      className="absolute -right-2 bottom-8 hidden h-auto w-44 rounded-2xl shadow-2xl shadow-black/60 ring-1 ring-white/10 sm:block lg:right-4"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Contenedor>
    </section>
  );
}

function Modulos() {
  return (
    <section id="modulos" className="scroll-mt-16 border-y border-borde bg-superficie py-20">
      <Contenedor>
        <Titulo
          etiqueta="Módulos"
          titulo="Todo lo que pasa entre la mesa, la cocina y la caja"
          texto="Activa solo lo que tu local necesita. El sistema se adapta a tu forma de trabajar, no al revés."
        />
        <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {MODULOS.map((m) => (
            <div key={m.titulo} className="flex gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-marca ring-1 ring-slate-300">
                <Icono nombre={m.icono} />
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold">{m.titulo}</h3>
                <p className="mt-1 text-sm text-suave">{m.texto}</p>
              </div>
            </div>
          ))}
        </div>
      </Contenedor>
    </section>
  );
}

function Demo() {
  return (
    <section id="demo" className="scroll-mt-16 py-20">
      <Contenedor>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Titulo
            etiqueta="Demo"
            titulo="Mira cartas reales funcionando"
            texto="Ábrelas en tu celular como lo haría un cliente. Cada una usa uno de los 21 diseños."
          />
          <Link href={CARTA_EJEMPLO} target="_blank" className="boton">
            Abrir Aroma Café <Icono nombre="externo" className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
          {DEMOS.map((d) => (
            <Link
              key={d.slug}
              href={`/${d.slug}`}
              target="_blank"
              className="group overflow-hidden rounded-2xl border border-borde bg-superficie transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex aspect-[4/3] items-end p-4 text-white" style={{ background: d.color }}>
                <span className="text-lg font-bold leading-tight">{d.nombre}</span>
              </div>
              <div className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="text-suave">{d.tipo}</span>
                <span className="font-medium text-marca group-hover:underline">Ver</span>
              </div>
            </Link>
          ))}
        </div>
      </Contenedor>
    </section>
  );
}

function Precios() {
  return (
    <section id="precios" className="scroll-mt-16 border-y border-borde bg-[#eef1f6] py-20">
      <Contenedor>
        <Titulo
          etiqueta="Precios"
          titulo="Un precio fijo, sin comisiones por pedido"
          texto={`Precios en pesos chilenos, IVA incluido. Prueba gratis ${DIAS_PRUEBA} días con todo incluido.`}
        />
        <PreciosPlanes />
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-stone-300 bg-superficie/60 px-6 py-4">
          <p>
            <span className="font-semibold">¿No tienes tiempo de cargar la carta?</span>{" "}
            <span className="text-suave">{ARMADO.texto}</span>
          </p>
          <p className="font-semibold tabular-nums">{clp(ARMADO.precio)} pago único</p>
        </div>
      </Contenedor>
    </section>
  );
}

function Servicios() {
  return (
    <section className="py-20">
      <Contenedor className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
        <Titulo
          etiqueta="Servicios"
          titulo="No te dejamos solo con el sistema"
          texto="Mesitto lo hace Brote Digital. Te acompañamos desde la primera carta hasta que tu equipo lo usa sin pensar."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {SERVICIOS.map(([titulo, texto]) => (
            <div key={titulo} className="rounded-2xl border border-borde bg-superficie p-5">
              <h3 className="font-semibold">{titulo}</h3>
              <p className="mt-1 text-sm text-suave">{texto}</p>
            </div>
          ))}
        </div>
      </Contenedor>
    </section>
  );
}

function Testimonios() {
  if (TESTIMONIOS.length === 0) return null;
  const sonEjemplo = TESTIMONIOS.some((t) => t.ejemplo);
  return (
    <section className="border-y border-borde bg-[#0f1626] py-20 text-slate-50">
      <Contenedor>
        <p className="text-sm font-semibold uppercase tracking-wider text-marca-claro">Testimonios</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          Lo que cambia en el día a día
        </h2>
        {sonEjemplo && (
          <p className="mt-3 text-sm text-slate-200/60">Textos de ejemplo mientras reunimos los de nuestros primeros clientes.</p>
        )}
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {TESTIMONIOS.map((t) => (
            <figure key={t.texto} className="flex flex-col rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
              <blockquote className="flex-1 text-lg leading-relaxed">“{t.texto}”</blockquote>
              <figcaption className="mt-5 text-sm">
                <span className="block font-semibold">{t.nombre}</span>
                <span className="text-slate-200/60">{t.local}</span>
                {t.ejemplo && (
                  <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-xs text-slate-200/70">Ejemplo</span>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      </Contenedor>
    </section>
  );
}

function Preguntas() {
  return (
    <section id="preguntas" className="scroll-mt-16 py-20">
      <Contenedor className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
        <Titulo etiqueta="Preguntas" titulo="Lo que nos preguntan antes de partir" />
        <div className="divide-y divide-borde rounded-2xl border border-borde bg-superficie">
          {PREGUNTAS.map(([pregunta, respuesta]) => (
            <details key={pregunta} className="group px-6 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {pregunta}
                <span className="text-xl text-marca transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-suave">{respuesta}</p>
            </details>
          ))}
        </div>
      </Contenedor>
    </section>
  );
}

function Cierre() {
  return (
    <section className="pb-20">
      <Contenedor>
        <div className="rounded-3xl bg-marca px-6 py-12 text-center text-white sm:px-12">
          <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">Prueba Mesitto en tu local</h2>
          <p className="mx-auto mt-3 max-w-xl text-lg text-white/85">
            Crea tu cuenta, carga tu carta y pega el primer QR hoy. Los primeros {DIAS_PRUEBA} días van por nuestra cuenta.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/registro" className="rounded-lg bg-white px-5 py-3 font-semibold text-marca-oscuro hover:bg-slate-50">
              Crear cuenta gratis
            </Link>
            <Link href="/login" className="rounded-lg border border-white/40 px-5 py-3 font-medium hover:bg-white/10">
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      </Contenedor>
    </section>
  );
}

function Pie() {
  return (
    <footer className="border-t border-borde">
      <Contenedor className="flex flex-wrap items-center justify-between gap-4 py-8 text-sm text-suave">
        <span className="flex items-center gap-3">
          <Logo className="text-xl" />
          <span>por Brote Digital</span>
        </span>
        <nav className="flex flex-wrap gap-5">
          {NAV.map(([href, texto]) => (
            <a key={href} href={href} className="hover:text-tinta">
              {texto}
            </a>
          ))}
          <Link href="/login" className="hover:text-tinta">
            Entrar
          </Link>
        </nav>
      </Contenedor>
    </footer>
  );
}
