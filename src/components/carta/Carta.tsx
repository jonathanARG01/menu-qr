"use client";

import "./fuentes.css";
import { useMemo } from "react";
import { traducir } from "@/lib/i18n";
import type { Restaurante, Seccion, Sucursal, Tema } from "@/lib/types";
import type { PropsTema } from "./comun";
import { ProveedorCarta, useCarta } from "./contexto";
import { PieCarta } from "./PieCarta";
import { TemaBistro } from "./TemaBistro";
import { TemaClasico } from "./TemaClasico";
import { TemaEsmeralda } from "./TemaEsmeralda";
import { TemaForno } from "./TemaForno";
import { TemaNeon } from "./TemaNeon";
import { TemaNoir } from "./TemaNoir";
import { TemaOriente } from "./TemaOriente";
import { TemaRetro } from "./TemaRetro";
import { TemaStreet } from "./TemaStreet";
import { TemaVeggie } from "./TemaVeggie";

const TEMAS: Record<Tema, (props: PropsTema) => React.ReactNode> = {
  clasico: TemaClasico,
  noir: TemaNoir,
  esmeralda: TemaEsmeralda,
  street: TemaStreet,
  retro: TemaRetro,
  bistro: TemaBistro,
  veggie: TemaVeggie,
  forno: TemaForno,
  oriente: TemaOriente,
  neon: TemaNeon,
};

type Props = {
  restaurante: Restaurante;
  secciones: Seccion[];
  sucursales?: Sucursal[];
  vistaPrevia?: boolean;
  tema?: Tema;
};

// Dibuja la carta con el diseño elegido por el restaurante, en el idioma que elija el cliente.
export function Carta(props: Props) {
  return (
    <ProveedorCarta
      restaurante={props.restaurante}
      secciones={props.secciones}
      sucursales={props.sucursales}
      vistaPrevia={props.vistaPrevia}
    >
      <CartaTraducida {...props} />
    </ProveedorCarta>
  );
}

function CartaTraducida({ restaurante, secciones, vistaPrevia, tema }: Props) {
  const { idioma } = useCarta();
  const Componente = TEMAS[tema ?? restaurante.tema ?? "clasico"] ?? TemaClasico;

  const traducido = useMemo(
    () => ({
      restaurante: traducir(restaurante, idioma, ["descripcion"]),
      secciones: secciones.map((s) => ({
        ...traducir(s, idioma, ["nombre"]),
        platos: s.platos.map((p) => traducir(p, idioma, ["nombre", "descripcion"])),
      })),
    }),
    [restaurante, secciones, idioma],
  );

  // Contenedor con consultas de tamaño: el diseño se adapta al ancho de la carta, también en la vista previa del panel.
  return (
    <div className="@container relative">
      <Componente
        restaurante={traducido.restaurante}
        secciones={traducido.secciones}
        vistaPrevia={vistaPrevia}
        pie={vistaPrevia ? null : <PieCarta restaurante={restaurante} />}
      />
    </div>
  );
}
