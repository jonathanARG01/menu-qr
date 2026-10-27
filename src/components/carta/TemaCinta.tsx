import { textoSobre } from "@/lib/utils";
import { CartaVacia, Etiquetas, FotoRedonda, Logo, precio, idSeccion, type PropsTema } from "./comun";
import { Agregar } from "./Agregar";
import { Destacados } from "./Destacados";
import { useCarta } from "./contexto";
import { NavCategorias } from "./NavCategorias";
import { SelectorIdioma } from "./SelectorIdioma";

const PAPEL = "#efe6d3";
const VERDE = "#1f5c3a";
const TINTA = "#2b2418";

// Papel claro, cada plato con una cinta verde para el nombre y una etiqueta roja para el precio.
export function TemaCinta({ restaurante, secciones, vistaPrevia, pie }: PropsTema) {
  const rojo = restaurante.color_primario;
  const { t } = useCarta();

  return (
    <div
      className={`f-montserrat overflow-hidden pb-28 ${vistaPrevia ? "" : "min-h-screen"}`}
      style={
        {
          color: TINTA,
          backgroundColor: PAPEL,
          backgroundImage:
            "radial-gradient(circle at 15% 0%, rgba(255,255,255,0.7), transparent 40%), radial-gradient(rgba(120,90,40,0.06) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 5px 5px",
          "--acento": rojo,
          "--sobre-acento": textoSobre(rojo),
          "--nav-bg": "rgba(239,230,211,0.94)",
          "--chip-bg": "rgba(31,92,58,0.1)",
          "--chip-text": VERDE,
          "--chip-activo-bg": VERDE,
          "--chip-activo-text": "#ffffff",
          "--pie-bg": VERDE,
          "--pie-text": "#ffffff",
        } as React.CSSProperties
      }
    >
      <header className="relative px-6 pb-8 pt-12 text-center">
        <SelectorIdioma className="absolute right-4 top-4" style={{ background: VERDE }} />
        <Logo restaurante={restaurante} className="mx-auto mb-4 h-16 w-16 rounded-full object-cover" />
        <h1 className="inline-flex max-w-full items-stretch text-3xl font-extrabold italic leading-tight shadow-xl @md:text-4xl">
          <span className="flex items-center rounded-l-2xl px-4 py-2 text-white" style={{ background: rojo }}>
            {t("carta")}
          </span>
          <span
            className="flex items-center rounded-r-2xl px-4 py-2"
            style={{ background: `linear-gradient(135deg, ${VERDE}, #2c7a4b)`, color: "#ffd43b" }}
          >
            {restaurante.nombre}
          </span>
        </h1>
        {restaurante.descripcion && <p className="mx-auto mt-4 max-w-sm text-sm opacity-75">{restaurante.descripcion}</p>}
      </header>

      {secciones.length > 0 && <NavCategorias categorias={secciones} claseChip="font-bold" />}

      <main className="mx-auto max-w-3xl px-4">
        {secciones.length === 0 && <CartaVacia />}
        <Destacados
          restaurante={restaurante}
          secciones={secciones}
          className="pt-6"
          claseTitulo="text-2xl font-extrabold italic"
          style={{ "--dest-bg": "#ffffff", "--dest-text": TINTA } as React.CSSProperties}
        />
        {secciones.map((seccion) => (
          <section key={seccion.id} id={idSeccion(seccion.id)} className="scroll-mt-16 pt-8">
            <h2 className="mb-4 text-center text-2xl font-extrabold italic" style={{ color: VERDE }}>
              {seccion.nombre}
            </h2>
            <ul className="grid gap-x-6 gap-y-5 @md:grid-cols-2">
              {seccion.platos.map((plato) => (
                <li key={plato.id} className="flex items-start gap-3">
                  <FotoRedonda
                    plato={plato}
                    className="-ml-6 mt-3 w-28 shrink-0 text-6xl"
                    style={{ background: "#d9b98b", boxShadow: "0 0 0 5px #b07d48, 0 12px 24px rgba(80,50,10,0.35)" }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-stretch">
                      <h3
                        className="flex flex-1 items-center rounded-l-xl py-2 pl-4 pr-3 text-lg font-medium leading-tight text-white"
                        style={{ background: `linear-gradient(135deg, ${VERDE}, #2c7a4b)` }}
                      >
                        {plato.nombre}
                      </h3>
                      <span
                        className="-ml-1 flex shrink-0 items-center px-3 text-lg font-extrabold italic tabular-nums shadow-md"
                        style={{
                          background: rojo,
                          color: textoSobre(rojo),
                          clipPath: "polygon(10% 0, 100% 0, 92% 100%, 0 100%)",
                        }}
                      >
                        {precio(plato, restaurante)}
                      </span>
                    </div>
                    {plato.descripcion && (
                      <p className="mt-2 text-[13px] font-medium italic leading-snug opacity-80">{plato.descripcion}</p>
                    )}
                    <div className="mt-1.5 flex items-center justify-between gap-3">
                      <Etiquetas plato={plato} className="opacity-70" />
                      <Agregar plato={plato} className="ml-auto" />
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
