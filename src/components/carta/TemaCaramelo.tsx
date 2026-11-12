import { textoSobre } from "@/lib/utils";
import { CartaVacia, Etiquetas, Logo, precio, idSeccion, type PropsTema } from "./comun";
import { Agregar } from "./Agregar";
import { FotoCuadro } from "./cafe";
import { Destacados } from "./Destacados";
import { useCarta } from "./contexto";
import { NavCategorias } from "./NavCategorias";
import { SelectorIdioma } from "./SelectorIdioma";

const CREMA = "#fbf1df";
const CHOCOLATE = "#6b3f22";
const TINTA = "#2d1a10";

// Crema y chocolate con una curva grande arriba, tarjetas blancas y botones caramelo.
export function TemaCaramelo({ restaurante, secciones, vistaPrevia, pie }: PropsTema) {
  const acento = restaurante.color_primario;
  const { t } = useCarta();

  return (
    <div
      className={`f-montserrat pb-28 ${vistaPrevia ? "" : "min-h-screen"}`}
      style={
        {
          color: TINTA,
          backgroundColor: CREMA,
          "--acento": acento,
          "--sobre-acento": textoSobre(acento),
          "--nav-bg": "rgba(251,241,223,0.94)",
          "--chip-bg": "#f3dfbd",
          "--chip-text": TINTA,
          "--chip-activo-bg": CHOCOLATE,
          "--chip-activo-text": "#ffffff",
          "--pie-bg": CHOCOLATE,
          "--pie-text": "#ffffff",
        } as React.CSSProperties
      }
    >
      <header className="relative rounded-br-[5rem] px-6 pb-12 pt-8 text-[#fbf1df] shadow-xl" style={{ background: CHOCOLATE }}>
        <div className="flex items-center gap-3">
          <Logo restaurante={restaurante} className="h-11 w-11 rounded-full object-cover ring-2 ring-white/40" />
          <SelectorIdioma className="ml-auto" style={{ background: "rgba(255,255,255,0.15)" }} />
        </div>
        <h1 className="f-playfair mt-6 max-w-sm text-4xl font-bold leading-[1.1] @md:text-5xl">{restaurante.nombre}</h1>
        {restaurante.descripcion && <p className="mt-3 max-w-sm text-sm text-white/80">{restaurante.descripcion}</p>}
        <div className="mt-6 flex gap-2">
          <span className="rounded-full bg-[#fbf1df] px-5 py-2 text-sm font-semibold" style={{ color: TINTA }}>
            {t("carta")}
          </span>
          <span
            className="rounded-full px-5 py-2 text-sm font-semibold"
            style={{ background: acento, color: textoSobre(acento) }}
          >
            ☕
          </span>
        </div>
      </header>

      {secciones.length > 0 && <NavCategorias categorias={secciones} claseChip="font-semibold" />}

      <main className="mx-auto max-w-3xl px-4">
        {secciones.length === 0 && <CartaVacia />}
        <Destacados
          restaurante={restaurante}
          secciones={secciones}
          className="pt-8"
          claseTitulo="f-playfair text-2xl font-bold"
          style={{ "--dest-bg": "#ffffff", "--dest-text": TINTA } as React.CSSProperties}
        />
        {secciones.map((seccion) => (
          <section key={seccion.id} id={idSeccion(seccion.id)} className="scroll-mt-16 pt-9">
            <h2 className="f-playfair mb-4 text-2xl font-bold">{seccion.nombre}</h2>
            <ul className="grid grid-cols-2 gap-3 @md:grid-cols-3">
              {seccion.platos.map((plato, i) => {
                const primero = i === 0;
                return (
                  <li
                    key={plato.id}
                    className="flex flex-col overflow-hidden rounded-3xl shadow-[0_12px_28px_-12px_rgba(107,63,34,0.35)]"
                    style={primero ? { background: CHOCOLATE, color: "#fbf1df" } : { background: "#ffffff" }}
                  >
                    <FotoCuadro
                      plato={plato}
                      className="aspect-[4/3] w-full text-6xl"
                      style={{ background: primero ? "#f6deb4" : "linear-gradient(160deg, #f8e7c8, #f1d4a3)" }}
                    />
                    <div className="flex flex-1 flex-col p-3">
                      <h3 className="text-[15px] font-semibold leading-tight">{plato.nombre}</h3>
                      {plato.descripcion && <p className="mt-1 text-[11px] leading-snug opacity-70">{plato.descripcion}</p>}
                      <Etiquetas plato={plato} className="mt-1 opacity-75" />
                      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                        <span
                          className="rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums"
                          style={
                            primero ? { background: "#fbf1df", color: TINTA } : { background: acento, color: textoSobre(acento) }
                          }
                        >
                          {precio(plato, restaurante)}
                        </span>
                        <Agregar plato={plato} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </main>
      {pie}
    </div>
  );
}
