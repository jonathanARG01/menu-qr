import { textoSobre } from "@/lib/utils";
import { CartaVacia, Etiquetas, FotoRedonda, Logo, precio, idSeccion, type PropsTema } from "./comun";
import { Agregar } from "./Agregar";
import { Destacados } from "./Destacados";
import { NavCategorias } from "./NavCategorias";
import { SelectorIdioma } from "./SelectorIdioma";

const CREMA = "#f3eedd";

// Patrón suave de círculos para las franjas verdes.
const patron = (color: string) =>
  `radial-gradient(circle at 50% 50%, transparent 9px, ${color} 10px, transparent 11px), radial-gradient(circle at 50% 50%, transparent 17px, ${color} 18px, transparent 19px)`;

// Onda que separa una franja de la siguiente.
function Onda({ arriba, abajo, invertida }: { arriba: string; abajo: string; invertida?: boolean }) {
  return (
    <svg viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden className="block h-10 w-full" style={{ background: arriba }}>
      <path
        d={invertida ? "M0 40V18C80 0 140 36 210 22S330 0 400 14v26z" : "M0 40V14C70 0 150 34 220 20S340 2 400 20v20z"}
        fill={abajo}
      />
    </svg>
  );
}

// Franjas verdes y crema separadas por ondas, "MENÚ" en serif grande y platos redondos que alternan de lado.
export function TemaOriente({ restaurante, secciones, vistaPrevia, pie }: PropsTema) {
  const verde = restaurante.color_primario;
  const sobreVerde = textoSobre(verde);
  const fondoDe = (i: number) => (i % 2 === 0 ? CREMA : verde);

  return (
    <div
      className={`f-montserrat pb-28 ${vistaPrevia ? "" : "min-h-screen"}`}
      style={
        {
          backgroundColor: fondoDe(secciones.length - 1),
          color: verde,
          "--acento": verde,
          "--sobre-acento": sobreVerde,
          "--nav-bg": "rgba(243,238,221,0.94)",
          "--chip-bg": "rgba(0,0,0,0.05)",
          "--chip-text": verde,
          "--chip-activo-bg": verde,
          "--chip-activo-text": sobreVerde,
          "--pie-bg": CREMA,
          "--pie-text": verde,
        } as React.CSSProperties
      }
    >
      <header
        className="relative px-6 pb-8 pt-10 text-center"
        style={{
          background: verde,
          color: sobreVerde,
          backgroundImage: patron("rgba(255,255,255,0.07)"),
          backgroundSize: "56px 56px",
        }}
      >
        <SelectorIdioma className="absolute right-4 top-4" style={{ background: "rgba(255,255,255,0.15)", color: sobreVerde }} />
        <Logo restaurante={restaurante} className="mx-auto mb-4 h-16 w-16 rounded-full border-2 border-white/70 object-cover" />
        <p className="text-xs font-semibold uppercase tracking-[0.35em] opacity-80">{restaurante.nombre}</p>
        <h1 className="f-playfair mt-1 text-7xl font-bold uppercase leading-none tracking-wide @md:text-8xl">Menú</h1>
        {restaurante.descripcion && <p className="mx-auto mt-3 max-w-sm text-sm opacity-80">{restaurante.descripcion}</p>}
      </header>
      <Onda arriba={verde} abajo={CREMA} />

      {secciones.length > 0 && (
        <div style={{ background: CREMA }}>
          <NavCategorias categorias={secciones} claseChip="font-semibold uppercase tracking-wide" />
        </div>
      )}

      <main>
        {secciones.length === 0 && <CartaVacia className="bg-[#f3eedd]" />}
        <div style={{ background: CREMA }} className="px-5 pt-4">
          <Destacados
            restaurante={restaurante}
            secciones={secciones}
            className="mx-auto max-w-2xl"
            claseTitulo="f-playfair text-3xl font-bold uppercase"
            style={{ "--dest-bg": "#ffffff", "--dest-text": verde } as React.CSSProperties}
          />
        </div>
        {secciones.map((seccion, s) => {
          const fondo = fondoDe(s);
          const oscura = fondo !== CREMA;
          const texto = oscura ? sobreVerde : verde;
          return (
            <section key={seccion.id} id={idSeccion(seccion.id)} className="scroll-mt-16">
              <div
                className="px-5 pb-6 pt-4"
                style={
                  {
                    background: fondo,
                    color: texto,
                    // En las franjas verdes el botón de agregar va en crema para que se vea.
                    ...(oscura ? { "--acento": CREMA, "--sobre-acento": verde } : {}),
                    ...(oscura ? { backgroundImage: patron("rgba(255,255,255,0.06)"), backgroundSize: "56px 56px" } : {}),
                  } as React.CSSProperties
                }
              >
                <div className="mx-auto max-w-2xl">
                  <h2 className="f-playfair mb-2 text-center text-3xl font-bold uppercase tracking-wide">{seccion.nombre}</h2>
                  <ul>
                    {seccion.platos.map((plato, i) => {
                      const derecha = i % 2 === 1;
                      return (
                        <li
                          key={plato.id}
                          className={`flex items-center gap-4 py-3 ${derecha ? "flex-row-reverse text-right" : ""}`}
                        >
                          <FotoRedonda
                            plato={plato}
                            className="w-28 shrink-0 text-5xl shadow-[0_10px_24px_rgba(0,0,0,0.22)] @md:w-36 @md:text-6xl"
                            style={{
                              background: oscura ? "rgba(255,255,255,0.92)" : "#ffffff",
                              outline: `2px solid ${oscura ? CREMA : verde}`,
                              outlineOffset: "4px",
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <h3 className="text-base font-bold uppercase leading-tight tracking-wide">{plato.nombre}</h3>
                            {plato.descripcion && <p className="mt-1 text-[13px] leading-snug opacity-75">{plato.descripcion}</p>}
                            <p className="f-playfair mt-1.5 text-xl font-bold tabular-nums">{precio(plato, restaurante)}</p>
                            <Etiquetas plato={plato} className={`mt-1 opacity-70 ${derecha ? "justify-end" : ""}`} />
                            <Agregar plato={plato} className="mt-2" />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
              {s < secciones.length - 1 && <Onda arriba={fondo} abajo={fondoDe(s + 1)} invertida={s % 2 === 1} />}
            </section>
          );
        })}
      </main>
      {pie}
    </div>
  );
}
