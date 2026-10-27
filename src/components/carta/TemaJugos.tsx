import { textoSobre } from "@/lib/utils";
import { CartaVacia, Etiquetas, FotoRedonda, Logo, ingredientes, precio, idSeccion, type PropsTema } from "./comun";
import { Agregar } from "./Agregar";
import { Destacados } from "./Destacados";
import { NavCategorias } from "./NavCategorias";
import { SelectorIdioma } from "./SelectorIdioma";

const SELVA = "#0f2a17";
const ETIQUETAS = ["#4f8f2f", "#e8742a", "#e05a2a", "#c2402f", "#f08a24", "#7a2b3a"];

const brochazo = "polygon(1% 14%, 8% 4%, 50% 0, 95% 5%, 100% 30%, 98% 86%, 90% 98%, 40% 100%, 4% 94%, 0 60%)";

// Selva verde oscura, título en letra de pincel con la última palabra en color, y cada bebida con su etiqueta pintada.
export function TemaJugos({ restaurante, secciones, vistaPrevia, pie }: PropsTema) {
  const acento = restaurante.color_primario;
  const palabras = restaurante.nombre.trim().split(/\s+/);
  const ultima = palabras.length > 1 ? palabras.pop() : null;

  return (
    <div
      className={`f-montserrat pb-28 text-white ${vistaPrevia ? "" : "min-h-screen"}`}
      style={
        {
          backgroundColor: SELVA,
          backgroundImage:
            "radial-gradient(ellipse at 20% 0%, rgba(90,160,60,0.35), transparent 50%), radial-gradient(ellipse at 100% 40%, rgba(240,140,40,0.18), transparent 40%), linear-gradient(180deg, transparent 70%, #2a1a10 100%)",
          "--acento": acento,
          "--sobre-acento": textoSobre(acento),
          "--nav-bg": "rgba(15,42,23,0.94)",
          "--chip-bg": "rgba(255,255,255,0.08)",
          "--chip-text": "#ffffff",
          "--chip-activo-bg": acento,
          "--chip-activo-text": textoSobre(acento),
          "--pie-bg": "#16351f",
          "--pie-text": "#ffffff",
        } as React.CSSProperties
      }
    >
      <header className="relative px-6 pb-8 pt-12 text-center">
        <SelectorIdioma className="absolute right-4 top-4" style={{ background: "rgba(0,0,0,0.3)" }} />
        <Logo restaurante={restaurante} className="mx-auto mb-3 h-16 w-16 rounded-full object-cover" />
        <h1 className="f-kaushan text-6xl leading-none @md:text-7xl" style={{ textShadow: "0 4px 0 rgba(0,0,0,0.35)" }}>
          {palabras.join(" ")} {ultima && <span style={{ color: acento }}>{ultima}</span>}
        </h1>
        {restaurante.descripcion && (
          <p
            className="f-oswald mx-auto mt-5 inline-block max-w-xs px-6 py-3 text-xl font-semibold uppercase leading-tight tracking-wide"
            style={{ background: "#3f7a2a", clipPath: brochazo }}
          >
            {restaurante.descripcion}
          </p>
        )}
      </header>

      {secciones.length > 0 && <NavCategorias categorias={secciones} claseChip="f-oswald uppercase tracking-wide" />}

      <main className="mx-auto max-w-3xl px-4">
        {secciones.length === 0 && <CartaVacia />}
        <Destacados
          restaurante={restaurante}
          secciones={secciones}
          className="pt-6"
          claseTitulo="f-kaushan text-3xl"
          claseNombre="f-oswald text-lg font-semibold uppercase"
          style={{ "--dest-bg": "rgba(0,0,0,0.3)" } as React.CSSProperties}
        />
        {secciones.map((seccion) => (
          <section key={seccion.id} id={idSeccion(seccion.id)} className="scroll-mt-16 pt-8">
            <h2 className="f-kaushan mb-4 text-center text-3xl">{seccion.nombre}</h2>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-6 @md:grid-cols-3">
              {seccion.platos.map((plato, i) => {
                const color = ETIQUETAS[i % ETIQUETAS.length];
                return (
                  <li key={plato.id} className="flex flex-col items-center text-center">
                    <FotoRedonda
                      plato={plato}
                      className="w-28 text-6xl"
                      style={{ background: "rgba(255,255,255,0.07)", boxShadow: "0 14px 30px rgba(0,0,0,0.4)" }}
                    />
                    <h3
                      className="f-oswald -mt-3 px-4 py-1 text-lg font-semibold uppercase tracking-wide"
                      style={{ background: color, clipPath: brochazo }}
                    >
                      {plato.nombre}
                    </h3>
                    <ul className="mt-2 space-y-0.5 text-left">
                      {ingredientes(plato.descripcion).map((ing) => (
                        <li
                          key={ing}
                          className="f-oswald flex items-center gap-1.5 text-[13px] uppercase tracking-wide text-white/85"
                        >
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: "#f08a24" }} />
                          {ing}
                        </li>
                      ))}
                    </ul>
                    <span className="f-oswald mt-2 text-xl font-semibold tabular-nums" style={{ color: acento }}>
                      {precio(plato, restaurante)}
                    </span>
                    <Etiquetas plato={plato} className="mt-1 justify-center text-white/60" />
                    <Agregar plato={plato} className="mt-2" />
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
