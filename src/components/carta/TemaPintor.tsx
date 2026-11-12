import { textoSobre } from "@/lib/utils";
import { CartaVacia, Etiquetas, Logo, precio, idSeccion, type PropsTema } from "./comun";
import { Agregar } from "./Agregar";
import { FotoCuadro } from "./cafe";
import { Destacados } from "./Destacados";
import { useCarta } from "./contexto";
import { NavCategorias } from "./NavCategorias";
import {
  CREMA,
  MADERA,
  MADERA_OSCURA,
  MURAL_FONDO,
  PALETA_PINTOR,
  PaletaPintor,
  Panorama,
  PIZARRA,
  Viga,
} from "./pintor";
import { SelectorIdioma } from "./SelectorIdioma";

const PARED = "#f3ead9";
const TINTA = "#3b2418";
const TIZA = "#f3efe3";
// Polvo de tiza sobre la pizarra.
const POLVO_TIZA =
  "radial-gradient(120% 80% at 20% 10%, rgba(255,255,255,0.10), transparent 60%), radial-gradient(90% 70% at 85% 90%, rgba(255,255,255,0.07), transparent 60%)";

// Paredes pintadas de los cerros de Valparaíso: panorama del puerto arriba, letrero crema con el nombre,
// mural a tinta muy suave de fondo, categorías en pizarras con marco de madera y platos en letreros crema.
export function TemaPintor({ restaurante, secciones, vistaPrevia, pie }: PropsTema) {
  const acento = restaurante.color_primario;
  const { t } = useCarta();

  return (
    <div
      className={`f-montserrat pb-28 ${vistaPrevia ? "" : "min-h-screen"}`}
      style={
        {
          color: TINTA,
          backgroundColor: PARED,
          backgroundImage: MURAL_FONDO,
          backgroundSize: "360px 480px",
          "--acento": acento,
          "--sobre-acento": textoSobre(acento),
          "--nav-bg": "rgba(243,234,217,0.95)",
          "--chip-bg": CREMA,
          "--chip-text": TINTA,
          "--chip-activo-bg": PIZARRA,
          "--chip-activo-text": TIZA,
          "--pie-bg": PIZARRA,
          "--pie-text": TIZA,
        } as React.CSSProperties
      }
    >
      <header className="relative overflow-hidden text-center">
        <Panorama className="absolute inset-0 h-full w-full" />
        <SelectorIdioma className="absolute right-4 top-4 z-10" style={{ background: "rgba(44,48,45,0.8)", color: TIZA }} />
        <div className="relative px-5 pb-28 pt-9 @md:pb-36">
          {/* Letrero crema con marco de madera, como el de la entrada. */}
          <div
            className="mx-auto max-w-[18rem] rounded-md px-6 pb-4 pt-3 @md:max-w-[28rem]"
            style={{
              background: CREMA,
              border: `3px solid ${MADERA}`,
              boxShadow: `0 0 0 2px ${CREMA}, 0 0 0 4px ${MADERA_OSCURA}, 0 16px 30px rgba(60,30,10,0.35)`,
            }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.5em]" style={{ color: MADERA }}>
              {t("carta")}
            </p>
            <Logo restaurante={restaurante} className="mx-auto mt-2 h-16 w-16 rounded-full object-cover" />
            <h1 className="f-vibes mt-1 text-[2.75rem] leading-tight @md:text-6xl" style={{ color: MADERA_OSCURA }}>
              {restaurante.nombre}
            </h1>
            <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
              {PALETA_PINTOR.map((c) => (
                <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
              ))}
            </div>
          </div>
        </div>
      </header>
      <Viga />

      {restaurante.descripcion && (
        <p className="mx-auto max-w-md px-6 pt-5 text-center text-sm italic leading-snug opacity-80">{restaurante.descripcion}</p>
      )}

      {secciones.length > 0 && <NavCategorias categorias={secciones} claseChip="f-caveat border border-[#8a5a35]/50 text-lg leading-none" />}

      <main className="mx-auto max-w-3xl px-4">
        {secciones.length === 0 && <CartaVacia />}
        <Destacados
          restaurante={restaurante}
          secciones={secciones}
          className="pt-8"
          claseTitulo="f-caveat text-3xl"
          style={{ "--dest-bg": CREMA, "--dest-text": TINTA } as React.CSSProperties}
        />
        {secciones.map((seccion, i) => {
          const pintura = PALETA_PINTOR[i % PALETA_PINTOR.length];
          return (
            <section key={seccion.id} id={idSeccion(seccion.id)} className="scroll-mt-16 pt-10">
              <h2 className="mb-4 flex items-center gap-3">
                <span
                  className="f-caveat inline-block rounded-[3px] px-5 pb-1 pt-0.5 text-[1.75rem] leading-tight"
                  style={{
                    color: TIZA,
                    backgroundColor: PIZARRA,
                    backgroundImage: POLVO_TIZA,
                    border: `5px solid ${MADERA}`,
                    boxShadow: `inset 0 0 0 1px ${MADERA_OSCURA}, 0 5px 12px rgba(40,20,10,0.3)`,
                  }}
                >
                  {seccion.nombre}
                </span>
                {/* Pincelada del color de la sección. */}
                <span
                  aria-hidden
                  className="h-2.5 flex-1"
                  style={{
                    background: `linear-gradient(90deg, ${pintura}, ${pintura}cc 70%, transparent)`,
                    clipPath: "polygon(0 30%, 40% 0, 80% 20%, 100% 45%, 85% 100%, 45% 80%, 0 100%)",
                  }}
                />
              </h2>
              <ul
                className="grid rounded-lg px-3 @md:grid-cols-2 @md:gap-x-6"
                style={{
                  background: CREMA,
                  border: `1px solid ${MADERA}40`,
                  boxShadow: "0 8px 20px rgba(60,30,10,0.12)",
                }}
              >
                {seccion.platos.map((plato) => (
                  <li key={plato.id} className="flex gap-3 border-b border-dashed py-3.5 last:border-b-0" style={{ borderColor: `${MADERA}45` }}>
                    <FotoCuadro
                      plato={plato}
                      className="m-1 h-16 w-16 shrink-0 rounded-md text-3xl"
                      style={{ background: "#efe3cc", boxShadow: `0 0 0 3px ${CREMA}, 0 0 0 5px ${pintura}` }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="f-playfair text-[17px] font-semibold leading-tight">{plato.nombre}</h3>
                        <span className="f-playfair shrink-0 font-bold tabular-nums" style={{ color: acento }}>
                          {precio(plato, restaurante)}
                        </span>
                      </div>
                      {plato.descripcion && <p className="mt-1 text-[12.5px] leading-snug opacity-75">{plato.descripcion}</p>}
                      <div className="mt-1.5 flex items-center justify-between gap-3">
                        <Etiquetas plato={plato} className="opacity-75" />
                        <Agregar plato={plato} className="ml-auto" />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        <PaletaPintor className="mx-auto mt-12 block h-16 w-24" />
      </main>
      {pie}
    </div>
  );
}
