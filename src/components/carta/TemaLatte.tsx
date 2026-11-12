import { textoSobre } from "@/lib/utils";
import { CartaVacia, Etiquetas, FotoRedonda, Logo, precio, idSeccion, type PropsTema } from "./comun";
import { Agregar } from "./Agregar";
import { Destacados } from "./Destacados";
import { useCarta } from "./contexto";
import { NavCategorias } from "./NavCategorias";
import { SelectorIdioma } from "./SelectorIdioma";

const TINTA = "#2a0f0b";

// Fondo de cafetería desenfocado, un panel de vidrio color crema y tazas vistas desde arriba.
export function TemaLatte({ restaurante, secciones, vistaPrevia, pie }: PropsTema) {
  const acento = restaurante.color_primario;
  const { t } = useCarta();

  return (
    <div
      className={`f-montserrat px-3 pb-28 pt-4 ${vistaPrevia ? "" : "min-h-screen"}`}
      style={
        {
          color: TINTA,
          backgroundColor: "#a8927c",
          backgroundImage:
            "radial-gradient(55% 35% at 15% 8%, #d8c6ae 0%, transparent 70%), radial-gradient(45% 35% at 95% 35%, #6d5442 0%, transparent 70%), radial-gradient(60% 40% at 5% 75%, #8a6f59 0%, transparent 70%), radial-gradient(50% 30% at 85% 95%, #c9b39a 0%, transparent 70%)",
          "--acento": acento,
          "--sobre-acento": textoSobre(acento),
          "--nav-bg": "rgba(236,226,212,0.9)",
          "--chip-bg": "rgba(255,255,255,0.55)",
          "--chip-text": TINTA,
          "--chip-activo-bg": acento,
          "--chip-activo-text": textoSobre(acento),
          "--pie-bg": TINTA,
          "--pie-text": "#ffffff",
        } as React.CSSProperties
      }
    >
      <div
        className="mx-auto max-w-3xl rounded-[2rem] pb-10 shadow-[0_30px_60px_-20px_rgba(42,15,11,0.45)] backdrop-blur-xl"
        style={{ background: "rgba(238,228,214,0.8)" }}
      >
        <header className="relative px-6 pb-8 pt-8">
          <div className="flex items-center gap-3">
            <Logo restaurante={restaurante} className="h-11 w-11 rounded-full object-cover shadow" />
            <span className="text-sm font-semibold leading-tight">
              {restaurante.nombre}
              <span className="block text-[11px] font-normal opacity-70">☕ {t("carta")}</span>
            </span>
            <SelectorIdioma className="ml-auto" style={{ background: TINTA, color: "#fff" }} />
          </div>
          <h1 className="mt-8 text-4xl font-bold leading-[1.05] @md:text-5xl">{restaurante.nombre}</h1>
          {restaurante.descripcion && <p className="mt-3 max-w-md text-sm opacity-75">{restaurante.descripcion}</p>}
          <span
            className="mt-5 inline-block rounded-full px-6 py-2.5 text-sm font-semibold shadow-lg"
            style={{ background: acento, color: textoSobre(acento) }}
          >
            {t("carta")}
          </span>
        </header>

        {secciones.length > 0 && <NavCategorias categorias={secciones} claseChip="font-semibold shadow-sm" />}

        <main className="px-4 @md:px-6">
          {secciones.length === 0 && <CartaVacia />}
          <Destacados
            restaurante={restaurante}
            secciones={secciones}
            className="pt-6"
            claseTitulo="text-2xl font-bold"
            style={{ "--dest-bg": "#f7efe4", "--dest-text": TINTA } as React.CSSProperties}
          />
          {secciones.map((seccion) => (
            <section key={seccion.id} id={idSeccion(seccion.id)} className="scroll-mt-16 pt-8">
              <h2 className="text-2xl font-bold">{seccion.nombre}</h2>
              <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-4 @md:grid-cols-3">
                {seccion.platos.map((plato) => (
                  <li
                    key={plato.id}
                    className="relative mt-14 flex flex-col rounded-[1.6rem] px-3 pb-7 pt-[4.75rem] text-left shadow-[0_12px_24px_-12px_rgba(42,15,11,0.35)]"
                    style={{ background: "linear-gradient(180deg, #e9ddcd, #f8f1e7)" }}
                  >
                    <FotoRedonda
                      plato={plato}
                      className="absolute -top-12 left-1/2 w-28 -translate-x-1/2 bg-white text-5xl"
                      style={{ boxShadow: "0 0 0 7px #ffffff, 0 16px 26px rgba(42,15,11,0.35)" }}
                    />
                    <h3 className="text-[15px] font-semibold leading-tight">{plato.nombre}</h3>
                    {plato.descripcion && <p className="mt-1 text-[11px] leading-snug opacity-70">{plato.descripcion}</p>}
                    <Etiquetas plato={plato} className="mt-1.5 opacity-75" />
                    <Agregar plato={plato} className="mt-2 self-center" />
                    <span
                      className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-lg px-3 py-1 text-sm font-bold tabular-nums shadow"
                      style={{ background: TINTA, color: "#fff" }}
                    >
                      {precio(plato, restaurante)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </main>
      </div>
      {pie}
    </div>
  );
}
