import { textoSobre } from "@/lib/utils";
import { CartaVacia, Etiquetas, FotoRedonda, Logo, precio, idSeccion, type PropsTema } from "./comun";
import { Agregar } from "./Agregar";
import { Destacados } from "./Destacados";
import { NavCategorias } from "./NavCategorias";
import { SelectorIdioma } from "./SelectorIdioma";

// Vetas de madera hechas solo con degradados.
const MADERA =
  "repeating-linear-gradient(92deg, rgba(0,0,0,0.08) 0 2px, transparent 2px 18px), repeating-linear-gradient(88deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 40px), linear-gradient(180deg, #7a4f2c, #5e3b20 60%, #4d301a)";

// Mesa de madera con los platos en cuadrícula y el nombre en blanco debajo de cada uno.
export function TemaMadera({ restaurante, secciones, vistaPrevia, pie }: PropsTema) {
  const acento = restaurante.color_primario;
  const sombra = "0 2px 6px rgba(0,0,0,0.6)";

  return (
    <div
      className={`f-montserrat pb-28 text-white ${vistaPrevia ? "" : "min-h-screen"}`}
      style={
        {
          backgroundColor: "#6b4423",
          backgroundImage: MADERA,
          "--acento": acento,
          "--sobre-acento": textoSobre(acento),
          "--nav-bg": "rgba(77,48,26,0.92)",
          "--chip-bg": "rgba(255,255,255,0.12)",
          "--chip-text": "#ffffff",
          "--chip-activo-bg": acento,
          "--chip-activo-text": textoSobre(acento),
          "--pie-bg": "#3b2414",
          "--pie-text": "#ffffff",
        } as React.CSSProperties
      }
    >
      <header className="relative px-6 pb-8 pt-12 text-center">
        <SelectorIdioma className="absolute right-4 top-4" style={{ background: "rgba(0,0,0,0.35)" }} />
        <Logo restaurante={restaurante} className="mx-auto mb-3 h-16 w-16 rounded-full object-cover shadow-lg" />
        <h1 className="text-4xl font-semibold @md:text-5xl" style={{ textShadow: sombra }}>
          {restaurante.nombre}
        </h1>
        {restaurante.descripcion && (
          <p className="mx-auto mt-2 max-w-sm text-sm text-white/85" style={{ textShadow: sombra }}>
            {restaurante.descripcion}
          </p>
        )}
      </header>

      {secciones.length > 0 && <NavCategorias categorias={secciones} claseChip="font-semibold" />}

      <main className="mx-auto max-w-3xl px-4">
        {secciones.length === 0 && <CartaVacia />}
        <Destacados
          restaurante={restaurante}
          secciones={secciones}
          className="pt-6"
          claseTitulo="text-2xl font-semibold [text-shadow:0_2px_6px_rgba(0,0,0,0.6)]"
          style={{ "--dest-bg": "rgba(40,24,12,0.75)" } as React.CSSProperties}
        />
        {secciones.map((seccion) => (
          <section key={seccion.id} id={idSeccion(seccion.id)} className="scroll-mt-16 pt-8">
            <h2 className="mb-5 text-center text-2xl font-semibold" style={{ textShadow: sombra }}>
              {seccion.nombre}
            </h2>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-8 @md:grid-cols-3">
              {seccion.platos.map((plato) => (
                <li key={plato.id} className="flex flex-col items-center text-center">
                  <FotoRedonda
                    plato={plato}
                    className="w-36 text-7xl"
                    style={{
                      background: "radial-gradient(circle, #f6d58b 50%, #d99a4e 72%, #b8743a)",
                      boxShadow: "0 16px 26px rgba(0,0,0,0.45)",
                    }}
                  />
                  <h3 className="mt-3 text-lg font-semibold leading-tight" style={{ textShadow: sombra }}>
                    {plato.nombre}
                  </h3>
                  {plato.descripcion && (
                    <p className="mt-1 text-[12px] leading-snug text-white/80" style={{ textShadow: sombra }}>
                      {plato.descripcion}
                    </p>
                  )}
                  <span
                    className="mt-2 rounded-full px-3 py-0.5 font-bold tabular-nums"
                    style={{ background: acento, color: textoSobre(acento) }}
                  >
                    {precio(plato, restaurante)}
                  </span>
                  <Etiquetas plato={plato} className="mt-1 justify-center text-white/75" />
                  <Agregar plato={plato} className="mt-2" />
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
