// Símbolo de Mesitto: una burbuja de chat con una mesa redonda y cuatro sillas vistas desde arriba.
// La mesa y las sillas son huecos (evenodd), así el símbolo se ve bien sobre cualquier fondo.
export const SIMBOLO_PATH =
  "M32 5C46.9 5 59 16.6 59 31S46.9 57 32 57c-4.3 0-8.4-1-12-2.7L6 58.5l4.2-12.2C7.1 42 5 36.8 5 31 5 16.6 17.1 5 32 5Z" +
  "M23.5 31a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0-17 0Z" +
  "M28.2 15.5a3.8 3.8 0 1 0 7.6 0a3.8 3.8 0 1 0-7.6 0Z" +
  "M43.7 31a3.8 3.8 0 1 0 7.6 0a3.8 3.8 0 1 0-7.6 0Z" +
  "M28.2 46.5a3.8 3.8 0 1 0 7.6 0a3.8 3.8 0 1 0-7.6 0Z" +
  "M12.7 31a3.8 3.8 0 1 0 7.6 0a3.8 3.8 0 1 0-7.6 0Z";

export function Marca({ className = "h-10 w-10", oscuro = false }: { className?: string; oscuro?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className={`shrink-0 ${oscuro ? "text-marca-claro" : "text-marca"} ${className}`} aria-hidden>
      <path d={SIMBOLO_PATH} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

// Símbolo + nombre. El nombre va en minúsculas con Nunito Black, como en el logo elegido.
export function Logo({ oscuro = false, className = "" }: { oscuro?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Marca oscuro={oscuro} className="h-[1.6em] w-[1.6em]" />
      <span className={`font-marca font-black leading-none tracking-tight ${oscuro ? "text-green-50" : "text-marca-tinta"}`}>mesitto</span>
    </span>
  );
}
