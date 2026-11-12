import { textoSobre } from "@/lib/utils";
import { CartaVacia, Etiquetas, Logo, precio, idSeccion, type PropsTema } from "./comun";
import { Agregar } from "./Agregar";
import { FotoCuadro, GranoCafe } from "./cafe";
import { Destacados } from "./Destacados";
import { NavCategorias } from "./NavCategorias";
import { SelectorIdioma } from "./SelectorIdioma";

const FONDO = "#1f130d";

// Granos repartidos por los bordes: [lado en %, alto en px, tamaño, giro].
const GRANOS: [string, number, number, number][] = [
  ["left:-14px", 30, 46, -30],
  ["left:6%", 150, 30, 20],
  ["right:-10px", 60, 52, 40],
  ["right:12%", 190, 26, -15],
  ["left:38%", 6, 22, 70],
];

// Café tostado oscuro con brillo naranjo, granos de café y tarjetas de vidrio.
export function TemaGrano({ restaurante, secciones, vistaPrevia, pie }: PropsTema) {
  const acento = restaurante.color_primario;

  return (
    <div
      className={`f-montserrat relative overflow-x-clip pb-28 text-stone-100 ${vistaPrevia ? "" : "min-h-screen"}`}
      style={
        {
          backgroundColor: FONDO,
          backgroundImage: `radial-gradient(70% 30% at 75% 0%, color-mix(in srgb, ${acento} 45%, transparent), transparent 75%)`,
          "--acento": acento,
          "--sobre-acento": textoSobre(acento),
          "--nav-bg": "rgba(31,19,13,0.92)",
          "--chip-bg": "rgba(255,255,255,0.08)",
          "--chip-text": "#e7d8c9",
          "--chip-activo-bg": acento,
          "--chip-activo-text": textoSobre(acento),
          "--pie-bg": "#140c08",
          "--pie-text": "#ffffff",
        } as React.CSSProperties
      }
    >
      {GRANOS.map(([lado, top, w, giro], i) => {
        const [prop, valor] = lado.split(":");
        return (
          <GranoCafe
            key={i}
            className="pointer-events-none absolute opacity-90 drop-shadow-xl"
            style={{ [prop]: valor, top, width: w, transform: `rotate(${giro}deg)` }}
          />
        );
      })}
      <header className="relative px-6 pb-10 pt-14">
        <SelectorIdioma className="absolute right-4 top-4 z-10" style={{ background: "rgba(0,0,0,0.35)" }} />
        <Logo restaurante={restaurante} className="mb-4 h-14 w-14 rounded-full object-cover" />
        <h1 className="max-w-xs text-4xl font-semibold leading-tight @md:max-w-md @md:text-5xl" style={{ color: acento }}>
          {restaurante.nombre}
        </h1>
        {restaurante.descripcion && <p className="mt-3 max-w-sm text-sm text-stone-300">{restaurante.descripcion}</p>}
      </header>

      {secciones.length > 0 && <NavCategorias categorias={secciones} claseChip="font-medium" />}

      <main className="relative mx-auto max-w-3xl px-4">
        {secciones.length === 0 && <CartaVacia />}
        <Destacados
          restaurante={restaurante}
          secciones={secciones}
          className="pt-8"
          claseTitulo="text-2xl font-semibold"
          style={{ "--dest-bg": "rgba(255,255,255,0.07)" } as React.CSSProperties}
        />
        {secciones.map((seccion) => (
          <section key={seccion.id} id={idSeccion(seccion.id)} className="scroll-mt-16 pt-10">
            <h2 className="mb-5 text-2xl font-semibold" style={{ color: acento }}>
              {seccion.nombre}
            </h2>
            <ul className="grid grid-cols-2 gap-3 @md:grid-cols-3">
              {seccion.platos.map((plato) => (
                <li
                  key={plato.id}
                  className="flex flex-col rounded-2xl border border-white/10 p-2.5 backdrop-blur"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                >
                  <FotoCuadro
                    plato={plato}
                    className="aspect-square w-full rounded-xl text-6xl"
                    style={{ background: "linear-gradient(160deg, #f6d6a6, #e3b27a)" }}
                  />
                  <h3 className="mt-2.5 text-center text-sm font-semibold leading-tight">{plato.nombre}</h3>
                  {plato.descripcion && (
                    <p className="mt-1 text-center text-[11px] leading-snug text-stone-400">{plato.descripcion}</p>
                  )}
                  <Etiquetas plato={plato} className="mt-1 justify-center text-stone-400" />
                  <div className="mt-auto flex items-center justify-between gap-2 pt-2.5">
                    <span className="text-sm font-semibold tabular-nums text-stone-200">{precio(plato, restaurante)}</span>
                    <Agregar plato={plato} />
                  </div>
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
