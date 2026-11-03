"use client";

import { Fragment, useEffect, useState } from "react";
import { Icono } from "@/components/Icono";
import { CAPTURAS } from "@/lib/tutoriales-capturas";
import { TUTORIALES, RUTA_TUTORIALES, type IdTutorial, type Imagen, type Paso } from "@/lib/tutoriales";

const dos = (n: number) => String(n).padStart(2, "0");

// Cajas para elegir el rol y, debajo, el tutorial de ese rol con sus pasos unidos por líneas.
export function Tutoriales({ inicial }: { inicial: IdTutorial | null }) {
  const [activo, setActivo] = useState<IdTutorial>(inicial ?? "administrador");
  const [ampliada, setAmpliada] = useState<Imagen | null>(null);
  const [visible, setVisible] = useState<string | null>(null);
  const tutorial = TUTORIALES.find((t) => t.id === activo)!;

  // Marca en la barra el paso que se está leyendo y lo deja a la vista dentro de la barra.
  useEffect(() => {
    const pasos = Array.from(document.querySelectorAll<HTMLElement>(".tut-paso"));
    const observador = new IntersectionObserver(
      (entradas) => {
        const arriba = entradas
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (arriba) setVisible(arriba.target.id);
      },
      { rootMargin: "-35% 0px -60% 0px" },
    );
    pasos.forEach((p) => observador.observe(p));
    return () => observador.disconnect();
  }, [activo]);

  useEffect(() => {
    if (!visible) return;
    const indice = document.getElementById("tut-indice");
    const chip = indice?.querySelector<HTMLElement>(`[data-ancla="${visible}"]`);
    if (indice && chip) indice.scrollTo({ left: chip.offsetLeft - indice.clientWidth / 2 + chip.clientWidth / 2, behavior: "smooth" });
  }, [visible]);

  // El rol elegido queda en la dirección, para compartir el enlace de un tutorial puntual.
  const elegir = (id: IdTutorial) => {
    setActivo(id);
    window.history.replaceState(null, "", `${RUTA_TUTORIALES}?rol=${id}`);
    document.getElementById("tutorial")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (!inicial) return;
    // Viene desde el panel: baja directo al tutorial (o al paso del #ancla).
    const destino = document.getElementById(window.location.hash.slice(1)) ?? document.getElementById("tutorial");
    destino?.scrollIntoView({ block: "start" });
  }, [inicial]);

  useEffect(() => {
    if (!ampliada) return;
    const cerrar = (e: KeyboardEvent) => e.key === "Escape" && setAmpliada(null);
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, [ampliada]);

  return (
    <>
      <section className="tut-roles" role="tablist" aria-label="Elige tu rol">
        {TUTORIALES.map((t, i) => (
          <Fragment key={t.id}>
            {i > 0 && <span className="tut-roles-union" aria-hidden />}
            <button
              type="button"
              role="tab"
              aria-selected={t.id === activo}
              aria-controls="tutorial"
              onClick={() => elegir(t.id)}
              className="tut-rol"
            >
              <span className="tut-rol-num">{dos(i + 1)}</span>
              <span className="tut-rol-etiqueta">{t.rol}</span>
              <span className="tut-rol-guia" aria-hidden />
              <span className="tut-rol-caja">
                <span className="tut-rol-icono">
                  <Icono nombre={t.icono} className="h-9 w-9" />
                </span>
                <span className="tut-rol-titulo">{t.titulo}</span>
                <span className="tut-rol-bajada">{t.bajada}</span>
                <span className="tut-rol-lista">
                  {t.puntos.map((p) => (
                    <span key={p}>
                      <Icono nombre="check" className="h-4 w-4" /> {p}
                    </span>
                  ))}
                </span>
                <span className="tut-rol-pie">
                  {t.pasos.length} pasos · {t.duracion}
                </span>
              </span>
            </button>
          </Fragment>
        ))}
      </section>

      <section id="tutorial" className="tut-tutorial" role="tabpanel" aria-label={`Tutorial ${tutorial.rol}`}>
        <div className="tut-tutorial-cabeza">
          <p className="tut-eyebrow">Tutorial · {tutorial.rol}</p>
          <h2>{tutorial.titulo}</h2>
          <p>{tutorial.bajada}</p>
        </div>

        {/* Barra fija al bajar: cambiar de rol o saltar a cualquier paso */}
        <nav className="tut-barra" aria-label="Pasos del tutorial">
          <div className="tut-barra-roles">
            {TUTORIALES.map((t) => (
              <button key={t.id} type="button" aria-pressed={t.id === activo} onClick={() => elegir(t.id)}>
                <Icono nombre={t.icono} className="h-4 w-4" />
                <span>{t.rol}</span>
              </button>
            ))}
          </div>
          <ol className="tut-indice" id="tut-indice">
            {tutorial.pasos.map((p, i) => {
              const ancla = `${tutorial.id}-${p.id}`;
              return (
                <li key={p.id}>
                  <a href={`#${ancla}`} data-ancla={ancla} aria-current={visible === ancla ? "step" : undefined}>
                    <span>{dos(i + 1)}</span> {p.titulo}
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="tut-pasos">
          {tutorial.pasos.map((p, i) => (
            <Fragment key={`${tutorial.id}-${p.id}`}>
              {i > 0 && <span className={`tut-conector ${i % 2 ? "tut-conector--der" : "tut-conector--izq"}`} aria-hidden><i /><i /></span>}
              <PasoTutorial paso={p} numero={i + 1} lado={i % 2 ? "der" : "izq"} id={`${tutorial.id}-${p.id}`} ampliar={setAmpliada} />
            </Fragment>
          ))}
        </div>

        <div className="tut-fin">
          <span className="tut-fin-check">
            <Icono nombre="check" className="h-6 w-6" />
          </span>
          <div>
            <p className="tut-fin-titulo">¡Listo! Ya sabes usar Platovi como {tutorial.rol.toLowerCase()}.</p>
            <p>Practica con una mesa de prueba antes del primer servicio y vuelve a esta página cuando lo necesites.</p>
          </div>
          {TUTORIALES.filter((t) => t.id !== activo).map((t) => (
            <button key={t.id} type="button" className="tut-fin-otro" onClick={() => elegir(t.id)}>
              Ver tutorial de {t.rol}
            </button>
          ))}
        </div>
      </section>

      {ampliada && (
        <div className="tut-zoom" role="dialog" aria-modal="true" aria-label={ampliada.alt} onClick={() => setAmpliada(null)}>
          <button type="button" className="tut-zoom-cerrar" aria-label="Cerrar">
            <Icono nombre="cerrar" className="h-6 w-6" />
          </button>
          <div className="tut-zoom-marco" onClick={(e) => e.stopPropagation()}>
            <Captura imagen={ampliada} />
          </div>
        </div>
      )}
    </>
  );
}

function PasoTutorial({
  paso,
  numero,
  lado,
  id,
  ampliar,
}: {
  paso: Paso;
  numero: number;
  lado: "izq" | "der";
  id: string;
  ampliar: (i: Imagen) => void;
}) {
  return (
    <article id={id} className={`tut-paso tut-paso--${lado}`}>
      <span className="tut-paso-nodo" aria-hidden />
      <header className="tut-paso-cabeza">
        <p className="tut-paso-num">Paso {dos(numero)}</p>
        <h3>{paso.titulo}</h3>
        <span className="tut-paso-raya" aria-hidden />
        <p className="tut-paso-resumen">{paso.resumen}</p>
      </header>

      {paso.imagenes.map((img) => (
        <figure key={img.src} className="tut-figura">
          <button type="button" className="tut-figura-boton" onClick={() => ampliar(img)} aria-label={`Ampliar: ${img.alt}`}>
            <Captura imagen={img} />
          </button>
          {img.pie && <figcaption>{img.pie}</figcaption>}
          {img.marcas && (
            <ol className="tut-leyenda">
              {Object.entries(img.marcas).map(([n, texto]) => (
                <li key={n}>
                  <span className="tut-marca-num">{n}</span>
                  <span>{texto}</span>
                </li>
              ))}
            </ol>
          )}
        </figure>
      ))}

      {paso.pasos && (
        <div className="tut-instrucciones">
          <p>Cómo hacerlo</p>
          <ol>
            {paso.pasos.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        </div>
      )}

      {paso.consejo && (
        <aside className="tut-consejo">
          <Icono nombre="rayo" className="h-5 w-5 shrink-0" />
          <p>
            <strong>Consejo:</strong> {paso.consejo}
          </p>
        </aside>
      )}
    </article>
  );
}

// Pantallazo real en un marco de ventana (o de celular) con las marcas numeradas encima.
function Captura({ imagen }: { imagen: Imagen }) {
  const datos = CAPTURAS[imagen.src];
  const movil = datos && datos.h > datos.w;
  const conTexto = new Set(Object.keys(imagen.marcas ?? {}).map(Number));
  return (
    <span className={`tut-ventana ${movil ? "tut-ventana--movil" : ""}`}>
      {!movil && (
        <span className="tut-ventana-barra" aria-hidden>
          <i />
          <i />
          <i />
          <span>{imagen.src === "login" ? "platovi.cl/login" : "platovi.cl/panel"}</span>
        </span>
      )}
      <span className="tut-ventana-imagen">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/tutoriales/${imagen.src}.webp`} alt={imagen.alt} width={datos?.w} height={datos?.h} loading="lazy" decoding="async" />
        {datos?.marcas
          .filter(([n]) => conTexto.has(n))
          .map(([n, x, y, w, h]) => (
            <span
              key={n}
              className="tut-marca"
              style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }}
              aria-hidden
            >
              <span className="tut-marca-num">{n}</span>
            </span>
          ))}
      </span>
    </span>
  );
}
