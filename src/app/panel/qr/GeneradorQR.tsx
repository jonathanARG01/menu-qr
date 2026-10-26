"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Mesa, Restaurante } from "@/lib/types";
import { mensajeError, urlCarta } from "@/lib/utils";
import { descargar, generarPdf, ordenarMesas, qrPng, qrSvg } from "@/lib/qr";
import { useToast } from "@/components/Toast";

export function GeneradorQR({ restaurante, mesasIniciales }: { restaurante: Restaurante; mesasIniciales: Mesa[] }) {
  const supabase = useMemo(() => createClient(), []);
  const avisar = useToast();
  const [mesas, setMesas] = useState(() => ordenarMesas(mesasIniciales));
  const [desde, setDesde] = useState("1");
  const [hasta, setHasta] = useState("10");
  const [nombreMesa, setNombreMesa] = useState("");
  const [generando, setGenerando] = useState(false);

  async function insertar(numeros: string[]) {
    const nuevos = numeros.map((n) => n.trim()).filter((n) => n && !mesas.some((m) => m.numero === n));
    if (nuevos.length === 0) return avisar("Esas mesas ya existen");
    const { data, error } = await supabase
      .from("mesas")
      .insert(nuevos.map((numero) => ({ restaurante_id: restaurante.id, numero })))
      .select();
    if (error) return avisar(mensajeError(error), "error");
    setMesas((m) => ordenarMesas([...m, ...(data as Mesa[])]));
    avisar(nuevos.length === 1 ? "Mesa añadida" : `${nuevos.length} mesas añadidas`);
  }

  function agregarRango(e: React.FormEvent) {
    e.preventDefault();
    const a = Math.max(1, Math.floor(Number(desde)));
    const b = Math.min(500, Math.floor(Number(hasta)));
    if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return avisar("Revisa el rango de mesas", "error");
    insertar(Array.from({ length: b - a + 1 }, (_, i) => String(a + i)));
  }

  function agregarUna(e: React.FormEvent) {
    e.preventDefault();
    insertar([nombreMesa]);
    setNombreMesa("");
  }

  async function borrar(mesa: Mesa) {
    if (!confirm(`¿Borrar la mesa ${mesa.numero}? El QR impreso seguirá abriendo la carta.`)) return;
    const { error } = await supabase.from("mesas").delete().eq("id", mesa.id);
    if (error) return avisar(mensajeError(error), "error");
    setMesas((m) => m.filter((x) => x.id !== mesa.id));
  }

  async function pdf(lista: (Mesa | null)[]) {
    setGenerando(true);
    try {
      await generarPdf(restaurante, lista);
    } catch (err) {
      avisar(mensajeError(err), "error");
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="tarjeta flex flex-col items-center gap-5 p-5 sm:flex-row sm:items-start">
        <TarjetaQR url={urlCarta(restaurante.slug)} grande />
        <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
          <div>
            <h2 className="font-semibold">QR general de la carta</h2>
            <p className="text-sm text-suave">Para la puerta, el mostrador, Instagram o la carta impresa.</p>
          </div>
          <p className="break-all rounded-lg bg-stone-50 px-3 py-2 font-mono text-xs text-suave">{urlCarta(restaurante.slug)}</p>
          <BotonesDescarga url={urlCarta(restaurante.slug)} archivo={`qr-${restaurante.slug}`} />
          <p className="text-xs text-suave">
            El QR apunta a la dirección de tu carta, no a un archivo: puedes cambiar platos y precios sin volver a imprimir.
          </p>
        </div>
      </section>

      <section className="tarjeta space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">QR por mesa</h2>
            <p className="text-sm text-suave">Cada QR abre la carta con el número de mesa.</p>
          </div>
          {mesas.length > 0 && (
            <button type="button" onClick={() => pdf(mesas)} className="boton" disabled={generando}>
              {generando ? "Generando PDF…" : `Descargar PDF (${mesas.length})`}
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <form onSubmit={agregarRango} className="flex items-end gap-2 rounded-xl bg-stone-50 p-3">
            <label className="flex-1 text-sm">
              Desde
              <input value={desde} onChange={(e) => setDesde(e.target.value)} inputMode="numeric" className="campo mt-1 py-2" />
            </label>
            <label className="flex-1 text-sm">
              Hasta
              <input value={hasta} onChange={(e) => setHasta(e.target.value)} inputMode="numeric" className="campo mt-1 py-2" />
            </label>
            <button type="submit" className="boton-secundario py-2">
              Añadir
            </button>
          </form>
          <form onSubmit={agregarUna} className="flex items-end gap-2 rounded-xl bg-stone-50 p-3">
            <label className="flex-1 text-sm">
              Una mesa con nombre
              <input
                value={nombreMesa}
                onChange={(e) => setNombreMesa(e.target.value)}
                maxLength={12}
                placeholder="Terraza 1"
                className="campo mt-1 py-2"
              />
            </label>
            <button type="submit" className="boton-secundario py-2" disabled={!nombreMesa.trim()}>
              Añadir
            </button>
          </form>
        </div>

        {mesas.length === 0 ? (
          <p className="py-6 text-center text-sm text-suave">
            Todavía no hay mesas. Añade un rango, por ejemplo de la 1 a la 10.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {mesas.map((mesa) => (
              <li key={mesa.id} className="rounded-xl border border-borde p-3 text-center">
                <TarjetaQR url={urlCarta(restaurante.slug, mesa.numero)} />
                <p className="mt-2 font-semibold">Mesa {mesa.numero}</p>
                <div className="mt-1 flex justify-center gap-3 text-xs">
                  <BotonPng
                    url={urlCarta(restaurante.slug, mesa.numero)}
                    archivo={`qr-${restaurante.slug}-mesa-${mesa.numero}`}
                  />
                  <button type="button" onClick={() => borrar(mesa)} className="text-suave hover:text-red-600">
                    Borrar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TarjetaQR({ url, grande = false }: { url: string; grande?: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    qrPng(url, grande ? 480 : 300).then(setSrc);
  }, [url, grande]);
  const tam = grande ? "h-44 w-44" : "aspect-square w-full";
  // eslint-disable-next-line @next/next/no-img-element
  return src ? (
    <img src={src} alt={`Código QR de ${url}`} className={`${tam} shrink-0 rounded-lg`} />
  ) : (
    <div className={`${tam} shrink-0 rounded-lg bg-stone-100`} />
  );
}

function BotonPng({ url, archivo }: { url: string; archivo: string }) {
  return (
    <button
      type="button"
      onClick={async () => descargar(await qrPng(url, 1200), `${archivo}.png`)}
      className="text-marca hover:underline"
    >
      PNG
    </button>
  );
}

function BotonesDescarga({ url, archivo }: { url: string; archivo: string }) {
  async function svg() {
    const contenido = await qrSvg(url);
    const href = URL.createObjectURL(new Blob([contenido], { type: "image/svg+xml" }));
    descargar(href, `${archivo}.svg`);
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
  return (
    <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
      <button
        type="button"
        className="boton-secundario py-2"
        onClick={async () => descargar(await qrPng(url, 1200), `${archivo}.png`)}
      >
        Descargar PNG
      </button>
      <button type="button" className="boton-secundario py-2" onClick={svg}>
        SVG (imprenta)
      </button>
    </div>
  );
}
