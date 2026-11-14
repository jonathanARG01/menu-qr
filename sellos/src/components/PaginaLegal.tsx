import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ACTUALIZADO, EMPRESA, type SeccionLegal } from "@/lib/legal";

export function PaginaLegal({ titulo, bajada, secciones }: { titulo: string; bajada: string; secciones: SeccionLegal[] }) {
  return (
    <div className="min-h-screen bg-fondo">
      <header className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <Link href="/" aria-label="Inicio">
          <Logo className="text-xl" />
        </Link>
        <Link href="/" className="text-sm text-suave hover:text-tinta">
          Volver al inicio
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-8 sm:px-6">
        <p className="text-xs uppercase tracking-[0.18em] text-suave">Legal</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">{titulo}</h1>
        <p className="mt-4 text-suave">{bajada}</p>
        <p className="mt-2 text-sm text-suave">Última actualización: {ACTUALIZADO}.</p>
        <ol className="mt-10 space-y-8">
          {secciones.map((s, i) => (
            <li key={s.titulo}>
              <h2 className="text-lg font-bold">
                <span className="text-marca tabular-nums">{i + 1}.</span> {s.titulo}
              </h2>
              {s.parrafos.map((p) => (
                <p key={p} className="mt-2 leading-relaxed text-suave">
                  {p}
                </p>
              ))}
              {s.lista && (
                <ul className="mt-2 space-y-2 leading-relaxed text-suave">
                  {s.lista.map(([t, d]) => (
                    <li key={t}>
                      <b className="text-tinta">{t}:</b> {d}
                    </li>
                  ))}
                </ul>
              )}
              {s.nota && <p className="mt-2 leading-relaxed text-suave">{s.nota}</p>}
            </li>
          ))}
        </ol>
        <p className="mt-16 border-t border-borde pt-6 text-sm text-suave">
          {EMPRESA.razon} · RUT {EMPRESA.rut} · {EMPRESA.correo}
        </p>
      </main>
    </div>
  );
}
