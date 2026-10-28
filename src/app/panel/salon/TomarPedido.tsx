"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { precioConPromo, promoVigente } from "@/lib/promos";
import { createClient } from "@/lib/supabase/client";
import { extraOpciones, gruposDe } from "@/lib/opciones";
import { nuevoId } from "@/lib/reintentos";
import { textoOpciones, type OpcionElegida, type TipoCuenta } from "@/lib/salon";
import type { Categoria, Plato, Promo } from "@/lib/types";
import { ElegirOpciones } from "@/components/ElegirOpciones";

// id: el de la fila que se va a crear (generado aquí, así un reintento no duplica la comanda).
// despues: "dejar para después" (tiempos de servicio): no va a cocina hasta que el mesero la marche.
export type LineaNueva = {
  clave: string;
  id: string;
  plato: Plato;
  cantidad: number;
  nota: string;
  comensal: number | null;
  opciones: OpcionElegida[];
  despues: boolean;
};
type Guardada = Omit<LineaNueva, "plato"> & { plato: string };

const claveBorrador = (id: string) => `comanda:${id}`;

// El mesero arma la comanda desde la carta: busca, suma platos, anota detalles y elige de quién es cada uno.
// Lo que va armando se guarda en el teléfono: si se corta la conexión o se cierra la ficha, no se pierde.
export function TomarPedido({
  categorias,
  platos: platosCarta,
  zona,
  comensales,
  formato,
  tipo = "mesa",
  borrador,
  onEnviar,
  onCancelar,
}: {
  categorias: Categoria[];
  platos: Plato[];
  // Zona horaria del restaurante, para mostrar el precio con las promos en horario.
  zona: string;
  comensales: number;
  formato: (n: number) => string;
  // Para llevar o delivery: se muestra el precio para llevar de cada plato (si tiene).
  tipo?: TipoCuenta;
  // Id de la cuenta: con él se guarda el borrador de la comanda en este teléfono.
  borrador: string;
  onEnviar: (lineas: LineaNueva[]) => Promise<boolean>;
  onCancelar: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [lineas, setLineas] = useState<LineaNueva[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [eligiendo, setEligiendo] = useState<Plato | null>(null);
  const [enLinea, setEnLinea] = useState(true);
  // Falló por la conexión: se reintenta solo cuando vuelve.
  const [reintentar, setReintentar] = useState(false);
  const cargado = useRef(false);

  // Las promos en horario y los agotados se ven igual que en la carta (la base de datos cobra el mismo precio).
  useEffect(() => {
    const restaurante = platosCarta[0]?.restaurante_id;
    if (!restaurante) return;
    createClient()
      .from("promos")
      .select("*")
      .eq("restaurante_id", restaurante)
      .eq("activa", true)
      .then(({ data }) => setPromos((data ?? []) as Promo[]));
  }, [platosCarta]);

  const platos = useMemo(() => {
    const vigentes = promos.filter((p) => promoVigente(p, zona));
    const ahora = Date.now();
    const llevar = tipo !== "mesa";
    return platosCarta.map((p) => ({
      ...p,
      precio: precioConPromo(llevar && p.precio_llevar != null ? { ...p, precio: Number(p.precio_llevar) } : p, vigentes),
      agotado: !!p.agotado_hasta && Date.parse(p.agotado_hasta) > ahora,
    }));
  }, [platosCarta, promos, zona, tipo]);

  // Borrador: se recupera al abrir y se guarda con cada cambio.
  useEffect(() => {
    try {
      const guardadas = JSON.parse(localStorage.getItem(claveBorrador(borrador)) ?? "[]") as Guardada[];
      const recuperadas = guardadas.flatMap((g): LineaNueva[] => {
        const plato = platos.find((p) => p.id === g.plato);
        return plato ? [{ ...g, plato }] : [];
      });
      if (recuperadas.length) setLineas(recuperadas);
    } catch {}
    cargado.current = true;
    // Solo al abrir; los precios se actualizan abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [borrador]);
  useEffect(() => {
    if (!cargado.current) return;
    try {
      if (lineas.length)
        localStorage.setItem(claveBorrador(borrador), JSON.stringify(lineas.map((l) => ({ ...l, plato: l.plato.id }))));
      else localStorage.removeItem(claveBorrador(borrador));
    } catch {}
  }, [lineas, borrador]);

  useEffect(() => {
    const actualizar = () => setEnLinea(navigator.onLine);
    actualizar();
    window.addEventListener("online", actualizar);
    window.addEventListener("offline", actualizar);
    return () => {
      window.removeEventListener("online", actualizar);
      window.removeEventListener("offline", actualizar);
    };
  }, []);

  async function enviar() {
    if (enviando || lineas.length === 0) return;
    setEnviando(true);
    const ok = await onEnviar(lineas);
    setEnviando(false);
    if (ok) {
      try {
        localStorage.removeItem(claveBorrador(borrador));
      } catch {}
      setReintentar(false);
    } else if (!navigator.onLine) setReintentar(true);
  }

  // Volvió la conexión con una comanda que no salió: se manda sola (los ids evitan duplicados).
  useEffect(() => {
    if (enLinea && reintentar && !enviando) enviar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enLinea, reintentar]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return platos.filter((p) => (q ? p.nombre.toLowerCase().includes(q) : !categoria || p.categoria_id === categoria));
  }, [platos, busqueda, categoria]);

  function sumar(plato: Plato, opciones: OpcionElegida[] = []) {
    const misma = (a: OpcionElegida[]) => textoOpciones(a) === textoOpciones(opciones);
    setLineas((ls) => {
      const i = ls.findIndex(
        (l) => l.plato.id === plato.id && !l.nota && l.comensal === null && !l.despues && misma(l.opciones),
      );
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, cantidad: Math.min(99, l.cantidad + 1) } : l));
      return [
        ...ls,
        { clave: `${plato.id}-${Date.now()}`, id: nuevoId(), plato, cantidad: 1, nota: "", comensal: null, opciones, despues: false },
      ];
    });
  }

  const cambiar = (clave: string, cambios: Partial<LineaNueva>) =>
    setLineas((ls) => ls.map((l) => (l.clave === clave ? { ...l, ...cambios } : l)).filter((l) => l.cantidad > 0));

  const total = lineas.reduce((t, l) => t + l.cantidad * (Number(l.plato.precio) + extraOpciones(l.opciones)), 0);
  const despues = lineas.filter((l) => l.despues).length;
  const unidades = lineas.reduce((t, l) => t + l.cantidad, 0);

  return (
    <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[1fr_320px]">
      <div className="flex min-h-0 flex-col gap-3">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar plato…"
          className="campo"
          autoFocus
        />
        {!busqueda && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setCategoria(null)}
              className={`shrink-0 rounded-full px-3 py-1 text-sm ${!categoria ? "bg-tinta text-white" : "bg-stone-100"}`}
            >
              Todo
            </button>
            {categorias.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoria(c.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-sm ${categoria === c.id ? "bg-tinta text-white" : "bg-stone-100"}`}
              >
                {c.nombre}
              </button>
            ))}
          </div>
        )}
        <ul className="grid max-h-[50vh] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 md:max-h-[60vh]">
          {filtrados.map((p) => {
            const n = lineas.filter((l) => l.plato.id === p.id).reduce((t, l) => t + l.cantidad, 0);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={!p.disponible || p.agotado}
                  onClick={() => (gruposDe(p).length ? setEligiendo(p) : sumar(p))}
                  className={`flex w-full items-center gap-2 rounded-xl border p-2.5 text-left transition ${
                    n ? "border-marca bg-marca/5" : "border-borde bg-superficie hover:border-stone-300"
                  } disabled:opacity-50`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.nombre}</span>
                    <span className="text-xs text-suave">
                      {p.disponible && !p.agotado ? formato(Number(p.precio)) : "Agotado"}
                      {gruposDe(p).length > 0 && p.disponible && !p.agotado ? " · con opciones" : ""}
                    </span>
                  </span>
                  {n > 0 && <span className="rounded-full bg-marca px-2 py-0.5 text-xs font-bold text-white">{n}</span>}
                </button>
              </li>
            );
          })}
          {filtrados.length === 0 && <li className="p-4 text-sm text-suave">No hay platos que coincidan.</li>}
        </ul>
      </div>

      <div className="flex min-h-0 flex-col rounded-2xl border border-borde bg-stone-50 p-3">
        <p className="mb-2 font-semibold">Comanda {unidades > 0 && <span className="text-suave">({unidades})</span>}</p>
        {lineas.length === 0 ? (
          <p className="flex-1 text-sm text-suave">Toca los platos para sumarlos.</p>
        ) : (
          <ul className="flex-1 space-y-2 overflow-y-auto md:max-h-[48vh]">
            {lineas.map((l) => (
              <li key={l.clave} className="rounded-xl bg-superficie p-2.5 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{l.plato.nombre}</span>
                    {l.opciones.length > 0 && (
                      <span className="block truncate text-xs text-suave">{textoOpciones(l.opciones)}</span>
                    )}
                  </span>
                  <span className="flex items-center rounded-lg border border-borde">
                    <button
                      type="button"
                      className="h-7 w-7"
                      onClick={() => cambiar(l.clave, { cantidad: l.cantidad - 1 })}
                      aria-label="Menos"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums">{l.cantidad}</span>
                    <button
                      type="button"
                      className="h-7 w-7"
                      onClick={() => cambiar(l.clave, { cantidad: Math.min(99, l.cantidad + 1) })}
                      aria-label="Más"
                    >
                      +
                    </button>
                  </span>
                </div>
                <div className="mt-1.5 flex gap-1.5">
                  <input
                    value={l.nota}
                    onChange={(e) => cambiar(l.clave, { nota: e.target.value.slice(0, 120) })}
                    placeholder="Nota (sin sal, a punto…)"
                    className="min-w-0 flex-1 rounded-lg border border-borde px-2 py-1 text-xs"
                  />
                  <select
                    value={l.comensal ?? ""}
                    onChange={(e) => cambiar(l.clave, { comensal: e.target.value ? Number(e.target.value) : null })}
                    className="rounded-lg border border-borde px-1 py-1 text-xs"
                    aria-label="Comensal"
                  >
                    <option value="">Compartido</option>
                    {Array.from({ length: comensales }, (_, i) => (
                      <option key={i} value={i + 1}>
                        Comensal {i + 1}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    aria-pressed={l.despues}
                    onClick={() => cambiar(l.clave, { despues: !l.despues })}
                    title="Dejar para después: no va a cocina hasta que lo marches"
                    className={`rounded-lg border px-1.5 py-1 text-xs font-medium ${
                      l.despues ? "border-violet-400 bg-violet-100 text-violet-800" : "border-borde text-suave"
                    }`}
                  >
                    {l.despues ? "⏸ Después" : "Después"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 space-y-2 border-t border-borde pt-3">
          {!enLinea && (
            <p className="rounded-lg bg-amber-100 px-2.5 py-1.5 text-xs font-medium text-amber-900">
              Sin conexión. La comanda queda guardada en este teléfono y se envía sola cuando vuelva internet.
            </p>
          )}
          {despues > 0 && (
            <p className="text-xs text-violet-800">
              {despues === 1 ? "1 plato queda" : `${despues} platos quedan`} en espera: lo mandas a cocina con “Marchar”.
            </p>
          )}
          <p className="flex justify-between font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formato(total)}</span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="boton-secundario"
              onClick={() => {
                if (lineas.length && !confirm("¿Descartar esta comanda sin enviarla?")) return;
                setLineas([]);
                onCancelar();
              }}
            >
              Cancelar
            </button>
            <button type="button" className="boton flex-1" disabled={lineas.length === 0 || enviando} onClick={enviar}>
              {enviando ? "Enviando…" : reintentar ? "Esperando conexión…" : "Enviar a cocina"}
            </button>
          </div>
        </div>
      </div>
      {eligiendo && (
        <ElegirOpciones
          nombre={eligiendo.nombre}
          precio={Number(eligiendo.precio)}
          grupos={gruposDe(eligiendo)}
          formato={formato}
          onCerrar={() => setEligiendo(null)}
          onElegir={(o) => {
            sumar(eligiendo, o);
            setEligiendo(null);
          }}
        />
      )}
    </div>
  );
}
