import { textoSobre } from "@/lib/utils";
import { CartaVacia, Etiquetas, Foto, Logo, precio, idSeccion, type PropsTema } from "./comun";
import { NavCategorias } from "./NavCategorias";

const CAFE = "#3a2c25";
const CREMA = "#f4ecdc";

// Tarjetas crema y café, letras condensadas y una foto protagonista arriba.
export function TemaRetro({ restaurante, secciones, vistaPrevia, pie }: PropsTema) {
  const acento = restaurante.color_primario;
  const portada = secciones.flatMap((s) => s.platos).find((p) => p.foto_url);

  return (
    <div
      className={`f-montserrat px-3 pb-28 pt-3 ${vistaPrevia ? "" : "min-h-screen"}`}
      style={
        {
          color: CAFE,
          background: `linear-gradient(180deg, #4a382f 0%, ${CAFE} 40%)`,
          backgroundColor: CAFE,
          "--acento": acento,
          "--sobre-acento": textoSobre(acento),
          "--nav-bg": "rgba(58,44,37,0.9)",
          "--chip-bg": "rgba(244,236,220,0.1)",
          "--chip-text": CREMA,
          "--chip-activo-bg": acento,
          "--chip-activo-text": textoSobre(acento),
          "--pie-bg": CREMA,
          "--pie-text": CAFE,
        } as React.CSSProperties
      }
    >
      <header className="mx-auto max-w-2xl overflow-hidden rounded-[2rem] text-center" style={{ background: CREMA }}>
        <div className="flex items-center justify-between px-5 pt-5">
          <span className="h-9 w-9 rounded-full" style={{ background: acento }} />
          <Logo restaurante={restaurante} className="h-14 w-14 rounded-full object-cover" />
          <span className="h-9 w-9 rounded-full" style={{ background: acento }} />
        </div>
        <h1 className="f-oswald mt-3 px-5 text-4xl font-semibold uppercase leading-none tracking-wide" style={{ color: acento }}>
          {restaurante.nombre}
        </h1>
        {restaurante.descripcion && <p className="mt-2 px-6 text-sm opacity-70">{restaurante.descripcion}</p>}
        {portada ? (
          <div className="relative mt-5">
            <Foto plato={portada} className="aspect-[4/3] w-full object-cover" />
            <span
              className="f-oswald absolute bottom-4 left-4 rounded-full px-4 py-1 text-sm font-semibold uppercase tracking-wide"
              style={{ background: acento, color: textoSobre(acento) }}
            >
              {portada.nombre} · {precio(portada, restaurante)}
            </span>
          </div>
        ) : (
          <div className="h-6" />
        )}
      </header>

      {secciones.length > 0 && (
        <div className="-mx-3 mt-3">
          <NavCategorias categorias={secciones} claseChip="f-oswald uppercase tracking-wide" />
        </div>
      )}

      <main className="mx-auto mt-3 max-w-2xl space-y-3">
        {secciones.length === 0 && <CartaVacia className="text-[#f4ecdc]" />}
        {secciones.map((seccion, i) => {
          const oscura = i % 2 === 1;
          return (
            <section
              key={seccion.id}
              id={idSeccion(seccion.id)}
              className="scroll-mt-16 rounded-[2rem] px-5 py-6"
              style={oscura ? { background: "#2a201b", color: CREMA } : { background: CREMA, color: CAFE }}
            >
              <h2 className="f-oswald mb-4 flex items-center gap-2 text-2xl font-semibold uppercase tracking-wide">
                <span className="text-sm" style={{ color: acento }}>
                  ▲
                </span>
                {seccion.nombre}
              </h2>
              <ul className="divide-y" style={{ borderColor: oscura ? "rgba(244,236,220,0.12)" : "rgba(58,44,37,0.12)" }}>
                {seccion.platos.map((plato) => (
                  <li key={plato.id} className="flex items-center gap-3 border-inherit py-3">
                    <Foto plato={plato} className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="f-oswald text-lg font-medium uppercase leading-tight tracking-wide">{plato.nombre}</h3>
                        <span className="f-oswald shrink-0 text-lg font-semibold tabular-nums" style={{ color: acento }}>
                          {precio(plato, restaurante)}
                        </span>
                      </div>
                      {plato.descripcion && <p className="text-[13px] leading-snug opacity-70">{plato.descripcion}</p>}
                      <Etiquetas plato={plato} className="mt-0.5 opacity-70" />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </main>
      {pie}
    </div>
  );
}
