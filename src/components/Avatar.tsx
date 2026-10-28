import { nombreVisible } from "@/lib/salon";

// Colores para las iniciales cuando la persona no eligió uno (siempre el mismo para el mismo nombre).
const COLORES = ["#e76f51", "#2a9d8f", "#e9c46a", "#8e7dbe", "#f4a261", "#4d908e", "#577590", "#d1495b"];

export function colorDe(texto: string) {
  let h = 0;
  for (const c of texto) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORES[h % COLORES.length];
}

export function iniciales(nombre: string) {
  const partes = nombreVisible(nombre).split(" ").filter(Boolean);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : (partes[0]?.[1] ?? ""))).toUpperCase();
}

// Foto, emoji o iniciales de alguien del equipo. Sin datos, no muestra nada.
export function Avatar({
  persona,
  className = "h-7 w-7 text-[11px]",
  titulo = true,
}: {
  persona?: { nombre: string; avatar?: string | null; color?: string | null } | null;
  className?: string;
  titulo?: boolean;
}) {
  if (!persona) return null;
  const nombre = nombreVisible(persona.nombre);
  const comun = `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold ring-2 ring-white ${className}`;
  const avatar = persona.avatar?.trim();
  if (avatar?.startsWith("https://")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatar} alt={nombre} title={titulo ? nombre : undefined} className={`${comun} object-cover`} />;
  }
  return (
    <span
      className={comun}
      style={{ background: persona.color || colorDe(persona.nombre), color: "#fff" }}
      title={titulo ? nombre : undefined}
      aria-label={nombre}
    >
      {avatar ? <span className="text-[1.35em] leading-none">{avatar}</span> : iniciales(persona.nombre)}
    </span>
  );
}
