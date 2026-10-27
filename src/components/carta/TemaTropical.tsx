import { textoSobre } from "@/lib/utils";
import { CartaVacia, Etiquetas, FotoRedonda, Logo, precio, idSeccion, type PropsTema } from "./comun";
import { Agregar } from "./Agregar";
import { Destacados } from "./Destacados";
import { useCarta } from "./contexto";
import { NavCategorias } from "./NavCategorias";
import { SelectorIdioma } from "./SelectorIdioma";

const NEGRO = "#0b0d0c";
const CREMA = "#f6e7c8";
const COLORES = ["#ff3fa4", "#22d3ee", "#a855f7", "#fb923c", "#facc15", "#4ade80"];

// Hoja tropical dibujada con SVG para las esquinas.
function Hoja({ className, color = "#2f7d32" }: { className: string; color?: string }) {
  return (
    <svg viewBox="0 0 120 160" aria-hidden className={className}>
      <path d="M60 158C58 120 20 110 8 70 0 40 20 8 60 2c40 6 60 38 52 68-12 40-50 50-52 88z" fill={color} />
      <path d="M60 156V10" stroke="#174d1b" strokeWidth="3" fill="none" />
      {[30, 52, 74, 96, 118].map((y) => (
        <path key={y} d={`M60 ${y}L22 ${y - 18}M60 ${y}L98 ${y - 18}`} stroke="#174d1b" strokeWidth="2.5" fill="none" />
      ))}
    </svg>
  );
}

const neon = (color: string) => `0 0 4px #fff, 0 0 12px ${color}, 0 0 26px ${color}`;

// Carta de tragos: fondo negro con hojas tropicales, título de neón y salpicaduras de color.
export function TemaTropical({ restaurante, secciones, vistaPrevia, pie }: PropsTema) {
  const acento = restaurante.color_primario;
  const { t } = useCarta();

  return (
    <div
      className={`f-montserrat relative overflow-hidden pb-28 text-white ${vistaPrevia ? "" : "min-h-screen"}`}
      style={
        {
          backgroundColor: NEGRO,
          backgroundImage: `radial-gradient(circle at 85% 12%, ${acento}26, transparent 30%), radial-gradient(circle at 10% 55%, rgba(34,211,238,0.12), transparent 30%), radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)`,
          backgroundSize: "100% 100%, 100% 100%, 4px 4px",
          "--acento": acento,
          "--sobre-acento": textoSobre(acento),
          "--nav-bg": "rgba(11,13,12,0.92)",
          "--chip-bg": "rgba(255,255,255,0.07)",
          "--chip-text": CREMA,
          "--chip-activo-bg": acento,
          "--chip-activo-text": textoSobre(acento),
          "--pie-bg": "#161a17",
          "--pie-text": "#ffffff",
        } as React.CSSProperties
      }
    >
      <Hoja className="pointer-events-none absolute -left-10 -top-6 w-32 -rotate-[35deg] opacity-80" />
      <Hoja className="pointer-events-none absolute -right-8 top-10 w-28 rotate-[40deg] opacity-70" color="#3a8f3d" />
      <header className="relative px-6 pb-8 pt-12 text-center">
        <SelectorIdioma className="absolute right-4 top-4" style={{ background: "rgba(255,255,255,0.1)" }} />
        <Logo restaurante={restaurante} className="mx-auto mb-3 h-16 w-16 rounded-full object-cover" />
        <p
          className="f-righteous text-4xl uppercase tracking-[0.15em] @md:text-5xl"
          style={{ color: "#ffd1ec", textShadow: neon(acento) }}
        >
          {t("carta")}
        </p>
        <h1
          className="f-allura mt-1 text-6xl leading-tight @md:text-7xl"
          style={{ color: "#e0fbff", textShadow: neon("#22d3ee") }}
        >
          {restaurante.nombre}
        </h1>
        {restaurante.descripcion && <p className="mx-auto mt-2 max-w-sm text-sm text-white/70">{restaurante.descripcion}</p>}
      </header>

      {secciones.length > 0 && <NavCategorias categorias={secciones} claseChip="f-kaushan text-base" />}

      <main className="relative mx-auto max-w-3xl px-4">
        {secciones.length === 0 && <CartaVacia />}
        <Destacados
          restaurante={restaurante}
          secciones={secciones}
          className="pt-6"
          claseTitulo="f-kaushan text-3xl"
          claseNombre="f-kaushan text-xl"
          style={{ "--dest-bg": "#161a17", "--dest-text": CREMA } as React.CSSProperties}
        />
        {secciones.map((seccion) => (
          <section key={seccion.id} id={idSeccion(seccion.id)} className="scroll-mt-16 pt-8">
            <h2 className="f-kaushan mb-4 text-center text-3xl" style={{ color: CREMA }}>
              {seccion.nombre}
            </h2>
            <ul className="grid gap-x-6 gap-y-6 @md:grid-cols-2">
              {seccion.platos.map((plato, i) => {
                const color = COLORES[i % COLORES.length];
                return (
                  <li key={plato.id} className="flex items-center gap-4">
                    <FotoRedonda
                      plato={plato}
                      className="w-24 shrink-0 text-5xl"
                      style={{ background: "rgba(255,255,255,0.06)", boxShadow: `0 0 0 2px ${color}55, 0 10px 30px ${color}33` }}
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="f-kaushan text-2xl leading-tight" style={{ color: CREMA }}>
                        {plato.nombre}
                      </h3>
                      <span className="mt-0.5 block h-1 w-20 rounded-full" style={{ background: color }} />
                      {plato.descripcion && (
                        <p className="mt-2 border-l-2 pl-2 text-[13px] leading-snug text-white/75" style={{ borderColor: color }}>
                          ( {plato.descripcion} )
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <span className="f-righteous text-lg tabular-nums" style={{ color, textShadow: `0 0 10px ${color}88` }}>
                          {precio(plato, restaurante)}
                        </span>
                        <Agregar plato={plato} />
                      </div>
                      <Etiquetas plato={plato} className="mt-1 text-white/60" />
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
