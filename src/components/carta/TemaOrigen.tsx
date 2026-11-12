import { textoSobre } from "@/lib/utils";
import { CartaVacia, Etiquetas, Logo, precio, idSeccion, type PropsTema } from "./comun";
import { Agregar } from "./Agregar";
import { FotoCuadro } from "./cafe";
import { Destacados } from "./Destacados";
import { useCarta } from "./contexto";
import { NavCategorias } from "./NavCategorias";
import { SelectorIdioma } from "./SelectorIdioma";

const CREMA = "#ebe3d1";
const OLIVA = "#3b3e33";
const CAFE = "#3a2a1c";

// Montaña al amanecer, franjas crema y verde oliva, tarjetas sobre madera con botón dorado.
export function TemaOrigen({ restaurante, secciones, vistaPrevia, pie }: PropsTema) {
  const oro = restaurante.color_primario;
  const { t } = useCarta();

  return (
    <div
      className={`f-montserrat pb-28 ${vistaPrevia ? "" : "min-h-screen"}`}
      style={
        {
          color: CAFE,
          backgroundColor: CREMA,
          "--acento": oro,
          "--sobre-acento": textoSobre(oro),
          "--nav-bg": "rgba(59,62,51,0.95)",
          "--chip-bg": "rgba(255,255,255,0.08)",
          "--chip-text": "#efe8d8",
          "--chip-activo-bg": oro,
          "--chip-activo-text": textoSobre(oro),
          "--pie-bg": "#4a2e17",
          "--pie-text": "#ffffff",
        } as React.CSSProperties
      }
    >
      <header
        className="relative overflow-hidden px-6 pb-28 pt-10 text-[#f3ecdc]"
        style={{ background: "linear-gradient(180deg, #5d5f52 0%, #4a4a3e 45%, #2f3028 100%)" }}
      >
        <svg viewBox="0 0 400 160" preserveAspectRatio="none" aria-hidden className="absolute inset-x-0 bottom-0 h-28 w-full">
          <path d="M0 160 L0 120 L90 90 L170 30 L205 18 L240 34 L330 92 L400 110 L400 160 Z" fill="#6f6a5a" opacity="0.6" />
          <path d="M170 30 L205 18 L240 34 L222 44 L206 34 L190 46 Z" fill="#efe3c8" opacity="0.85" />
          <path d="M0 160 L0 135 L120 118 L260 128 L400 120 L400 160 Z" fill="#2b2c25" />
        </svg>
        <SelectorIdioma className="absolute right-4 top-4 z-10" style={{ background: "rgba(0,0,0,0.3)" }} />
        <div className="relative">
          <div className="flex items-center gap-3">
            <Logo restaurante={restaurante} className="h-12 w-12 rounded-full object-cover" />
            <span className="f-playfair text-lg font-semibold">{restaurante.nombre}</span>
          </div>
          <h1 className="f-playfair mt-8 max-w-sm text-4xl font-semibold leading-[1.1] @md:text-5xl">{restaurante.nombre}</h1>
          {restaurante.descripcion && <p className="mt-3 max-w-sm text-sm text-[#f3ecdc]/80">{restaurante.descripcion}</p>}
          <span
            className="mt-6 inline-block rounded-full px-7 py-2.5 text-sm font-semibold"
            style={{ background: oro, color: textoSobre(oro) }}
          >
            {t("carta")}
          </span>
        </div>
      </header>

      {secciones.length > 0 && <NavCategorias categorias={secciones} claseChip="tracking-wide" />}

      {secciones.length === 0 && <CartaVacia />}
      <div className="mx-auto max-w-3xl px-5">
        <Destacados
          restaurante={restaurante}
          secciones={secciones}
          className="pt-8"
          claseTitulo="f-playfair text-3xl font-semibold"
          claseNombre="f-playfair font-semibold"
          style={{ "--dest-bg": "#f8f3e8", "--dest-text": CAFE } as React.CSSProperties}
        />
      </div>
      {secciones.map((seccion, i) => {
        const oscura = i % 2 === 1;
        return (
          <section
            key={seccion.id}
            id={idSeccion(seccion.id)}
            className="scroll-mt-16 py-10"
            style={oscura ? { background: OLIVA, color: "#efe8d8" } : undefined}
          >
            <div className="mx-auto max-w-3xl px-5">
              <h2 className="f-playfair mb-6 text-3xl font-semibold">{seccion.nombre}</h2>
              {oscura ? (
                <ul className="grid grid-cols-2 gap-4 @md:grid-cols-3">
                  {seccion.platos.map((plato) => (
                    <li
                      key={plato.id}
                      className="flex flex-col overflow-hidden rounded-xl border border-white/10 shadow-xl"
                      style={{ background: "linear-gradient(165deg, #6e4d30, #3d2a19)" }}
                    >
                      <FotoCuadro
                        plato={plato}
                        className="aspect-[4/3] w-full text-6xl"
                        style={{ background: "rgba(0,0,0,0.15)" }}
                      />
                      <div className="flex flex-1 flex-col p-3">
                        <h3 className="f-playfair text-lg font-semibold leading-tight">{plato.nombre}</h3>
                        {plato.descripcion && <p className="mt-1 text-[11px] leading-snug text-white/70">{plato.descripcion}</p>}
                        <Etiquetas plato={plato} className="mt-1 text-white/70" />
                        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                          <span className="text-lg font-medium tabular-nums">{precio(plato, restaurante)}</span>
                          <Agregar plato={plato} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="grid gap-x-8 gap-y-5 @md:grid-cols-2">
                  {seccion.platos.map((plato) => (
                    <li key={plato.id} className="flex gap-3">
                      <FotoCuadro
                        plato={plato}
                        className="h-14 w-14 shrink-0 rounded-full text-2xl"
                        style={{ background: `color-mix(in srgb, ${oro} 25%, transparent)` }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <h3 className="f-playfair text-lg font-semibold leading-tight">{plato.nombre}</h3>
                          <span className="shrink-0 font-semibold tabular-nums">{precio(plato, restaurante)}</span>
                        </div>
                        {plato.descripcion && <p className="mt-0.5 text-[13px] leading-snug opacity-75">{plato.descripcion}</p>}
                        <div className="mt-1 flex items-center justify-between gap-3">
                          <Etiquetas plato={plato} className="opacity-70" />
                          <Agregar plato={plato} className="ml-auto" />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        );
      })}
      {pie}
    </div>
  );
}
