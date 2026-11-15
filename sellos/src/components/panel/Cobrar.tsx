"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { qrSvg } from "@/lib/qr";
import { rutaUnirse, textoRegla, vigente, type Negocio, type ProgramaSellos } from "@/lib/tipos";
import { formatoPrecio, mensajeError, urlSitio } from "@/lib/utils";

type Estado = { usado: boolean; nombre: string | null; sumados: number | null; vencido: boolean };

// "Sumar con QR": el equipo muestra este QR (en el celular o una tablet en el mesón) y el cliente lo escanea con su
// cámara. Cada QR sirve una vez y dura 15 minutos; al usarse aparece a quién se le sumó y sale uno nuevo.
export function Cobrar({ negocio, programa }: { negocio: Negocio; programa: ProgramaSellos }) {
  const supabase = useMemo(() => createClient(), []);
  const porMonto = programa.regla === "monto";
  const formato = (n: number) => formatoPrecio(n, negocio.moneda);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [monto, setMonto] = useState("");
  const [error, setError] = useState("");
  const [listo, setListo] = useState<Estado | null>(null);
  const creando = useRef(false);

  const crear = useCallback(
    async (valor: number | null) => {
      if (creando.current) return;
      creando.current = true;
      setError("");
      const { data, error } = await supabase.rpc("crear_codigo", { p_negocio: negocio.id, p_monto: valor });
      creando.current = false;
      if (error) return setError(mensajeError(error));
      setCodigo(String(data));
    },
    [supabase, negocio.id],
  );

  // Con "un sello por visita" el QR aparece al tiro; con monto, después de anotarlo.
  useEffect(() => {
    if (!porMonto && vigente(negocio)) crear(null);
  }, [porMonto, negocio, crear]);

  // Revisa cada 2 segundos si el cliente ya lo escaneó.
  useEffect(() => {
    if (!codigo) return;
    const id = setInterval(async () => {
      const { data } = await supabase.rpc("estado_codigo", { p_codigo: codigo });
      const e = data as Estado | null;
      if (!e) return;
      if (e.usado) {
        setListo(e);
        setCodigo(null);
        setMonto("");
        setTimeout(() => {
          setListo(null);
          if (!porMonto) crear(null);
        }, 4000);
      } else if (e.vencido) {
        setCodigo(null);
        if (!porMonto) crear(null);
      }
    }, 2000);
    return () => clearInterval(id);
  }, [codigo, supabase, porMonto, crear]);

  const url = codigo ? `${urlSitio()}${rutaUnirse(negocio.slug, codigo)}` : "";
  const svg = useMemo(() => (url ? qrSvg(url) : ""), [url]);

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="text-center">
        <h1 className="text-xl font-semibold">Sumar sello con QR</h1>
        <p className="text-sm text-suave">
          Muéstrale este QR al cliente: lo escanea con la cámara de su celular y suma su sello. Si no tiene tarjeta, se la crea
          en el mismo paso.
        </p>
      </div>

      {porMonto && !codigo && !listo && (
        <form
          className="tarjeta space-y-3 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const v = Number(monto.replace(/[^\d.,]/g, "").replace(",", "."));
            if (!(v > 0)) return setError("Anota el monto de la compra");
            crear(v);
          }}
        >
          <label className="block text-sm">
            <span className="etiqueta-campo">Monto de la compra</span>
            <input
              inputMode="decimal"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder={formato(programa.monto_por_sello * 2)}
              className="campo text-lg"
              autoFocus
            />
          </label>
          <p className="text-xs text-suave">{textoRegla(programa, formato)}.</p>
          <button className="boton w-full py-3">Mostrar QR</button>
        </form>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-700">{error}</p>}

      {listo && (
        <div className="tarjeta flex flex-col items-center gap-2 p-8 text-center">
          <p className="text-5xl" aria-hidden>
            ✅
          </p>
          <p className="text-lg font-semibold">
            {listo.sumados === 1 ? "Sello sumado" : `${listo.sumados} sellos sumados`}
            {listo.nombre ? ` a ${listo.nombre}` : ""}
          </p>
          <p className="text-sm text-suave">{porMonto ? "Listo para la próxima compra." : "En un momento sale el QR siguiente."}</p>
        </div>
      )}

      {codigo && !listo && (
        <div className="tarjeta flex flex-col items-center gap-3 p-6" style={{ borderTop: `6px solid ${programa.color}` }}>
          <div className="w-full max-w-[18rem]" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="font-mono text-sm tracking-widest text-suave">{codigo}</p>
          {porMonto && <p className="text-sm">Compra de {formato(Number(monto.replace(/[^\d.,]/g, "").replace(",", ".")))}</p>}
          <p className="text-center text-xs text-suave">Sirve una sola vez y dura 15 minutos.</p>
          <button
            type="button"
            className="text-sm text-suave hover:text-tinta"
            onClick={() => {
              setCodigo(null);
              if (!porMonto) crear(null);
            }}
          >
            {porMonto ? "Cancelar" : "Generar otro"}
          </button>
        </div>
      )}
    </div>
  );
}
