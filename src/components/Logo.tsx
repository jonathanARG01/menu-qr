// Símbolo de la marca: un QR estilizado sobre un plato. Se usa en el sitio de venta y en las pantallas de acceso.
export function Marca({ className = "h-11 w-11" }: { className?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 shadow-lg shadow-amber-900/40 ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-[55%] w-[55%] text-white" fill="currentColor" aria-hidden>
        <path d="M4 4h6v6H4zm2 2v2h2V6zM14 4h6v6h-6zm2 2v2h2V6zM4 14h6v6H4zm2 2v2h2v-2zM14 14h2v2h-2zm2 2h2v2h-2zm2-2h2v2h-2zm-2 4h2v2h-2zm2 0h2v2h-2zm-4 0h2v2h-2z" />
      </svg>
    </span>
  );
}
