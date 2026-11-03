"use client";

import { useState } from "react";
import { TarjetaVisual } from "@/components/sellos/TarjetaVisual";
import { Inclinable } from "@/components/sellos/Inclinable";
import { DISENOS_SELLO, PROGRAMA_BASE, type DisenoSello, type IconoSello } from "@/lib/sellos/tipos";

// Ejemplos para la landing: cada diseño con un local, un color y un premio distinto, para mostrar la variedad.
const EJEMPLOS: Record<DisenoSello, { local: string; color: string; icono: IconoSello; premio: string; sellos: number }> = {
  clasica: { local: "Aroma Café", color: "#23345c", icono: "cafe", premio: "Un café de regalo", sellos: 7 },
  boleto: { local: "Cine Bar", color: "#b91c1c", icono: "cerveza", premio: "Una schop gratis", sellos: 4 },
  epoca: { local: "Panadería Don Luis", color: "#7c4a1e", icono: "pan", premio: "Media docena de pan", sellos: 6 },
  neon: { local: "Burger Night", color: "#db2777", icono: "burger", premio: "Una burger gratis", sellos: 5 },
  pasaporte: { local: "Sabores del Mundo", color: "#0f3d3e", icono: "estrella", premio: "Postre de la casa", sellos: 6 },
  editorial: { local: "Bistró Norte", color: "#111827", icono: "copa", premio: "Una copa de vino", sellos: 3 },
  aurora: { local: "Heladería Polar", color: "#7c3aed", icono: "helado", premio: "Un helado doble", sellos: 8 },
  pizarra: { local: "La Pizarra", color: "#14532d", icono: "taco", premio: "Tres tacos gratis", sellos: 5 },
  camino: { local: "Sushi Go", color: "#0e7490", icono: "sushi", premio: "Un roll de regalo", sellos: 6 },
  circulo: { local: "Pizza Forno", color: "#c2410c", icono: "pizza", premio: "Una pizza mediana", sellos: 7 },
  pop: { local: "Donas Pop", color: "#facc15", icono: "dona", premio: "Una caja de donas", sellos: 4 },
  premium: { local: "Gran Reserva", color: "#1f2937", icono: "copa", premio: "Cena para dos", sellos: 8 },
};

const ORDEN = Object.keys(DISENOS_SELLO) as DisenoSello[];

// Tarjeta de sellos real (el mismo componente que ve el comensal) con selector de los 12 diseños.
export function VitrinaLoyalty() {
  const [diseno, setDiseno] = useState<DisenoSello>("premium");
  const e = EJEMPLOS[diseno];
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative w-full max-w-[22rem]" style={{ perspective: "1200px" }}>
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-10 -z-10 rounded-full opacity-70 blur-3xl"
          style={{ background: `radial-gradient(circle, ${e.color}88, transparent 70%)` }}
        />
        <div key={diseno} className="cambio-precio">
          <Inclinable giroscopio>
            <TarjetaVisual
              local={e.local}
              programa={{ ...PROGRAMA_BASE, meta: 10, color: e.color, icono: e.icono, premio: e.premio, diseno }}
              sellos={e.sellos}
              nombre="Camila"
            />
          </Inclinable>
        </div>
      </div>
      <p className="text-center text-sm text-sitio-suave">
        <b className="text-sitio-tinta">{DISENOS_SELLO[diseno].nombre}:</b> {DISENOS_SELLO[diseno].texto} Muévela con el
        mouse o el dedo.
      </p>
      <div className="flex max-w-md flex-wrap justify-center gap-2" role="radiogroup" aria-label="Diseños de tarjeta">
        {ORDEN.map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={d === diseno}
            onClick={() => setDiseno(d)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              d === diseno
                ? "border-sitio-oro/70 bg-sitio-oro/15 text-sitio-oro-texto"
                : "border-sitio-borde bg-sitio-vidrio text-sitio-suave hover:border-sitio-oro/40 hover:text-sitio-tinta"
            }`}
          >
            {DISENOS_SELLO[d].nombre}
          </button>
        ))}
      </div>
    </div>
  );
}
