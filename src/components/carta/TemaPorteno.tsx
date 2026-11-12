import { textoSobre } from "@/lib/utils";
import { CartaVacia, Etiquetas, FotoRedonda, Logo, precio, idSeccion, type PropsTema } from "./comun";
import { Agregar } from "./Agregar";
import { Casitas, PALETA_CERROS } from "./cafe";
import { Destacados } from "./Destacados";
import { useCarta } from "./contexto";
import { NavCategorias } from "./NavCategorias";
import { SelectorIdioma } from "./SelectorIdioma";

const CAFE = "#17110d";
const PAPEL = "#fdf8ef";
const TINTA = "#1d1d1b";

// Inspirado en los cerros de Valparaíso: café negro arriba, casitas de colores, mar y cada plato como una taza sobre su plato.
export function TemaPorteno({ restaurante, secciones, vistaPrevia, pie }: PropsTema) {
  const acento = restaurante.color_primario;
  const { t } = useCarta();

  return (
    <div
      className={`f-montserrat pb-28 ${vistaPrevia ? "" : "min-h-screen"}`}
      style={
        {
          color: TINTA,
          backgroundColor: PAPEL,
          "--acento": acento,
          "--sobre-acento": textoSobre(acento),
          "--nav-bg": "rgba(253,248,239,0.95)",
          "--chip-bg": "#ffffff",
          "--chip-text": TINTA,
          "--chip-activo-bg": CAFE,
          "--chip-activo-text": "#ffffff",
          "--pie-bg": CAFE,
          "--pie-text": "#ffffff",
        } as React.CSSProperties
      }
    >
      <header className="relative text-center text-[#f3e9dc]" style={{ background: CAFE }}>
        <SelectorIdioma className="absolute right-4 top-4 z-10" style={{ background: "rgba(255,255,255,0.12)" }} />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(60% 45% at 50% 35%, rgba(120,72,40,0.45), transparent 70%)" }}
        />
        <div className="relative px-6 pb-6 pt-12">
          <Logo
            restaurante={restaurante}
            className="mx-auto mb-4 h-28 w-28 rounded-full object-cover"
            style={{ boxShadow: "0 0 0 5px #ffffff, 0 18px 30px rgba(0,0,0,0.5)" }}
          />
          <p className="text-xs font-semibold uppercase tracking-[0.5em] opacity-80">{t("carta")}</p>
          <h1 className="f-marker mt-1 text-4xl uppercase leading-tight tracking-wide @md:text-5xl">{restaurante.nombre}</h1>
          {restaurante.descripcion && <p className="mx-auto mt-3 max-w-sm text-sm opacity-75">{restaurante.descripcion}</p>}
          <div className="mt-4 flex justify-center gap-1.5" aria-hidden>
            {PALETA_CERROS.map((c) => (
              <span key={c} className="h-2 w-6 rounded-full" style={{ background: c }} />
            ))}
          </div>
        </div>
        <Casitas className="relative block w-full" alto={86} />
      </header>

      {secciones.length > 0 && <NavCategorias categorias={secciones} claseChip="f-marker border-2 border-[#1d1d1b] uppercase" />}

      <main className="mx-auto max-w-3xl px-4">
        {secciones.length === 0 && <CartaVacia />}
        <Destacados
          restaurante={restaurante}
          secciones={secciones}
          className="pt-8"
          claseTitulo="f-marker text-2xl uppercase"
          style={{ "--dest-bg": "#ffffff", "--dest-text": TINTA } as React.CSSProperties}
        />
        {secciones.map((seccion, i) => {
          const color = PALETA_CERROS[i % PALETA_CERROS.length];
          return (
            <section key={seccion.id} id={idSeccion(seccion.id)} className="scroll-mt-16 pt-10">
              <h2 className="f-marker mb-5 flex items-end gap-2 text-2xl uppercase">
                <svg viewBox="0 0 24 24" aria-hidden className="h-7 w-7 shrink-0">
                  <path d="M3 11 L12 3 L21 11 V21 H3 Z" fill={color} stroke={TINTA} strokeWidth="1.6" strokeLinejoin="round" />
                  <rect x="7" y="13" width="4" height="4" fill="#fff" stroke={TINTA} strokeWidth="1.2" />
                  <rect x="13" y="13" width="4" height="8" fill="#fff" stroke={TINTA} strokeWidth="1.2" />
                </svg>
                <span className="border-b-4 leading-none" style={{ borderColor: color }}>
                  {seccion.nombre}
                </span>
              </h2>
              <ul className="grid gap-4 @md:grid-cols-2">
                {seccion.platos.map((plato, j) => {
                  const borde = PALETA_CERROS[(i + j) % PALETA_CERROS.length];
                  return (
                    <li
                      key={plato.id}
                      className="flex gap-4 rounded-2xl border-2 bg-white p-3.5 shadow-[4px_4px_0_#1d1d1b]"
                      style={{ borderColor: TINTA }}
                    >
                      <FotoRedonda
                        plato={plato}
                        className="m-2 w-16 shrink-0 self-start bg-[#2a1a10] text-3xl"
                        style={{ boxShadow: `0 0 0 5px #ffffff, 0 0 0 8px ${borde}, 0 0 0 10px ${TINTA}` }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <h3 className="font-bold leading-tight">{plato.nombre}</h3>
                          <span
                            className="f-marker shrink-0 text-lg tabular-nums"
                            style={{ color: borde === "#ffcb05" ? TINTA : borde }}
                          >
                            {precio(plato, restaurante)}
                          </span>
                        </div>
                        {plato.descripcion && <p className="mt-1 text-[12px] leading-snug opacity-75">{plato.descripcion}</p>}
                        <div className="mt-1.5 flex items-center justify-between gap-3">
                          <Etiquetas plato={plato} className="opacity-75" />
                          <Agregar plato={plato} className="ml-auto" />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        <Casitas className="mt-12 block w-full opacity-90" alto={60} />
      </main>
      {pie}
    </div>
  );
}
