"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Aviso } from "@/components/AuthShell";
import { CamposRestaurante } from "@/components/CamposRestaurante";
import { Interruptor } from "@/components/Interruptor";
import { useToast } from "@/components/Toast";
import { actualizarRestaurante, crearParaCliente, dejarRestaurante, editarRestaurante } from "./actions";

export type FilaAdmin = {
  id: string;
  slug: string;
  nombre: string;
  plan: string;
  activo: boolean;
  created_at: string;
  duenos: string | null;
  platos: number;
  sucursales: number;
  visitas_30d: number;
  pedidos_30d: number;
  soy_staff: boolean;
};

const PLANES = [
  { valor: "free", texto: "Prueba" },
  { valor: "carta", texto: "Carta" },
  { valor: "pro", texto: "Pro" },
  { valor: "grupo", texto: "Grupo" },
];

const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
const numero = (n: number) => Number(n).toLocaleString("es-AR");

export function ListaAdmin({ filas: iniciales }: { filas: FilaAdmin[] }) {
  const avisar = useToast();
  const [filas, setFilas] = useState(iniciales);
  const [busqueda, setBusqueda] = useState("");
  const [creando, setCreando] = useState(false);
  const [pendiente, empezar] = useTransition();

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return filas;
    return filas.filter((f) => [f.nombre, f.slug, f.duenos ?? ""].some((t) => t.toLowerCase().includes(q)));
  }, [filas, busqueda]);

  const resumen = useMemo(
    () => ({
      total: filas.length,
      activos: filas.filter((f) => f.activo).length,
      pagos: filas.filter((f) => f.activo && f.plan !== "free").length,
      visitas: filas.reduce((n, f) => n + Number(f.visitas_30d), 0),
      pedidos: filas.reduce((n, f) => n + Number(f.pedidos_30d), 0),
    }),
    [filas],
  );

  function cambiar(fila: FilaAdmin, cambios: { plan?: string; activo?: boolean }) {
    const antes = filas;
    setFilas((fs) => fs.map((f) => (f.id === fila.id ? { ...f, ...cambios } : f)));
    empezar(async () => {
      const error = await actualizarRestaurante(fila.id, fila.slug, cambios);
      if (error) {
        setFilas(antes);
        avisar(error, "error");
      } else {
        avisar(cambios.activo === false ? `${fila.nombre} pausado: su carta ya no se ve` : "Guardado");
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Dato titulo="Restaurantes" valor={resumen.total} />
        <Dato titulo="Activos" valor={resumen.activos} />
        <Dato titulo="Con plan pago" valor={resumen.pagos} />
        <Dato titulo="Visitas (30 días)" valor={resumen.visitas} />
        <Dato titulo="Pedidos (30 días)" valor={resumen.pedidos} />
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, dirección o correo"
          className="campo max-w-sm flex-1"
        />
        <button type="button" className="boton" onClick={() => setCreando(true)}>
          + Restaurante para un cliente
        </button>
      </div>

      {visibles.length === 0 ? (
        <p className="tarjeta p-6 text-center text-sm text-suave">No hay restaurantes que coincidan.</p>
      ) : (
        <ul className="space-y-3">
          {visibles.map((f) => (
            <li key={f.id} className={`tarjeta p-4 ${f.activo ? "" : "opacity-70"}`}>
              <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="font-semibold">
                    {f.nombre}
                    {!f.activo && <span className="ml-2 rounded bg-stone-200 px-1.5 py-0.5 text-xs font-normal">Pausado</span>}
                  </p>
                  <a href={`/${f.slug}`} target="_blank" className="text-sm text-marca hover:underline">
                    /{f.slug} ↗
                  </a>
                  <p className="mt-1 truncate text-xs text-suave">
                    {f.duenos ?? "Sin dueño"} · alta {fecha(f.created_at)}
                  </p>
                </div>
                <dl className="grid grid-cols-4 gap-4 text-center text-xs text-suave">
                  <Cifra titulo="Platos" valor={f.platos} />
                  <Cifra titulo="Sucursales" valor={f.sucursales} />
                  <Cifra titulo="Visitas 30d" valor={f.visitas_30d} />
                  <Cifra titulo="Pedidos 30d" valor={f.pedidos_30d} />
                </dl>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-borde pt-3 text-sm">
                <label className="flex items-center gap-2">
                  Plan
                  <select
                    value={f.plan}
                    onChange={(e) => cambiar(f, { plan: e.target.value })}
                    disabled={pendiente}
                    className="campo w-auto py-1.5"
                  >
                    {PLANES.map((p) => (
                      <option key={p.valor} value={p.valor}>
                        {p.texto}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <Interruptor activo={f.activo} onChange={(activo) => cambiar(f, { activo })} etiqueta="Activo" />
                  {f.activo ? "Activo" : "Pausado"}
                </label>
                <div className="flex-1" />
                {f.soy_staff && (
                  <button
                    type="button"
                    className="text-suave hover:text-red-600"
                    onClick={() =>
                      empezar(async () => {
                        const error = await dejarRestaurante(f.id);
                        if (error) return avisar(error, "error");
                        setFilas((fs) => fs.map((x) => (x.id === f.id ? { ...x, soy_staff: false } : x)));
                      })
                    }
                  >
                    Dejar de editar
                  </button>
                )}
                <button
                  type="button"
                  className="boton-secundario py-1.5"
                  disabled={pendiente}
                  onClick={() =>
                    empezar(async () => {
                      const error = await editarRestaurante(f.id);
                      if (error) avisar(error, "error");
                    })
                  }
                >
                  Editar carta
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {creando && <CrearParaCliente onCerrar={() => setCreando(false)} />}
    </div>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <div className="tarjeta p-4">
      <p className="text-xs text-suave">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{numero(valor)}</p>
    </div>
  );
}

function Cifra({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <div>
      <dd className="text-base font-semibold tabular-nums text-tinta">{numero(valor)}</dd>
      <dt>{titulo}</dt>
    </div>
  );
}

function CrearParaCliente({ onCerrar }: { onCerrar: () => void }) {
  const [error, accion, pendiente] = useActionState(crearParaCliente, null);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onCerrar}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-crear"
        className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl"
      >
        <h2 id="titulo-crear" className="mb-4 text-lg font-semibold">
          Restaurante para un cliente
        </h2>
        <form action={accion} className="space-y-4">
          <p className="text-sm text-suave">
            Quedas como dueño para armarle la carta. Después lo editas desde tu panel eligiéndolo arriba.
          </p>
          <CamposRestaurante />
          {error && <Aviso>{error}</Aviso>}
          <div className="flex gap-3">
            <button type="button" onClick={onCerrar} className="boton-secundario flex-1">
              Cancelar
            </button>
            <button type="submit" className="boton flex-1" disabled={pendiente}>
              {pendiente ? "Creando…" : "Crear y editar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
