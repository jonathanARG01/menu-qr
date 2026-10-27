import { textoSobre } from "@/lib/utils";
import { CartaVacia, Etiquetas, FotoRedonda, Logo, precio, idSeccion, type PropsTema } from "./comun";
import { Agregar } from "./Agregar";
import { Destacados } from "./Destacados";
import { NavCategorias } from "./NavCategorias";
import { SelectorIdioma } from "./SelectorIdioma";

const VERDE = "#12302a";

// Monograma de líneas doradas, como los de los restaurantes de lujo.
function Monograma({ color, className }: { color: string; className: string }) {
  return (
    <svg viewBox="0 0 120 50" aria-hidden className={className} fill="none" stroke={color} strokeWidth="2">
      <path d="M8 4l30 42L68 4M38 46L52 4M52 4l30 42L112 4M82 46L96 4" />
    </svg>
  );
}

function Rombos({ color }: { color: string }) {
  const rombo = "absolute h-1.5 w-1.5 rotate-45 border";
  return (
    <>
      <span className={`${rombo} left-3 top-3`} style={{ borderColor: color }} />
      <span className={`${rombo} right-3 top-3`} style={{ borderColor: color }} />
      <span className={`${rombo} bottom-3 left-3`} style={{ borderColor: color }} />
      <span className={`${rombo} bottom-3 right-3`} style={{ borderColor: color }} />
    </>
  );
}

// Verde profundo con luz diagonal; cada plato es un afiche con su nombre en caligrafía dorada sobre una mesa de madera.
export function TemaGala({ restaurante, secciones, vistaPrevia, pie }: PropsTema) {
  const oro = restaurante.color_primario;

  return (
    <div
      className={`f-montserrat pb-28 text-white ${vistaPrevia ? "" : "min-h-screen"}`}
      style={
        {
          backgroundColor: VERDE,
          backgroundImage:
            "linear-gradient(115deg, rgba(255,255,255,0.07) 0%, transparent 35%), radial-gradient(ellipse at 50% 0%, #1d4a40, transparent 70%)",
          "--acento": oro,
          "--sobre-acento": textoSobre(oro),
          "--nav-bg": "rgba(18,48,42,0.94)",
          "--chip-bg": "transparent",
          "--chip-text": oro,
          "--chip-activo-bg": oro,
          "--chip-activo-text": textoSobre(oro),
          "--pie-bg": "#0c221d",
          "--pie-text": "#f3e6c8",
        } as React.CSSProperties
      }
    >
      <header className="relative px-6 pb-10 pt-12 text-center">
        <SelectorIdioma className="absolute right-4 top-4" style={{ background: "rgba(0,0,0,0.3)", color: oro }} />
        {restaurante.logo_url ? (
          <Logo restaurante={restaurante} className="mx-auto mb-4 h-16 w-16 rounded-full object-cover" />
        ) : (
          <Monograma color={oro} className="mx-auto mb-4 w-24" />
        )}
        <h1 className="f-cinzel text-3xl font-bold uppercase tracking-[0.25em] @md:text-4xl" style={{ color: oro }}>
          {restaurante.nombre}
        </h1>
        {restaurante.descripcion && (
          <p className="f-allura mt-2 text-3xl" style={{ color: "#f3e6c8" }}>
            {restaurante.descripcion}
          </p>
        )}
      </header>

      {secciones.length > 0 && (
        <NavCategorias
          categorias={secciones}
          claseChip="f-cinzel border border-current/40 text-xs font-medium uppercase tracking-[0.2em]"
        />
      )}

      <main className="mx-auto max-w-3xl px-5">
        {secciones.length === 0 && <CartaVacia />}
        <Destacados
          restaurante={restaurante}
          secciones={secciones}
          className="pt-8"
          claseTitulo="f-cinzel text-xl font-bold uppercase tracking-[0.2em]"
          claseNombre="f-allura text-3xl font-normal"
          style={{ "--dest-bg": "#0c221d", "--dest-text": "#f3e6c8" } as React.CSSProperties}
        />
        {secciones.map((seccion) => (
          <section key={seccion.id} id={idSeccion(seccion.id)} className="scroll-mt-16 pt-10">
            <h2
              className="f-cinzel mb-6 flex items-center justify-center gap-3 text-lg font-bold uppercase tracking-[0.3em]"
              style={{ color: oro }}
            >
              <span className="h-px w-10" style={{ background: oro }} />
              {seccion.nombre}
              <span className="h-px w-10" style={{ background: oro }} />
            </h2>
            <ul className="grid gap-6 @md:grid-cols-2">
              {seccion.platos.map((plato, i) => (
                <li
                  key={plato.id}
                  className={`relative overflow-hidden rounded-sm shadow-[0_20px_40px_rgba(0,0,0,0.45)] ${i % 2 ? "@md:mt-10" : ""}`}
                  style={{ background: "linear-gradient(160deg, #1b4a40 0%, #0f2925 55%)" }}
                >
                  <Rombos color={`${oro}aa`} />
                  <div className="px-6 pt-8 text-center">
                    <h3 className="f-allura text-5xl leading-none" style={{ color: oro }}>
                      {plato.nombre}
                    </h3>
                    {plato.descripcion && (
                      <p className="mx-auto mt-2 max-w-xs text-xs leading-snug text-white/70">{plato.descripcion}</p>
                    )}
                  </div>
                  <div className="relative mt-4 h-44">
                    {/* Mesa de madera en diagonal */}
                    <span
                      aria-hidden
                      className="absolute inset-x-0 bottom-0 h-28"
                      style={{
                        background: "linear-gradient(180deg, #5a3a26, #2e1d14)",
                        clipPath: "polygon(0 35%, 100% 0, 100% 100%, 0 100%)",
                      }}
                    />
                    <FotoRedonda
                      plato={plato}
                      className="absolute left-1/2 top-2 w-36 -translate-x-1/2 text-6xl"
                      style={{
                        background: "#1a1a1a",
                        boxShadow: `0 0 0 6px #2a2a2a, 0 0 0 10px ${oro}55, 0 18px 30px rgba(0,0,0,0.6)`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 bg-black/25 px-5 py-3">
                    <span className="f-cinzel text-lg font-bold tabular-nums" style={{ color: oro }}>
                      {precio(plato, restaurante)}
                    </span>
                    <Etiquetas plato={plato} className="text-white/60" />
                    <Agregar plato={plato} />
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
