import { textoSobre } from "@/lib/utils";
import { CartaVacia, Etiquetas, FotoRedonda, Logo, precio, idSeccion, type PropsTema } from "./comun";
import { Agregar } from "./Agregar";
import { Destacados } from "./Destacados";
import { NavCategorias } from "./NavCategorias";
import { SelectorIdioma } from "./SelectorIdioma";

const FONDO = "#14291b";
const VERDE_CHECK = "#3fa34d";

function Check() {
  return (
    <span
      aria-hidden
      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
      style={{ background: VERDE_CHECK }}
    >
      ✓
    </span>
  );
}

// Pizarra verde oscura con marco dorado doble, títulos en letra caligráfica y precios con puntos guía.
export function TemaVeggie({ restaurante, secciones, vistaPrevia, pie }: PropsTema) {
  const oro = restaurante.color_primario;

  return (
    <div
      className={`f-montserrat px-3 pb-28 pt-3 text-white ${vistaPrevia ? "" : "min-h-screen"}`}
      style={
        {
          backgroundColor: FONDO,
          backgroundImage:
            "radial-gradient(ellipse at top, rgba(80,130,70,0.35), transparent 60%), radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 5px 5px",
          "--acento": oro,
          "--sobre-acento": textoSobre(oro),
          "--nav-bg": "rgba(20,41,27,0.94)",
          "--chip-bg": "transparent",
          "--chip-text": oro,
          "--chip-activo-bg": oro,
          "--chip-activo-text": textoSobre(oro),
          "--pie-bg": "#0f2015",
          "--pie-text": "#f7ecd2",
        } as React.CSSProperties
      }
    >
      <div className="mx-auto max-w-2xl rounded-2xl p-1.5" style={{ border: `1.5px solid ${oro}` }}>
        <div className="rounded-xl pb-8" style={{ border: `1px solid ${oro}80` }}>
          <header className="relative px-6 pb-6 pt-10 text-center">
            <SelectorIdioma className="absolute right-3 top-3" style={{ background: "rgba(0,0,0,0.3)", color: oro }} />
            <Logo restaurante={restaurante} className="mx-auto mb-3 h-16 w-16 rounded-full object-cover" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-white/80">Menú</p>
            <span className="mx-auto mt-2 flex w-40 items-center gap-2">
              <span className="h-px flex-1" style={{ background: oro }} />
              <Check />
              <span className="h-px flex-1" style={{ background: oro }} />
            </span>
            <h1 className="f-vibes mt-2 text-6xl leading-tight @md:text-7xl" style={{ color: oro }}>
              {restaurante.nombre}
            </h1>
            {restaurante.descripcion && <p className="mx-auto mt-1 max-w-sm text-sm text-white/70">{restaurante.descripcion}</p>}
          </header>

          {secciones.length > 0 && (
            <div className="mx-1">
              <NavCategorias categorias={secciones} claseChip="border border-current/40 font-medium" />
            </div>
          )}

          <main className="px-5">
            {secciones.length === 0 && <CartaVacia />}
            <Destacados
              restaurante={restaurante}
              secciones={secciones}
              className="pt-6"
              claseTitulo="f-vibes text-4xl font-normal"
              style={{ "--dest-bg": "rgba(0,0,0,0.3)" } as React.CSSProperties}
            />
            {secciones.map((seccion) => (
              <section key={seccion.id} id={idSeccion(seccion.id)} className="scroll-mt-16 pt-8">
                <h2 className="mb-4 flex items-center justify-center gap-3" style={{ color: oro }}>
                  <span className="text-xs">✦</span>
                  <span className="h-px w-8" style={{ background: oro }} />
                  <span className="f-vibes text-4xl leading-none">{seccion.nombre}</span>
                  <span className="h-px w-8" style={{ background: oro }} />
                  <span className="text-xs">✦</span>
                </h2>
                <ul className="space-y-4">
                  {seccion.platos.map((plato) => (
                    <li key={plato.id} className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <Check />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <h3 className="font-semibold leading-tight">{plato.nombre}</h3>
                              <span
                                className="mb-1 min-w-4 flex-1 border-b-2 border-dotted"
                                style={{ borderColor: `${oro}66` }}
                              />
                              <span className="shrink-0 font-semibold tabular-nums" style={{ color: oro }}>
                                {precio(plato, restaurante)}
                              </span>
                            </div>
                            {plato.descripcion && (
                              <p className="text-xs italic leading-snug text-white/65">{plato.descripcion}</p>
                            )}
                            <div className="flex items-center justify-between gap-3">
                              <Etiquetas plato={plato} className="mt-1 text-white/60" />
                              <Agregar plato={plato} className="ml-auto mt-1.5" />
                            </div>
                          </div>
                        </div>
                      </div>
                      <FotoRedonda
                        plato={plato}
                        className="w-16 shrink-0 bg-black/25 text-3xl shadow-[0_8px_20px_rgba(0,0,0,0.5)] @md:w-20 @md:text-4xl"
                        style={{ outline: `2px solid ${oro}`, outlineOffset: "2px" }}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </main>
        </div>
      </div>
      {pie}
    </div>
  );
}
