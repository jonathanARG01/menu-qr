import { textoSobre } from "@/lib/utils";
import { CartaVacia, Etiquetas, Logo, precio, idSeccion, type PropsTema } from "./comun";
import { Agregar } from "./Agregar";
import { FotoCuadro } from "./cafe";
import { Destacados } from "./Destacados";
import { useCarta } from "./contexto";
import { NavCategorias } from "./NavCategorias";
import { SelectorIdioma } from "./SelectorIdioma";

const PAPEL = "#f5ead6";
const TINTA = "#3b2418";
// Colores de las cintas de pincel de cada categoría (la primera usa el acento).
const CINTAS = ["#4f6b3a", "#41607a", "#8a4b2f", "#6b5a3a"];
const PINCEL = "polygon(1% 14%, 30% 4%, 70% 9%, 99% 0, 100% 78%, 97% 100%, 60% 92%, 22% 100%, 2% 90%, 0 52%)";

// Pizarra de papel dibujada a mano: marco fino, cintas de pincel y líneas punteadas, con ilustraciones de cada bebida.
export function TemaLibreta({ restaurante, secciones, vistaPrevia, pie }: PropsTema) {
  const acento = restaurante.color_primario;
  const { t } = useCarta();

  return (
    <div
      className={`f-montserrat px-3 pb-28 pt-3 ${vistaPrevia ? "" : "min-h-screen"}`}
      style={
        {
          color: TINTA,
          backgroundColor: PAPEL,
          backgroundImage:
            "radial-gradient(rgba(120,80,40,0.07) 1px, transparent 1px), radial-gradient(80% 50% at 50% 0%, rgba(255,255,255,0.5), transparent)",
          backgroundSize: "7px 7px, auto",
          "--acento": acento,
          "--sobre-acento": textoSobre(acento),
          "--nav-bg": "rgba(245,234,214,0.95)",
          "--chip-bg": "transparent",
          "--chip-text": TINTA,
          "--chip-activo-bg": TINTA,
          "--chip-activo-text": PAPEL,
          "--pie-bg": TINTA,
          "--pie-text": PAPEL,
        } as React.CSSProperties
      }
    >
      <div className="mx-auto max-w-3xl border-2 p-1" style={{ borderColor: `${TINTA}99` }}>
        <div className="border pb-8" style={{ borderColor: `${TINTA}55` }}>
          <header className="relative px-6 pb-6 pt-10 text-center">
            <SelectorIdioma className="absolute right-3 top-3" style={{ background: TINTA, color: PAPEL }} />
            <Logo restaurante={restaurante} className="mx-auto mb-2 h-16 w-16 rounded-full object-cover" />
            <h1 className="f-kaushan text-5xl leading-tight @md:text-6xl">{restaurante.nombre}</h1>
            <p className="mt-2 flex items-center justify-center gap-3 text-xs font-semibold uppercase tracking-[0.45em]">
              <span aria-hidden>❦</span>
              {t("carta")}
              <span aria-hidden className="-scale-x-100">
                ❦
              </span>
            </p>
            {restaurante.descripcion && <p className="mx-auto mt-3 max-w-sm text-sm opacity-75">{restaurante.descripcion}</p>}
          </header>

          {secciones.length > 0 && (
            <NavCategorias categorias={secciones} claseChip="f-oswald border border-current/30 uppercase tracking-wide" />
          )}

          <main className="px-4 @md:px-6">
            {secciones.length === 0 && <CartaVacia />}
            <Destacados
              restaurante={restaurante}
              secciones={secciones}
              className="pt-6"
              claseTitulo="f-kaushan text-3xl"
              style={{ "--dest-bg": "#fbf4e6", "--dest-text": TINTA } as React.CSSProperties}
            />
            {secciones.map((seccion, i) => {
              const cinta = i === 0 ? acento : CINTAS[(i - 1) % CINTAS.length];
              return (
                <section key={seccion.id} id={idSeccion(seccion.id)} className="scroll-mt-16 pt-9">
                  <h2
                    className="f-oswald mb-3 inline-block px-6 py-1.5 text-lg font-semibold uppercase tracking-[0.12em]"
                    style={{ background: cinta, color: textoSobre(cinta), clipPath: PINCEL }}
                  >
                    {seccion.nombre}
                  </h2>
                  <ul className="grid gap-x-8 @md:grid-cols-2">
                    {seccion.platos.map((plato) => (
                      <li key={plato.id} className="flex gap-3 border-b border-dashed py-3" style={{ borderColor: `${TINTA}40` }}>
                        <FotoCuadro plato={plato} className="h-14 w-14 shrink-0 rounded-full text-3xl" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <h3 className="f-cormorant text-xl font-semibold leading-tight">{plato.nombre}</h3>
                            <span className="shrink-0 font-semibold tabular-nums">{precio(plato, restaurante)}</span>
                          </div>
                          {plato.descripcion && <p className="mt-0.5 text-[12px] leading-snug opacity-75">{plato.descripcion}</p>}
                          <div className="mt-1 flex items-center justify-between gap-3">
                            <Etiquetas plato={plato} className="opacity-70" />
                            <Agregar plato={plato} className="ml-auto" />
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
            <p className="f-kaushan mt-10 text-center text-xl opacity-70" aria-hidden>
              ☕ ♥ ☕
            </p>
          </main>
        </div>
      </div>
      {pie}
    </div>
  );
}
