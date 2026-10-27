import { textoSobre } from "@/lib/utils";
import { CartaVacia, Etiquetas, FotoRedonda, Logo, precio, idSeccion, type PropsTema } from "./comun";
import { Agregar } from "./Agregar";
import { NavCategorias } from "./NavCategorias";
import { SelectorIdioma } from "./SelectorIdioma";

// Colores neón de las etiquetas de sección: la primera usa el color del restaurante.
const OTROS = ["#22e4ff", "#ffe600", "#7cff4f", "#ff7a1a", "#a96bff"];

const brillo = (color: string) => `0 0 4px #fff, 0 0 10px ${color}, 0 0 22px ${color}, 0 0 40px ${color}`;

// Fondo negro, título de neón que brilla, etiquetas de sección tipo brochazo y platos en dos columnas.
export function TemaNeon({ restaurante, secciones, vistaPrevia, pie }: PropsTema) {
  const acento = restaurante.color_primario;
  const colores = [acento, ...OTROS];
  const portada = secciones.flatMap((s) => s.platos).find((p) => p.foto_url);

  return (
    <div
      className={`f-montserrat overflow-hidden pb-28 text-white ${vistaPrevia ? "" : "min-h-screen"}`}
      style={
        {
          backgroundColor: "#07070b",
          backgroundImage:
            "radial-gradient(circle at 10% 0%, rgba(255,43,214,0.18), transparent 35%), radial-gradient(circle at 100% 30%, rgba(34,228,255,0.14), transparent 35%), radial-gradient(circle at 0% 80%, rgba(255,230,0,0.08), transparent 30%)",
          "--acento": acento,
          "--sobre-acento": textoSobre(acento),
          "--nav-bg": "rgba(7,7,11,0.92)",
          "--chip-bg": "rgba(255,255,255,0.06)",
          "--chip-text": "#f5f5f5",
          "--chip-activo-bg": acento,
          "--chip-activo-text": textoSobre(acento),
          "--pie-bg": "#15151d",
          "--pie-text": "#ffffff",
        } as React.CSSProperties
      }
    >
      <header className="relative px-6 pb-8 pt-12 text-center">
        <SelectorIdioma className="absolute right-4 top-4" style={{ background: "rgba(255,255,255,0.1)" }} />
        <span
          aria-hidden
          className="absolute left-4 top-3 text-2xl opacity-80"
          style={{ filter: `drop-shadow(0 0 8px ${OTROS[0]})` }}
        >
          🏮
        </span>
        <Logo
          restaurante={restaurante}
          className="mx-auto mb-4 h-16 w-16 rounded-full object-cover"
          style={{ boxShadow: brillo(acento) }}
        />
        <h1
          className="f-righteous mx-auto inline-block rounded-2xl border-[3px] px-5 py-2 text-5xl uppercase leading-tight @md:text-6xl"
          style={{
            color: "#fff",
            borderColor: acento,
            textShadow: brillo(acento),
            boxShadow: `${brillo(acento)}, inset 0 0 18px ${acento}`,
          }}
        >
          {restaurante.nombre}
        </h1>
        {restaurante.descripcion && (
          <p
            className="f-marker mt-4 text-lg uppercase tracking-wide"
            style={{ color: OTROS[0], textShadow: `0 0 10px ${OTROS[0]}` }}
          >
            {restaurante.descripcion}
          </p>
        )}
        {portada && (
          <FotoRedonda
            plato={portada}
            className="mx-auto mt-6 w-40"
            style={{ boxShadow: brillo(OTROS[0]), border: `3px solid ${OTROS[0]}` }}
          />
        )}
      </header>

      {secciones.length > 0 && <NavCategorias categorias={secciones} claseChip="f-righteous uppercase tracking-wide" />}

      <main className="mx-auto grid max-w-3xl gap-x-6 gap-y-2 px-4 pt-2 @md:grid-cols-2">
        {secciones.length === 0 && <CartaVacia />}
        {secciones.map((seccion, i) => {
          const color = colores[i % colores.length];
          return (
            <section
              key={seccion.id}
              id={idSeccion(seccion.id)}
              className="scroll-mt-16 rounded-2xl border p-4 pt-5"
              style={{ borderColor: `${color}55`, boxShadow: `inset 0 0 24px ${color}14` }}
            >
              <h2
                className="f-marker mb-3 inline-block -rotate-2 px-4 py-1 text-2xl uppercase text-black"
                style={{
                  background: color,
                  clipPath: "polygon(3% 12%, 100% 0, 97% 86%, 0 100%)",
                  boxShadow: `0 0 18px ${color}`,
                }}
              >
                {seccion.nombre}
              </h2>
              <ul className="space-y-3">
                {seccion.platos.map((plato) => (
                  <li key={plato.id} className="flex items-center gap-3">
                    {plato.foto_url && (
                      <FotoRedonda plato={plato} className="w-14 shrink-0" style={{ border: `2px solid ${color}` }} />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <h3 className="font-bold uppercase leading-tight tracking-wide">{plato.nombre}</h3>
                        <span className="mb-1 flex-1 border-b border-dashed border-white/20" />
                        <span className="f-righteous shrink-0 tabular-nums" style={{ color, textShadow: `0 0 8px ${color}` }}>
                          {precio(plato, restaurante)}
                        </span>
                      </div>
                      {plato.descripcion && <p className="text-xs leading-snug text-white/60">{plato.descripcion}</p>}
                      <div className="flex items-center justify-between gap-3">
                        <Etiquetas plato={plato} className="mt-1 text-white/60" />
                        <Agregar plato={plato} className="ml-auto mt-1.5" />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </main>
      {pie}
    </div>
  );
}
