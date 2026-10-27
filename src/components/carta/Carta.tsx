"use client";

import "./fuentes.css";
import { useMemo } from "react";
import { traducir } from "@/lib/i18n";
import type { Promo, Restaurante, Seccion, Sucursal, Tema } from "@/lib/types";
import { horaPromo } from "@/lib/promos";
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
import { TemaTropical } from "./TemaTropical";
import { TemaJugos } from "./TemaJugos";
import { TemaBatidos } from "./TemaBatidos";
import { TemaGala } from "./TemaGala";
import { TemaVitrina } from "./TemaVitrina";
import { TemaCinta } from "./TemaCinta";
import { TemaTrattoria } from "./TemaTrattoria";
import { TemaKraft } from "./TemaKraft";
import { TemaMadera } from "./TemaMadera";
import { TemaCoctel } from "./TemaCoctel";
import { TemaRevista } from "./TemaRevista";
import { useCartaViva } from "./useCartaViva";

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
  tropical: TemaTropical,
  jugos: TemaJugos,
  batidos: TemaBatidos,
  gala: TemaGala,
  vitrina: TemaVitrina,
  cinta: TemaCinta,
  trattoria: TemaTrattoria,
  kraft: TemaKraft,
  madera: TemaMadera,
  coctel: TemaCoctel,
  revista: TemaRevista,
};

type Props = {
  restaurante: Restaurante;
  secciones: Seccion[];
  sucursales?: Sucursal[];
  vistaPrevia?: boolean;
  tema?: Tema;
  promos?: Promo[];
};

// Dibuja la carta con el diseño elegido por el restaurante, en el idioma que elija el cliente.
export function Carta(props: Props) {
  // Precios con las promos en horario y platos agotados, al día aunque la página venga de la caché.
  const { secciones, promos } = useCartaViva(props.restaurante, props.secciones, props.promos ?? [], props.vistaPrevia);
  return (
    <ProveedorCarta
      restaurante={props.restaurante}
      secciones={secciones}
      sucursales={props.sucursales}
      vistaPrevia={props.vistaPrevia}
    >
      <CartaTraducida {...props} secciones={secciones} promos={promos} />
    </ProveedorCarta>
  );
}

function CartaTraducida({ restaurante, secciones, vistaPrevia, tema, promos = [] }: Props) {
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
      {promos.length > 0 && <BannerPromos promos={promos} />}
      <Componente
        restaurante={traducido.restaurante}
        secciones={traducido.secciones}
        vistaPrevia={vistaPrevia}
        pie={vistaPrevia ? null : <PieCarta restaurante={restaurante} />}
      />
    </div>
  );
}

// Franja arriba de la carta con las promos que están en horario ahora.
function BannerPromos({ promos }: { promos: Promo[] }) {
  const { t } = useCarta();
  return (
    <div className="relative z-10 bg-stone-900 px-4 py-2 text-center text-sm text-white" role="status">
      {promos.map((p, i) => (
        <p key={p.id} className={i ? "mt-1" : ""}>
          <span aria-hidden>🎉 </span>
          <strong>{p.nombre}</strong>
          {p.descuento > 0 && (
            <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-xs font-bold text-stone-900">
              -{p.descuento}%
            </span>
          )}
          {p.descripcion ? ` · ${p.descripcion}` : ""}
          <span className="opacity-75">
            {" "}
            · {t("promoHasta")} {horaPromo(p.hasta)}
          </span>
        </p>
      ))}
    </div>
  );
}
