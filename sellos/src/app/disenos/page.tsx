import Link from "next/link";
import { Etiqueta, SitioClub, Titulo } from "@/components/sitio/Marco";
import { Inclinable } from "@/components/Inclinable";
import { TarjetaVisual } from "@/components/TarjetaVisual";
import { DISENOS_SELLO, PROGRAMA_BASE, type DisenoSello } from "@/lib/tipos";

export const metadata = { title: "Diseños de tarjeta" };

// Galería pública de diseños (para mostrar a clientes y en la página de venta).
const EJEMPLOS: { color: string; icono: string; local: string; premio: string }[] = [
  { color: "#6b3e26", icono: "cafe", local: "Café del Cerro", premio: "Un café de regalo" },
  { color: "#1f2937", icono: "barberia", local: "Barbería Don Pepe", premio: "Un corte gratis" },
  { color: "#0e7490", icono: "padel", local: "Pádel Club Viña", premio: "Una hora de cancha" },
  { color: "#be185d", icono: "unas", local: "Nails Studio", premio: "Una manicure gratis" },
  { color: "#7c3aed", icono: "cerveza", local: "Bar La Ola", premio: "Una schop de regalo" },
  { color: "#166534", icono: "pelota", local: "Fútbol 7 El Arco", premio: "Un partido gratis" },
];

export default function PaginaDisenos() {
  const disenos = (Object.keys(DISENOS_SELLO) as DisenoSello[]).filter((d) => d !== "medida");
  return (
    <SitioClub>
      <main className="mx-auto max-w-6xl px-5 pb-16 pt-14">
        <div className="mx-auto max-w-2xl text-center">
          <Etiqueta centro>Diseños de tarjeta</Etiqueta>
          <h1 className="sr-only">Diseños de tarjeta</h1>
          <Titulo centro acento="con tu logo y tu color.">
            Todos incluidos,
          </Titulo>
          <p className="mt-4 text-suave">En todos los planes. Y si quieres, la hacemos a tu medida.</p>
          <Link href="/registro" className="boton-jade mt-6">
            Pruébalo gratis <span className="flecha">→</span>
          </Link>
        </div>
        <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {disenos.map((d, i) => {
            const e = EJEMPLOS[i % EJEMPLOS.length];
            return (
              <div key={d} className="flex flex-col items-center gap-3" data-diseno={d} data-revelar="zoom" style={{ "--retraso": `${(i % 3) * 110}ms` } as React.CSSProperties}>
                <Inclinable>
                  <TarjetaVisual
                    local={e.local}
                    programa={{ ...PROGRAMA_BASE, meta: 10, color: e.color, icono: e.icono as typeof PROGRAMA_BASE.icono, premio: e.premio, diseno: d, hitos: [{ sellos: 5, premio: "Un regalo chico" }] }}
                    sellos={6}
                    nombre="Elizabeth"
                  />
                </Inclinable>
                <div className="text-center">
                  <p className="font-semibold">{DISENOS_SELLO[d].nombre}</p>
                  <p className="text-sm text-suave">{DISENOS_SELLO[d].texto}</p>
                </div>
              </div>
            );
          })}
          <div className="flex flex-col items-center gap-3" data-diseno="puntos">
            <Inclinable>
              <TarjetaVisual
                local="Café del Cerro"
                programa={{ ...PROGRAMA_BASE, tipo: "puntos", nombre_puntos: "puntos", color: "#23345c", icono: "cafe", diseno: "clasica" }}
                sellos={0}
                puntos={1350}
                proximo={{ titulo: "Taza de la casa", puntos: 2000 }}
                nivel="Oro"
                nombre="Elizabeth"
              />
            </Inclinable>
            <div className="text-center">
              <p className="font-semibold">Tarjeta de puntos o cashback</p>
              <p className="text-sm text-suave">Puntos por compra y catálogo de premios con fotos.</p>
            </div>
          </div>
        </div>
      </main>
    </SitioClub>
  );
}
