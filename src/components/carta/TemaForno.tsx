import { textoSobre } from "@/lib/utils";
import { CartaVacia, Etiquetas, FotoRedonda, Logo, precio, idSeccion, type PropsTema } from "./comun";
import { Agregar } from "./Agregar";
import { NavCategorias } from "./NavCategorias";
import { SelectorIdioma } from "./SelectorIdioma";

const FONDO = "#f3f2ee";
const TINTA = "#1d1d1b";
const OLIVA = "#3d4130";

// Pincelada de color hecha con SVG, para títulos y adornos.
function Pincelada({ color, className }: { color: string; className: string }) {
  return (
    <svg viewBox="0 0 300 40" preserveAspectRatio="none" aria-hidden className={className}>
      <path d="M4 22c30-12 70-16 120-14s110 2 170-6c4 6 2 14-4 18-60 8-120 10-180 9S30 34 8 34c-6-2-8-8-4-12z" fill={color} />
      <path d="M40 30c50 2 110 1 200-4" stroke={color} strokeWidth="3" strokeLinecap="round" opacity="0.5" fill="none" />
    </svg>
  );
}

// Fondo claro de pizzería con pinceladas oliva, título en letra de pincel y pizzas grandes que alternan de lado.
export function TemaForno({ restaurante, secciones, vistaPrevia, pie }: PropsTema) {
  const rojo = restaurante.color_primario;
  const primera = secciones[0]?.nombre;

  return (
    <div
      className={`f-montserrat overflow-hidden pb-28 ${vistaPrevia ? "" : "min-h-screen"}`}
      style={
        {
          color: TINTA,
          backgroundColor: FONDO,
          backgroundImage: "radial-gradient(rgba(0,0,0,0.035) 1px, transparent 1px)",
          backgroundSize: "6px 6px",
          "--acento": rojo,
          "--sobre-acento": textoSobre(rojo),
          "--nav-bg": "rgba(243,242,238,0.94)",
          "--chip-bg": "rgba(29,29,27,0.06)",
          "--chip-text": TINTA,
          "--chip-activo-bg": OLIVA,
          "--chip-activo-text": "#ffffff",
          "--pie-bg": OLIVA,
          "--pie-text": "#ffffff",
        } as React.CSSProperties
      }
    >
      <header className="relative px-6 pb-6 pt-8">
        <SelectorIdioma className="absolute right-4 top-4" style={{ background: OLIVA }} />
        <Pincelada color={OLIVA} className="absolute -right-14 top-[11rem] h-12 w-44 rotate-[-6deg] opacity-90" />
        <div className="flex items-center gap-3">
          {restaurante.logo_url ? (
            <Logo restaurante={restaurante} className="h-14 w-14 rounded-full border border-black/15 object-cover" />
          ) : (
            <span
              className="flex h-14 w-14 items-center justify-center rounded-full border-2 text-2xl"
              style={{ borderColor: rojo, color: rojo }}
            >
              🍕
            </span>
          )}
          <p className="f-playfair text-2xl font-semibold uppercase tracking-[0.2em]">{restaurante.nombre}</p>
        </div>
        {primera && (
          <h1 className="f-kaushan relative mt-4 text-7xl leading-none @md:text-8xl" style={{ color: TINTA }}>
            {primera}
          </h1>
        )}
        {restaurante.descripcion && (
          <p className="mt-3 max-w-[16rem] text-xs font-semibold uppercase tracking-[0.2em] text-black/60">
            {restaurante.descripcion}
          </p>
        )}
      </header>

      {secciones.length > 0 && <NavCategorias categorias={secciones} claseChip="font-semibold uppercase tracking-wide" />}

      <main className="mx-auto max-w-2xl px-5">
        {secciones.length === 0 && <CartaVacia />}
        {secciones.map((seccion, s) => {
          // La sección de extras o agregados se muestra como lista compacta, sin fotos.
          const compacta = seccion.platos.every((p) => !p.descripcion && !p.foto_url);
          return (
            <section key={seccion.id} id={idSeccion(seccion.id)} className="scroll-mt-16 pt-8">
              {s > 0 && (
                <h2 className="relative mb-2 inline-block px-3">
                  <Pincelada color={OLIVA} className="absolute inset-0 h-full w-full" />
                  <span className="f-kaushan relative text-3xl text-white">{seccion.nombre}</span>
                </h2>
              )}
              {compacta ? (
                <ul className="mt-2 grid gap-x-6 gap-y-2 rounded-2xl @md:grid-cols-2 bg-white/70 p-4 text-sm">
                  {seccion.platos.map((plato) => (
                    <li key={plato.id} className="flex items-center gap-2">
                      <span className="font-semibold uppercase">{plato.nombre}</span>
                      <span className="flex-1 border-b border-dotted border-black/25" />
                      <span className="font-bold tabular-nums" style={{ color: rojo }}>
                        {precio(plato, restaurante)}
                      </span>
                      <Agregar plato={plato} />
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="divide-y divide-black/10">
                  {seccion.platos.map((plato, i) => {
                    const derecha = i % 2 === 0;
                    return (
                      <li key={plato.id} className={`relative flex items-center gap-4 py-5 ${derecha ? "flex-row-reverse" : ""}`}>
                        <FotoRedonda
                          plato={plato}
                          className={`w-32 shrink-0 bg-white text-6xl shadow-[0_14px_30px_rgba(0,0,0,0.22)] @md:w-44 @md:text-7xl ${
                            derecha ? "-mr-10" : "-ml-10"
                          }`}
                          style={{ outline: "6px solid #ffffff" }}
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="flex items-center gap-2 font-bold uppercase tracking-wide">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: rojo }} />
                            {plato.nombre}
                          </h3>
                          {plato.descripcion && (
                            <p className="mt-1 text-[13px] leading-snug text-black/60">{plato.descripcion}</p>
                          )}
                          <p className="mt-1.5 text-lg font-bold tabular-nums" style={{ color: rojo }}>
                            {precio(plato, restaurante)}
                          </p>
                          <Etiquetas plato={plato} className="mt-1 text-black/55" />
                          <Agregar plato={plato} className="mt-2" />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </main>
      {pie}
    </div>
  );
}
