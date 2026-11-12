import { useId } from "react";
import type { Plato } from "@/lib/types";
import { SinFoto } from "./comun";

// Piezas compartidas por los diseños de cafetería.

// Foto cuadrada (o con la forma que dé className); sin foto, el ícono o emoji del plato para que el diseño no quede vacío.
export function FotoCuadro({ plato, className, style }: { plato: Plato; className: string; style?: React.CSSProperties }) {
  if (plato.foto_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={plato.foto_url}
        alt={plato.nombre}
        loading="lazy"
        decoding="async"
        className={`object-cover ${className}`}
        style={style}
      />
    );
  }
  return (
    <span aria-hidden className={`flex items-center justify-center ${className}`} style={style}>
      <SinFoto plato={plato} />
    </span>
  );
}

// Grano de café dibujado, para decorar.
export function GranoCafe({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 40 56" aria-hidden className={className} style={style}>
      <defs>
        <radialGradient id="grano-luz" cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#b5703c" />
          <stop offset="0.55" stopColor="#7a4321" />
          <stop offset="1" stopColor="#3e1f0d" />
        </radialGradient>
      </defs>
      <ellipse cx="20" cy="28" rx="18" ry="26" fill="url(#grano-luz)" />
      <path d="M21 4 C10 18 30 36 19 52" fill="none" stroke="#2a1408" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// Colores de cada capa de la bebida.
const COLOR_CAPA = {
  espresso: "#3b2416",
  agua: "#9cc3d5",
  leche: "#e6d6bd",
  espuma: "#f8f2e7",
  crema: "#fffaf0",
  chocolate: "#5a2d1a",
  caramelo: "#c98a3c",
  hielo: "#cfe6ee",
  te: "#b8652f",
  matcha: "#86ad55",
  fruta: "#d9485f",
} as const;

type Capa = [keyof typeof COLOR_CAPA, number];

// Receta en capas (de abajo hacia arriba) según el nombre de la bebida. null si no es una bebida conocida.
const RECETAS: [RegExp, Capa[]][] = [
  [
    /dirty chai/,
    [
      ["te", 0.8],
      ["espresso", 0.7],
      ["leche", 1.6],
      ["espuma", 0.4],
    ],
  ],
  [
    /caramel|caramelo/,
    [
      ["caramelo", 0.6],
      ["leche", 1.4],
      ["espresso", 0.9],
      ["espuma", 0.6],
    ],
  ],
  [
    /moca|mocha|mocachino|mochaccino/,
    [
      ["chocolate", 0.8],
      ["espresso", 0.9],
      ["leche", 1.2],
      ["crema", 0.7],
    ],
  ],
  [
    /frappe|frapuccino|frappuccino|helado|frio|iced|cold brew/,
    [
      ["espresso", 1],
      ["leche", 1.4],
      ["hielo", 0.9],
    ],
  ],
  [
    /affogato/,
    [
      ["crema", 1.2],
      ["espresso", 1],
    ],
  ],
  [
    /americano|filtrado|v60|chemex|prensa/,
    [
      ["espresso", 0.9],
      ["agua", 2],
    ],
  ],
  [/doppio|doble/, [["espresso", 1.6]]],
  [
    /macchiato|manchado/,
    [
      ["espresso", 1.4],
      ["espuma", 0.8],
    ],
  ],
  [
    /cortado/,
    [
      ["espresso", 1],
      ["leche", 1],
    ],
  ],
  [
    /flat white/,
    [
      ["espresso", 1.1],
      ["leche", 1.6],
      ["espuma", 0.3],
    ],
  ],
  [
    /cappuccino|capuchino|capuccino/,
    [
      ["espresso", 1],
      ["leche", 1],
      ["espuma", 1.2],
    ],
  ],
  [
    /matcha/,
    [
      ["matcha", 1],
      ["leche", 1.6],
      ["espuma", 0.4],
    ],
  ],
  [
    /chai/,
    [
      ["te", 1],
      ["leche", 1.6],
      ["espuma", 0.5],
    ],
  ],
  [
    /latte|lagrima|lágrima|cafe con leche/,
    [
      ["espresso", 0.8],
      ["leche", 2],
      ["espuma", 0.5],
    ],
  ],
  [
    /chocolate|cacao|submarino/,
    [
      ["chocolate", 2.2],
      ["crema", 0.6],
    ],
  ],
  [/espresso|ristretto|expreso/, [["espresso", 1]]],
  [/(^| )te( |$)|infusion|tisana|rooibos/, [["te", 2.4]]],
  [
    /batido|smoothie|frambuesa|frutilla|berries/,
    [
      ["fruta", 2],
      ["crema", 0.5],
    ],
  ],
];

const normalizar = (texto: string) => texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export const capasBebida = (nombre: string) => RECETAS.find(([re]) => re.test(normalizar(nombre)))?.[1] ?? null;

// Taza de línea con la bebida por capas, como los carteles de café en la pared.
export function TazaCapas({ capas, trazo, className = "" }: { capas: Capa[]; trazo: string; className?: string }) {
  const id = useId().replace(/:/g, "");
  const fondo = 82;
  const alto = 58;
  const total = capas.reduce((s, [, a]) => s + a, 0);
  const escala = Math.min(alto / 3.4, alto / total);
  let y = fondo;
  return (
    <svg viewBox="0 0 110 96" aria-hidden className={className}>
      <defs>
        <clipPath id={`taza-${id}`}>
          <path d="M20 22 H84 L78 76 Q76 84 68 84 H36 Q28 84 26 76 Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#taza-${id})`}>
        {capas.map(([tipo, a], i) => {
          const h = a * escala;
          y -= h;
          return <rect key={i} x="0" y={y} width="110" height={h + 0.6} fill={COLOR_CAPA[tipo]} />;
        })}
      </g>
      <path
        d="M20 22 H84 L78 76 Q76 84 68 84 H36 Q28 84 26 76 Z"
        fill="none"
        stroke={trazo}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path d="M83 32 C102 30 104 62 78 66" fill="none" stroke={trazo} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M12 90 H94" stroke={trazo} strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

// Colores de las casas de los cerros.
export const PALETA_CERROS = ["#e6007e", "#ffcb05", "#0096d6", "#2bb34a", "#e30613", "#7b3fbf", "#ff7a00", "#00b3a4"];

// Fila de casitas de colores sobre los cerros, con ventanas.
export function Casitas({ className = "", alto = 90 }: { className?: string; alto?: number }) {
  const casas = [
    [0, 34, 52, 0, true],
    [32, 30, 64, 1, false],
    [60, 38, 46, 2, true],
    [96, 28, 70, 3, false],
    [122, 36, 54, 4, true],
    [156, 32, 62, 5, false],
    [186, 40, 48, 6, true],
    [224, 30, 68, 7, false],
    [252, 36, 56, 2, true],
    [286, 30, 60, 0, false],
    [314, 38, 50, 3, true],
    [350, 30, 66, 1, false],
    [378, 34, 54, 4, true],
  ] as const;
  return (
    <svg viewBox="0 0 412 90" preserveAspectRatio="xMidYMax slice" aria-hidden className={className} style={{ height: alto }}>
      <path d="M0 70 Q60 40 130 58 T260 52 T412 60 V90 H0 Z" fill="#2b5d34" opacity="0.35" />
      {casas.map(([x, w, h, c, techo], i) => {
        const top = 90 - h;
        const color = PALETA_CERROS[c];
        return (
          <g key={i}>
            <rect x={x} y={top} width={w} height={h} fill={color} stroke="#1d1d1b" strokeWidth="1.5" />
            {techo ? (
              <path
                d={`M${x - 2} ${top} L${x + w / 2} ${top - 12} L${x + w + 2} ${top} Z`}
                fill="#c0392b"
                stroke="#1d1d1b"
                strokeWidth="1.5"
              />
            ) : (
              <rect x={x - 1} y={top - 4} width={w + 2} height="4" fill="#1d1d1b" />
            )}
            {[0, 1].map((f) =>
              [0, 1].map((col) => (
                <rect
                  key={`${f}-${col}`}
                  x={x + 5 + col * (w / 2 - 2)}
                  y={top + 8 + f * 18}
                  width={w / 2 - 8}
                  height="11"
                  fill="#ffffff"
                  stroke="#1d1d1b"
                  strokeWidth="1.2"
                />
              )),
            )}
          </g>
        );
      })}
      <path
        d="M0 84 Q20 78 40 84 T80 84 T120 84 T160 84 T200 84 T240 84 T280 84 T320 84 T360 84 T412 84 V90 H0 Z"
        fill="#0096d6"
      />
    </svg>
  );
}
