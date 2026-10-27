"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BotonAvisos } from "@/components/BotonAvisos";
import { Icono } from "@/components/Icono";
import { enlaceContratar, estadoPrueba, type EstadoPrueba } from "@/lib/planes";
import type { Restaurante } from "@/lib/types";

type Props = { restaurante: Pick<Restaurante, "nombre" | "plan" | "prueba_inicio" | "prueba_fin"> };

// Días de prueba arriba del panel (solo administradores). Se calcula en el navegador para no desfasarse con la caché.
export function AvisoPrueba({ restaurante }: Props) {
  const [prueba, setPrueba] = useState<EstadoPrueba | null>(null);
  useEffect(() => setPrueba(estadoPrueba(restaurante)), [restaurante]);
  if (!prueba) return null;

  const contratar = enlaceContratar(restaurante.nombre);
  const urgente = prueba.vencida || prueba.quedan <= 4;
  const tono = prueba.vencida
    ? "border-red-200 bg-red-50 text-red-900"
    : urgente
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-borde bg-superficie";
  const barra = prueba.vencida ? "bg-red-500" : urgente ? "bg-amber-500" : "bg-marca-claro";

  return (
    <div className={`mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-4 py-3 text-sm ${tono}`}>
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${prueba.vencida ? "bg-red-100" : "bg-amber-100"}`}
      >
        <Icono nombre={prueba.vencida ? "candado" : "reloj"} className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1 basis-48">
        <p className="font-semibold">
          {prueba.vencida
            ? "Terminó tu prueba: tu carta está pausada"
            : `Prueba gratis · te ${prueba.quedan === 1 ? "queda 1 día" : `quedan ${prueba.quedan} días`}`}
        </p>
        {prueba.vencida ? (
          <p className="text-xs opacity-80">Elige un plan y vuelve a mostrarla al instante. No se borró nada.</p>
        ) : (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 max-w-56 flex-1 overflow-hidden rounded-full bg-stone-200">
              <div className={`h-full rounded-full ${barra}`} style={{ width: `${(prueba.usados / prueba.total) * 100}%` }} />
            </div>
            <span className="text-xs tabular-nums opacity-80">
              día {Math.min(prueba.total, prueba.usados + 1)} de {prueba.total}
            </span>
          </div>
        )}
      </div>
      {urgente && <BotonAvisos texto="Avisarme" />}
      <Link href="/panel/plan" className="rounded-full px-3 py-1.5 text-xs font-semibold hover:underline">
        Ver planes
      </Link>
      {urgente && contratar && (
        <a href={contratar} target="_blank" className="boton py-1.5 text-xs">
          Quiero contratar
        </a>
      )}
    </div>
  );
}
