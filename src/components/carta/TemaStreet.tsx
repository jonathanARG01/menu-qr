import { textoSobre } from "@/lib/utils";
import { CartaVacia, Etiquetas, Foto, Logo, precio, idSeccion, type PropsTema } from "./comun";
import { NavCategorias } from "./NavCategorias";

// Colores de las etiquetas de categoría: la primera usa el color del restaurante.
const OTROS = ["#e63946", "#8ac926", "#fb8500", "#3a86ff"];

// Pizarra negra, etiquetas tipo brochazo, precios con puntos guía y tiras de fotos.
export function TemaStreet({ restaurante, secciones, vistaPrevia, pie }: PropsTema) {
  const acento = restaurante.color_primario;
  const colores = [acento, ...OTROS];

  return (
    <div
      className={`f-montserrat pb-28 text-white ${vistaPrevia ? "" : "min-h-screen"}`}
      style={
        {
          backgroundColor: "#121212",
          backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
          "--acento": acento,
          "--sobre-acento": textoSobre(acento),
          "--nav-bg": "rgba(18,18,18,0.9)",
          "--chip-bg": "rgba(255,255,255,0.08)",
          "--chip-text": "#f5f5f5",
          "--chip-activo-bg": acento,
          "--chip-activo-text": textoSobre(acento),
          "--pie-bg": "#1f1f1f",
          "--pie-text": "#ffffff",
        } as React.CSSProperties
      }
    >
      <header className="relative overflow-hidden px-6 pb-10 pt-12 text-center">
        <Logo restaurante={restaurante} className="mx-auto mb-4 h-20 w-20 rounded-full border-4 border-white object-cover" />
        <h1
          className="f-pacifico text-5xl leading-tight @md:text-6xl"
          style={{ color: acento, textShadow: "3px 3px 0 rgba(0,0,0,0.6)" }}
        >
          {restaurante.nombre}
        </h1>
        {restaurante.descripcion && (
          <p
            className="f-oswald mx-auto mt-4 inline-block -rotate-2 px-5 py-1.5 text-base font-medium uppercase tracking-wide text-white shadow-lg"
            style={{ background: "#e63946" }}
          >
            {restaurante.descripcion}
          </p>
        )}
      </header>

      {secciones.length > 0 && <NavCategorias categorias={secciones} claseChip="f-oswald uppercase tracking-wide" />}

      <main className="mx-auto max-w-2xl space-y-10 px-4 pt-8">
        {secciones.length === 0 && <CartaVacia />}
        {secciones.map((seccion, i) => {
          const color = colores[i % colores.length];
          const fotos = seccion.platos.filter((p) => p.foto_url);
          return (
            <section
              key={seccion.id}
              id={idSeccion(seccion.id)}
              className="relative scroll-mt-20 rounded-2xl border-2 bg-black/40 px-4 pb-5 pt-9"
              style={{ borderColor: `color-mix(in srgb, ${color} 70%, transparent)` }}
            >
              <h2
                className="f-oswald absolute -top-5 left-4 px-5 py-1.5 text-2xl font-semibold uppercase italic tracking-wide"
                style={{
                  background: color,
                  color: textoSobre(color),
                  clipPath: "polygon(2% 8%, 100% 0, 97% 92%, 0 100%)",
                }}
              >
                {seccion.nombre}
              </h2>
              <ul className="space-y-3">
                {seccion.platos.map((plato) => (
                  <li key={plato.id}>
                    <div className="flex items-baseline gap-2">
                      <h3 className="font-semibold">{plato.nombre}</h3>
                      <span className="mb-1 flex-1 border-b-2 border-dotted border-white/25" />
                      <span className="f-oswald text-lg font-semibold tabular-nums" style={{ color }}>
                        {precio(plato, restaurante)}
                      </span>
                    </div>
                    {plato.descripcion && <p className="text-[13px] text-white/60">{plato.descripcion}</p>}
                    <Etiquetas plato={plato} className="mt-0.5 text-white/60" />
                  </li>
                ))}
              </ul>
              {fotos.length > 0 && (
                <div className="-mx-4 mt-5 flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
                  {fotos.map((plato, j) => (
                    <figure key={plato.id} className={`w-40 shrink-0 ${j % 2 ? "rotate-2" : "-rotate-2"}`}>
                      <Foto
                        plato={plato}
                        className="aspect-[4/3] w-full rounded-xl object-cover shadow-xl ring-2 ring-white/10"
                      />
                      <figcaption className="f-oswald mt-1.5 truncate text-center text-xs uppercase tracking-wide text-white/70">
                        {plato.nombre}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </main>
      {pie}
    </div>
  );
}
