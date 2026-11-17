"use client";

import Link from "next/link";
import { useState } from "react";
import { Icono } from "@/components/Icono";
import { DESCUENTOS, PLANES, type Plan } from "@/lib/marca";

const clp = (n: number) => "$" + n.toLocaleString("es-CL");
// Precio mensual con el descuento del período, redondeado a la decena.
const conDescuento = (precio: number, descuento: number) => Math.round((precio * (1 - descuento / 100)) / 10) * 10;

const NOMBRE_PERIODO: Record<number, string> = { 1: "Mensual", 3: "3 meses", 6: "Semestral", 12: "Anual" };
const PERIODOS = [{ meses: 1, descuento: 0 }, ...DESCUENTOS].map((p) => ({ ...p, nombre: NOMBRE_PERIODO[p.meses] ?? `${p.meses} meses` }));
const DESTACADO: Plan = "pro";

// Cajas de precios con el selector de período: el precio se recalcula al elegir Mensual, 3 meses, Semestral o Anual.
export function PreciosPlanes() {
  const [meses, setMeses] = useState(1);
  const periodo = PERIODOS.find((p) => p.meses === meses) ?? PERIODOS[0];

  return (
    <>
      <div data-revelar="" className="mt-12 flex flex-col items-center gap-3 text-center">
        <div role="radiogroup" aria-label="Período de pago" className="vidrio-club inline-flex flex-wrap justify-center gap-1 rounded-[1.75rem] p-1.5 sm:rounded-full">
          {PERIODOS.map((p) => {
            const activo = p.meses === periodo.meses;
            return (
              <button
                key={p.meses}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => setMeses(p.meses)}
                className={`rounded-full px-4 py-2.5 text-sm font-semibold transition duration-300 ${activo ? "text-[#1a1408] shadow-lg shadow-black/15" : "text-suave hover:text-tinta"}`}
                style={activo ? { background: "var(--oro-degradado)" } : undefined}
              >
                {p.nombre}
                {p.descuento > 0 && <span className={`ml-1.5 ${activo ? "text-[#1a1408]/70" : "text-club-bronce"}`}>−{p.descuento}%</span>}
              </button>
            );
          })}
        </div>
        <p key={periodo.meses} className="aparecer-club text-sm text-suave">
          {periodo.descuento > 0
            ? `Pagando cada ${periodo.meses} meses ahorras un ${periodo.descuento} % sobre el precio mensual.`
            : "Sin permanencia: pagas mes a mes y cancelas cuando quieras."}
        </p>
      </div>

      <div className="mt-12 grid items-stretch gap-5 lg:grid-cols-3">
        {(Object.keys(PLANES) as Plan[]).map((id, i) => {
          const p = PLANES[id];
          const destacado = id === DESTACADO;
          const mensual = conDescuento(p.precio, periodo.descuento);
          return (
            <div key={id} data-revelar="" style={{ "--retraso": `${i * 110}ms` } as React.CSSProperties}>
              <div
                className={`tarjeta-club relative flex h-full flex-col rounded-[2rem] p-7 ${
                  destacado ? "marco-oro pt-12 lg:-my-4 lg:pb-11 lg:pt-14" : ""
                }`}
              >
                {destacado && <span className="pestana-oro">El más elegido</span>}
                <h3 className="text-2xl font-bold">{p.nombre}</h3>
                <p className="mt-1 min-h-10 text-sm text-suave">{p.detalle}</p>
                <p key={periodo.meses} className="aparecer-club mt-6 flex flex-wrap items-baseline gap-x-2">
                  <span className={`font-titulo text-5xl font-bold tracking-tight tabular-nums ${destacado ? "texto-oro" : ""}`}>{clp(mensual)}</span>
                  <span className="text-suave">/mes + IVA</span>
                  {periodo.descuento > 0 && <span className="text-suave tabular-nums line-through">{clp(p.precio)}</span>}
                </p>
                <p className="mt-1 h-5 text-sm text-suave tabular-nums">
                  {periodo.meses > 1 && `${clp(mensual * periodo.meses)} + IVA cada ${periodo.meses} meses`}
                </p>
                <Link href="/registro" className={`mt-7 w-full shrink-0 ${destacado ? "boton-oro" : "boton-capsula"}`}>
                  Probar gratis <span className="flecha">→</span>
                </Link>
                <ul className="mt-7 flex-1 space-y-2.5 border-t border-borde pt-6 text-sm">
                  {p.incluye.map((item) => (
                    <li key={item} className="flex gap-2">
                      <Icono nombre="check" className="mt-0.5 h-4 w-4 shrink-0 text-club-oro" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
