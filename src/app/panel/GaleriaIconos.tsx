"use client";

import { useMemo, useState } from "react";
import { GRUPOS_ICONOS, urlIcono, type Icono } from "@/lib/iconos";

const normalizar = (texto: string) => texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Galería para elegir el ícono de un plato sin foto: buscador, sugerido por el nombre y todos por grupo.
export function GaleriaIconos({
  elegido,
  sugerido,
  onElegir,
}: {
  elegido: string | null;
  sugerido: string;
  onElegir: (id: string) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [grupo, setGrupo] = useState<string | null>(null);

  const grupos = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return GRUPOS_ICONOS.filter((g) => !grupo || q || g.grupo === grupo)
      .map((g) => ({
        ...g,
        iconos: q
          ? g.iconos.filter((i) => normalizar(`${i.nombre} ${i.buscar ?? ""} ${g.grupo}`).includes(q))
          : g.iconos,
      }))
      .filter((g) => g.iconos.length);
  }, [busqueda, grupo]);

  const todos = GRUPOS_ICONOS.flatMap((g) => g.iconos);
  const iconoSugerido = todos.find((i) => i.id === sugerido);

  return (
    <div className="space-y-3 rounded-xl border border-borde p-3">
      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar: flan, cerveza, lomo, ensalada…"
        className="campo py-2 text-sm"
        aria-label="Buscar ícono"
      />
      {!busqueda.trim() && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {[null, ...GRUPOS_ICONOS.map((g) => g.grupo)].map((g) => (
            <button
              key={g ?? "todos"}
              type="button"
              onClick={() => setGrupo(g)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs transition ${
                grupo === g ? "border-marca bg-marca text-white" : "border-borde hover:border-stone-400"
              }`}
            >
              {g ?? "Todos"}
            </button>
          ))}
        </div>
      )}
      <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
        {!busqueda.trim() && !grupo && iconoSugerido && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-suave">Sugerido por el nombre</p>
            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
              <Opcion icono={iconoSugerido} activo={elegido === iconoSugerido.id} onElegir={onElegir} />
            </div>
          </div>
        )}
        {grupos.map((g) => (
          <div key={g.grupo}>
            <p className="mb-1.5 text-xs font-semibold text-suave">{g.grupo}</p>
            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
              {g.iconos.map((i) => (
                <Opcion key={i.id} icono={i} activo={elegido === i.id} onElegir={onElegir} />
              ))}
            </div>
          </div>
        ))}
        {grupos.length === 0 && <p className="py-4 text-center text-sm text-suave">No hay íconos con ese nombre.</p>}
      </div>
    </div>
  );
}

function Opcion({ icono, activo, onElegir }: { icono: Icono; activo: boolean; onElegir: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onElegir(icono.id)}
      title={icono.nombre}
      aria-pressed={activo}
      className={`flex flex-col items-center gap-0.5 rounded-lg border p-1.5 transition ${
        activo ? "border-marca bg-marca/10 ring-2 ring-marca/30" : "border-transparent hover:border-borde hover:bg-stone-50"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={urlIcono(icono.id)} alt="" loading="lazy" className="h-9 w-9 object-contain" />
      <span className="w-full truncate text-center text-[10px] leading-tight text-suave">{icono.nombre}</span>
    </button>
  );
}
