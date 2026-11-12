import { textoSobre } from "@/lib/utils";
import { CartaVacia, Etiquetas, Logo, precio, idSeccion, type PropsTema } from "./comun";
import { Agregar } from "./Agregar";
import { FotoCuadro, TazaCapas, capasBebida } from "./cafe";
import { Destacados } from "./Destacados";
import { NavCategorias } from "./NavCategorias";
import { SelectorIdioma } from "./SelectorIdioma";

const PARED = "#33241b";

// Pared oscura con letras de bronce en relieve; cada café es una taza de línea con sus capas (espresso, leche, espuma).
export function TemaMuro({ restaurante, secciones, vistaPrevia, pie }: PropsTema) {
  const bronce = restaurante.color_primario;
  const relieve = "0 2px 0 rgba(0,0,0,0.45), 0 8px 16px rgba(0,0,0,0.45)";

  return (
    <div
      className={`f-montserrat pb-28 text-[#efe0c6] ${vistaPrevia ? "" : "min-h-screen"}`}
      style={
        {
          backgroundColor: PARED,
          backgroundImage:
            "radial-gradient(30% 18% at 20% 0%, rgba(255,214,150,0.18), transparent 70%), radial-gradient(30% 18% at 80% 0%, rgba(255,214,150,0.14), transparent 70%), radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "auto, auto, 4px 4px",
          "--acento": bronce,
          "--sobre-acento": textoSobre(bronce),
          "--nav-bg": "rgba(41,29,22,0.94)",
          "--chip-bg": "rgba(255,255,255,0.06)",
          "--chip-text": "#efe0c6",
          "--chip-activo-bg": bronce,
          "--chip-activo-text": textoSobre(bronce),
          "--pie-bg": "#1f1611",
          "--pie-text": "#ffffff",
        } as React.CSSProperties
      }
    >
      <header className="relative px-6 pb-10 pt-14 text-center">
        <SelectorIdioma className="absolute right-4 top-4" style={{ background: "rgba(0,0,0,0.3)" }} />
        <Logo
          restaurante={restaurante}
          className="mx-auto mb-5 h-16 w-16 rounded-full object-cover"
          style={{ boxShadow: relieve }}
        />
        <h1
          className="text-3xl font-medium uppercase leading-tight tracking-[0.35em] @md:text-5xl"
          style={{ color: bronce, textShadow: relieve }}
        >
          {restaurante.nombre}
        </h1>
        {restaurante.descripcion && <p className="mx-auto mt-4 max-w-sm text-sm text-[#efe0c6]/70">{restaurante.descripcion}</p>}
      </header>

      {secciones.length > 0 && <NavCategorias categorias={secciones} claseChip="uppercase tracking-[0.15em] text-[12px]" />}

      <main className="mx-auto max-w-3xl px-4">
        {secciones.length === 0 && <CartaVacia />}
        <Destacados
          restaurante={restaurante}
          secciones={secciones}
          className="pt-8"
          claseTitulo="text-xl font-medium uppercase tracking-[0.25em]"
          style={{ "--dest-bg": "#3f2d22" } as React.CSSProperties}
        />
        {secciones.map((seccion) => (
          <section key={seccion.id} id={idSeccion(seccion.id)} className="scroll-mt-16 pt-12">
            <h2
              className="mb-8 text-center text-2xl font-medium uppercase tracking-[0.3em]"
              style={{ color: bronce, textShadow: relieve }}
            >
              {seccion.nombre}
            </h2>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-10 @md:grid-cols-3">
              {seccion.platos.map((plato) => {
                const capas = plato.foto_url ? null : capasBebida(plato.nombre);
                return (
                  <li key={plato.id} className="flex flex-col items-center text-center">
                    {capas ? (
                      <TazaCapas capas={capas} trazo={bronce} className="h-28 w-32 drop-shadow-[0_8px_10px_rgba(0,0,0,0.5)]" />
                    ) : (
                      <FotoCuadro
                        plato={plato}
                        className="h-28 w-28 rounded-2xl text-5xl"
                        style={{ border: `3px solid ${bronce}`, boxShadow: relieve, background: "rgba(0,0,0,0.15)" }}
                      />
                    )}
                    <h3 className="mt-3 text-[13px] font-semibold uppercase tracking-[0.2em]">{plato.nombre}</h3>
                    {plato.descripcion && <p className="mt-1 text-[11px] leading-snug text-[#efe0c6]/65">{plato.descripcion}</p>}
                    <span className="mt-1.5 text-base font-semibold tabular-nums" style={{ color: bronce }}>
                      {precio(plato, restaurante)}
                    </span>
                    <Etiquetas plato={plato} className="mt-1 justify-center text-[#efe0c6]/65" />
                    <Agregar plato={plato} className="mt-2" />
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
