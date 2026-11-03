"use client";

import { Icono } from "@/components/Icono";
import { useToast } from "@/components/Toast";
import { useUrlSitio } from "@/lib/useUrlSitio";
import { TUTORIALES, urlTutorial } from "@/lib/tutoriales";

// Enlaces a la capacitación de cada rol, para abrirlos o mandárselos a cada persona del equipo.
export function TutorialesEquipo() {
  const sitio = useUrlSitio();
  const avisar = useToast();

  const copiar = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      avisar("Enlace copiado");
    } catch {
      avisar(url);
    }
  };

  return (
    <section id="tutoriales" className="tarjeta scroll-mt-24 space-y-3 p-5">
      <div>
        <h2 className="flex items-center gap-2 font-semibold">
          <Icono nombre="tutorial" className="h-5 w-5 text-[#ff7a1a]" /> Tutoriales para tu equipo
        </h2>
        <p className="text-sm text-suave">
          Guías paso a paso con pantallazos del sistema. Mándale a cada persona el de su rol cuando la sumes.
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-3">
        {TUTORIALES.map((t) => {
          const url = `${sitio}${urlTutorial(t.id)}`;
          return (
            <li key={t.id} className="flex flex-col gap-2 rounded-xl border border-borde p-3">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Icono nombre={t.icono} className="h-4 w-4 text-[#ff7a1a]" /> {t.rol}
                <span className="ml-auto text-xs font-normal text-suave">{t.duracion}</span>
              </span>
              <span className="flex gap-2">
                <a href={urlTutorial(t.id)} target="_blank" rel="noopener" className="boton-secundario flex-1 px-3 py-1.5 text-center text-sm">
                  Ver
                </a>
                <button type="button" className="boton-secundario flex-1 px-3 py-1.5 text-sm" onClick={() => copiar(url)}>
                  Copiar enlace
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
