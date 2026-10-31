// Símbolo de Platovi: una mesa redonda vista desde arriba, con cuatro sillas, y sobre la mesa un código QR
// cuya cuarta esquina es un plato. Mesa azul tinta, sillas y plato mostaza.
export const COLORES_LOGO = { mesa: "#172033", mesaOscuro: "#2a3858", acento: "#f2a33a" };

// Cuadrados de las esquinas del QR (x, y) y puntitos sueltos (x, y), en una grilla de 3,6 unidades.
const ESQUINAS: [number, number][] = [
  [20.3, 20.3],
  [34.7, 20.3],
  [20.3, 34.7],
];
const PUNTOS: [number, number][] = [
  [30.5, 19.7],
  [30.5, 26.9],
  [19.7, 30.5],
  [26.9, 30.5],
  [30.5, 30.5],
  [37.7, 30.5],
  [41.3, 30.5],
  [30.5, 37.7],
  [30.5, 41.3],
];

export function Marca({ className = "h-10 w-10", oscuro = false }: { className?: string; oscuro?: boolean }) {
  const { mesa, mesaOscuro, acento } = COLORES_LOGO;
  return (
    <svg viewBox="0 0 64 64" className={`shrink-0 ${className}`} aria-hidden>
      <g fill={acento}>
        <rect x="24" y="2" width="16" height="7" rx="3.5" />
        <rect x="24" y="55" width="16" height="7" rx="3.5" />
        <rect x="2" y="24" width="7" height="16" rx="3.5" />
        <rect x="55" y="24" width="7" height="16" rx="3.5" />
      </g>
      <circle cx="32" cy="32" r="21" fill={oscuro ? mesaOscuro : mesa} />
      <g fill="#fff">
        {ESQUINAS.map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <rect x={x} y={y} width="9" height="9" rx="1.8" fill="none" stroke="#fff" strokeWidth="1.8" />
            <rect x={x + 3} y={y + 3} width="3" height="3" rx=".7" />
          </g>
        ))}
        {PUNTOS.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="3" height="3" rx=".7" />
        ))}
      </g>
      <circle cx="39.2" cy="39.2" r="4.1" fill="none" stroke={acento} strokeWidth="1.9" />
      <circle cx="39.2" cy="39.2" r="1.5" fill={acento} />
    </svg>
  );
}

// Símbolo + nombre en Outfit Bold, con el punto final en mostaza.
export function Logo({ oscuro = false, className = "" }: { oscuro?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Marca oscuro={oscuro} className="h-[1.75em] w-[1.75em]" />
      <span className={`font-marca font-bold leading-none tracking-tight ${oscuro ? "text-white" : "text-marca-tinta"}`}>
        Platovi<span className="text-marca-claro">.</span>
      </span>
    </span>
  );
}
