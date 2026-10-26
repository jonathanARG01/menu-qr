import { textoSobre } from "@/lib/utils";
import { CartaVacia, Etiquetas, Foto, Logo, precio, idSeccion, type PropsTema } from "./comun";
import { NavCategorias } from "./NavCategorias";

// Fondo casi negro, fotos grandes y acentos cálidos.
export function TemaNoir({ restaurante, secciones, vistaPrevia, pie }: PropsTema) {
  const acento = restaurante.color_primario;

  return (
    <div
      className={`f-montserrat pb-28 text-stone-100 ${vistaPrevia ? "" : "min-h-screen"}`}
      style={
        {
          background: "radial-gradient(120% 60% at 50% 0%, #26221f 0%, #0f0f10 60%)",
          backgroundColor: "#0f0f10",
          "--acento": acento,
          "--sobre-acento": textoSobre(acento),
          "--nav-bg": "rgba(15,15,16,0.82)",
          "--chip-bg": "rgba(255,255,255,0.06)",
          "--chip-text": "#d6d3d1",
          "--chip-activo-bg": acento,
          "--chip-activo-text": textoSobre(acento),
          "--pie-bg": "#1c1a19",
          "--pie-text": "#f5f5f4",
        } as React.CSSProperties
      }
    >
      <header className="px-6 pb-10 pt-14 text-center">
        <Logo
          restaurante={restaurante}
          className="mx-auto mb-5 h-20 w-20 rounded-full object-cover"
          style={{ boxShadow: `0 0 0 4px #1b1918, 0 0 0 6px ${acento}` }}
        />
        <p className="text-[11px] font-semibold uppercase tracking-[0.45em]" style={{ color: acento }}>
          Carta
        </p>
        <h1 className="f-playfair mt-3 text-4xl font-semibold leading-tight @md:text-5xl">{restaurante.nombre}</h1>
        {restaurante.descripcion && <p className="mx-auto mt-3 max-w-md text-sm text-stone-400">{restaurante.descripcion}</p>}
        <div className="mx-auto mt-6 h-px w-16" style={{ background: acento }} />
      </header>

      {secciones.length > 0 && <NavCategorias categorias={secciones} claseChip="tracking-wide" />}

      <main className="mx-auto max-w-2xl px-5">
        {secciones.length === 0 && <CartaVacia />}
        {secciones.map((seccion) => {
          const conFoto = seccion.platos.filter((p) => p.foto_url);
          const sinFoto = seccion.platos.filter((p) => !p.foto_url);
          return (
            <section key={seccion.id} id={idSeccion(seccion.id)} className="scroll-mt-16 pt-12">
              <h2 className="f-oswald mb-6 flex items-center gap-3 text-2xl font-medium uppercase tracking-[0.18em]">
                <span className="h-px w-8" style={{ background: acento }} />
                {seccion.nombre}
              </h2>

              {conFoto.length > 0 && (
                <div className="grid gap-8 @md:grid-cols-2">
                  {conFoto.map((plato) => (
                    <article key={plato.id}>
                      <Foto
                        plato={plato}
                        className="aspect-[4/3] w-full rounded-2xl object-cover shadow-[0_24px_48px_-12px_rgba(0,0,0,0.8)]"
                      />
                      <div className="mt-4 flex items-baseline justify-between gap-4">
                        <h3 className="text-base font-semibold uppercase tracking-wide">{plato.nombre}</h3>
                        <span className="f-oswald shrink-0 text-xl font-medium tabular-nums" style={{ color: acento }}>
                          {precio(plato, restaurante)}
                        </span>
                      </div>
                      {plato.descripcion && <p className="mt-1 text-sm leading-relaxed text-stone-400">{plato.descripcion}</p>}
                      <Etiquetas plato={plato} className="mt-2 text-stone-400" />
                    </article>
                  ))}
                </div>
              )}

              {sinFoto.length > 0 && (
                <ul className={`space-y-5 ${conFoto.length ? "mt-10" : ""}`}>
                  {sinFoto.map((plato) => (
                    <li key={plato.id}>
                      <div className="flex items-baseline gap-3">
                        <h3 className="text-[15px] font-semibold uppercase tracking-wide">{plato.nombre}</h3>
                        <span className="mb-1 flex-1 border-b border-dotted border-stone-600" />
                        <span className="f-oswald text-lg font-medium tabular-nums" style={{ color: acento }}>
                          {precio(plato, restaurante)}
                        </span>
                      </div>
                      {plato.descripcion && <p className="mt-1 text-sm text-stone-400">{plato.descripcion}</p>}
                      <Etiquetas plato={plato} className="mt-1 text-stone-400" />
                    </li>
                  ))}
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
