import { textoSobre } from "@/lib/utils";
import { CartaVacia, Etiquetas, Foto, Logo, precio, idSeccion, type PropsTema } from "./comun";
import { Agregar } from "./Agregar";
import { Destacados } from "./Destacados";
import { NavCategorias } from "./NavCategorias";
import { SelectorIdioma } from "./SelectorIdioma";

// Claro, con los dos colores del restaurante. Es el diseño original.
export function TemaClasico({ restaurante, secciones, vistaPrevia, pie }: PropsTema) {
  const primario = restaurante.color_primario;
  const fondo = restaurante.color_fondo;
  const tinta = textoSobre(fondo);

  return (
    <div
      className={`pb-28 ${vistaPrevia ? "" : "min-h-screen"}`}
      style={
        {
          background: fondo,
          color: tinta,
          "--acento": primario,
          "--sobre-acento": textoSobre(primario),
          "--nav-bg": `color-mix(in srgb, ${fondo} 85%, transparent)`,
          "--chip-bg": "rgba(255,255,255,0.85)",
          "--chip-text": "#44403c",
          "--chip-activo-bg": primario,
          "--chip-activo-text": textoSobre(primario),
          "--pie-bg": "#ffffff",
          "--pie-text": "#44403c",
        } as React.CSSProperties
      }
    >
      <header className="relative px-5 pb-8 pt-10 text-center" style={{ background: primario, color: textoSobre(primario) }}>
        <SelectorIdioma className="absolute right-3 top-3" />
        <Logo
          restaurante={restaurante}
          className="mx-auto mb-3 h-20 w-20 rounded-full border-4 border-white/80 object-cover shadow-md"
        />
        <h1 className="font-serif text-3xl font-semibold">{restaurante.nombre}</h1>
        {restaurante.descripcion && <p className="mx-auto mt-1 max-w-md text-sm opacity-85">{restaurante.descripcion}</p>}
      </header>

      {secciones.length > 0 && <NavCategorias categorias={secciones} />}

      <main className="mx-auto max-w-2xl px-4">
        {secciones.length === 0 && <CartaVacia />}
        <Destacados
          restaurante={restaurante}
          secciones={secciones}
          className="pt-6"
          claseTitulo="font-serif text-2xl font-semibold"
          style={{ "--dest-bg": "#ffffff", "--dest-text": "#1c1917" } as React.CSSProperties}
        />
        {secciones.map((seccion) => (
          <section key={seccion.id} id={idSeccion(seccion.id)} className="scroll-mt-16 pt-8">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-widest" style={{ color: primario }}>
              {seccion.nombre}
            </h2>
            <ul className="space-y-3">
              {seccion.platos.map((plato) => (
                <li key={plato.id} className="flex gap-4 rounded-2xl bg-white/70 p-3 shadow-sm ring-1 ring-black/5">
                  <div className="min-w-0 flex-1 py-0.5">
                    <h3 className="font-semibold leading-snug text-stone-900">{plato.nombre}</h3>
                    {plato.descripcion && <p className="mt-0.5 text-sm leading-snug text-stone-600">{plato.descripcion}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-semibold tabular-nums" style={{ color: primario }}>
                        {precio(plato, restaurante)}
                      </span>
                      <Etiquetas plato={plato} className="text-stone-600" />
                      <Agregar plato={plato} className="ml-auto" />
                    </div>
                  </div>
                  <Foto plato={plato} className="h-24 w-24 shrink-0 rounded-xl object-cover" />
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
