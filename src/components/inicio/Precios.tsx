"use client";

import Link from "next/link";
import { useState } from "react";
import { Icono } from "@/components/Icono";
import { PERIODOS, PLANES } from "./datos";

const clp = (n: number) => "$" + n.toLocaleString("es-CL");

// Precio mensual con el descuento del período, redondeado a la decena.
const conDescuento = (precio: number, descuento: number) => Math.round((precio * (1 - descuento)) / 10) * 10;

// Tarjetas de planes (estilo del sitio de venta) con el selector de período: el precio se recalcula al elegir Mensual, 3 meses, Semestral o Anual.
export function PreciosPlanes() {
  const [periodoId, setPeriodoId] = useState<string>("anual");
  const periodo = PERIODOS.find((p) => p.id === periodoId) ?? PERIODOS[0];

  return (
    <>
      <div data-revelar="" className="mt-12 flex flex-col items-center gap-3 text-center">
        <div role="radiogroup" aria-label="Período de pago" className="vidrio inline-flex flex-wrap justify-center gap-1 rounded-[1.75rem] p-1.5 sm:rounded-full">
          {PERIODOS.map((p) => {
            const activo = p.id === periodo.id;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => setPeriodoId(p.id)}
                className={`rounded-full px-4 py-2.5 text-sm font-semibold transition duration-300 ${
                  activo ? "text-[#172033] shadow-lg shadow-black/20" : "text-sitio-suave hover:text-sitio-tinta"
                }`}
                style={activo ? { background: "var(--oro-degradado)" } : undefined}
              >
                {p.nombre}
                {p.descuento > 0 && (
                  <span className={`ml-1.5 ${activo ? "text-[#172033]/70" : "text-sitio-oro-texto"}`}>−{Math.round(p.descuento * 100)}%</span>
                )}
              </button>
            );
          })}
        </div>
        <p key={periodo.id} className="cambio-precio text-sm text-sitio-suave">
          {periodo.descuento > 0
            ? `Pagando cada ${periodo.meses} meses ahorras un ${Math.round(periodo.descuento * 100)} % sobre el precio mensual.`
            : "Sin permanencia: pagas mes a mes y cancelas cuando quieras."}
        </p>
      </div>

      <div className="mt-12 grid items-stretch gap-5 lg:grid-cols-3">
        {PLANES.map((p, i) => {
          const destacado = "destacado" in p && p.destacado;
          const mensual = conDescuento(p.precio, periodo.descuento);
          return (
            <div key={p.id} data-revelar="" style={{ "--retraso": `${i * 110}ms` } as React.CSSProperties}>
              <div
                className={`tarjeta-sitio relative flex h-full flex-col rounded-[2rem] p-7 ${
                  destacado ? "borde-oro shadow-[0_30px_80px_-30px_rgb(242_163_58/0.45)] lg:-my-4 lg:py-11" : ""
                }`}
              >
                {destacado && (
                  <span
                    className="absolute -top-3.5 left-7 rounded-full px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#172033] shadow-lg shadow-black/20"
                    style={{ background: "var(--oro-degradado)" }}
                  >
                    Recomendado
                  </span>
                )}
                <h3 className="font-marca text-2xl font-bold">{p.nombre}</h3>
                <p className="mt-1 min-h-10 text-sm text-sitio-suave">{p.para}</p>
                <p key={periodo.id} className="cambio-precio mt-6 flex flex-wrap items-baseline gap-x-2">
                  <span className={`font-marca text-5xl font-bold tracking-tight tabular-nums ${destacado ? "texto-oro" : ""}`}>{clp(mensual)}</span>
                  <span className="text-sitio-suave">/mes + IVA</span>
                  {periodo.descuento > 0 && <span className="text-sitio-suave tabular-nums line-through">{clp(p.precio)}</span>}
                </p>
                <p className="mt-1 h-5 text-sm text-sitio-suave tabular-nums">
                  {periodo.meses > 1 && `${clp(mensual * periodo.meses)} + IVA cada ${periodo.meses} meses`}
                </p>
                <Link href="/registro" className={`mt-7 w-full ${destacado ? "boton-oro" : "boton-vidrio"}`}>
                  Probar gratis
                </Link>
                <ul className="mt-7 flex-1 space-y-2.5 border-t border-sitio-borde pt-6 text-sm">
                  {p.incluye.map((item) => (
                    <li key={item} className="flex gap-2">
                      <Icono nombre="check" className="mt-0.5 h-4 w-4 shrink-0 text-sitio-oro" />
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
