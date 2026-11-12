import { textoSobre } from "@/lib/utils";
import { CartaVacia, Etiquetas, Foto, IconoPlato, Logo, precio, idSeccion, type PropsTema } from "./comun";
import { Agregar } from "./Agregar";
import { Destacados } from "./Destacados";
import { useCarta } from "./contexto";
import { NavCategorias } from "./NavCategorias";
import { SelectorIdioma } from "./SelectorIdioma";

const NEGRO = "#121212";

// Negro mate y dorado, como el empaque de una tostaduría: sello redondo, letras romanas y marcos finos.
export function TemaBarista({ restaurante, secciones, vistaPrevia, pie }: PropsTema) {
  const oro = restaurante.color_primario;
  const { t } = useCarta();

  return (
    <div
      className={`f-montserrat pb-28 text-stone-200 ${vistaPrevia ? "" : "min-h-screen"}`}
      style={
        {
          backgroundColor: NEGRO,
          backgroundImage:
            "radial-gradient(90% 40% at 50% 0%, #2a2724 0%, transparent 70%), radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "auto, 5px 5px",
          "--acento": oro,
          "--sobre-acento": textoSobre(oro),
          "--nav-bg": "rgba(18,18,18,0.9)",
          "--chip-bg": "transparent",
          "--chip-text": "#d6d3d1",
          "--chip-activo-bg": oro,
          "--chip-activo-text": textoSobre(oro),
          "--pie-bg": "#1b1b1b",
          "--pie-text": "#f5f5f4",
        } as React.CSSProperties
      }
    >
      <header className="relative px-6 pb-10 pt-14 text-center">
        <SelectorIdioma className="absolute right-4 top-4" style={{ background: "rgba(255,255,255,0.08)" }} />
        <div
          className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full"
          style={{ border: `1.5px solid ${oro}`, boxShadow: `0 0 0 5px ${NEGRO}, 0 0 0 6px ${oro}66` }}
        >
          {restaurante.logo_url ? (
            <Logo restaurante={restaurante} className="h-[84px] w-[84px] rounded-full object-cover" />
          ) : (
            <span className="f-cinzel text-4xl font-bold" style={{ color: oro }}>
              {restaurante.nombre.trim().charAt(0)}
            </span>
          )}
        </div>
        <h1 className="f-cinzel text-3xl font-bold uppercase leading-tight tracking-[0.22em] @md:text-4xl" style={{ color: oro }}>
          {restaurante.nombre}
        </h1>
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.6em] text-stone-400">{t("carta")}</p>
        {restaurante.descripcion && <p className="mx-auto mt-4 max-w-sm text-sm text-stone-400">{restaurante.descripcion}</p>}
      </header>

      {secciones.length > 0 && (
        <NavCategorias categorias={secciones} claseChip="f-cinzel border border-white/15 uppercase tracking-[0.15em]" />
      )}

      <main className="mx-auto max-w-2xl px-4">
        {secciones.length === 0 && <CartaVacia />}
        <Destacados
          restaurante={restaurante}
          secciones={secciones}
          className="pt-8"
          claseTitulo="f-cinzel text-2xl font-bold uppercase tracking-[0.15em]"
          claseNombre="f-cinzel font-bold uppercase tracking-wide"
          style={{ "--dest-bg": "#1c1b1a" } as React.CSSProperties}
        />
        {secciones.map((seccion) => (
          <section
            key={seccion.id}
            id={idSeccion(seccion.id)}
            className="mt-10 scroll-mt-16 p-1.5"
            style={{ border: `1px solid ${oro}55` }}
          >
            <div className="px-4 pb-6 pt-7 @md:px-7" style={{ border: `1px solid ${oro}33` }}>
              <h2
                className="f-cinzel mb-7 flex items-center justify-center gap-3 text-center text-xl font-bold uppercase tracking-[0.25em]"
                style={{ color: oro }}
              >
                <span className="h-px w-8" style={{ background: oro }} />
                {seccion.nombre}
                <span className="h-px w-8" style={{ background: oro }} />
              </h2>
              <ul className="space-y-6">
                {seccion.platos.map((plato) => (
                  <li key={plato.id} className="flex gap-4">
                    <Foto plato={plato} className="h-16 w-16 shrink-0 rounded-md object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <IconoPlato plato={plato} className="h-6 w-6 self-center" />
                        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-100">{plato.nombre}</h3>
                        <span className="mb-1 flex-1 border-b border-dotted" style={{ borderColor: `${oro}66` }} />
                        <span className="f-cinzel shrink-0 text-base font-bold tabular-nums" style={{ color: oro }}>
                          {precio(plato, restaurante)}
                        </span>
                      </div>
                      {plato.descripcion && (
                        <p className="mt-1 text-[13px] leading-relaxed text-stone-400">{plato.descripcion}</p>
                      )}
                      <div className="mt-1.5 flex items-center justify-between gap-3">
                        <Etiquetas plato={plato} className="text-stone-400" />
                        <Agregar plato={plato} className="ml-auto" />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </main>
      {pie}
    </div>
  );
}
