import "./fuentes.css";
import type { Tema } from "@/lib/types";
import type { PropsTema } from "./comun";
import { TemaClasico } from "./TemaClasico";
import { TemaEsmeralda } from "./TemaEsmeralda";
import { TemaNoir } from "./TemaNoir";
import { TemaRetro } from "./TemaRetro";
import { TemaStreet } from "./TemaStreet";

const TEMAS: Record<Tema, (props: PropsTema) => React.ReactNode> = {
  clasico: TemaClasico,
  noir: TemaNoir,
  esmeralda: TemaEsmeralda,
  street: TemaStreet,
  retro: TemaRetro,
};

// Dibuja la carta con el diseño elegido por el restaurante.
export function Carta(props: PropsTema & { tema?: Tema }) {
  const Componente = TEMAS[props.tema ?? props.restaurante.tema ?? "clasico"] ?? TemaClasico;
  // Contenedor con consultas de tamaño: el diseño se adapta al ancho de la carta, también en la vista previa del panel.
  return (
    <div className="@container">
      <Componente {...props} />
    </div>
  );
}
