"use client";

import { useEffect, useRef } from "react";
import { nombrePersona, type Persona } from "@/lib/equipo";
import { colorCalor, type PrefIndicadores } from "./indicadores";

type Props = {
  pref: PrefIndicadores;
  onCambiar: (c: Partial<PrefIndicadores>) => void;
  // Minutos de "Alertas de cocina" (Personalizar), lo que se usa si no se eligió otro.
  atrasoBase: number;
  meseros: (Persona & { colorZona: string })[];
  yo: string | null;
  admin: boolean;
  onRepartir: () => void;
  onCerrar: () => void;
};

// Panel del botón "Indicadores": cada indicador se prende o se apaga aquí y queda guardado en este dispositivo.
export function PanelIndicadores({ pref, onCambiar, atrasoBase, meseros, yo, admin, onRepartir, onCerrar }: Props) {
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fuera = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (caja.current && !caja.current.contains(t) && !t.closest("[data-boton-indicadores]")) onCerrar();
    };
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    document.addEventListener("pointerdown", fuera);
    window.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      window.removeEventListener("keydown", tecla);
    };
  }, [onCerrar]);

  return (
    <div
      ref={caja}
      role="dialog"
      aria-label="Indicadores del salón"
      className="fixed inset-x-4 top-20 z-40 max-h-[75vh] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[360px] space-y-1 overflow-y-auto rounded-2xl border border-borde bg-superficie p-3 text-sm shadow-xl"
    >
      <p className="px-1 pb-1 text-xs text-suave">Se guardan en este dispositivo: cada uno elige qué ver.</p>

      <Fila
        activo={pref.tiempo}
        onCambiar={(v) => onCambiar({ tiempo: v })}
        titulo="⏱ Tiempo en mesa"
        detalle="Reloj ámbar y luego rojo (al doble del tiempo) cuando la mesa necesita que pases."
      >
        <Minutos etiqueta="Sin pedir desde que se sentaron" valor={pref.sinPedir} onCambiar={(n) => onCambiar({ sinPedir: n })} />
        <Minutos
          etiqueta="Sin pedir nada más (postre, café)"
          valor={pref.sinMas}
          onCambiar={(n) => onCambiar({ sinMas: n })}
        />
        <Minutos etiqueta="Esperando la cuenta o al mesero" valor={pref.espera} onCambiar={(n) => onCambiar({ espera: n })} />
      </Fila>

      <Fila
        activo={pref.atrasados}
        onCambiar={(v) => onCambiar({ atrasados: v })}
        titulo="🔥 Platos atrasados"
        detalle="La mesa parpadea si un pedido lleva mucho en cocina sin estar listo."
      >
        <Minutos
          etiqueta={`Atrasado desde${pref.atraso === null ? " (el de Alertas de cocina)" : ""}`}
          valor={pref.atraso ?? atrasoBase}
          onCambiar={(n) => onCambiar({ atraso: n === atrasoBase ? null : n })}
        />
      </Fila>

      <Fila
        activo={pref.totales}
        onCambiar={(v) => onCambiar({ totales: v })}
        titulo="$ Total en vivo"
        detalle="Lo consumido en cada mesa y, arriba, el total del salón y lo cobrado en el turno."
      />

      <Fila
        activo={pref.zonas}
        onCambiar={(v) => onCambiar({ zonas: v })}
        titulo="🎨 Zonas por mesero"
        detalle="Cada mesa con el color de quien la atiende o la tiene a cargo."
      >
        {meseros.length > 0 ? (
          <>
            <label className="block text-xs text-suave">
              Resaltar
              <select
                value={pref.resaltar}
                onChange={(e) => onCambiar({ resaltar: e.target.value })}
                className="campo mt-1 py-1.5 text-sm"
              >
                <option value="todas">Todas las mesas</option>
                {yo && meseros.some((m) => m.user_id === yo) && <option value="mias">Solo mis mesas</option>}
                {meseros.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    Mesas de {nombrePersona(m)}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {meseros.map((m) => (
                <span key={m.user_id} className="inline-flex items-center gap-1 text-xs">
                  <span className="h-3 w-3 rounded-full" style={{ background: m.colorZona }} />
                  {nombrePersona(m)}
                </span>
              ))}
            </div>
            {admin && (
              <button type="button" onClick={onRepartir} className="boton-secundario mt-1 w-full justify-center py-1.5 text-sm">
                Repartir mesas en el plano
              </button>
            )}
          </>
        ) : (
          <p className="text-xs text-suave">Agrega meseros en Equipo para repartir el salón.</p>
        )}
      </Fila>

      <Fila
        activo={pref.limpiar}
        onCambiar={(v) => onCambiar({ limpiar: v })}
        titulo="🧹 Mesa por limpiar"
        detalle="Al cobrar, la mesa queda por limpiar hasta que alguien la marca lista."
      />

      <Fila
        activo={pref.calor}
        onCambiar={(v) => onCambiar({ calor: v })}
        titulo="🌡 Mapa de calor"
        detalle="Qué mesas venden más o rotan más. Mientras está prendido, el plano muestra solo eso."
      >
        <div className="flex gap-1.5">
          {(
            [
              ["ventas", "Ventas"],
              ["rotacion", "Rotación"],
            ] as const
          ).map(([v, t]) => (
            <button
              key={v}
              type="button"
              onClick={() => onCambiar({ calorMide: v })}
              className={`flex-1 rounded-lg border px-2 py-1 text-xs ${pref.calorMide === v ? "border-marca bg-marca/10 text-marca" : "border-borde"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onCambiar({ calorDias: d })}
              className={`flex-1 rounded-lg border px-2 py-1 text-xs ${pref.calorDias === d ? "border-marca bg-marca/10 text-marca" : "border-borde"}`}
            >
              {d} días
            </button>
          ))}
        </div>
        <EscalaCalor />
      </Fila>
    </div>
  );
}

export function EscalaCalor({ texto = ["Menos", "Más"] }: { texto?: [string, string] }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-suave">
      {texto[0]}
      <span
        className="h-2.5 w-24 rounded-full"
        style={{ background: `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map((t) => colorCalor(t)).join(",")})` }}
      />
      {texto[1]}
    </span>
  );
}

function Fila({
  activo,
  onCambiar,
  titulo,
  detalle,
  children,
}: {
  activo: boolean;
  onCambiar: (v: boolean) => void;
  titulo: string;
  detalle: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl px-2 py-2 ${activo ? "bg-stone-50" : ""}`}>
      <div className="flex items-start gap-3">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{titulo}</span>
          <span className="block text-xs text-suave">{detalle}</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={activo}
          aria-label={titulo}
          onClick={() => onCambiar(!activo)}
          className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${activo ? "bg-marca" : "bg-stone-300"}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${activo ? "left-[22px]" : "left-0.5"}`}
          />
        </button>
      </div>
      {activo && children && <div className="mt-2 space-y-2">{children}</div>}
    </div>
  );
}

function Minutos({ etiqueta, valor, onCambiar }: { etiqueta: string; valor: number; onCambiar: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-suave">{etiqueta}</span>
      <span className="flex shrink-0 items-center rounded-lg border border-borde">
        <button type="button" className="h-7 w-7 text-base" onClick={() => onCambiar(Math.max(1, valor - 1))} aria-label="Menos">
          −
        </button>
        <span className="w-12 text-center font-semibold tabular-nums">{valor} min</span>
        <button type="button" className="h-7 w-7 text-base" onClick={() => onCambiar(Math.min(180, valor + 1))} aria-label="Más">
          +
        </button>
      </span>
    </div>
  );
}
