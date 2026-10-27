import { textoSobre } from "@/lib/utils";
import { CartaVacia, Etiquetas, FotoRedonda, Logo, precio, idSeccion, type PropsTema } from "./comun";
import { Agregar } from "./Agregar";
import { Destacados } from "./Destacados";
import { NavCategorias } from "./NavCategorias";
import { SelectorIdioma } from "./SelectorIdioma";

const FONDO = "#1b231d";

// Título entre corchetes de color, como en las tiendas online.
function Corchetes({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="relative inline-block px-4 py-1">
      <span
        aria-hidden
        className="absolute bottom-0 left-0 h-3/4 w-4 rounded-bl-lg border-b-2 border-l-2"
        style={{ borderColor: color }}
      />
      <span
        aria-hidden
        className="absolute right-0 top-0 h-3/4 w-4 rounded-tr-lg border-r-2 border-t-2"
        style={{ borderColor: color }}
      />
      {children}
    </span>
  );
}

// Fondo verde casi negro y productos en tarjetas de vidrio, con la foto saliendo por arriba.
export function TemaVitrina({ restaurante, secciones, vistaPrevia, pie }: PropsTema) {
  const acento = restaurante.color_primario;

  return (
    <div
      className={`f-montserrat pb-28 text-white ${vistaPrevia ? "" : "min-h-screen"}`}
      style={
        {
          backgroundColor: FONDO,
          backgroundImage: "radial-gradient(ellipse at 50% -10%, rgba(120,170,110,0.25), transparent 60%)",
          "--acento": acento,
          "--sobre-acento": textoSobre(acento),
          "--nav-bg": "rgba(27,35,29,0.9)",
          "--chip-bg": "rgba(255,255,255,0.06)",
          "--chip-text": "#e8efe6",
          "--chip-activo-bg": acento,
          "--chip-activo-text": textoSobre(acento),
          "--pie-bg": "#242e27",
          "--pie-text": "#ffffff",
        } as React.CSSProperties
      }
    >
      <header className="relative px-6 pb-8 pt-12 text-center">
        <SelectorIdioma className="absolute right-4 top-4" style={{ background: "rgba(255,255,255,0.1)" }} />
        <Logo restaurante={restaurante} className="mx-auto mb-4 h-16 w-16 rounded-full object-cover" />
        <h1 className="f-playfair text-4xl font-semibold @md:text-5xl">
          <Corchetes color={acento}>{restaurante.nombre}</Corchetes>
        </h1>
        {restaurante.descripcion && <p className="mx-auto mt-3 max-w-sm text-sm text-white/65">{restaurante.descripcion}</p>}
      </header>

      {secciones.length > 0 && <NavCategorias categorias={secciones} />}

      <main className="mx-auto max-w-3xl px-4">
        {secciones.length === 0 && <CartaVacia />}
        <Destacados
          restaurante={restaurante}
          secciones={secciones}
          className="pt-6"
          claseTitulo="f-playfair text-2xl font-semibold"
          claseNombre="f-playfair text-lg"
          style={{ "--dest-bg": "rgba(255,255,255,0.06)" } as React.CSSProperties}
        />
        {secciones.map((seccion) => (
          <section key={seccion.id} id={idSeccion(seccion.id)} className="scroll-mt-16 pt-10">
            <h2 className="f-playfair mb-2 text-center text-2xl font-semibold">
              <Corchetes color={acento}>{seccion.nombre}</Corchetes>
            </h2>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-4 @md:grid-cols-3">
              {seccion.platos.map((plato) => (
                <li key={plato.id} className="flex flex-col pt-14">
                  <div
                    className="relative flex flex-1 flex-col rounded-[1.75rem] border border-white/15 px-3 pb-3 pt-16 text-center backdrop-blur"
                    style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))" }}
                  >
                    <FotoRedonda
                      plato={plato}
                      className="absolute left-1/2 top-0 w-28 -translate-x-1/2 -translate-y-1/2 text-6xl drop-shadow-[0_14px_18px_rgba(0,0,0,0.5)]"
                    />
                    <h3 className="f-playfair text-lg leading-tight">{plato.nombre}</h3>
                    {plato.descripcion && <p className="mt-1 text-[11px] leading-snug text-white/55">{plato.descripcion}</p>}
                    <Etiquetas plato={plato} className="mt-1 justify-center text-white/55" />
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
                      <span className="font-medium tabular-nums">{precio(plato, restaurante)}</span>
                      <Agregar plato={plato} className="h-7 px-2.5 text-xs" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
      {pie}
    </div>
  );
}
