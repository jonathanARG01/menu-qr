import { textoSobre } from "@/lib/utils";
import { CartaVacia, Etiquetas, FotoRedonda, Logo, ingredientes, precio, idSeccion, type PropsTema } from "./comun";
import { Agregar } from "./Agregar";
import { Destacados } from "./Destacados";
import { useCarta } from "./contexto";
import { NavCategorias } from "./NavCategorias";
import { SelectorIdioma } from "./SelectorIdioma";

const CREMA = "#efe6cf";

// Pizarra negra, título con letras gastadas y precios grandes en blanco.
export function TemaCoctel({ restaurante, secciones, vistaPrevia, pie }: PropsTema) {
  const rosa = restaurante.color_primario;
  const { t } = useCarta();

  return (
    <div
      className={`f-montserrat pb-28 text-white ${vistaPrevia ? "" : "min-h-screen"}`}
      style={
        {
          backgroundColor: "#0d0d0d",
          backgroundImage:
            "radial-gradient(ellipse at 30% 0%, rgba(255,255,255,0.08), transparent 55%), radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 3px 3px",
          "--acento": rosa,
          "--sobre-acento": textoSobre(rosa),
          "--nav-bg": "rgba(13,13,13,0.94)",
          "--chip-bg": "rgba(255,255,255,0.07)",
          "--chip-text": CREMA,
          "--chip-activo-bg": rosa,
          "--chip-activo-text": textoSobre(rosa),
          "--pie-bg": "#1a1a1a",
          "--pie-text": "#ffffff",
        } as React.CSSProperties
      }
    >
      <header className="relative px-6 pb-8 pt-12 text-center">
        <SelectorIdioma className="absolute right-4 top-4" style={{ background: "rgba(255,255,255,0.1)" }} />
        <Logo restaurante={restaurante} className="mx-auto mb-3 h-16 w-16 rounded-full object-cover" />
        <p className="f-dirt text-4xl uppercase leading-none" style={{ color: CREMA }}>
          {t("carta")}
        </p>
        <h1 className="f-dirt text-5xl uppercase leading-none @md:text-6xl" style={{ color: CREMA }}>
          {restaurante.nombre}
        </h1>
        {restaurante.descripcion && (
          <p className="mt-4 text-sm font-semibold uppercase tracking-[0.4em]" style={{ color: rosa }}>
            {restaurante.descripcion}
          </p>
        )}
      </header>

      {secciones.length > 0 && <NavCategorias categorias={secciones} claseChip="font-bold uppercase tracking-wide" />}

      <main className="mx-auto max-w-3xl px-4">
        {secciones.length === 0 && <CartaVacia />}
        <Destacados
          restaurante={restaurante}
          secciones={secciones}
          className="pt-6"
          claseTitulo="f-dirt text-3xl uppercase"
          claseNombre="font-bold uppercase"
          style={{ "--dest-bg": "#1a1a1a" } as React.CSSProperties}
        />
        {secciones.map((seccion) => (
          <section key={seccion.id} id={idSeccion(seccion.id)} className="scroll-mt-16 pt-8">
            <h2 className="f-dirt mb-5 text-center text-3xl uppercase" style={{ color: CREMA }}>
              {seccion.nombre}
            </h2>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-7 @md:grid-cols-3">
              {seccion.platos.map((plato) => (
                <li key={plato.id} className="flex gap-2">
                  <FotoRedonda plato={plato} className="w-12 shrink-0 self-start text-4xl" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[13px] font-extrabold uppercase leading-tight">{plato.nombre}</h3>
                    <ul className="mt-0.5 text-[11px] uppercase leading-snug text-white/80">
                      {ingredientes(plato.descripcion).map((ing) => (
                        <li key={ing}>{ing}</li>
                      ))}
                    </ul>
                    <p className="mt-1.5 text-2xl font-extrabold tabular-nums leading-none">{precio(plato, restaurante)}</p>
                    <Etiquetas plato={plato} className="mt-1 text-white/55" />
                    <Agregar plato={plato} className="mt-2 h-7 px-2.5 text-xs" />
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
