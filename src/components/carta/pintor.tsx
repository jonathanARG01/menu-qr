import { useId } from "react";

// Piezas del diseño "Pintor": paredes pintadas de los cerros de Valparaíso, madera, letreros crema y pizarras.
// Todo es ilustración propia (sin fotos), para que el diseño lo pueda usar cualquier restaurante.

export const CREMA = "#fbf5e8";
export const MADERA = "#8a5a35";
export const MADERA_OSCURA = "#4a2e1c";
export const PIZARRA = "#2c302d";
// Colores de pintura de las paredes: terracota, ocre, azul puerto, magenta de las puertas, verde y crema.
export const PALETA_PINTOR = ["#c0462e", "#d99a2b", "#3f6f86", "#8e2f5a", "#4d6a46"] as const;

// ---------- Mural de fondo: dibujo a tinta de Valparaíso, en un color muy suave, que se repite por la carta ----------

const ventanas = (x: number, y: number, w: number, h: number) => {
  let d = "";
  const cols = w >= 34 ? 3 : w >= 22 ? 2 : 1;
  const filas = Math.max(1, Math.floor((h - 14) / 18));
  const ancho = 7;
  const paso = (w - cols * ancho) / (cols + 1);
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < cols; c++) {
      const vx = x + paso + c * (ancho + paso);
      const vy = y + 10 + f * 18;
      d += `M${vx} ${vy}h${ancho}v10h-${ancho}z M${vx + ancho / 2} ${vy}v10 `;
    }
  }
  return d;
};

// Casa con techo de dos aguas o plano, ventanas y balcón con baranda.
const casaTinta = (x: number, y: number, w: number, h: number, techo: boolean, balcon: boolean) => {
  let d = `M${x} ${y + h}V${y}h${w}V${y + h} `;
  d += techo ? `M${x - 3} ${y + 1}L${x + w / 2} ${y - 16}L${x + w + 3} ${y + 1} ` : `M${x - 2} ${y}h${w + 4}M${x - 2} ${y - 3}h${w + 4} `;
  d += ventanas(x, y, w, h - 6);
  if (balcon) {
    const by = y + Math.round(h / 2);
    d += `M${x - 3} ${by}h${w + 6}M${x - 3} ${by + 7}h${w + 6}`;
    for (let bx = x - 1; bx < x + w + 4; bx += 4) d += `M${bx} ${by}v7`;
    d += " ";
  }
  return d;
};

function dibujoMural() {
  const trazos: string[] = [];
  // Torre del reloj.
  trazos.push(
    "M40 230V72h36v158 M38 72h40 M42 72L58 34L74 72 M58 34V20 M58 22l10 3l-10 3",
    "M47 92a11 11 0 1 0 22 0a11 11 0 1 0 -22 0 M58 92v-7 M58 92l5 3 M40 108h36 M40 210h36",
    ventanas(40, 110, 36, 100),
  );
  // Barco con humo y agua.
  trazos.push(
    "M212 112h110l-12 15h-86z M244 112v-14h44v14 M252 98v-8h10v8 M272 98v-16h8v16 M254 105h4M264 105h4M274 105h4",
    "M276 80c-6-10 8-14 2-24c-5-8 6-12 4-20 M200 134q10-5 20 0t20 0t20 0t20 0t20 0t20 0t20 0 M216 144q10-4 20 0t20 0t20 0t20 0t20 0",
  );
  // Gaviotas.
  trazos.push("M140 40q6-7 12 0q6-7 12 0 M180 62q4-5 8 0q4-5 8 0 M110 26q5-6 10 0q5-6 10 0 M300 30q5-6 10 0q5-6 10 0");
  // Nubes en espiral.
  trazos.push("M100 120c-12 0-14-16 0-16c2-10 20-10 22 0c12-2 14 14 2 16z M300 200c-10 0-12-13 0-13c2-8 16-8 18 0c10-1 11 12 1 13z");
  // Rosa de los vientos.
  trazos.push(
    "M116 230a36 36 0 1 0 72 0a36 36 0 1 0 -72 0 M126 230a26 26 0 1 0 52 0a26 26 0 1 0 -52 0",
    "M152 190l6 34l-6 6l-6-6z M152 270l6-34l-6-6l-6 6z M112 230l34 6l6-6l-6-6z M192 230l-34 6l-6-6l6-6z M138 216l14 14l14-14 M138 244l14-14l14 14",
  );
  // Cables entre postes.
  trazos.push("M96 268V300 M96 272q120 30 264-6 M96 280q120 34 264-2 M352 250v40");
  // Cerro con casas.
  trazos.push(
    "M0 410q60-30 120-50t120-40 M0 330q30-6 46 4",
    casaTinta(6, 382, 40, 60, true, true),
    casaTinta(52, 360, 30, 70, false, true),
    casaTinta(88, 346, 36, 48, true, false),
    casaTinta(130, 330, 28, 56, true, true),
    casaTinta(4, 452, 46, 30, false, false),
    casaTinta(58, 440, 34, 40, true, false),
    casaTinta(100, 410, 40, 70, false, true),
  );
  // Escalera.
  let escalera = "M150 480";
  for (let i = 0; i < 9; i++) escalera += "h8v-9";
  trazos.push(escalera, "M150 480l72-81");
  // Ascensor (funicular) con su carro.
  trazos.push("M232 476l98-150 M246 480l98-150 M266 436l18-27l20 13l-18 27z M272 428h8 M282 413l8 5");
  // Farol.
  trazos.push("M336 480v-70 M330 410h12l-2-14h-8z M336 396v-4 M326 480h20");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 480"><path d="${trazos.join(" ")}" fill="none" stroke="rgb(90,58,38)" stroke-opacity="0.13" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export const MURAL_FONDO = `url("data:image/svg+xml,${encodeURIComponent(dibujoMural())}")`;

// ---------- Panorama pintado del puerto: cielo al atardecer, bahía con barcos y cerros de casas de colores ----------

type Casa = [x: number, base: number, w: number, h: number, color: number, techo: boolean];

const CASAS_ATRAS: Casa[] = [
  [168, 238, 22, 30, 0, true],
  [192, 224, 26, 36, 1, false],
  [220, 208, 24, 32, 2, true],
  [246, 198, 28, 40, 3, false],
  [276, 188, 24, 30, 4, true],
  [302, 180, 30, 42, 5, false],
  [334, 172, 24, 34, 0, true],
  [360, 164, 28, 38, 2, false],
  [386, 156, 20, 30, 1, true],
];

const CASAS_FRENTE: Casa[] = [
  [204, 240, 30, 24, 5, true],
  [236, 240, 26, 32, 0, false],
  [264, 240, 34, 40, 1, true],
  [300, 240, 28, 48, 2, true],
  [330, 240, 34, 56, 3, false],
  [366, 240, 36, 62, 4, true],
  [0, 240, 26, 50, 1, true],
  [26, 240, 30, 38, 3, false],
  [58, 240, 24, 28, 2, true],
  [84, 240, 26, 20, 0, false],
];

// Cerros a los lados, que solo se ven en pantallas anchas.
const CASAS_LADOS_ATRAS: Casa[] = [
  [-192, 186, 26, 30, 3, true],
  [-162, 180, 28, 34, 1, false],
  [-130, 188, 24, 28, 5, true],
  [410, 150, 26, 32, 3, true],
  [440, 142, 30, 38, 0, false],
  [474, 136, 24, 30, 1, true],
  [502, 130, 30, 40, 4, false],
  [536, 126, 26, 32, 2, true],
  [566, 122, 32, 36, 0, true],
];

const CASAS_LADOS_FRENTE: Casa[] = [
  [-198, 240, 30, 64, 2, true],
  [-166, 240, 34, 52, 0, false],
  [-130, 240, 28, 44, 4, true],
  [-100, 240, 32, 36, 1, true],
  [-66, 240, 28, 30, 3, false],
  [-36, 240, 32, 44, 5, true],
  [404, 240, 32, 70, 1, false],
  [438, 240, 30, 58, 5, true],
  [470, 240, 36, 78, 0, true],
  [508, 240, 30, 66, 2, false],
  [540, 240, 34, 72, 3, true],
  [576, 240, 30, 62, 4, false],
];

const COLORES_CASA = ["#c0462e", "#e0a63c", "#3f6f86", "#8e2f5a", "#5b7a4c", "#efe2c4"];

function CasaPintada({ casa, encendidas }: { casa: Casa; encendidas?: boolean }) {
  const [x, base, w, h, c, techo] = casa;
  const top = base - h;
  const cols = w >= 26 ? 2 : 1;
  const filas = Math.max(1, Math.floor((h - 8) / 13));
  const ancho = 6;
  const paso = (w - cols * ancho) / (cols + 1);
  return (
    <g>
      <rect x={x} y={top} width={w} height={h} fill={COLORES_CASA[c]} />
      <rect x={x} y={top} width={w * 0.28} height={h} fill="#000" opacity="0.12" />
      {techo ? (
        <path d={`M${x - 2} ${top + 1} L${x + w / 2} ${top - 11} L${x + w + 2} ${top + 1} Z`} fill="#a33a24" />
      ) : (
        <rect x={x - 1.5} y={top - 3} width={w + 3} height="3.5" fill="#5a3a26" />
      )}
      {Array.from({ length: filas }).map((_, f) =>
        Array.from({ length: cols }).map((__, col) => (
          <rect
            key={`${f}-${col}`}
            x={x + paso + col * (ancho + paso)}
            y={top + 5 + f * 13}
            width={ancho}
            height="8"
            fill={encendidas && (f + col + x) % 3 === 0 ? "#ffd98a" : "#f6e7c4"}
            stroke="#3a2a22"
            strokeWidth="0.6"
          />
        )),
      )}
    </g>
  );
}

export function Panorama({ className = "" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="-200 0 800 240" preserveAspectRatio="xMidYMax slice" aria-hidden className={className}>
      <defs>
        <linearGradient id={`${id}cielo`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f5e3c2" />
          <stop offset="0.55" stopColor="#f0c195" />
          <stop offset="1" stopColor="#e39a6c" />
        </linearGradient>
        <linearGradient id={`${id}mar`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8aa3a6" />
          <stop offset="1" stopColor="#3f5c6b" />
        </linearGradient>
        <radialGradient id={`${id}farol`}>
          <stop offset="0" stopColor="#ffe6a8" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffe6a8" stopOpacity="0" />
        </radialGradient>
        {/* Bordes temblorosos, como pintados a pincel. */}
        <filter id={`${id}pincel`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="2" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="2.2" />
        </filter>
        <filter id={`${id}nube`}>
          <feGaussianBlur stdDeviation="3" />
        </filter>
        {/* Grano de tela. */}
        <filter id={`${id}tela`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
          <feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.22  0 0 0 0 0.12  0 0 0 0.16 0" />
        </filter>
      </defs>

      <rect x="-200" width="800" height="240" fill={`url(#${id}cielo)`} />
      <g fill="#fff6e6" opacity="0.6" filter={`url(#${id}nube)`}>
        <ellipse cx="70" cy="60" rx="46" ry="12" />
        <ellipse cx="100" cy="52" rx="30" ry="10" />
        <ellipse cx="300" cy="40" rx="54" ry="11" />
        <ellipse cx="250" cy="86" rx="40" ry="8" />
        <ellipse cx="-110" cy="70" rx="50" ry="10" />
        <ellipse cx="500" cy="64" rx="48" ry="10" />
      </g>
      <circle cx="318" cy="122" r="20" fill="#fff1cf" opacity="0.85" />

      <g filter={`url(#${id}pincel)`}>
        <path d="M-200 140 Q-100 126 0 144 Q60 128 120 137 T240 131 T400 140 T600 134 V152 H-200 Z" fill="#b98d73" opacity="0.7" />
        <rect x="-200" y="148" width="800" height="92" fill={`url(#${id}mar)`} />
        <g stroke="#fff6e6" strokeWidth="1" opacity="0.4" strokeLinecap="round">
          <path d="M300 156h36 M290 164h52 M306 172h22 M120 170h20 M60 190h26 M180 160h16" />
        </g>
        {/* Grúas del puerto. */}
        <g stroke="#3a2a22" strokeWidth="1.4" fill="none">
          <path d="M20 152V112 M14 152l6-40l6 40 M20 114l30 8 M44 120v14" />
          <path d="M66 150V118 M61 150l5-32l5 32 M66 120l24 6 M86 125v12" />
        </g>
        {/* Barcos. */}
        <path d="M30 168h74l-8 10H38z" fill="#8c2f22" />
        <path d="M38 178h58l-2 3H40z" fill="#2a1d18" />
        <rect x="52" y="158" width="30" height="10" fill="#f1e6d0" />
        <rect x="70" y="150" width="6" height="8" fill="#2a1d18" />
        <path d="M150 156h34l-4 6h-26z" fill="#3a2a22" />
        <rect x="158" y="150" width="14" height="6" fill="#f1e6d0" />

        {/* Cerros. */}
        <path d="M150 240 Q200 214 250 200 T400 150 Q480 128 600 116 V240 Z" fill="#6e4a32" />
        <path d="M-200 240 V176 Q-150 166 -110 180 T0 198 V240 Z" fill="#5d3e2a" />
        {CASAS_LADOS_ATRAS.map((c, i) => (
          <CasaPintada key={`la${i}`} casa={c} />
        ))}
        <path d="M0 240 V190 Q40 184 72 200 T132 240 Z" fill="#5d3e2a" />
        {CASAS_ATRAS.map((c, i) => (
          <CasaPintada key={`a${i}`} casa={c} />
        ))}
        {/* Ascensor. */}
        <g stroke="#2a1d18" strokeWidth="1.6">
          <path d="M226 240 L296 178 M234 240 L304 178" />
        </g>
        <rect x="252" y="206" width="16" height="11" fill="#c0462e" stroke="#2a1d18" strokeWidth="0.8" transform="rotate(-41 260 211)" />
        {[...CASAS_LADOS_FRENTE, ...CASAS_FRENTE].map((c, i) => (
          <CasaPintada key={`f${i}`} casa={c} encendidas />
        ))}
        {/* Cables. */}
        <path d="M112 186 Q230 214 400 176" stroke="#2a1d18" strokeWidth="0.7" fill="none" />
        <path d="M112 192 Q230 222 400 184" stroke="#2a1d18" strokeWidth="0.7" fill="none" />
        {/* Farol. */}
        <circle cx="112" cy="182" r="18" fill={`url(#${id}farol)`} />
        <path d="M112 240 V186 M106 186 h12 l-2 -9 h-8 z" stroke="#2a1d18" strokeWidth="2" fill="#2a1d18" />
        <rect x="108.5" y="178.5" width="7" height="6" fill="#ffd98a" />
      </g>
      <rect x="-200" width="800" height="240" filter={`url(#${id}tela)`} />
    </svg>
  );
}

// Viga de madera bajo el panorama, como el frente del local.
export function Viga({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={className}
      style={{
        height: 16,
        backgroundColor: MADERA,
        backgroundImage:
          "repeating-linear-gradient(90deg, rgba(0,0,0,0.0) 0 38px, rgba(0,0,0,0.25) 38px 40px), linear-gradient(180deg, rgba(255,255,255,0.22), rgba(0,0,0,0.25)), repeating-linear-gradient(0deg, rgba(0,0,0,0.08) 0 2px, transparent 2px 5px)",
        boxShadow: "0 4px 10px rgba(60,30,10,0.35)",
      }}
    />
  );
}

// Paleta de pintor de madera con sus colores y un pincel.
export function PaletaPintor({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 130 84" aria-hidden className={className}>
      <path
        d="M64 6C30 6 6 24 6 46c0 20 20 32 42 32c12 0 14-8 10-14c-4-7 2-12 10-11c10 1 18 6 30 2c16-5 26-15 26-26C124 16 98 6 64 6z"
        fill="#d4a774"
        stroke={MADERA_OSCURA}
        strokeWidth="2"
      />
      <ellipse cx="44" cy="56" rx="7" ry="5.5" fill={CREMA} stroke={MADERA_OSCURA} strokeWidth="1.6" />
      {PALETA_PINTOR.map((c, i) => {
        const pos = [
          [30, 30],
          [50, 20],
          [74, 18],
          [96, 26],
          [104, 42],
        ][i];
        return <circle key={c} cx={pos[0]} cy={pos[1]} r="6.5" fill={c} stroke={MADERA_OSCURA} strokeWidth="0.8" />;
      })}
      <path d="M70 70 L122 30" stroke={MADERA_OSCURA} strokeWidth="4" strokeLinecap="round" />
      <path d="M118 33 L126 26" stroke="#c0462e" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
