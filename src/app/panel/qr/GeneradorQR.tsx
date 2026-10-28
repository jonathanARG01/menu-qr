"use client";

import { nombreMesa as rotuloMesa } from "@/lib/salon";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Mesa, Restaurante, Sucursal } from "@/lib/types";
import { mensajeError, urlCarta } from "@/lib/utils";
import {
  colorLegibleQR,
  descargar,
  enlaceMesa,
  ESTILO_BASE,
  generarPdf,
  ordenarMesas,
  prepararLogoQR,
  qrPng,
  qrSvg,
  type EstiloQR,
} from "@/lib/qr";
import { useToast } from "@/components/Toast";
import { useUrlSitio } from "@/lib/useUrlSitio";

export function GeneradorQR({
  restaurante,
  mesasIniciales,
  sucursales,
  sucursalInicial,
  reservas = false,
  pisos = [],
}: {
  restaurante: Restaurante;
  mesasIniciales: Mesa[];
  sucursales: Sucursal[];
  sucursalInicial?: string;
  reservas?: boolean;
  pisos?: { id: string; nombre: string }[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const avisar = useToast();
  const sitio = useUrlSitio();
  const [todas, setMesas] = useState(() => ordenarMesas(mesasIniciales));
  // Con sucursales, cada una tiene sus mesas y sus QR llevan ?s=<sucursal>.
  const [sucursalId, setSucursalId] = useState<string>(
    sucursales.find((s) => s.id === sucursalInicial)?.id ?? sucursales[0]?.id ?? "",
  );
  const sucursal = sucursales.find((s) => s.id === sucursalId);
  const mesas = todas.filter((m) => (m.sucursal_id ?? "") === sucursalId);
  const url = (mesa?: string) => urlCarta(restaurante.slug, mesa, sitio, sucursal?.slug);
  const urlMesa = (mesa: Mesa) => {
    const e = enlaceMesa(mesa, mesas);
    return urlCarta(restaurante.slug, e.mesa, sitio, sucursal?.slug, e.nombre);
  };
  const [desde, setDesde] = useState("1");
  const [hasta, setHasta] = useState("10");
  const [nombreMesa, setNombreMesa] = useState("");
  const [generando, setGenerando] = useState(false);
  const [conLogo, setConLogo] = useState(!!restaurante.logo_url);
  const [imagenPropia, setImagenPropia] = useState<string | null>(null);
  const [conColor, setConColor] = useState(false);
  const [logoQr, setLogoQr] = useState<string | null>(null);

  // La imagen del centro se prepara una vez (placa blanca + logo) y se reutiliza en todos los QR.
  const origenLogo = imagenPropia ?? restaurante.logo_url;
  useEffect(() => {
    if (!conLogo || !origenLogo) return setLogoQr(null);
    let vigente = true;
    prepararLogoQR(origenLogo).then((png) => {
      if (!vigente) return;
      if (!png) avisar("No se pudo usar esa imagen en el QR", "error");
      setLogoQr(png);
    });
    return () => {
      vigente = false;
    };
  }, [conLogo, origenLogo, avisar]);

  const estilo: EstiloQR = useMemo(
    () => ({ logo: conLogo ? logoQr : null, color: conColor ? colorLegibleQR(restaurante.color_primario) : ESTILO_BASE.color }),
    [conLogo, logoQr, conColor, restaurante.color_primario],
  );

  function elegirImagen(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    if (imagenPropia) URL.revokeObjectURL(imagenPropia);
    setImagenPropia(URL.createObjectURL(archivo));
    setConLogo(true);
  }

  async function insertar(numeros: string[]) {
    const nuevos = numeros.map((n) => n.trim()).filter((n) => n && !mesas.some((m) => m.numero === n));
    if (nuevos.length === 0) return avisar("Esas mesas ya existen");
    const { data, error } = await supabase
      .from("mesas")
      .insert(
        nuevos.map((numero) => ({ restaurante_id: restaurante.id, numero, ...(sucursal ? { sucursal_id: sucursal.id } : {}) })),
      )
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
      await generarPdf(restaurante, lista, estilo, sucursal);
    } catch (err) {
      avisar(mensajeError(err), "error");
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="tarjeta space-y-3 p-5">
        <div>
          <h2 className="font-semibold">Diseño del QR</h2>
          <p className="text-sm text-suave">Se aplica a todos los códigos, al PNG, al SVG y al PDF.</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={conLogo}
              onChange={(e) => setConLogo(e.target.checked)}
              disabled={!origenLogo}
              className="h-4 w-4 accent-[var(--color-marca)]"
            />
            Logo al centro
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={conColor}
              onChange={(e) => setConColor(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-marca)]"
            />
            Color de la marca
            <span className="h-4 w-4 rounded" style={{ background: colorLegibleQR(restaurante.color_primario) }} />
          </label>
          <label className="boton-secundario cursor-pointer py-1.5 text-sm">
            {imagenPropia ? "Cambiar imagen" : "Usar otra imagen"}
            <input type="file" accept="image/*" onChange={elegirImagen} className="sr-only" />
          </label>
        </div>
        {!origenLogo && (
          <p className="text-xs text-suave">
            Para poner tu logo al centro, súbelo en{" "}
            <Link href="/panel/marca" className="text-marca underline">
              Marca
            </Link>{" "}
            o elige una imagen aquí.
          </p>
        )}
        {conLogo && origenLogo && (
          <p className="text-xs text-suave">
            Con logo el código usa corrección de errores alta, así se sigue leyendo bien. Prueba escanearlo antes de imprimir.
          </p>
        )}
      </section>

      {sucursales.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Sucursal">
          <span className="text-sm font-medium">Sucursal:</span>
          {[...sucursales.map((s) => ({ id: s.id, nombre: s.nombre })), { id: "", nombre: "Sin sucursal" }].map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id === sucursalId}
              onClick={() => setSucursalId(s.id)}
              className={`rounded-full border px-3 py-1 text-sm ${
                s.id === sucursalId
                  ? "border-marca bg-marca text-white"
                  : "border-borde bg-superficie text-suave hover:border-stone-400"
              }`}
            >
              {s.nombre}
            </button>
          ))}
        </div>
      )}

      <section className="tarjeta flex flex-col items-center gap-5 p-5 sm:flex-row sm:items-start">
        <TarjetaQR url={url()} estilo={estilo} grande />
        <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
          <div>
            <h2 className="font-semibold">QR general{sucursal ? ` de ${sucursal.nombre}` : " de la carta"}</h2>
            <p className="text-sm text-suave">Para la puerta, el mostrador, Instagram o la carta impresa.</p>
          </div>
          <p className="break-all rounded-lg bg-stone-50 px-3 py-2 font-mono text-xs text-suave">{url()}</p>
          <BotonesDescarga url={url()} estilo={estilo} archivo={`qr-${restaurante.slug}${sucursal ? `-${sucursal.slug}` : ""}`} />
          <p className="text-xs text-suave">
            El QR apunta a la dirección de tu carta, no a un archivo: puedes cambiar platos y precios sin volver a imprimir.
          </p>
        </div>
      </section>

      {reservas && (
        <section className="grid gap-4 sm:grid-cols-2">
          {[
            {
              ruta: "espera",
              titulo: "QR de la lista de espera",
              ayuda: "Para la puerta: el cliente se anota solo y ve en su teléfono cuántos tiene delante.",
            },
            {
              ruta: "reservar",
              titulo: "QR para reservar",
              ayuda: "Para Instagram, Google o la vidriera: piden mesa para otro día.",
            },
          ].map((q) => {
            const direccion = `${sitio}/${restaurante.slug}/${q.ruta}${sucursal ? `?s=${sucursal.slug}` : ""}`;
            return (
              <div key={q.ruta} className="tarjeta flex flex-col items-center gap-3 p-5 text-center">
                <TarjetaQR url={direccion} estilo={estilo} />
                <div>
                  <h2 className="font-semibold">{q.titulo}</h2>
                  <p className="text-sm text-suave">{q.ayuda}</p>
                </div>
                <p className="break-all rounded-lg bg-stone-50 px-3 py-2 font-mono text-xs text-suave">{direccion}</p>
                <BotonesDescarga
                  url={direccion}
                  estilo={estilo}
                  archivo={`qr-${restaurante.slug}-${q.ruta}${sucursal ? `-${sucursal.slug}` : ""}`}
                />
              </div>
            );
          })}
        </section>
      )}

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
                <TarjetaQR url={urlMesa(mesa)} estilo={estilo} />
                <p className="mt-2 font-semibold">{rotuloMesa(mesa.numero)}</p>
                {enlaceMesa(mesa, mesas).nombre && (
                  <p className="text-xs text-suave">{pisos.find((p) => p.id === mesa.piso_id)?.nombre ?? "Sin piso"}</p>
                )}
                <div className="mt-1 flex justify-center gap-3 text-xs">
                  <BotonPng
                    url={urlMesa(mesa)}
                    estilo={estilo}
                    archivo={`qr-${restaurante.slug}${sucursal ? `-${sucursal.slug}` : ""}-mesa-${mesa.numero}`}
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

function TarjetaQR({ url, estilo, grande = false }: { url: string; estilo: EstiloQR; grande?: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    qrPng(url, grande ? 480 : 300, estilo).then(setSrc);
  }, [url, grande, estilo]);
  const tam = grande ? "h-44 w-44" : "aspect-square w-full";
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={`Código QR de ${url}`} className={`${tam} shrink-0 rounded-lg`} />
  ) : (
    <div className={`${tam} shrink-0 rounded-lg bg-stone-100`} />
  );
}

function BotonPng({ url, estilo, archivo }: { url: string; estilo: EstiloQR; archivo: string }) {
  return (
    <button
      type="button"
      onClick={async () => descargar(await qrPng(url, 1200, estilo), `${archivo}.png`)}
      className="text-marca hover:underline"
    >
      PNG
    </button>
  );
}

function BotonesDescarga({ url, estilo, archivo }: { url: string; estilo: EstiloQR; archivo: string }) {
  function svg() {
    const contenido = qrSvg(url, estilo);
    const href = URL.createObjectURL(new Blob([contenido], { type: "image/svg+xml" }));
    descargar(href, `${archivo}.svg`);
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
  return (
    <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
      <button
        type="button"
        className="boton-secundario py-2"
        onClick={async () => descargar(await qrPng(url, 1200, estilo), `${archivo}.png`)}
      >
        Descargar PNG
      </button>
      <button type="button" className="boton-secundario py-2" onClick={svg}>
        SVG (imprenta)
      </button>
    </div>
  );
}
