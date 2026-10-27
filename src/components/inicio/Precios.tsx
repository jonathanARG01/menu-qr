"use client";

import Link from "next/link";
import { useState } from "react";
import { Icono } from "@/components/Icono";
import { PERIODOS, PLANES } from "./datos";

const clp = (n: number) => "$" + n.toLocaleString("es-CL");

// Precio mensual con el descuento del período, redondeado a la decena.
const conDescuento = (precio: number, descuento: number) => Math.round((precio * (1 - descuento)) / 10) * 10;

// Tarjetas de planes con el selector de período: el precio se recalcula al elegir Mensual, 3 meses, Semestral o Anual.
export function PreciosPlanes() {
  const [periodoId, setPeriodoId] = useState<string>("anual");
  const periodo = PERIODOS.find((p) => p.id === periodoId) ?? PERIODOS[0];

  return (
    <>
      <div className="mt-10 flex flex-col items-start gap-3">
        <div role="radiogroup" aria-label="Período de pago" className="inline-flex flex-wrap gap-1 rounded-2xl border border-borde bg-superficie p-1.5 shadow-sm">
          {PERIODOS.map((p) => {
            const activo = p.id === periodo.id;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => setPeriodoId(p.id)}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  activo ? "bg-marca-tinta text-white shadow" : "text-suave hover:text-tinta"
                }`}
              >
                {p.nombre}
                {p.descuento > 0 && (
                  <span className={`ml-1.5 ${activo ? "text-marca-claro" : "text-amber-600"}`}>−{Math.round(p.descuento * 100)}%</span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-suave">
          {periodo.descuento > 0
            ? `Pagando cada ${periodo.meses} meses ahorras un ${Math.round(periodo.descuento * 100)} % sobre el precio mensual.`
            : "Sin permanencia: pagas mes a mes y cancelas cuando quieras."}
        </p>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {PLANES.map((p) => {
          const destacado = "destacado" in p && p.destacado;
          const mensual = conDescuento(p.precio, periodo.descuento);
          return (
            <div
              key={p.id}
              className={`relative flex flex-col rounded-2xl border p-7 ${
                destacado ? "border-marca bg-superficie shadow-xl shadow-slate-900/10 ring-1 ring-marca" : "border-borde bg-superficie"
              }`}
            >
              {destacado && (
                <span className="absolute -top-3 left-7 rounded-full bg-marca-claro px-3 py-1 text-xs font-bold uppercase tracking-wide text-marca-tinta">
                  Recomendado
                </span>
              )}
              <h3 className="text-xl font-bold">{p.nombre}</h3>
              <p className="mt-1 min-h-10 text-sm text-suave">{p.para}</p>
              <p className="mt-5 flex flex-wrap items-baseline gap-x-2">
                <span className="text-4xl font-bold tracking-tight tabular-nums">{clp(mensual)}</span>
                <span className="text-suave">/mes</span>
                {periodo.descuento > 0 && <span className="text-suave tabular-nums line-through">{clp(p.precio)}</span>}
              </p>
              <p className="mt-1 h-5 text-sm text-suave tabular-nums">
                {periodo.meses > 1 && `${clp(mensual * periodo.meses)} cada ${periodo.meses} meses`}
              </p>
              <Link href="/registro" className={`mt-6 ${destacado ? "boton" : "boton-secundario"}`}>
                Probar gratis
              </Link>
              <ul className="mt-6 flex-1 space-y-2.5 border-t border-borde pt-6 text-sm">
                {p.incluye.map((item) => (
                  <li key={item} className="flex gap-2">
                    <Icono nombre="check" className="mt-0.5 h-4 w-4 shrink-0 text-marca" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}
