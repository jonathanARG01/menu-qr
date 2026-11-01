import Link from "next/link";
import { Icono } from "@/components/Icono";
import { TarjetaVisual } from "@/components/sellos/TarjetaVisual";
import { WHATSAPP_VENTAS } from "@/lib/planes";
import { NOMBRE_SELLOS, PRECIO_SELLOS, PROGRAMA_BASE } from "@/lib/sellos/tipos";
import { formatoPrecio } from "@/lib/utils";

export const enlaceContratarSellos = (restaurante: string) =>
  WHATSAPP_VENTAS
    ? `https://wa.me/${WHATSAPP_VENTAS}?text=${encodeURIComponent(`Hola, soy de ${restaurante} y quiero activar ${NOMBRE_SELLOS}.`)}`
    : null;

const VENTAJAS = [
  "Tus clientes guardan la tarjeta en el celular, sin descargar nada (web y Google Wallet).",
  "El sello se suma solo: el cliente escanea el QR de la precuenta.",
  "Avisos al celular: “te falta 1 sello”, “tu premio está listo”.",
  "El mesero canjea el premio con su PIN, y todo queda registrado.",
  "12 diseños para elegir (boleto, pasaporte, neón, pizarra, premium y más), con tu logo y tu color.",
  "Reemplaza la tarjeta de cartón: no se pierde y sabes quién vuelve.",
];

// Para quien todavía no tiene Platovi Sellos: qué es, cuánto cuesta y cómo pedirlo.
export function OfertaSellos({ restaurante, grupo }: { restaurante: { nombre: string; logo_url: string | null }; grupo: boolean }) {
  const contratar = enlaceContratarSellos(restaurante.nombre);
  return (
    <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Complemento</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{NOMBRE_SELLOS}: tarjeta de sellos en el celular</h1>
          <p className="mt-2 max-w-xl text-suave">
            Premia a los clientes que vuelven con una tarjeta digital: juntan sellos en cada visita y ganan el premio que
            tú elijas.
          </p>
        </div>
        <ul className="space-y-2 text-sm">
          {VENTAJAS.map((v) => (
            <li key={v} className="flex gap-2">
              <Icono nombre="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              {v}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-2xl font-semibold tabular-nums">
            {formatoPrecio(grupo ? PRECIO_SELLOS.grupo : PRECIO_SELLOS.local, "CLP")}
            <span className="text-sm font-normal text-suave"> /mes{grupo ? " · todas tus sucursales" : ""}</span>
          </p>
          {contratar ? (
            <a href={contratar} target="_blank" rel="noopener noreferrer" className="boton">
              <Icono nombre="whatsapp" className="h-4 w-4" /> Quiero {NOMBRE_SELLOS}
            </a>
          ) : (
            <p className="text-sm text-suave">Escríbenos para activarlo.</p>
          )}
        </div>
        <p className="text-xs text-suave">
          Se suma a tu plan actual y se activa al instante. Más detalles en{" "}
          <Link href="/panel/plan" className="text-marca hover:underline">
            Tu plan
          </Link>
          .
        </p>
      </div>
      <div className="flex justify-center">
        <TarjetaVisual
          local={restaurante.nombre}
          logo={restaurante.logo_url}
          programa={PROGRAMA_BASE}
          sellos={7}
          nombre="Camila"
        />
      </div>
    </div>
  );
}
