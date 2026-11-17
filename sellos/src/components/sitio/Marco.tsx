import Link from "next/link";
import { Logo } from "@/components/Logo";
import { BotonTema, ScriptTema, Tema } from "@/components/Tema";
import { CORREO_CONTACTO, EMPRESA, LEMA, MARCA, enlaceWhatsapp } from "@/lib/marca";
import { AnimacionesClub, MenuMovil } from "./Interactivo";

// Marco del sitio de venta: tema claro/oscuro, cabecera en cápsula, barra de avance, animaciones y pie.

export const retraso = (ms: number) => ({ "--retraso": `${ms}ms` }) as React.CSSProperties;

const ENLACES: [string, string][] = [
  ["/#como-funciona", "Cómo funciona"],
  ["/#funciones", "Funciones"],
  ["/disenos", "Diseños"],
  ["/#precios", "Precios"],
  ["/#preguntas", "Preguntas"],
];

// Las animaciones de aparición solo se activan si el script corre (si no, todo queda visible).
const SCRIPT_JS = `document.documentElement.classList.add("club-js")`;

export function SitioClub({ children, animado = true }: { children: React.ReactNode; animado?: boolean }) {
  return (
    <div className="club relative min-h-dvh overflow-x-clip">
      <ScriptTema />
      {animado && <script dangerouslySetInnerHTML={{ __html: SCRIPT_JS }} />}
      <Tema />
      {animado && <AnimacionesClub />}
      <div aria-hidden className="barra-avance-club fixed inset-x-0 top-0 z-50 h-[3px]" style={{ background: "var(--jade-degradado)" }} />
      <Cabecera />
      {children}
      <Pie />
    </div>
  );
}

function Cabecera() {
  return (
    <div className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
      <header className="cabecera-club vidrio-club mx-auto flex h-14 max-w-6xl items-center gap-3 rounded-full pl-4 pr-2 sm:pl-5">
        <Link href="/" aria-label="Inicio" className="shrink-0">
          <Logo className="text-lg sm:text-xl" />
        </Link>
        <nav className="ml-6 hidden items-center gap-1 text-sm lg:flex">
          {ENLACES.map(([href, texto]) => (
            <a key={href} href={href} className="rounded-full px-3 py-2 text-suave transition hover:bg-club-vidrio hover:text-tinta">
              {texto}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <BotonTema className="vidrio-club !bg-club-vidrio !shadow-none" />
          <Link href="/entrar" className="hidden rounded-full px-3 py-2 text-sm font-medium text-tinta transition hover:text-club-jade-texto sm:block">
            Entrar
          </Link>
          <Link href="/registro" className="boton-jade hidden py-2.5 sm:inline-flex">
            Crear cuenta <span className="flecha">→</span>
          </Link>
          <MenuMovil enlaces={ENLACES} />
        </div>
      </header>
    </div>
  );
}

// Rótulo chico arriba de cada título: una línea jade y texto espaciado.
export function Etiqueta({ children, centro = false }: { children: React.ReactNode; centro?: boolean }) {
  return (
    <p className={`flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-club-jade-texto ${centro ? "justify-center" : ""}`}>
      <span aria-hidden className="h-px w-8" style={{ background: "var(--jade-degradado)" }} />
      {children}
      {centro && <span aria-hidden className="h-px w-8" style={{ background: "var(--jade-degradado)" }} />}
    </p>
  );
}

// Título de sección: firme, con la parte destacada en cursiva y degradado.
export function Titulo({ children, acento, centro = false, className = "" }: { children: React.ReactNode; acento?: string; centro?: boolean; className?: string }) {
  return (
    <h2 className={`mt-4 text-balance text-3xl font-bold leading-[1.08] tracking-tight sm:text-5xl ${centro ? "text-center" : ""} ${className}`}>
      {children}
      {acento && (
        <>
          {" "}
          <span className="texto-jade pr-1 font-acento text-[1.12em] font-normal italic">{acento}</span>
        </>
      )}
    </h2>
  );
}

function Pie() {
  const wa = enlaceWhatsapp(`Hola, quiero saber más de ${MARCA} para mi negocio.`);
  const columnas: [string, [string, string, boolean?][]][] = [
    [
      "Producto",
      [
        ["/#como-funciona", "Cómo funciona"],
        ["/#funciones", "Funciones"],
        ["/disenos", "Diseños de tarjeta"],
        ["/#precios", "Precios"],
      ],
    ],
    [
      "Ayuda",
      [
        ["/#preguntas", "Preguntas frecuentes"],
        ["/#contacto", "Contacto"],
        [wa, "WhatsApp", true],
        [`mailto:${CORREO_CONTACTO}`, CORREO_CONTACTO, true],
      ],
    ],
    [
      "Cuenta",
      [
        ["/registro", "Crear cuenta gratis"],
        ["/entrar", "Entrar al panel"],
        ["/recuperar", "Olvidé mi contraseña"],
      ],
    ],
  ];
  return (
    <footer className="relative mt-10 overflow-hidden border-t border-borde">
      <div aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, var(--club-jade), var(--club-coral), transparent)" }} />
      <div aria-hidden className="absolute left-1/2 top-0 h-64 w-[44rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,var(--club-brillo),transparent)]" />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-5 pb-10 pt-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo className="text-2xl" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-suave">{LEMA}. Para cafés, bares, canchas, peluquerías, tiendas y cualquier negocio donde los clientes vuelven.</p>
          <Link href="/registro" className="boton-jade mt-6">
            Probar gratis <span className="flecha">→</span>
          </Link>
        </div>
        {columnas.map(([titulo, enlaces]) => (
          <div key={titulo}>
            <p className="font-titulo text-sm font-semibold text-tinta">{titulo}</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {enlaces.map(([href, texto, externo]) => (
                <li key={texto}>
                  <a
                    href={href}
                    {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="break-all text-suave transition hover:text-club-jade-texto"
                  >
                    {texto}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="relative border-t border-borde">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-6 text-xs text-suave">
          <span>
            © {new Date().getFullYear()} {EMPRESA} · Hecho en Valparaíso, Chile
          </span>
          <span className="ml-auto flex gap-5">
            <Link href="/terminos" className="hover:text-tinta">
              Términos
            </Link>
            <Link href="/privacidad" className="hover:text-tinta">
              Privacidad
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
