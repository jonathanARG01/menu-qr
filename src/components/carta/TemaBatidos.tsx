import { textoSobre } from "@/lib/utils";
import { CartaVacia, Etiquetas, FotoRedonda, Logo, ingredientes, precio, idSeccion, type PropsTema } from "./comun";
import { Agregar } from "./Agregar";
import { Destacados } from "./Destacados";
import { useCarta } from "./contexto";
import { NavCategorias } from "./NavCategorias";
import { SelectorIdioma } from "./SelectorIdioma";

const AMARILLO = "#ffc62a";
const CHOCOLATE = "#3b1f0e";

// Amarillo alegre, título redondo en marrón, frases a mano y cada producto con su número.
export function TemaBatidos({ restaurante, secciones, vistaPrevia, pie }: PropsTema) {
  const acento = restaurante.color_primario;
  const { t } = useCarta();
  // Numeración corrida en toda la carta, como en el afiche.
  const inicio = secciones.map((_, i) => secciones.slice(0, i).reduce((n, s) => n + s.platos.length, 0));

  return (
    <div
      className={`f-montserrat overflow-hidden pb-28 ${vistaPrevia ? "" : "min-h-screen"}`}
      style={
        {
          color: CHOCOLATE,
          backgroundColor: AMARILLO,
          backgroundImage:
            "radial-gradient(circle at 80% 10%, rgba(255,255,255,0.45), transparent 35%), radial-gradient(circle at 0% 70%, rgba(255,150,0,0.35), transparent 40%)",
          "--acento": acento,
          "--sobre-acento": textoSobre(acento),
          "--nav-bg": "rgba(255,198,42,0.94)",
          "--chip-bg": "rgba(59,31,14,0.08)",
          "--chip-text": CHOCOLATE,
          "--chip-activo-bg": CHOCOLATE,
          "--chip-activo-text": "#ffffff",
          "--pie-bg": CHOCOLATE,
          "--pie-text": "#ffffff",
        } as React.CSSProperties
      }
    >
      <header className="relative mx-auto max-w-3xl px-6 pb-8 pt-12 text-center">
        <SelectorIdioma className="absolute right-4 top-4" style={{ background: CHOCOLATE }} />
        <Logo restaurante={restaurante} className="mx-auto mb-3 h-16 w-16 rounded-full object-cover" />
        <p className="f-caveat text-3xl leading-none">{t("carta")}</p>
        <h1 className="f-fredoka text-6xl font-bold uppercase leading-[0.95] @md:text-7xl">{restaurante.nombre}</h1>
        {restaurante.descripcion && (
          <p
            className="f-caveat mx-auto mt-5 inline-block -rotate-3 px-6 py-2 text-2xl leading-tight"
            style={{ background: CHOCOLATE, color: "#fff6dc", borderRadius: "40% 55% 45% 60% / 60% 45% 55% 40%" }}
          >
            {restaurante.descripcion} ♡
          </p>
        )}
      </header>

      {secciones.length > 0 && <NavCategorias categorias={secciones} claseChip="f-fredoka font-semibold" />}

      <main className="mx-auto max-w-3xl px-4">
        {secciones.length === 0 && <CartaVacia />}
        <Destacados
          restaurante={restaurante}
          secciones={secciones}
          className="pt-6"
          claseTitulo="f-fredoka text-3xl font-bold"
          claseNombre="f-fredoka text-lg font-semibold"
          style={{ "--dest-bg": "#fff6dc", "--dest-text": CHOCOLATE } as React.CSSProperties}
        />
        {secciones.map((seccion, s) => (
          <section key={seccion.id} id={idSeccion(seccion.id)} className="scroll-mt-16 pt-8">
            <h2 className="f-fredoka mb-4 text-center text-3xl font-bold">{seccion.nombre}</h2>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-8 @md:grid-cols-3">
              {seccion.platos.map((plato, i) => {
                const numero = inicio[s] + i + 1;
                return (
                  <li key={plato.id} className="flex flex-col items-center">
                    <FotoRedonda
                      plato={plato}
                      className="w-32 text-6xl"
                      style={{ background: "rgba(255,255,255,0.35)", boxShadow: "0 16px 30px rgba(140,80,0,0.25)" }}
                    />
                    <div className="mt-3 flex w-full items-start gap-2">
                      <span
                        className="f-fredoka flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                        style={{ background: CHOCOLATE, color: AMARILLO }}
                      >
                        {numero}
                      </span>
                      <div className="min-w-0">
                        <h3 className="f-fredoka text-lg font-bold leading-tight">{plato.nombre}</h3>
                        {plato.descripcion && (
                          <p className="text-xs leading-snug opacity-80">{ingredientes(plato.descripcion).join(" + ")}</p>
                        )}
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span
                            className="f-fredoka rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums"
                            style={{ background: CHOCOLATE, color: "#fff6dc" }}
                          >
                            {precio(plato, restaurante)}
                          </span>
                          <Agregar plato={plato} />
                        </div>
                        <Etiquetas plato={plato} className="mt-1 opacity-75" />
                      </div>
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
