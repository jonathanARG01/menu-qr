import { textoSobre } from "@/lib/utils";
import { CartaVacia, Etiquetas, FotoRedonda, Logo, precio, idSeccion, type PropsTema } from "./comun";
import { Agregar } from "./Agregar";
import { Destacados } from "./Destacados";
import { NavCategorias } from "./NavCategorias";
import { SelectorIdioma } from "./SelectorIdioma";

const VERDE = "#1d4a2f";
const CREMA = "#f6edd6";

// Verde intenso, título pintado a mano, cinta amarilla y platos redondos que alternan de lado sobre una franja crema.
export function TemaBistro({ restaurante, secciones, vistaPrevia, pie }: PropsTema) {
  const acento = restaurante.color_primario;

  return (
    <div
      className={`f-montserrat overflow-hidden pb-28 text-white ${vistaPrevia ? "" : "min-h-screen"}`}
      style={
        {
          backgroundColor: VERDE,
          backgroundImage:
            "radial-gradient(circle at 15% 10%, rgba(255,255,255,0.07), transparent 40%), radial-gradient(circle at 90% 60%, rgba(0,0,0,0.25), transparent 45%)",
          "--acento": acento,
          "--sobre-acento": textoSobre(acento),
          "--nav-bg": "rgba(23,58,37,0.92)",
          "--chip-bg": "rgba(246,237,214,0.1)",
          "--chip-text": CREMA,
          "--chip-activo-bg": acento,
          "--chip-activo-text": textoSobre(acento),
          "--pie-bg": CREMA,
          "--pie-text": VERDE,
        } as React.CSSProperties
      }
    >
      <header className="relative px-6 pb-8 pt-10 text-center">
        <SelectorIdioma className="absolute right-4 top-4" style={{ background: "rgba(255,255,255,0.12)" }} />
        <Logo restaurante={restaurante} className="mx-auto mb-3 h-16 w-16 rounded-full border-2 border-white/80 object-cover" />
        <p className="f-kaushan text-2xl leading-none" style={{ color: acento }}>
          Delicioso
        </p>
        <h1
          className="f-marker mt-1 text-5xl uppercase leading-[0.95] tracking-wide @md:text-6xl"
          style={{ textShadow: "0 3px 0 rgba(0,0,0,0.25)" }}
        >
          {restaurante.nombre}
        </h1>
        {restaurante.descripcion && (
          <p
            className="mx-auto mt-4 inline-block -rotate-1 px-5 py-1.5 text-xs font-bold uppercase tracking-[0.18em]"
            style={{
              background: acento,
              color: textoSobre(acento),
              clipPath: "polygon(2% 8%, 98% 0, 100% 88%, 1% 100%)",
            }}
          >
            {restaurante.descripcion}
          </p>
        )}
      </header>

      {secciones.length > 0 && <NavCategorias categorias={secciones} claseChip="font-bold uppercase tracking-wide" />}

      <main className="mx-auto max-w-2xl px-4 pt-4">
        {secciones.length === 0 && <CartaVacia />}
        <Destacados
          restaurante={restaurante}
          secciones={secciones}
          className="pt-4"
          claseTitulo="f-marker text-3xl uppercase"
          style={{ "--dest-bg": "#f6edd6", "--dest-text": "#1d4a2f", "--dest-precio": "#1d4a2f" } as React.CSSProperties}
        />
        {secciones.map((seccion) => (
          <section key={seccion.id} id={idSeccion(seccion.id)} className="scroll-mt-16 pt-6">
            <h2 className="f-marker mb-2 text-center text-3xl uppercase tracking-wide" style={{ color: acento }}>
              {seccion.nombre}
            </h2>
            <ul>
              {seccion.platos.map((plato, i) => {
                const derecha = i % 2 === 1;
                return (
                  <li
                    key={plato.id}
                    className={`relative flex items-center gap-4 py-4 ${derecha ? "flex-row-reverse text-right" : ""}`}
                  >
                    {/* Media luna crema que sale del borde y sostiene el plato */}
                    <span
                      aria-hidden
                      className={`absolute top-1/2 h-24 w-20 -translate-y-1/2 @md:h-32 @md:w-28 ${
                        derecha ? "-right-4 rounded-l-full" : "-left-4 rounded-r-full"
                      }`}
                      style={{ background: CREMA }}
                    />
                    <FotoRedonda
                      plato={plato}
                      className="relative w-28 shrink-0 text-5xl shadow-[0_12px_28px_rgba(0,0,0,0.35)] @md:w-36 @md:text-6xl"
                      style={{ background: "#fffaf0", outline: `4px solid ${CREMA}`, outlineOffset: "-2px" }}
                    />
                    <div className="relative min-w-0 flex-1">
                      <h3 className="f-marker text-xl uppercase leading-tight tracking-wide">{plato.nombre}</h3>
                      {plato.descripcion && (
                        <p className="mt-1 text-[13px] leading-snug text-white/80">
                          <span style={{ color: acento }}>• </span>
                          {plato.descripcion}
                        </p>
                      )}
                      <div className={`mt-2 flex flex-wrap items-center gap-3 ${derecha ? "justify-end" : ""}`}>
                        <span
                          className="f-marker rounded-md px-2.5 py-0.5 text-lg tabular-nums"
                          style={{ background: acento, color: textoSobre(acento) }}
                        >
                          {precio(plato, restaurante)}
                        </span>
                        <Agregar plato={plato} />
                      </div>
                      <Etiquetas plato={plato} className={`mt-1.5 text-white/70 ${derecha ? "justify-end" : ""}`} />
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
