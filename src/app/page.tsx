import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import { Icono } from "@/components/Icono";
import { Logo } from "@/components/Logo";
import { AnimacionesSitio, BotonInstalar, BotonTema, MenuMovil } from "@/components/inicio/Interactivo";
import { PreciosPlanes } from "@/components/inicio/Precios";
import { SCRIPT_TEMA_SITIO } from "@/components/inicio/tema";
import { FormContacto } from "@/components/inicio/Contacto";
import { VitrinaLoyalty } from "@/components/inicio/Loyalty";
import { NOMBRE_SELLOS, PRECIO_SELLOS } from "@/lib/sellos/tipos";
import { createPublicClient } from "@/lib/supabase/server";
import { leerAjustesSitio, REDES_SITIO, type AjustesSitio } from "@/lib/sitio";
import { enlaceRed, INFO_RED } from "@/lib/redes";
import {
  ARMADOS,
  DEMOS,
  DIAS_PRUEBA,
  MODULOS,
  PASOS,
  PREGUNTAS,
  RECORRIDO,
  SERVICIOS,
  TESTIMONIOS,
} from "@/components/inicio/datos";

// Instalable como app (escritorio y celular) desde el sitio de venta.
export const metadata: Metadata = {
  manifest: "/sitio.webmanifest",
  appleWebApp: { capable: true, title: "Platovi", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#0b0e14" };

// Contacto y redes vienen de /admin/sitio: al guardar se refresca al tiro; si no, cada 5 minutos.
export const revalidate = 300;

async function ajustesSitio(): Promise<AjustesSitio> {
  try {
    const { data } = await createPublicClient().from("sitio_ajustes").select("contacto, redes").eq("id", 1).maybeSingle();
    return leerAjustesSitio(data);
  } catch {
    // Sin el SQL 0028 (o sin conexión al compilar): los datos de siempre.
    return leerAjustesSitio(null);
  }
}

const CARTA_EJEMPLO = "/aroma-cafe";

const clp = (n: number) => "$" + n.toLocaleString("es-CL");

const NAV: [string, string][] = [
  ["#como-funciona", "Cómo funciona"],
  ["#modulos", "Módulos"],
  ["#loyalty", "Loyalty"],
  ["#demo", "Demo"],
  ["#precios", "Precios"],
  ["#preguntas", "Preguntas"],
  ["#contacto", "Contacto"],
];

// Retraso de una animación (aparición escalonada).
const retraso = (ms: number) => ({ "--retraso": `${ms}ms` }) as React.CSSProperties;

// Sitio de venta: lo que ve un dueño de restaurante al entrar a la raíz.
export default async function Inicio() {
  const sitio = await ajustesSitio();
  return (
    <div className="sitio min-h-screen overflow-x-clip">
      {/* Tema guardado + animaciones, antes de pintar para que no parpadee */}
      <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA_SITIO }} />
      <AnimacionesSitio />
      <div aria-hidden className="barra-avance fixed inset-x-0 top-0 z-50 h-0.5" style={{ background: "var(--oro-degradado)" }} />
      <Cabecera />
      <main>
        <Portada />
        <Cifras />
        <Pasos />
        <div className="mx-2 rounded-[2.5rem] bg-sitio-fondo-2 sm:mx-4 lg:rounded-[4.5rem]">
          <Recorrido />
          <Modulos />
        </div>
        <Loyalty />
        <Demo />
        <Precios />
        <Servicios />
        <Testimonios />
        <Preguntas />
        <Contacto sitio={sitio} />
        <Cierre />
      </main>
      <Pie sitio={sitio} />
    </div>
  );
}

function Contenedor({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-4 sm:px-6 ${className}`}>{children}</div>;
}

function Flecha({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`flecha ${className}`} aria-hidden>
      <path d="M4 10h12M11 5l5 5-5 5" />
    </svg>
  );
}

// Etiqueta de sección: una línea dorada corta y el texto en versalitas.
function Etiqueta({ children, contraste }: { children: React.ReactNode; contraste?: boolean }) {
  return (
    <p className={`flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] ${contraste ? "text-sitio-contraste-suave" : "text-sitio-oro-texto"}`}>
      <span className="h-px w-8" style={{ background: "var(--oro-degradado)" }} />
      {children}
    </p>
  );
}

function Titulo({
  etiqueta,
  titulo,
  acento,
  texto,
  centrado,
  contraste,
}: {
  etiqueta: string;
  titulo: string;
  acento?: string;
  texto?: string;
  centrado?: boolean;
  contraste?: boolean;
}) {
  return (
    <div data-revelar="" className={`max-w-2xl ${centrado ? "mx-auto text-center [&>p:first-child]:justify-center" : ""}`}>
      <Etiqueta contraste={contraste}>{etiqueta}</Etiqueta>
      <h2
        className={`mt-4 font-marca text-3xl font-bold leading-[1.08] tracking-tight text-balance sm:text-[2.75rem] ${contraste ? "text-sitio-contraste-tinta" : ""}`}
      >
        {titulo}
        {acento && (
          <>
            {" "}
            <span className="font-elegante text-[1.15em] font-semibold italic texto-oro">{acento}</span>
          </>
        )}
      </h2>
      {texto && <p className={`mt-4 text-lg ${contraste ? "text-sitio-contraste-suave" : "text-sitio-suave"}`}>{texto}</p>}
    </div>
  );
}

function Cabecera() {
  return (
    <header className="sticky top-0 z-30 px-3 pt-3 sm:px-4">
      <div className="cabecera-sitio vidrio mx-auto flex h-14 max-w-6xl items-center gap-3 rounded-full pl-4 pr-2 sm:gap-5 sm:pl-5">
        <Link href="/" aria-label="Platovi, inicio" className="shrink-0">
          <Logo oscuro nombreClase="text-sitio-tinta" className="text-xl" />
        </Link>
        <nav className="hidden items-center gap-0.5 whitespace-nowrap text-sm xl:flex">
          {NAV.map(([href, texto]) => (
            <a
              key={href}
              href={href}
              className="rounded-full px-3 py-1.5 text-sitio-suave transition hover:bg-sitio-vidrio hover:text-sitio-tinta"
            >
              {texto}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <div className="hidden sm:block">
            <BotonInstalar />
          </div>
          <BotonTema />
          <Link
            href="/login"
            className="hidden rounded-full px-3 py-2 text-sm font-medium text-sitio-suave transition hover:text-sitio-tinta md:inline-flex"
          >
            Entrar
          </Link>
          <Link href="/registro" className="boton-oro hidden whitespace-nowrap py-2 min-[400px]:inline-flex">
            Crear cuenta
          </Link>
          <MenuMovil enlaces={NAV} />
        </div>
      </div>
    </header>
  );
}

// Aviso flotante como los que llegan al panel.
function Aviso({ color, texto, className, ms }: { color: string; texto: string; className: string; ms: number }) {
  return (
    <span className={`absolute ${className}`}>
      <span
        className="vidrio flotar flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold text-sitio-tinta shadow-xl shadow-black/30"
        style={{ ...retraso(ms), background: "var(--sitio-vidrio-fuerte)" }}
      >
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 12px ${color}` }} />
        {texto}
      </span>
    </span>
  );
}

function Portada() {
  return (
    <section className="relative -mt-[4.25rem] overflow-hidden pt-[4.25rem]">
      <div aria-hidden className="fondo-portada absolute inset-0" />
      {/* Esferas doradas */}
      <div aria-hidden className="absolute inset-0">
        <span className="orbe flotar-lento left-[4%] top-[24%] hidden h-9 w-9 sm:block" style={retraso(0)} />
        <span className="orbe orbe-difuso flotar-lento right-[3%] top-[12%] hidden h-28 w-28 lg:block" style={retraso(-4000)} />
        <span className="orbe flotar-lento bottom-[16%] left-[44%] hidden h-5 w-5 sm:block" style={retraso(-2000)} />
        <span className="orbe flotar-lento bottom-[30%] right-[42%] hidden h-12 w-12 lg:block" style={retraso(-6000)} />
      </div>

      <Contenedor className="relative grid items-center gap-14 pb-28 pt-14 lg:grid-cols-[1.1fr_1fr] lg:pb-36 lg:pt-24">
        <div>
          <p
            className="entrada vidrio inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm text-sitio-suave"
            style={retraso(0)}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-sitio-oro opacity-60" />
              <span className="relative h-2 w-2 rounded-full bg-sitio-oro" />
            </span>
            Carta QR + gestión del salón, en un solo sistema
          </p>
          <h1
            className="entrada mt-6 font-marca text-[2.65rem] font-bold leading-[1.02] tracking-tight text-balance sm:text-6xl lg:text-7xl"
            style={retraso(120)}
          >
            Tu restaurante,{" "}
            <span className="block font-elegante text-[1.15em] font-semibold italic leading-[1] texto-oro">en un solo lugar.</span>
          </h1>
          <p className="entrada mt-6 max-w-xl text-lg text-sitio-suave" style={retraso(240)}>
            Tus clientes escanean el QR, ven la carta en su idioma y piden desde la mesa. Tú ves el salón, la cocina y la caja en
            vivo, desde el celular. Sin reimprimir cartas ni pagar comisiones por pedido.
          </p>
          <div className="entrada mt-9 flex flex-wrap gap-3" style={retraso(360)}>
            <Link href="/registro" className="boton-oro px-6 py-3.5 text-base">
              Probar gratis {DIAS_PRUEBA} días <Flecha />
            </Link>
            <Link href={CARTA_EJEMPLO} target="_blank" className="boton-vidrio px-6 py-3.5 text-base">
              Ver carta de ejemplo <Icono nombre="externo" className="h-4 w-4" />
            </Link>
          </div>
          <ul className="entrada mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-sitio-suave" style={retraso(480)}>
            {["Sin tarjeta de crédito", "Sin permanencia", "Precios en pesos chilenos"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Icono nombre="check" className="h-4 w-4 text-sitio-oro" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="entrada relative mx-auto w-full max-w-[230px] sm:max-w-[300px]" style={retraso(300)}>
          {/* Cápsula de luz detrás del teléfono */}
          <div aria-hidden className="halo-capsula absolute -inset-x-8 -inset-y-10 rounded-full sm:-inset-x-14 sm:-inset-y-14" />
          <div aria-hidden className="absolute -inset-x-16 -inset-y-20 hidden rounded-full border border-dashed border-sitio-oro/20 sm:block" />
          <div className="relative">
            <Telefono />
          </div>
          <div aria-hidden className="pointer-events-none absolute inset-0 hidden sm:block">
            <Aviso color="#a78bfa" texto="Mesa 6 pide la cuenta" className="-left-36 top-14" ms={0} />
            <Aviso color="#34d399" texto="Mesa 2: pedido listo" className="-right-28 top-1/2" ms={-2000} />
            <Aviso color="#38bdf8" texto="Mesa 9 llama al mesero" className="-left-32 bottom-16" ms={-4000} />
          </div>
        </div>
      </Contenedor>

      {/* Curva orgánica hacia la franja de cifras */}
      <svg aria-hidden viewBox="0 0 1440 120" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-16 w-full text-sitio-fondo-2 sm:h-24">
        <path fill="currentColor" d="M0 70C180 20 360 0 560 30s380 90 600 70 230-60 280-80v100H0z" />
      </svg>
    </section>
  );
}

// Teléfono con la carta de ejemplo real adentro: se puede recorrer sin salir de la página.
function Telefono() {
  return (
    <div className="relative rounded-[2.6rem] bg-[#0d0f14] p-2.5 shadow-2xl shadow-black/60 ring-1 ring-white/15">
      <div className="absolute left-1/2 top-3.5 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-[#0d0f14]" />
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
  const cifras: { n: number; antes?: string; despues?: string; texto: string }[] = [
    { n: 21, texto: "diseños de carta" },
    { n: 7, texto: "idiomas" },
    { n: 0, despues: " %", texto: "comisión por pedido" },
    { n: DIAS_PRUEBA, despues: " días", texto: "de prueba gratis" },
  ];
  return (
    <section className="bg-sitio-fondo-2 pb-14">
      <Contenedor className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cifras.map((c, i) => (
          <div key={c.texto} data-revelar="" style={retraso(i * 90)} className="tarjeta-sitio px-4 py-6 text-center">
            <p className="font-marca text-4xl font-bold tracking-tight tabular-nums">
              <span className="texto-oro">
                <span data-contar={c.n}>{c.n}</span>
                {c.despues}
              </span>
            </p>
            <p className="mt-1 text-sm text-sitio-suave">{c.texto}</p>
          </div>
        ))}
      </Contenedor>
      <Cinta />
    </section>
  );
}

// Cinta con los módulos que pasa sola (se detiene al pasar el mouse y queda quieta si se pide menos movimiento).
function Cinta() {
  const grupo = (duplicado: boolean) => (
    <ul aria-hidden={duplicado || undefined} className={`flex shrink-0 items-center gap-10 pr-10 ${duplicado ? "cinta-duplicado" : ""}`}>
      {MODULOS.map((m) => (
        <li key={m.titulo} className="flex items-center gap-10 whitespace-nowrap">
          <span className="font-elegante text-2xl font-semibold italic text-sitio-tinta/80">{m.titulo}</span>
          <span className="text-sitio-oro">✦</span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="cinta mt-12 overflow-hidden">
      <div className="cinta-pista flex w-max">
        {grupo(false)}
        {grupo(true)}
      </div>
    </div>
  );
}

const ILUSTRACIONES_PASOS: { src: string; alt: string }[] = [
  { src: "/ilustraciones/phone-camera.svg", alt: "Celular sacándole una foto a la carta" },
  { src: "/ilustraciones/qr-code-scan.svg", alt: "Celular escaneando el QR de la mesa" },
  { src: "/ilustraciones/eating-together.svg", alt: "Clientes comiendo en una mesa del restaurante" },
];

// Los tres pasos en una línea de tiempo con nodos que brillan; cada uno con su ilustración de unDraw dentro de un arco crema.
function Pasos() {
  return (
    <section id="como-funciona" className="scroll-mt-20 py-24 lg:py-32">
      <Contenedor>
        <Titulo
          etiqueta="Cómo funciona"
          titulo="Del QR a la mesa"
          acento="en un día."
          texto="Sin instalar nada en el local ni capacitaciones eternas. Tres pasos y tu carta ya está en las mesas."
          centrado
        />
        <ol className="mt-16 grid gap-14 md:grid-cols-3 md:gap-0">
          {PASOS.map(([titulo, texto], i) => {
            const ilus = ILUSTRACIONES_PASOS[i];
            return (
              <li key={titulo} data-revelar="" style={retraso(i * 150)} className="group md:px-5">
                <div className="arco mx-auto flex aspect-[4/5] w-full max-w-[280px] items-end justify-center overflow-hidden px-7 pb-10 transition duration-500 group-hover:-translate-y-2">
                  {ilus && (
                    <Image
                      src={ilus.src}
                      alt={ilus.alt}
                      width={800}
                      height={600}
                      className="h-auto max-h-[82%] w-auto max-w-full object-contain transition duration-700 group-hover:scale-105"
                    />
                  )}
                </div>
                <div className="relative flex justify-center py-8">
                  <span aria-hidden className={`absolute left-0 right-1/2 top-1/2 hidden h-px md:block ${i === 0 ? "md:hidden" : ""}`} style={{ background: "linear-gradient(90deg, transparent, var(--sitio-oro))" }} />
                  <span aria-hidden className={`absolute left-1/2 right-0 top-1/2 hidden h-px md:block ${i === PASOS.length - 1 ? "md:hidden" : ""}`} style={{ background: "linear-gradient(90deg, var(--sitio-oro), transparent)" }} />
                  <span
                    className="nodo nodo-latido relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-sitio-oro bg-sitio-fondo font-marca text-lg font-bold text-sitio-oro-texto"
                    style={retraso(i * 900)}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="mx-auto max-w-xs text-center">
                  <h3 className="font-marca text-xl font-bold">{titulo}</h3>
                  <p className="mt-2 text-sitio-suave">{texto}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </Contenedor>
    </section>
  );
}

// Ilustración de unDraw sobre un fondo crema fijo (se lee igual en tema claro y oscuro).
function Ilustracion({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return <Image src={src} alt={alt} width={800} height={600} className={`h-auto w-full object-contain ${className}`} />;
}

// Recorrido por el sistema con capturas reales, alternando imagen y texto.
function Recorrido() {
  return (
    <section className="py-24 lg:py-32">
      <Contenedor>
        <Titulo
          etiqueta="El sistema por dentro"
          titulo="Así se ve un servicio"
          acento="con Platovi."
          texto="Capturas reales del sistema, desde que el cliente pide hasta que paga."
        />
        <div className="mt-20 space-y-28">
          {RECORRIDO.map((r, i) => {
            const vertical = r.alto > r.ancho;
            const par = i % 2 === 1;
            return (
              <div key={r.titulo} className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
                <div data-revelar={par ? "derecha" : "izquierda"} className={`min-w-0 ${par ? "lg:order-2" : ""}`}>
                  <p className="font-marca text-sm font-bold text-sitio-oro-texto">
                    {String(i + 1).padStart(2, "0")} <span className="mx-2 text-sitio-suave/60">/</span>
                    <span className="uppercase tracking-[0.2em]">{r.etiqueta}</span>
                  </p>
                  <h3 className="mt-3 font-marca text-2xl font-bold tracking-tight text-balance sm:text-3xl">{r.titulo}</h3>
                  <p className="mt-4 text-lg text-sitio-suave">{r.texto}</p>
                  <ul className="mt-7 flex flex-wrap gap-2">
                    {r.puntos.map((pt) => (
                      <li key={pt} className="vidrio flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm">
                        <Icono nombre="check" className="h-3.5 w-3.5 shrink-0 text-sitio-oro" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
                <div data-revelar="zoom" style={retraso(120)} className={`relative flex min-w-0 justify-center ${par ? "lg:order-1" : ""}`}>
                  <div aria-hidden className="absolute inset-[10%] rounded-full bg-sitio-oro/25 blur-3xl" />
                  <div className={`vidrio relative rounded-[1.9rem] p-2 ${vertical ? "w-full max-w-72" : "w-full"}`}>
                    <Image
                      src={r.imagen}
                      alt={r.alt}
                      width={r.ancho}
                      height={r.alto}
                      className="h-auto w-full rounded-[1.5rem] shadow-2xl shadow-black/40"
                    />
                  </div>
                  {r.movil && (
                    <div className="flotar absolute -right-2 bottom-8 hidden w-44 sm:block lg:right-2" style={retraso(-1500)}>
                      <Image
                        src={r.movil}
                        alt="Aviso al cliente: tu pedido está listo"
                        width={390}
                        height={844}
                        className="h-auto w-full rounded-2xl shadow-2xl shadow-black/60 ring-1 ring-white/15"
                      />
                    </div>
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
    <section id="modulos" className="scroll-mt-20 pb-24 lg:pb-32">
      <Contenedor>
        <Titulo
          etiqueta="Módulos"
          titulo="Todo lo que pasa entre la mesa, la cocina"
          acento="y la caja."
          texto="Activa solo lo que tu local necesita. El sistema se adapta a tu forma de trabajar, no al revés."
        />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULOS.map((m, i) => (
            <div key={m.titulo} data-revelar="" style={retraso((i % 3) * 90)} className="tarjeta-sitio p-6">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-2xl text-sitio-oro-texto"
                style={{
                  background:
                    "linear-gradient(var(--sitio-fondo-2), var(--sitio-fondo-2)) padding-box, linear-gradient(140deg, #f9d796, rgb(242 163 58 / 0.2)) border-box",
                  border: "1px solid transparent",
                }}
              >
                <Icono nombre={m.icono} />
              </span>
              <h3 className="mt-5 font-marca text-lg font-bold">{m.titulo}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-sitio-suave">{m.texto}</p>
            </div>
          ))}
        </div>
      </Contenedor>
    </section>
  );
}

const VENTAJAS_LOYALTY: { icono: Parameters<typeof Icono>[0]["nombre"]; titulo: string; texto: string }[] = [
  { icono: "pantalla", titulo: "En el celular, sin descargar nada", texto: "La tarjeta vive en la web y en Google Wallet. No se pierde ni se olvida en casa." },
  { icono: "qr", titulo: "El sello se suma solo", texto: "El cliente escanea el QR de su precuenta y listo. Sin timbres ni cartón." },
  { icono: "candado", titulo: "Canje seguro con PIN", texto: "El mesero entrega el premio con su PIN y todo queda registrado." },
  { icono: "personas", titulo: "Sabes quién vuelve", texto: "Cada tarjeta tiene nombre: ves a tus clientes frecuentes y cuándo vinieron." },
];

const CAMPANAS_LOYALTY: { icono: Parameters<typeof Icono>[0]["nombre"]; titulo: string; texto: string }[] = [
  { icono: "rayo", titulo: "Días de sello doble", texto: "Elige los días flojos y cada visita vale 2 sellos." },
  { icono: "estrella", titulo: "Reseña en Google", texto: "Tras el sello, invita a dejar una reseña de 5 estrellas." },
  { icono: "campana", titulo: "Te extrañamos", texto: "Si alguien deja de venir, le llega un aviso con un sello de regalo." },
  { icono: "regalo", titulo: "Cumpleaños", texto: "Un sello extra o un regalo el día de su cumpleaños." },
];

// Platovi Loyalty: la tarjeta de sellos digital, complemento que se suma a cualquier plan.
function Loyalty() {
  return (
    <section id="loyalty" className="relative scroll-mt-20 overflow-hidden py-24 lg:py-32">
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-24 -z-10 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--sitio-brillo), transparent 70%)" }}
      />
      <Contenedor className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-20">
        <div>
          <Titulo
            etiqueta={NOMBRE_SELLOS}
            titulo="Clientes que vuelven,"
            acento="sello a sello."
            texto="Cambia la tarjeta de cartón por una tarjeta de sellos en el celular. Tus clientes juntan sellos en cada visita y ganan el premio que tú elijas."
          />
          <ul className="mt-10 grid gap-5 sm:grid-cols-2">
            {VENTAJAS_LOYALTY.map((v, i) => (
              <li key={v.titulo} data-revelar="" style={retraso(i * 80)} className="flex gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-sitio-oro/30 bg-sitio-oro/10 text-sitio-oro-texto">
                  <Icono nombre={v.icono} className="h-5 w-5" />
                </span>
                <span>
                  <b className="block font-marca text-[0.95rem]">{v.titulo}</b>
                  <span className="mt-0.5 block text-sm leading-relaxed text-sitio-suave">{v.texto}</span>
                </span>
              </li>
            ))}
          </ul>
          <div data-revelar="" className="vidrio mt-10 flex flex-wrap items-center gap-x-8 gap-y-5 rounded-[1.75rem] p-5 sm:p-6">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-sitio-suave">Complemento de tu plan</p>
              <p className="mt-1 font-marca text-3xl font-bold tabular-nums">
                {clp(PRECIO_SELLOS.local)}
                <span className="text-base font-normal text-sitio-suave"> /mes por local</span>
              </p>
              <p className="mt-0.5 text-sm text-sitio-suave">
                Plan Grupo: {clp(PRECIO_SELLOS.grupo)} /mes para todas tus sucursales.
              </p>
            </div>
            <a href="#contacto" className="boton-oro px-6 py-3.5 text-base sm:ml-auto">
              Lo quiero <Flecha />
            </a>
          </div>
        </div>
        <div data-revelar="zoom" style={retraso(120)}>
          <VitrinaLoyalty />
        </div>
      </Contenedor>

      <Contenedor className="mt-20">
        <div data-revelar="" className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Etiqueta>Para que vuelvan</Etiqueta>
            <h3 className="mt-3 font-marca text-2xl font-bold sm:text-3xl">Campañas automáticas que trabajan por ti.</h3>
          </div>
          <p className="max-w-sm text-sm text-sitio-suave">Las activas una vez y se envían solas al celular de tus clientes.</p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CAMPANAS_LOYALTY.map((c, i) => (
            <div key={c.titulo} data-revelar="" style={retraso(i * 90)} className="tarjeta-sitio p-6">
              <Icono nombre={c.icono} className="h-6 w-6 text-sitio-oro-texto" />
              <h4 className="mt-4 font-marca text-lg font-bold">{c.titulo}</h4>
              <p className="mt-1.5 text-sm leading-relaxed text-sitio-suave">{c.texto}</p>
            </div>
          ))}
        </div>
      </Contenedor>
    </section>
  );
}

function Demo() {
  return (
    <section id="demo" className="scroll-mt-20 py-24 lg:py-32">
      <Contenedor>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Titulo
            etiqueta="Demo"
            titulo="Mira cartas reales"
            acento="funcionando."
            texto="Ábrelas en tu celular como lo haría un cliente. Cada una usa uno de los 21 diseños."
          />
          <Link href={CARTA_EJEMPLO} target="_blank" className="boton-vidrio" data-revelar="">
            Abrir Aroma Café <Icono nombre="externo" className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {DEMOS.map((d, i) => (
            <Link
              key={d.slug}
              href={`/${d.slug}`}
              target="_blank"
              data-revelar="zoom"
              style={retraso((i % 4) * 80)}
              className="group relative flex aspect-[4/5] flex-col md:aspect-[4/5] justify-between overflow-hidden rounded-[1.75rem] p-4 text-white ring-1 ring-white/10 transition duration-500 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-black/40 sm:p-5"
            >
              {/* Captura real de la parte de arriba de esa carta (public/inicio/demos) */}
              <Image
                src={`/inicio/demos/${d.slug}.webp`}
                alt={`Carta de ${d.nombre}`}
                fill
                sizes="(min-width: 768px) 25vw, 50vw"
                className="object-cover object-top transition duration-700 group-hover:scale-105"
              />
              <span
                aria-hidden
                className="absolute inset-0"
                style={{ background: `linear-gradient(180deg, transparent 35%, ${d.color}cc 72%, #050608 100%)` }}
              />
              <span className="relative self-start rounded-full bg-black/45 px-2.5 py-1 text-xs backdrop-blur">{d.tipo}</span>
              <span className="relative">
                <span className="block font-marca text-lg font-bold leading-tight sm:text-xl">{d.nombre}</span>
                <span className="mt-2 flex items-center gap-1.5 text-sm text-white/75 transition group-hover:text-white">
                  Ver carta <Flecha className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                </span>
              </span>
            </Link>
          ))}
        </div>
      </Contenedor>
    </section>
  );
}

function Precios() {
  return (
    <section id="precios" className="relative scroll-mt-20 py-24 lg:py-32">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 50% 40% at 50% 20%, var(--sitio-brillo), transparent 70%)" }}
      />
      <Contenedor className="relative">
        <Titulo
          etiqueta="Precios"
          titulo="Un precio fijo,"
          acento="sin comisiones."
          texto={`Precios en pesos chilenos (CLP), IVA incluido. Prueba gratis ${DIAS_PRUEBA} días con todo incluido.`}
          centrado
        />
        <PreciosPlanes />
        <div className="mt-20">
          <div data-revelar="" className="text-center">
            <h3 className="font-marca text-2xl font-bold">¿No tienes tiempo de cargar la carta? La armamos por ti</h3>
            <p className="mt-2 text-sitio-suave">Pago único y opcional. Si prefieres hacerlo tú, la armas en minutos desde el panel.</p>
          </div>
          <div className="mx-auto mt-8 grid max-w-4xl gap-4 md:grid-cols-2">
            {ARMADOS.map((a, i) => {
              const destacado = "destacado" in a && a.destacado;
              return (
                <div
                  key={a.id}
                  data-revelar=""
                  style={retraso(i * 100)}
                  className={`tarjeta-sitio flex flex-col p-6 ${destacado ? "borde-oro" : ""}`}
                >
                  <p className="flex items-baseline justify-between gap-3">
                    <span className="font-marca font-bold">Armado {a.nombre}</span>
                    <span className="font-marca text-xl font-bold tabular-nums texto-oro">{clp(a.precio)}</span>
                  </p>
                  <p className="mt-1 text-sm text-sitio-suave">{a.para}</p>
                  <ul className="mt-4 space-y-2 border-t border-sitio-borde pt-4 text-sm">
                    {a.incluye.map((item) => (
                      <li key={item} className="flex gap-2">
                        <Icono nombre="check" className="mt-0.5 h-4 w-4 shrink-0 text-sitio-oro" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </Contenedor>
    </section>
  );
}

// Bloque que contrasta con el fondo (crema en modo oscuro, tinta en modo claro), con esquinas orgánicas.
function Servicios() {
  return (
    <section className="px-2 sm:px-4">
      <div className="mx-auto max-w-7xl rounded-[2.5rem] bg-sitio-contraste py-20 sm:rounded-[3rem] lg:rounded-br-[9rem] lg:rounded-tl-[9rem] lg:py-28">
        <Contenedor className="grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:items-center">
          <div>
            <Titulo
              etiqueta="Servicios"
              titulo="No te dejamos solo con el sistema"
              texto="Platovi lo hace Brote Digital. Te acompañamos desde la primera carta hasta que tu equipo lo usa sin pensar."
              contraste
            />
            <div data-revelar="zoom" className="mt-10 flex aspect-square max-w-[19rem] items-center justify-center rounded-full bg-[#fffaf1] p-12 shadow-2xl shadow-black/20">
              <Ilustracion src="/ilustraciones/active-support.svg" alt="Persona recibiendo ayuda por videollamada desde el celular" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {SERVICIOS.map(([titulo, texto], i) => (
              <div
                key={titulo}
                data-revelar=""
                style={retraso(i * 90)}
                className="rounded-[1.75rem] bg-sitio-contraste-tinta/[0.06] p-6 text-sitio-contraste-tinta ring-1 ring-sitio-contraste-tinta/10 transition duration-300 hover:-translate-y-1 hover:bg-sitio-contraste-tinta/10"
              >
                <span className="font-elegante text-3xl font-semibold italic text-[#c47a1e]">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-2 font-marca text-lg font-bold">{titulo}</h3>
                <p className="mt-1.5 text-sm text-sitio-contraste-suave">{texto}</p>
              </div>
            ))}
          </div>
        </Contenedor>
      </div>
    </section>
  );
}

function Testimonios() {
  if (TESTIMONIOS.length === 0) return null;
  return (
    <section className="py-24 lg:py-32">
      <Contenedor>
        <Titulo etiqueta="Testimonios" titulo="Lo que cambia" acento="en el día a día." />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {TESTIMONIOS.map((t, i) => (
            <figure key={t.texto} data-revelar="" style={retraso(i * 110)} className="tarjeta-sitio flex flex-col p-7">
              <span aria-hidden className="font-elegante text-7xl leading-[0.6] texto-oro">“</span>
              <blockquote className="mt-4 flex-1 text-lg leading-relaxed">{t.texto}</blockquote>
              <figcaption className="mt-6 flex items-center gap-3 border-t border-sitio-borde pt-5 text-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-marca font-bold text-[#172033]" style={{ background: "var(--oro-degradado)" }}>
                  {t.nombre.charAt(0)}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">{t.nombre}</span>
                  <span className="text-sitio-suave">{t.local}</span>
                </span>
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
    <section id="preguntas" className="scroll-mt-20 pb-24 lg:pb-32">
      <Contenedor className="grid gap-12 lg:grid-cols-[1fr_1.6fr] lg:items-start">
        <div className="lg:sticky lg:top-28">
          <Titulo etiqueta="Preguntas" titulo="Lo que nos preguntan" acento="antes de partir." />
          <div data-revelar="zoom" className="arco mt-10 hidden aspect-[4/5] max-w-[17rem] items-end px-8 pb-10 lg:flex">
            <Ilustracion src="/ilustraciones/questions.svg" alt="Dos personas frente a un gran signo de pregunta" />
          </div>
        </div>
        <div className="space-y-3">
          {PREGUNTAS.map(([pregunta, respuesta], i) => (
            <details
              key={pregunta}
              data-revelar=""
              style={retraso(Math.min(i, 5) * 60)}
              className="pregunta-sitio vidrio group rounded-[1.5rem] px-6 py-5 transition-colors open:border-sitio-oro/40"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                {pregunta}
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sitio-borde text-lg text-sitio-oro-texto transition duration-300 group-open:rotate-45 group-open:border-sitio-oro/50">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sitio-suave">{respuesta}</p>
            </details>
          ))}
        </div>
      </Contenedor>
    </section>
  );
}

// Cierre: una gran cápsula oscura con luz dorada (igual en los dos temas).
function Cierre() {
  return (
    <section className="pb-24">
      <Contenedor>
        <div
          data-revelar="zoom"
          className="relative isolate grid items-center gap-12 overflow-hidden rounded-[2.5rem] px-6 py-14 text-center text-[#f5f1e8] ring-1 ring-[#f2a33a]/25 sm:rounded-[3.5rem] sm:px-14 lg:grid-cols-[1.35fr_1fr] lg:text-left"
          style={{
            background:
              "radial-gradient(ellipse 70% 80% at 0% 0%, rgb(242 163 58 / 0.32), transparent 60%), radial-gradient(ellipse 50% 60% at 100% 100%, rgb(196 122 30 / 0.22), transparent 60%), linear-gradient(140deg, #1b2740, #0b0e14)",
          }}
        >
          <span aria-hidden className="orbe flotar-lento -z-10 right-[38%] top-8 h-8 w-8" />
          <span aria-hidden className="orbe orbe-difuso flotar-lento -z-10 -bottom-6 left-[30%] h-20 w-20" style={retraso(-3000)} />
          <div>
            <h2 className="font-marca text-3xl font-bold tracking-tight text-balance sm:text-5xl">
              Prueba Platovi <span className="font-elegante text-[1.15em] font-semibold italic texto-oro">en tu local.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-[#f5f1e8]/75 lg:mx-0">
              Crea tu cuenta, carga tu carta y pega el primer QR hoy. Los primeros {DIAS_PRUEBA} días van por nuestra cuenta.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3 lg:justify-start">
              <Link href="/registro" className="boton-oro px-6 py-3.5 text-base">
                Crear cuenta gratis <Flecha />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3.5 font-medium transition hover:-translate-y-0.5 hover:border-[#f2a33a]/60 hover:bg-white/5"
              >
                Ya tengo cuenta
              </Link>
            </div>
          </div>
          <div className="mx-auto flex aspect-[5/4] w-full max-w-[18rem] items-center justify-center rounded-[50%] bg-[#fffaf1] p-10 shadow-2xl shadow-black/40 sm:max-w-xs lg:max-w-none">
            <Ilustracion src="/ilustraciones/eating-pasta.svg" alt="Dos personas comiendo en un restaurante" />
          </div>
        </div>
      </Contenedor>
    </section>
  );
}

// Enlaces de las redes cargadas en /admin/sitio (las vacías o inválidas no se muestran).
function redesSitio(sitio: AjustesSitio) {
  return REDES_SITIO.flatMap((r) => {
    const url = sitio.redes[r] ? enlaceRed(r, sitio.redes[r]) : null;
    return url ? [{ red: r, url, nombre: INFO_RED[r].nombre, icono: INFO_RED[r].icono }] : [];
  });
}

function IconoRed({ d, className = "h-4 w-4" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`fill-current ${className}`} aria-hidden>
      <path d={d} />
    </svg>
  );
}

const ICONO_WHATSAPP =
  "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z";

// Formas de contacto, ordenadas por lo más rápido: WhatsApp, correo, teléfono y redes.
function Contacto({ sitio }: { sitio: AjustesSitio }) {
  const { contacto } = sitio;
  const redes = redesSitio(sitio);
  const formas = [
    contacto.whatsapp && {
      titulo: "WhatsApp",
      valor: contacto.telefono || `+${contacto.whatsapp}`,
      ayuda: "La forma más rápida. Te responde una persona.",
      href: `https://wa.me/${contacto.whatsapp}?text=${encodeURIComponent("Hola, quiero saber más de Platovi para mi restaurante.")}`,
      icono: <IconoRed d={ICONO_WHATSAPP} className="h-5 w-5" />,
    },
    contacto.correo && {
      titulo: "Correo",
      valor: contacto.correo,
      ayuda: "Para cotizaciones, documentos o dudas largas.",
      href: `mailto:${contacto.correo}`,
      icono: <Icono nombre="correo" className="h-5 w-5" />,
    },
    contacto.telefono && {
      titulo: "Llámanos",
      valor: contacto.telefono,
      ayuda: "Si prefieres conversarlo.",
      href: `tel:${contacto.telefono.replace(/[^\d+]/g, "")}`,
      icono: <Icono nombre="campana" className="h-5 w-5" />,
    },
  ].filter(Boolean) as { titulo: string; valor: string; ayuda: string; href: string; icono: React.ReactNode }[];

  return (
    <section id="contacto" className="scroll-mt-20 pb-24 lg:pb-32">
      <Contenedor className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:items-start">
        <div>
          <Titulo
            etiqueta="Contacto"
            titulo="Hablemos de"
            acento="tu restaurante."
            texto="Escríbenos por donde te acomode. Te respondemos a cualquier hora, todos los días."
          />
          <div data-revelar="" className="mt-6 inline-flex items-center gap-2 rounded-full border border-sitio-oro/40 bg-sitio-oro/10 px-3.5 py-1.5 text-sm font-semibold text-sitio-oro-texto">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Atención 24/7 · {contacto.horario}
          </div>
          <ul className="mt-8 space-y-3">
            {formas.map((f, i) => (
              <li key={f.titulo} data-revelar="" style={retraso(i * 90)}>
                <a
                  href={f.href}
                  target={f.href.startsWith("http") ? "_blank" : undefined}
                  rel="noreferrer"
                  className="tarjeta-sitio group flex items-center gap-4 p-4"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[#172033]" style={{ background: "var(--oro-degradado)" }}>
                    {f.icono}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-sitio-suave">{f.titulo}</span>
                    <span className="block truncate font-marca text-lg font-bold">{f.valor}</span>
                    <span className="block text-sm text-sitio-suave">{f.ayuda}</span>
                  </span>
                  <Flecha className="h-5 w-5 shrink-0 text-sitio-oro transition group-hover:translate-x-1" />
                </a>
              </li>
            ))}
          </ul>
          {redes.length > 0 && (
            <div data-revelar="" className="mt-8">
              <p className="text-sm text-sitio-suave">Síguenos</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {redes.map((r) => (
                  <a
                    key={r.red}
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="vidrio flex items-center gap-2 rounded-full px-4 py-2 text-sm transition hover:-translate-y-0.5 hover:border-sitio-oro/50"
                  >
                    <IconoRed d={r.icono} />
                    {r.nombre}
                  </a>
                ))}
              </div>
            </div>
          )}
          {contacto.ubicacion && (
            <p data-revelar="" className="mt-8 flex items-start gap-2 text-sm text-sitio-suave">
              <Icono nombre="restaurantes" className="mt-0.5 h-4 w-4 shrink-0 text-sitio-oro" />
              {contacto.ubicacion}
            </p>
          )}
        </div>
        <div data-revelar="zoom" style={retraso(120)}>
          <FormContacto whatsapp={contacto.whatsapp} />
        </div>
      </Contenedor>
    </section>
  );
}

// Pie con la marca, las redes, el menú, el producto y el contacto (estilo del resto del sitio).
function Pie({ sitio }: { sitio: AjustesSitio }) {
  const { contacto } = sitio;
  const redes = redesSitio(sitio);
  const producto: [string, string][] = [
    ["/registro", `Probar gratis ${DIAS_PRUEBA} días`],
    ["/aroma-cafe", "Carta de ejemplo"],
    ["#precios", "Planes y precios"],
    ["/login", "Entrar al panel"],
  ];
  const anio = new Date().getFullYear();
  return (
    <footer className="relative mt-4 overflow-hidden border-t border-sitio-borde bg-sitio-fondo-2">
      <div aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, var(--sitio-oro), transparent)" }} />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[60rem] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(closest-side, var(--sitio-brillo), transparent)" }}
      />
      <Contenedor className="relative grid grid-cols-2 gap-x-6 gap-y-12 py-16 lg:grid-cols-[1.5fr_1fr_1fr_1.3fr] lg:gap-10">
        <div className="col-span-2 lg:col-span-1">
          <Logo oscuro nombreClase="text-sitio-tinta" className="text-2xl" />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-sitio-suave">
            Carta digital con QR, pedidos desde la mesa y gestión del salón, la cocina y la caja. Hecho en Chile por Brote Digital.
          </p>
          {redes.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {redes.map((r) => (
                <a
                  key={r.red}
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={r.nombre}
                  title={r.nombre}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-sitio-borde bg-sitio-vidrio text-sitio-tinta transition hover:-translate-y-0.5 hover:border-sitio-oro/60 hover:text-sitio-oro-texto"
                >
                  <IconoRed d={r.icono} />
                </a>
              ))}
            </div>
          )}
        </div>
        <ColumnaPie titulo="Menú" enlaces={NAV} />
        <ColumnaPie titulo="Producto" enlaces={producto} />
        <div className="col-span-2 sm:col-span-1">
          <p className="font-marca text-base font-bold">Contacto</p>
          <ul className="mt-5 space-y-3.5 text-sm">
            {contacto.whatsapp && (
              <DatoPie href={`https://wa.me/${contacto.whatsapp}`} icono={<IconoRed d={ICONO_WHATSAPP} className="h-3.5 w-3.5" />}>
                {contacto.telefono || `+${contacto.whatsapp}`}
              </DatoPie>
            )}
            {contacto.correo && (
              <DatoPie href={`mailto:${contacto.correo}`} icono={<Icono nombre="correo" className="h-3.5 w-3.5" />}>
                {contacto.correo}
              </DatoPie>
            )}
            {contacto.horario && <DatoPie icono={<Icono nombre="reloj" className="h-3.5 w-3.5" />}>{contacto.horario}</DatoPie>}
            {contacto.ubicacion && (
              <DatoPie icono={<Icono nombre="restaurantes" className="h-3.5 w-3.5" />}>{contacto.ubicacion}</DatoPie>
            )}
          </ul>
        </div>
      </Contenedor>
      <Contenedor className="relative flex flex-wrap items-center justify-between gap-4 border-t border-sitio-borde py-6 text-xs text-sitio-suave">
        <span>
          © {anio} Platovi · por Brote Digital. Precios en pesos chilenos (CLP), IVA incluido.
        </span>
        <a href="#contacto" className="transition hover:text-sitio-tinta">
          ¿Dudas? Escríbenos, respondemos 24/7
        </a>
      </Contenedor>
    </footer>
  );
}

function ColumnaPie({ titulo, enlaces }: { titulo: string; enlaces: [string, string][] }) {
  return (
    <div>
      <p className="font-marca text-base font-bold">{titulo}</p>
      <ul className="mt-5 space-y-3 text-sm">
        {enlaces.map(([href, texto]) => (
          <li key={href}>
            <a href={href} className="text-sitio-suave transition hover:text-sitio-tinta">
              {texto}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DatoPie({ href, icono, children }: { href?: string; icono: React.ReactNode; children: React.ReactNode }) {
  const contenido = (
    <>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-sitio-oro/40 bg-sitio-oro/10 text-sitio-oro-texto">
        {icono}
      </span>
      <span className="min-w-0 break-words pt-1">{children}</span>
    </>
  );
  return (
    <li>
      {href ? (
        <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="flex items-start gap-3 text-sitio-suave transition hover:text-sitio-tinta">
          {contenido}
        </a>
      ) : (
        <span className="flex items-start gap-3 text-sitio-suave">{contenido}</span>
      )}
    </li>
  );
}
