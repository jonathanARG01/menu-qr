"use client";

import { useEffect, useState } from "react";
import { Icono } from "@/components/Icono";
import { CLAVE_TEMA, SCRIPT_TEMA } from "@/lib/tema";

type Preferencia = "claro" | "oscuro" | "sistema";

function leerPreferencia(): Preferencia {
  try {
    const v = localStorage.getItem(CLAVE_TEMA);
    return v === "claro" || v === "oscuro" ? v : "sistema";
  } catch {
    return "sistema";
  }
}
function aplicar(p: Preferencia) {
  const oscuro = p === "oscuro" || (p === "sistema" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.tema = oscuro ? "oscuro" : "claro";
}
function guardar(p: Preferencia) {
  try {
    if (p === "sistema") localStorage.removeItem(CLAVE_TEMA);
    else localStorage.setItem(CLAVE_TEMA, p);
  } catch {}
  aplicar(p);
}

// Pone el tema antes de pintar (va en la página, no en un efecto).
export function ScriptTema() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />;
}

// Mantiene el tema al navegar y sigue al sistema si así se eligió.
export function Tema() {
  useEffect(() => {
    aplicar(leerPreferencia());
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const cambio = () => leerPreferencia() === "sistema" && aplicar("sistema");
    mq.addEventListener("change", cambio);
    return () => {
      mq.removeEventListener("change", cambio);
      delete document.documentElement.dataset.tema;
    };
  }, []);
  return null;
}

const OPCIONES: [Preferencia, string, string][] = [
  ["claro", "sol", "Claro"],
  ["oscuro", "luna", "Oscuro"],
  ["sistema", "monitor", "Auto"],
];

// Claro · Oscuro · Auto, en tres botones.
export function SelectorTema({ className = "" }: { className?: string }) {
  const [pref, setPref] = useState<Preferencia>("sistema");
  useEffect(() => setPref(leerPreferencia()), []);
  return (
    <div className={`grid grid-cols-3 gap-1 rounded-2xl border border-borde bg-stone-50 p-1 ${className}`} role="radiogroup" aria-label="Tema">
      {OPCIONES.map(([id, icono, texto]) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={pref === id}
          title={id === "sistema" ? "Igual que tu dispositivo" : `Modo ${texto.toLowerCase()}`}
          onClick={() => {
            setPref(id);
            guardar(id);
          }}
          className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-[11px] font-medium transition ${
            pref === id ? "bg-superficie text-tinta shadow-sm ring-1 ring-borde" : "text-suave hover:text-tinta"
          }`}
        >
          <Icono nombre={icono} className="h-3.5 w-3.5" />
          {texto}
        </button>
      ))}
    </div>
  );
}

// Un solo botón redondo que alterna claro ↔ oscuro (para pantallas del cliente y de acceso).
export function BotonTema({ className = "" }: { className?: string }) {
  const [oscuro, setOscuro] = useState(false);
  useEffect(() => setOscuro(document.documentElement.dataset.tema === "oscuro"), []);
  return (
    <button
      type="button"
      onClick={() => {
        const p: Preferencia = oscuro ? "claro" : "oscuro";
        setOscuro(!oscuro);
        guardar(p);
      }}
      className={`grid h-10 w-10 place-items-center rounded-full border border-borde bg-superficie/80 text-suave shadow-sm backdrop-blur transition hover:text-tinta ${className}`}
      aria-label={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={oscuro ? "Modo claro" : "Modo oscuro"}
    >
      <Icono nombre={oscuro ? "sol" : "luna"} className="h-[18px] w-[18px]" />
    </button>
  );
}
