import Link from "next/link";
import { Logo } from "@/components/Logo";
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
    <div className="min-h-dvh bg-fondo">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/">
          <Logo className="text-xl" />
        </Link>
        <Link href="/registro" className="boton">
          Pruébalo gratis
        </Link>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-16">
        <h1 className="text-3xl font-extrabold tracking-tight">Diseños de tarjeta</h1>
        <p className="mt-1 text-suave">Todos incluidos en todos los planes, con tu logo y tu color. Y si quieres, la hacemos a tu medida.</p>
        <div className="mt-8 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {disenos.map((d, i) => {
            const e = EJEMPLOS[i % EJEMPLOS.length];
            return (
              <div key={d} className="flex flex-col items-center gap-3" data-diseno={d}>
                <Inclinable>
                  <TarjetaVisual
                    local={e.local}
                    programa={{ ...PROGRAMA_BASE, meta: 10, color: e.color, icono: e.icono as typeof PROGRAMA_BASE.icono, premio: e.premio, diseno: d, hitos: [{ sellos: 5, premio: "Un regalo chico" }] }}
                    sellos={6}
                    nombre="Camila"
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
                nombre="Camila"
              />
            </Inclinable>
            <div className="text-center">
              <p className="font-semibold">Tarjeta de puntos o cashback</p>
              <p className="text-sm text-suave">Puntos por compra y catálogo de premios con fotos.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
