import { Etiqueta, SitioClub } from "@/components/sitio/Marco";
import { ACTUALIZADO, EMPRESA, type SeccionLegal } from "@/lib/legal";

export function PaginaLegal({ titulo, bajada, secciones }: { titulo: string; bajada: string; secciones: SeccionLegal[] }) {
  return (
    <SitioClub animado={false}>
      <main className="mx-auto max-w-3xl px-5 pb-16 pt-14">
        <Etiqueta>Legal</Etiqueta>
        <h1 className="entrada-club mt-4 text-4xl font-bold tracking-tight sm:text-5xl">{titulo}</h1>
        <p className="mt-4 text-suave">{bajada}</p>
        <p className="mt-2 text-sm text-suave">Última actualización: {ACTUALIZADO}.</p>
        <ol className="tarjeta-club quieta mt-10 space-y-8 rounded-[2rem] p-6 sm:p-10">
          {secciones.map((s, i) => (
            <li key={s.titulo}>
              <h2 className="text-lg font-bold">
                <span className="texto-jade tabular-nums">{i + 1}.</span> {s.titulo}
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
    </SitioClub>
  );
}
