"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/Toast";
import { Icono } from "@/components/Icono";
import { descargar, qrPng, qrSvg } from "@/lib/qr";
import { emojiSello, rutaUnirse, type Negocio, type ProgramaSellos } from "@/lib/tipos";
import { textoSobre, urlSitio } from "@/lib/utils";

// QR para unirse: cartel para imprimir (caja, mesón, vitrina) y enlace para redes.
export function Carteles({ negocio, programa }: { negocio: Negocio; programa: ProgramaSellos }) {
  const avisar = useToast();
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(`${urlSitio()}${rutaUnirse(negocio.slug)}`), [negocio.slug]);
  const svg = useMemo(() => (url ? qrSvg(url) : ""), [url]);
  const tinta = textoSobre(programa.color);

  async function bajar() {
    descargar(await qrPng(url, 1200), `qr-tarjeta-${negocio.slug}.png`);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      avisar("Enlace copiado");
    } catch {
      avisar("No se pudo copiar. Mantén presionado el enlace para copiarlo.", "error");
    }
  }

  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <h1 className="text-xl font-semibold">QR para unirse</h1>
        <p className="text-sm text-suave">Imprímelo y déjalo donde tus clientes esperan o pagan.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-[auto_1fr]">
        <div
          id="cartel"
          className="mx-auto flex w-full max-w-xs flex-col items-center overflow-hidden rounded-3xl text-center shadow-xl print:max-w-none print:shadow-none"
          style={{ background: programa.color, color: tinta }}
        >
          <div className="px-6 pb-4 pt-7">
            {negocio.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={negocio.logo_url} alt="" className="mx-auto mb-3 h-16 w-16 rounded-2xl bg-white object-contain p-1" />
            ) : (
              <p className="text-4xl" aria-hidden>
                {emojiSello(programa.icono)}
              </p>
            )}
            <p className="text-2xl font-extrabold leading-tight">¡Junta sellos y gana!</p>
            <p className="mt-1 text-sm opacity-90">
              {programa.meta} sellos = <b>{programa.premio}</b>
            </p>
          </div>
          <div className="mx-6 w-48 rounded-2xl bg-white p-2" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="px-6 pb-7 pt-4 text-sm font-medium">
            Escanea con tu cámara y guarda tu tarjeta de {negocio.nombre}
          </p>
        </div>
        <div className="space-y-4 text-sm print:hidden">
          <div>
            <h2 className="font-semibold">Dónde ponerlo</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-suave">
              <li>En la caja, el mesón o el espejo (peluquerías y barberías).</li>
              <li>En la vitrina o la puerta, para quien pasa por fuera.</li>
              <li>En tu Instagram, la bio de WhatsApp Business y tus historias (con el enlace).</li>
            </ul>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="boton" onClick={() => window.print()} disabled={!url}>
              Imprimir cartel
            </button>
            <button type="button" className="boton-secundario" onClick={bajar} disabled={!url}>
              Descargar solo el QR
            </button>
            <button type="button" className="boton-secundario" onClick={copiar} disabled={!url}>
              Copiar enlace
            </button>
            <a href={url || "#"} target="_blank" className="boton-secundario">
              <Icono nombre="externo" className="h-4 w-4" /> Ver página
            </a>
          </div>
          <p className="break-all font-mono text-xs text-suave">{url}</p>
        </div>
      </div>
      <style>{`@media print { header, nav, .print\\:hidden { display: none !important } body { background: #fff } #cartel { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 2cm auto } }`}</style>
    </div>
  );
}
