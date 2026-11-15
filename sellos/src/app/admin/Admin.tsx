"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { LOCAL_EXTRA, PLANES, nombrePlan, type Plan } from "@/lib/marca";
import { rubroDe } from "@/lib/rubros";
import { emojiSello } from "@/lib/tipos";
import { formatoFecha, formatoPrecio, mensajeError, numeroWhatsapp } from "@/lib/utils";

export type FilaAdmin = {
  id: string;
  slug: string;
  nombre: string;
  rubro: string;
  telefono: string | null;
  plan: Plan;
  estado: "prueba" | "activo" | "pausado";
  prueba_hasta: string;
  notas_admin: string | null;
  created_at: string;
  dueno_email: string | null;
  tarjetas: number;
  sellos_30d: number;
  ultima_actividad: string | null;
  max_locales: number;
  locales: number;
};

const hoy = () => new Date().toISOString().slice(0, 10);
const sumarDias = (fecha: string, d: number) => {
  const base = fecha > hoy() ? new Date(`${fecha}T12:00:00`) : new Date();
  base.setDate(base.getDate() + d);
  return base.toISOString().slice(0, 10);
};

export function Admin({ filas }: { filas: FilaAdmin[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const avisar = useToast();
  const [q, setQ] = useState("");

  const activos = filas.filter((f) => f.estado === "activo");
  const mensual = activos.reduce(
    (n, f) => n + (PLANES[f.plan]?.precio ?? 0) + (f.plan === "cadena" ? Math.max(0, f.max_locales - 5) * LOCAL_EXTRA : 0),
    0,
  );
  const enPrueba = filas.filter((f) => f.estado === "prueba" && f.prueba_hasta >= hoy());

  async function cambiar(
    f: FilaAdmin,
    c: { estado?: string; plan?: string; prueba_hasta?: string; notas?: string; max_locales?: number },
  ) {
    const { error } = await supabase.rpc("admin_negocio", {
      p_id: f.id,
      p_estado: c.estado ?? null,
      p_plan: c.plan ?? null,
      p_prueba_hasta: c.prueba_hasta ?? null,
      p_notas: c.notas ?? null,
      p_max_locales: c.max_locales ?? null,
    });
    if (error) return avisar(mensajeError(error), "error");
    avisar("Guardado");
    router.refresh();
  }

  const visibles = filas.filter((f) =>
    `${f.nombre} ${f.slug} ${f.dueno_email ?? ""} ${f.telefono ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Dato titulo="Negocios" valor={String(filas.length)} />
        <Dato titulo="En prueba" valor={String(enPrueba.length)} />
        <Dato titulo="Pagando" valor={String(activos.length)} />
        <Dato titulo="Ingreso mensual (+ IVA)" valor={formatoPrecio(mensual, "CLP")} />
      </div>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar negocio, correo o teléfono…"
        aria-label="Buscar"
        className="campo max-w-sm py-2 text-sm"
      />
      <ul className="space-y-3">
        {visibles.map((f) => {
          const vencida = f.estado === "prueba" && f.prueba_hasta < hoy();
          return (
            <li key={f.id} className="tarjeta space-y-3 p-4">
              <div className="flex flex-wrap items-start gap-3">
                <span className="text-2xl" aria-hidden>
                  {emojiSello(rubroDe(f.rubro).icono)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {f.nombre}{" "}
                    <a href={`/u/${f.slug}`} target="_blank" className="text-xs font-normal text-marca">
                      /u/{f.slug}
                    </a>
                  </p>
                  <p className="text-xs text-suave">
                    {rubroDe(f.rubro).nombre} · {f.dueno_email ?? "sin dueño"}
                    {f.telefono && (
                      <>
                        {" · "}
                        <a href={`https://wa.me/${numeroWhatsapp(f.telefono)}`} target="_blank" className="text-marca">
                          {f.telefono}
                        </a>
                      </>
                    )}{" "}
                    · alta {formatoFecha(f.created_at, { day: "numeric", month: "short", year: "2-digit" })}
                  </p>
                  <p className="text-xs text-suave">
                    {f.tarjetas} clientes · {f.sellos_30d} visitas en 30 días · {f.locales} de {f.max_locales} locales · última actividad{" "}
                    {f.ultima_actividad ? formatoFecha(f.ultima_actividad, { day: "numeric", month: "short" }) : "—"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    f.estado === "activo"
                      ? "bg-emerald-100 text-emerald-800"
                      : f.estado === "pausado" || vencida
                        ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-900"
                  }`}
                >
                  {f.estado === "activo"
                    ? `Pagando · ${nombrePlan(f.plan)}`
                    : f.estado === "pausado"
                      ? "Pausado"
                      : vencida
                        ? "Prueba vencida"
                        : `Prueba hasta ${formatoFecha(`${f.prueba_hasta}T12:00:00`, { day: "numeric", month: "short" })}`}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                {(Object.keys(PLANES) as Plan[]).map((id) => (
                  <button
                    key={id}
                    className={f.estado === "activo" && f.plan === id ? "boton py-1.5" : "boton-secundario py-1.5"}
                    onClick={() => cambiar(f, { estado: "activo", plan: id })}
                  >
                    Activar {PLANES[id].nombre}
                  </button>
                ))}
                <button
                  className="boton-secundario py-1.5"
                  onClick={() => cambiar(f, { estado: "prueba", prueba_hasta: sumarDias(f.prueba_hasta, 14) })}
                >
                  +14 días de prueba
                </button>
                <button
                  className="boton-secundario py-1.5"
                  onClick={() => {
                    const n = Number(prompt("Locales que permite (Cadena incluye 5; cada extra se cobra aparte)", String(f.max_locales)));
                    if (Number.isInteger(n) && n >= 1 && n <= 200) cambiar(f, { max_locales: n });
                  }}
                >
                  Locales: {f.max_locales}
                </button>
                {f.estado !== "pausado" && (
                  <button className="boton-secundario py-1.5 text-red-700" onClick={() => cambiar(f, { estado: "pausado" })}>
                    Pausar
                  </button>
                )}
                <button
                  className="text-suave hover:text-tinta"
                  onClick={() => {
                    const notas = prompt("Notas (solo tú las ves)", f.notas_admin ?? "");
                    if (notas !== null) cambiar(f, { notas });
                  }}
                >
                  {f.notas_admin ? `Notas: ${f.notas_admin.slice(0, 40)}` : "Agregar notas"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="tarjeta p-4">
      <p className="text-xs text-suave">{titulo}</p>
      <p className="text-2xl font-semibold tabular-nums">{valor}</p>
    </div>
  );
}
