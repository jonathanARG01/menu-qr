import Link from "next/link";
import { Logo } from "@/components/Logo";
import { BotonTema } from "@/components/inicio/Interactivo";
import { SCRIPT_TEMA_SITIO } from "@/components/inicio/tema";
import { ACTUALIZADO, EMPRESA, type SeccionLegal } from "@/lib/legal";

// Página de texto legal con el estilo del sitio de venta (tema claro/oscuro incluido).
export function PaginaLegal({ titulo, bajada, secciones }: { titulo: string; bajada: string; secciones: SeccionLegal[] }) {
  return (
    <div className="sitio min-h-screen overflow-x-clip">
      <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA_SITIO }} />
      <header className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <Link href="/" aria-label="Platovi, inicio">
          <Logo oscuro nombreClase="text-sitio-tinta" className="text-xl" />
        </Link>
        <div className="flex items-center gap-3">
          <BotonTema />
          <Link href="/" className="text-sm text-sitio-suave transition hover:text-sitio-tinta">
            Volver al inicio
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-8 sm:px-6">
        <p className="text-xs uppercase tracking-[0.18em] text-sitio-suave">Legal</p>
        <h1 className="mt-2 font-marca text-4xl font-bold tracking-tight sm:text-5xl">{titulo}</h1>
        <p className="mt-4 text-sitio-suave">{bajada}</p>
        <p className="mt-2 text-sm text-sitio-suave">Última actualización: {ACTUALIZADO}.</p>
        <ol className="mt-12 space-y-10">
          {secciones.map((s, i) => (
            <li key={s.titulo} id={`punto-${i + 1}`} className="scroll-mt-8">
              <h2 className="font-marca text-xl font-bold">
                <span className="texto-oro tabular-nums">{i + 1}.</span> {s.titulo}
              </h2>
              {s.parrafos.map((p) => (
                <p key={p} className="mt-3 leading-relaxed text-sitio-suave">
                  {p}
                </p>
              ))}
              {s.lista && (
                <ul className="mt-3 space-y-2 leading-relaxed text-sitio-suave">
                  {s.lista.map(([t, d]) => (
                    <li key={t} className="flex gap-2">
                      <span aria-hidden className="text-sitio-oro">
                        •
                      </span>
                      <span>
                        <b className="text-sitio-tinta">{t}:</b> {d}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {s.nota && <p className="mt-3 leading-relaxed text-sitio-suave">{s.nota}</p>}
            </li>
          ))}
        </ol>
        <nav className="mt-16 flex flex-wrap gap-x-6 gap-y-2 border-t border-sitio-borde pt-6 text-sm text-sitio-suave">
          <Link href="/terminos" className="hover:text-sitio-tinta">
            Términos y condiciones
          </Link>
          <Link href="/privacidad" className="hover:text-sitio-tinta">
            Política de privacidad
          </Link>
          <a href={`mailto:${EMPRESA.correo}`} className="hover:text-sitio-tinta">
            {EMPRESA.correo}
          </a>
        </nav>
      </main>
    </div>
  );
}
