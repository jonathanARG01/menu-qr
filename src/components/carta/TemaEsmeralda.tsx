import { textoSobre } from "@/lib/utils";
import { CartaVacia, Etiquetas, Foto, Logo, precio, idSeccion, type PropsTema } from "./comun";
import { NavCategorias } from "./NavCategorias";

const CREMA = "#f1e6cf";

// Verde profundo, letras crema e itálicas, fotos en platos redondos unidas por un hilo dorado.
export function TemaEsmeralda({ restaurante, secciones, vistaPrevia, pie }: PropsTema) {
  const acento = restaurante.color_primario;

  return (
    <div
      className={`f-montserrat pb-28 ${vistaPrevia ? "" : "min-h-screen"}`}
      style={
        {
          color: CREMA,
          background: "radial-gradient(130% 70% at 50% 0%, #1b5646 0%, #0e3b30 55%, #0a2e25 100%)",
          backgroundColor: "#0e3b30",
          "--acento": acento,
          "--sobre-acento": textoSobre(acento),
          "--nav-bg": "rgba(11,47,38,0.85)",
          "--chip-bg": "rgba(241,230,207,0.08)",
          "--chip-text": CREMA,
          "--chip-activo-bg": acento,
          "--chip-activo-text": textoSobre(acento),
          "--pie-bg": "#123f34",
          "--pie-text": CREMA,
        } as React.CSSProperties
      }
    >
      <header className="px-6 pb-10 pt-14 text-center">
        <Logo restaurante={restaurante} className="mx-auto mb-5 h-20 w-20 rounded-full object-cover shadow-lg" />
        <h1 className="f-cormorant text-5xl font-semibold leading-none">{restaurante.nombre}</h1>
        <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.6em]" style={{ color: acento }}>
          Menú
        </p>
        {restaurante.descripcion && <p className="mx-auto mt-4 max-w-sm text-sm opacity-75">{restaurante.descripcion}</p>}
      </header>

      {secciones.length > 0 && <NavCategorias categorias={secciones} />}

      <main className="mx-auto max-w-xl px-5">
        {secciones.length === 0 && <CartaVacia />}
        {secciones.map((seccion) => (
          <section key={seccion.id} id={idSeccion(seccion.id)} className="scroll-mt-16 pt-12">
            <h2 className="f-cormorant mb-8 text-center text-4xl font-semibold" style={{ color: acento }}>
              <span className="mr-3 align-middle text-base opacity-70">✦</span>
              {seccion.nombre}
              <span className="ml-3 align-middle text-base opacity-70">✦</span>
            </h2>
            <ul>
              {seccion.platos.map((plato, i) => {
                const derecha = i % 2 === 1;
                return (
                  <li key={plato.id}>
                    {i > 0 && <Hilo invertido={derecha} color={acento} />}
                    {plato.foto_url ? (
                      <div className={`flex items-center gap-5 ${derecha ? "flex-row-reverse text-right" : ""}`}>
                        <Foto
                          plato={plato}
                          className="h-32 w-32 shrink-0 rounded-full object-cover shadow-[0_18px_36px_rgba(0,0,0,0.45)] ring-[6px] ring-[#e9dcc0] @md:h-40 @md:w-40"
                        />
                        <TextoPlato plato={plato} restaurante={restaurante} acento={acento} alinear={derecha ? "end" : "start"} />
                      </div>
                    ) : (
                      <div className="text-center">
                        <TextoPlato plato={plato} restaurante={restaurante} acento={acento} alinear="center" />
                      </div>
                    )}
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

function TextoPlato({
  plato,
  restaurante,
  acento,
  alinear,
}: {
  plato: PropsTema["secciones"][number]["platos"][number];
  restaurante: PropsTema["restaurante"];
  acento: string;
  alinear: "start" | "end" | "center";
}) {
  const justificar = { start: "justify-start", end: "justify-end", center: "justify-center" }[alinear];
  return (
    <div className="min-w-0 flex-1">
      <h3 className="f-cormorant text-2xl font-semibold leading-tight">{plato.nombre}</h3>
      {plato.descripcion && <p className="mt-1 text-[13px] leading-snug opacity-70">{plato.descripcion}</p>}
      <p className="mt-2 text-sm font-semibold tracking-wide tabular-nums" style={{ color: acento }}>
        {precio(plato, restaurante)}
      </p>
      <Etiquetas plato={plato} className={`mt-1 opacity-70 ${justificar}`} />
    </div>
  );
}

// Línea curva fina que une un plato con el siguiente, alternando de lado.
function Hilo({ invertido, color }: { invertido: boolean; color: string }) {
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="my-1 h-10 w-full" aria-hidden>
      <path
        d={invertido ? "M18 0 C 18 28, 82 12, 82 40" : "M82 0 C 82 28, 18 12, 18 40"}
        fill="none"
        stroke={color}
        strokeOpacity="0.55"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
