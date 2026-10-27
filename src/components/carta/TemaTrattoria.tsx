import { textoSobre } from "@/lib/utils";
import { CartaVacia, Etiquetas, FotoRedonda, Logo, precio, idSeccion, type PropsTema } from "./comun";
import { Agregar } from "./Agregar";
import { Destacados } from "./Destacados";
import { NavCategorias } from "./NavCategorias";
import { SelectorIdioma } from "./SelectorIdioma";

const PIZARRA = "#151515";
const VERDE = "#1f9d55";
const ROJO = "#d7263d";

// Franja verde, blanca y roja como un trazo de tiza.
function Tricolor({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`flex h-1.5 overflow-hidden rounded-full ${className}`}>
      <span className="flex-1" style={{ background: VERDE }} />
      <span className="flex-1 bg-white" />
      <span className="flex-1" style={{ background: ROJO }} />
    </span>
  );
}

// Pizarra negra con recuadros, los colores de Italia y letra de tiza.
export function TemaTrattoria({ restaurante, secciones, vistaPrevia, pie }: PropsTema) {
  const acento = restaurante.color_primario;
  const palabras = restaurante.nombre.trim().split(/\s+/);
  const ultima = palabras.length > 1 ? palabras.pop() : null;

  return (
    <div
      className={`f-montserrat pb-28 text-white ${vistaPrevia ? "" : "min-h-screen"}`}
      style={
        {
          backgroundColor: PIZARRA,
          backgroundImage:
            "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.08), transparent 60%), radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 3px 3px",
          "--acento": acento,
          "--sobre-acento": textoSobre(acento),
          "--nav-bg": "rgba(21,21,21,0.94)",
          "--chip-bg": "rgba(255,255,255,0.07)",
          "--chip-text": "#ffffff",
          "--chip-activo-bg": acento,
          "--chip-activo-text": textoSobre(acento),
          "--pie-bg": "#222222",
          "--pie-text": "#ffffff",
        } as React.CSSProperties
      }
    >
      <header className="relative px-6 pb-8 pt-12 text-center">
        <SelectorIdioma className="absolute right-4 top-4" style={{ background: "rgba(255,255,255,0.1)" }} />
        {restaurante.logo_url ? (
          <Logo restaurante={restaurante} className="mx-auto mb-3 h-16 w-16 rounded-full object-cover" />
        ) : (
          <span aria-hidden className="mb-1 block text-4xl">
            👨‍🍳
          </span>
        )}
        <Tricolor className="mx-auto mb-3 w-40" />
        <h1 className="f-playfair text-5xl font-bold uppercase leading-none @md:text-6xl">
          {palabras.join(" ")}
          {ultima && (
            <span className="block">
              <span style={{ color: VERDE }}>{ultima.slice(0, Math.ceil(ultima.length / 3))}</span>
              <span>{ultima.slice(Math.ceil(ultima.length / 3), Math.ceil((ultima.length * 2) / 3))}</span>
              <span style={{ color: ROJO }}>{ultima.slice(Math.ceil((ultima.length * 2) / 3))}</span>
            </span>
          )}
        </h1>
        {restaurante.descripcion && <p className="f-kaushan mt-3 text-xl text-white/85">{restaurante.descripcion}</p>}
      </header>

      {secciones.length > 0 && <NavCategorias categorias={secciones} claseChip="f-kaushan text-base" />}

      <main className="mx-auto grid max-w-3xl gap-5 px-4 pt-4 @md:grid-cols-2">
        {secciones.length === 0 && <CartaVacia />}
        <Destacados
          restaurante={restaurante}
          secciones={secciones}
          className="@md:col-span-2"
          claseTitulo="f-kaushan text-3xl"
          style={{ "--dest-bg": "#222222" } as React.CSSProperties}
        />
        {secciones.map((seccion, i) => {
          const borde = i % 2 ? ROJO : VERDE;
          return (
            <section
              key={seccion.id}
              id={idSeccion(seccion.id)}
              className="scroll-mt-16 rounded-xl border-2 bg-black/30 p-4"
              style={{ borderColor: borde, boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.05)` }}
            >
              <h2 className="f-kaushan text-3xl">{seccion.nombre}</h2>
              <Tricolor className="mb-4 mt-1 w-32" />
              <ul className="space-y-3">
                {seccion.platos.map((plato) => (
                  <li key={plato.id} className="flex items-center gap-3">
                    <FotoRedonda plato={plato} className="w-12 shrink-0 bg-white/5 text-2xl" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <h3 className="f-playfair font-semibold leading-tight">{plato.nombre}</h3>
                        <span className="mb-1 flex-1 border-b-2 border-dotted border-white/25" />
                        <span className="shrink-0 font-semibold tabular-nums">{precio(plato, restaurante)}</span>
                      </div>
                      {plato.descripcion && <p className="text-xs leading-snug text-white/60">{plato.descripcion}</p>}
                      <div className="flex items-center justify-between gap-3">
                        <Etiquetas plato={plato} className="mt-0.5 text-white/55" />
                        <Agregar plato={plato} className="ml-auto mt-1" />
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
