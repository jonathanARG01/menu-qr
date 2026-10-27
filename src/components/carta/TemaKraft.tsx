import { textoSobre } from "@/lib/utils";
import { CartaVacia, Etiquetas, FotoRedonda, Logo, precio, idSeccion, type PropsTema } from "./comun";
import { Agregar } from "./Agregar";
import { Destacados } from "./Destacados";
import { useCarta } from "./contexto";
import { NavCategorias } from "./NavCategorias";
import { SelectorIdioma } from "./SelectorIdioma";

const PAPEL = "#f4ede1";
const TINTA = "#2b2b2b";
const CARTON = "#e8d3b0";

// Papel crema, cada producto sobre una tabla de madera y con su etiqueta de cartón.
export function TemaKraft({ restaurante, secciones, vistaPrevia, pie }: PropsTema) {
  const acento = restaurante.color_primario;
  const { t } = useCarta();

  return (
    <div
      className={`f-montserrat pb-28 ${vistaPrevia ? "" : "min-h-screen"}`}
      style={
        {
          color: TINTA,
          backgroundColor: PAPEL,
          backgroundImage: "radial-gradient(rgba(150,110,60,0.08) 1px, transparent 1px)",
          backgroundSize: "6px 6px",
          "--acento": acento,
          "--sobre-acento": textoSobre(acento),
          "--nav-bg": "rgba(244,237,225,0.94)",
          "--chip-bg": CARTON,
          "--chip-text": TINTA,
          "--chip-activo-bg": TINTA,
          "--chip-activo-text": "#ffffff",
          "--pie-bg": TINTA,
          "--pie-text": "#ffffff",
        } as React.CSSProperties
      }
    >
      <header className="relative px-6 pb-8 pt-12 text-center">
        <SelectorIdioma className="absolute right-4 top-4" style={{ background: TINTA }} />
        <Logo restaurante={restaurante} className="mx-auto mb-3 h-16 w-16 rounded-full object-cover" />
        <h1 className="f-oswald text-5xl font-semibold uppercase leading-none tracking-[0.12em] @md:text-6xl">
          {restaurante.nombre}
        </h1>
        <p className="f-caveat mt-1 flex items-center justify-center gap-3 text-3xl">
          <span className="h-0.5 w-8 bg-current opacity-60" />
          {t("carta")}
          <span className="h-0.5 w-8 bg-current opacity-60" />
        </p>
        {restaurante.descripcion && <p className="mx-auto mt-2 max-w-sm text-sm opacity-70">{restaurante.descripcion}</p>}
      </header>

      {secciones.length > 0 && <NavCategorias categorias={secciones} claseChip="f-oswald uppercase tracking-wide" />}

      <main className="mx-auto max-w-3xl px-4">
        {secciones.length === 0 && <CartaVacia />}
        <Destacados
          restaurante={restaurante}
          secciones={secciones}
          className="pt-6"
          claseTitulo="f-oswald text-2xl font-semibold uppercase tracking-wide"
          claseNombre="f-oswald text-lg font-medium uppercase"
          style={{ "--dest-bg": "#fffaf1", "--dest-text": TINTA } as React.CSSProperties}
        />
        {secciones.map((seccion) => (
          <section key={seccion.id} id={idSeccion(seccion.id)} className="scroll-mt-16 pt-8">
            <h2 className="f-caveat mb-4 text-center text-4xl">{seccion.nombre}</h2>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-8 @md:grid-cols-3">
              {seccion.platos.map((plato, i) => (
                <li key={plato.id} className="flex flex-col items-center text-center">
                  <FotoRedonda
                    plato={plato}
                    className="w-32 text-6xl"
                    style={{
                      background:
                        i % 2 ? "radial-gradient(circle, #6b4a32 55%, #4e3424)" : "radial-gradient(circle, #c99a66 55%, #a8784a)",
                      boxShadow: "0 10px 18px rgba(60,40,20,0.3)",
                    }}
                  />
                  <h3
                    className={`f-oswald mt-3 px-3 py-1 text-base font-medium uppercase tracking-wide shadow-sm ${i % 2 ? "rotate-1" : "-rotate-1"}`}
                    style={{ background: CARTON }}
                  >
                    {plato.nombre}
                  </h3>
                  {plato.descripcion && <p className="mt-1.5 text-[11px] leading-snug opacity-70">{plato.descripcion}</p>}
                  <span className="f-oswald mt-1 text-lg font-semibold tabular-nums" style={{ color: acento }}>
                    {precio(plato, restaurante)}
                  </span>
                  <Etiquetas plato={plato} className="justify-center opacity-70" />
                  <Agregar plato={plato} className="mt-1.5" />
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
