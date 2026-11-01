import type { ReactNode } from "react";
import { emojiSello, type ProgramaSellos } from "@/lib/sellos/tipos";
import { textoSobre } from "@/lib/utils";

// La tarjeta de sellos como se ve en el celular: marca del local, sellos ganados y por ganar, y el premio.
// Se usa en la tarjeta del cliente, en la página para unirse y en la vista previa del panel.
export function TarjetaVisual({
  local,
  logo,
  programa,
  sellos,
  premios = 0,
  nombre,
  pie,
  animarUltimos = 0,
}: {
  local: string;
  logo?: string | null;
  programa: Pick<ProgramaSellos, "meta" | "premio" | "color" | "icono">;
  sellos: number;
  premios?: number;
  nombre?: string;
  pie?: ReactNode;
  // Cuántos de los últimos sellos aparecen con animación (recién sumados).
  animarUltimos?: number;
}) {
  const tinta = textoSobre(programa.color);
  const emoji = emojiSello(programa.icono);
  const columnas = programa.meta <= 6 ? programa.meta : programa.meta <= 10 ? 5 : programa.meta <= 12 ? 6 : 6;
  return (
    <div
      className="w-full max-w-sm overflow-hidden rounded-3xl p-5 shadow-xl"
      style={{ background: programa.color, color: tinta }}
    >
      <div className="flex items-start gap-3">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="h-11 w-11 shrink-0 rounded-xl bg-white object-contain p-1" />
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 text-lg font-bold">
            {local.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold leading-tight">{local}</p>
          <p className="text-xs opacity-75">Tarjeta de sellos</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider opacity-70">Sellos</p>
          <p className="text-xl font-extrabold tabular-nums leading-none">
            {sellos}/{programa.meta}
          </p>
        </div>
      </div>

      <div
        className="mt-4 grid gap-2 rounded-2xl p-3"
        style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))`, background: "rgba(255,255,255,0.12)" }}
      >
        {Array.from({ length: programa.meta }, (_, i) => {
          const lleno = i < sellos;
          const ultimo = i === programa.meta - 1;
          const nuevo = lleno && i >= sellos - animarUltimos;
          return (
            <span
              key={i}
              className={`flex aspect-square items-center justify-center rounded-full text-lg ${nuevo ? "animate-[sello_0.5s_ease-out_both]" : ""}`}
              style={
                lleno
                  ? { background: "#ffffff", animationDelay: nuevo ? `${(i - (sellos - animarUltimos)) * 120}ms` : undefined }
                  : { border: `1.5px dashed ${tinta === "#ffffff" ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.3)"}` }
              }
              aria-hidden
            >
              {lleno ? emoji : ultimo ? "🎁" : <span className="text-xs opacity-60">{i + 1}</span>}
            </span>
          );
        })}
      </div>
      <span className="sr-only">
        {sellos} de {programa.meta} sellos
      </span>

      <div className="mt-4 flex items-end justify-between gap-3 text-sm">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider opacity-70">Premio</p>
          <p className="font-semibold leading-snug">{programa.premio}</p>
        </div>
        {nombre && (
          <div className="min-w-0 text-right">
            <p className="text-[10px] uppercase tracking-wider opacity-70">Nombre</p>
            <p className="truncate font-semibold">{nombre}</p>
          </div>
        )}
      </div>
      {premios > 0 && (
        <p className="mt-3 rounded-xl bg-white px-3 py-2 text-center text-sm font-bold text-emerald-700">
          🎉 {premios === 1 ? "Tienes un premio listo" : `Tienes ${premios} premios listos`}
        </p>
      )}
      {pie}
    </div>
  );
}
