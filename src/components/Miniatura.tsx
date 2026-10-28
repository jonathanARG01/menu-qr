import { imagenDefecto } from "@/components/carta/comun";

type ConFoto = { id: string; nombre: string; descripcion?: string | null; foto_url?: string | null };

// Foto de cada plato para las comandas y avisos: la suya o, si no tiene, la ilustración que le corresponde.
export const mapaFotos = (platos: ConFoto[]) =>
  new Map(platos.map((p) => [p.id, p.foto_url || imagenDefecto(p.nombre, p.descripcion)]));

// Miniatura del plato con la cantidad encima ("3×"), como en las tarjetas de comanda y de pedido listo.
export function Miniatura({ src, cantidad, className = "h-11 w-11" }: { src?: string | null; cantidad?: number; className?: string }) {
  if (!src) return null;
  return (
    <span className={`relative inline-block shrink-0 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" loading="lazy" className="h-full w-full rounded-lg object-cover ring-1 ring-black/10" />
      {cantidad !== undefined && cantidad > 0 && (
        <span className="absolute -right-1.5 -top-1.5 rounded-full bg-stone-900 px-1.5 text-[10px] font-bold leading-4 text-white ring-2 ring-white">
          {cantidad}×
        </span>
      )}
    </span>
  );
}
