"use client";

import { useState } from "react";
import type { Plato } from "@/lib/types";
import { traducir } from "@/lib/i18n";
import { gruposDe } from "@/lib/opciones";
import { formatoPrecio } from "@/lib/utils";
import { ElegirOpciones } from "@/components/ElegirOpciones";
import { useCarta } from "./contexto";

// Botón para sumar un plato al pedido. Solo aparece si el restaurante tiene pedidos activados.
// Si el plato tiene opciones (tamaño, acompañamiento…), primero se eligen.
export function Agregar({ plato, className = "" }: { plato: Plato; className?: string }) {
  const { pedidos, cantidad, cambiar, agregar, moneda, idioma, t } = useCarta();
  const [eligiendo, setEligiendo] = useState(false);
  if (!pedidos) return null;
  const n = cantidad(plato.id);
  const estilo = { background: "var(--acento)", color: "var(--sobre-acento)" };
  const grupos = gruposDe(plato);
  const sumar = () => (grupos.length ? setEligiendo(true) : cambiar(plato.id, 1));
  const hoja = eligiendo && (
    <ElegirOpciones
      nombre={traducir(plato, idioma, ["nombre"]).nombre}
      precio={Number(plato.precio)}
      grupos={grupos}
      formato={(v) => formatoPrecio(v, moneda)}
      acento={estilo}
      textos={{
        agregar: t("agregar"),
        cancelar: t("cerrar"),
        obligatorio: t("obligatorio"),
        hasta: (k) => (k === 1 ? t("elegirUno") : t("hastaN").replace("{n}", String(k))),
      }}
      onCerrar={() => setEligiendo(false)}
      onElegir={(o) => {
        agregar(plato.id, o);
        setEligiendo(false);
      }}
    />
  );

  if (plato.agotado && n === 0) {
    return (
      <span
        className={`inline-flex h-8 shrink-0 items-center rounded-full border border-current/30 px-3 text-sm font-semibold opacity-60 ${className}`}
      >
        {t("agotado")}
      </span>
    );
  }

  if (n === 0) {
    return (
      <>
      <button
        type="button"
        onClick={sumar}
        aria-label={`${t("agregar")}: ${plato.nombre}`}
        className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-semibold shadow-sm transition active:scale-95 ${className}`}
        style={estilo}
      >
        <span className="text-base leading-none">+</span> {t("agregar")}
      </button>
      {hoja}
      </>
    );
  }

  return (
    <>
    <span
      className={`inline-flex h-8 shrink-0 items-center rounded-full text-sm font-semibold shadow-sm ${className}`}
      style={estilo}
    >
      <button
        type="button"
        onClick={() => cambiar(plato.id, -1)}
        aria-label={`${t("quitar")}: ${plato.nombre}`}
        className="h-8 w-8 text-lg leading-none"
      >
        −
      </button>
      <span className="min-w-5 text-center tabular-nums" aria-live="polite">
        {n}
      </span>
      <button
        type="button"
        onClick={sumar}
        disabled={plato.agotado}
        aria-label={`${t("agregar")}: ${plato.nombre}`}
        className="h-8 w-8 text-lg leading-none disabled:opacity-40"
      >
        +
      </button>
    </span>
    {hoja}
    </>
  );
}
