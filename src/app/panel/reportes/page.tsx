import Link from "next/link";
import { requerirSeccion } from "@/lib/panel";
import { NOMBRE_TIPO, regionDe, type TipoCuenta } from "@/lib/salon";
import { formatoFecha, formatoNumero } from "@/lib/region";
import { formatoPrecio } from "@/lib/utils";
import { Icono } from "@/components/Icono";

export const dynamic = "force-dynamic";

type Fila = {
  persona: string | null;
  semana: string;
  mesas: number;
  llevar: number;
  comensales: number;
  ventas: number;
  propinas: number;
  minutos: number;
  comandas: number;
};
type Reporte = {
  filas: Fila[];
  canales: { tipo: TipoCuenta; cuentas: number; ventas: number }[];
  personas: { id: string; nombre: string; rol: string }[];
};
type Total = Omit<Fila, "semana" | "persona"> & { id: string; nombre: string; semanas: Map<string, number> };

const RANGOS = [7, 30, 90];

// Reportes por mesero: mesas atendidas, ventas, propinas y tiempos de cada persona del equipo, semana a semana.
export default async function Reportes({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const { supabase, restaurante, ajustes } = await requerirSeccion("reportes");
  const region = regionDe(ajustes);
  const pedido = Number((await searchParams).dias);
  const dias = RANGOS.includes(pedido) ? pedido : 30;
  const hasta = new Date(Date.now() + 60000);
  const desde = new Date(hasta.getTime() - dias * 86400000);
  const { data, error } = await supabase.rpc("reporte_equipo", {
    p_restaurante: restaurante.id,
    p_desde: desde.toISOString(),
    p_hasta: hasta.toISOString(),
  });

  if (error) {
    return (
      <div className="tarjeta mx-auto max-w-lg p-6">
        <h1 className="font-semibold">
          {/reporte_equipo/.test(error.message) ? "Falta un paso en la base de datos" : "No se pudo cargar"}
        </h1>
        <p className="mt-2 text-sm text-suave">
          {/reporte_equipo/.test(error.message) ? (
            <>
              Para ver los reportes por mesero ejecuta el SQL <code>0014_llevar_clientes_recordatorios.sql</code> en Supabase.
            </>
          ) : (
            error.message
          )}
        </p>
      </div>
    );
  }

  const r = data as Reporte;
  const formato = (n: number) => formatoPrecio(n, restaurante.moneda);
  const nombreDe = (id: string | null) =>
    id === null ? "Sin asignar" : (r.personas.find((p) => p.id === id)?.nombre ?? "Ya no está en el equipo");

  // Totales del período por persona, y sus ventas de cada semana.
  const porPersona = new Map<string, Total>();
  for (const f of r.filas) {
    const id = f.persona ?? "sin";
    const t =
      porPersona.get(id) ??
      ({
        id,
        nombre: nombreDe(f.persona),
        mesas: 0,
        llevar: 0,
        comensales: 0,
        ventas: 0,
        propinas: 0,
        minutos: 0,
        comandas: 0,
        semanas: new Map(),
      } as Total);
    t.mesas += f.mesas;
    t.llevar += f.llevar;
    t.comensales += f.comensales;
    t.ventas += Number(f.ventas);
    t.propinas += Number(f.propinas);
    t.minutos += Number(f.minutos);
    t.comandas += f.comandas;
    t.semanas.set(f.semana, (t.semanas.get(f.semana) ?? 0) + Number(f.ventas));
    porPersona.set(id, t);
  }
  const personas = [...porPersona.values()].sort((a, b) => b.ventas - a.ventas);
  const semanas = [...new Set(r.filas.map((f) => f.semana))].sort();
  const totalVentas = r.canales.reduce((s, c) => s + Number(c.ventas), 0);
  const maxVentas = Math.max(1, ...personas.map((p) => p.ventas));
  const semana = (d: string) => formatoFecha(`${d}T12:00:00Z`, { ...region, zona: "UTC" }, { day: "numeric", month: "short" });
  const minutos = (t: Total) => (t.mesas ? Math.round(t.minutos / t.mesas) : null);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Reportes por mesero</h1>
          <p className="text-sm text-suave">
            Mesas cerradas en el período: quién las atendió, cuánto vendió y cuánta propina dejó.
          </p>
        </div>
        <nav className="flex rounded-xl bg-stone-100 p-1 text-sm" aria-label="Período">
          {RANGOS.map((d) => (
            <Link
              key={d}
              href={`/panel/reportes?dias=${d}`}
              aria-current={d === dias ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 font-medium ${d === dias ? "bg-superficie shadow-sm" : "text-suave hover:text-tinta"}`}
            >
              {d} días
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Dato titulo="Ventas" valor={formato(totalVentas)} />
        {(["mesa", "llevar", "delivery"] as TipoCuenta[]).map((tipo) => {
          const c = r.canales.find((x) => x.tipo === tipo);
          return (
            <Dato
              key={tipo}
              titulo={tipo === "mesa" ? "En el salón" : NOMBRE_TIPO[tipo]}
              valor={formato(Number(c?.ventas ?? 0))}
              nota={`${formatoNumero(c?.cuentas ?? 0, region)} ${tipo === "mesa" ? "mesas" : "pedidos"}`}
            />
          );
        })}
      </div>

      {personas.length === 0 ? (
        <div className="tarjeta flex flex-col items-center gap-2 p-10 text-center text-sm text-suave">
          <Icono nombre="reportes" className="h-10 w-10 text-stone-300" />
          <p className="max-w-md">
            Todavía no hay mesas cerradas en este período. Cada mesa queda a cargo de quien la abre o toma el primer pedido (se
            puede cambiar en la ficha de la mesa, en “Atiende”).
          </p>
        </div>
      ) : (
        <>
          <section className="tarjeta overflow-x-auto p-5">
            <h2 className="mb-3 font-semibold">Por persona</h2>
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs text-suave">
                <tr>
                  <th className="pb-2 font-medium">Persona</th>
                  <th className="pb-2 text-right font-medium">Mesas</th>
                  <th className="pb-2 text-right font-medium">Comensales</th>
                  <th className="pb-2 text-right font-medium">Ventas</th>
                  <th className="pb-2 text-right font-medium">Por mesa</th>
                  <th className="pb-2 text-right font-medium">Propinas</th>
                  <th className="pb-2 text-right font-medium">Tiempo por mesa</th>
                  <th className="pb-2 text-right font-medium">Comandas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {personas.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5 pr-3">
                      <span className="font-medium">{p.nombre}</span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-stone-100">
                        <span
                          className="block h-full rounded-full bg-marca"
                          style={{ width: `${(p.ventas / maxVentas) * 100}%` }}
                        />
                      </span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {p.mesas}
                      {p.llevar > 0 && <span className="block text-xs text-suave">+{p.llevar} para llevar</span>}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{p.comensales}</td>
                    <td className="py-2.5 text-right font-semibold tabular-nums">{formato(p.ventas)}</td>
                    <td className="py-2.5 text-right tabular-nums">
                      {p.mesas + p.llevar ? formato(p.ventas / (p.mesas + p.llevar)) : "—"}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{formato(p.propinas)}</td>
                    <td className="py-2.5 text-right tabular-nums">{minutos(p) === null ? "—" : `${minutos(p)} min`}</td>
                    <td className="py-2.5 text-right tabular-nums">{p.comandas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-suave">
              Las ventas no incluyen propinas. “Tiempo por mesa” va de que se abre hasta que se cierra. “Comandas” son las que
              cargó esa persona (no las que pidió el cliente desde el QR).
            </p>
          </section>

          {semanas.length > 1 && (
            <section className="tarjeta overflow-x-auto p-5">
              <h2 className="mb-3 font-semibold">Ventas por semana</h2>
              <table className="w-full text-sm" style={{ minWidth: 160 + semanas.length * 96 }}>
                <thead className="text-left text-xs text-suave">
                  <tr>
                    <th className="pb-2 font-medium">Persona</th>
                    {semanas.map((s) => (
                      <th key={s} className="pb-2 text-right font-medium">
                        Semana del {semana(s)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-borde">
                  {personas.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 pr-3 font-medium">{p.nombre}</td>
                      {semanas.map((s) => (
                        <td key={s} className="py-2 text-right tabular-nums">
                          {p.semanas.get(s) ? formato(p.semanas.get(s)!) : <span className="text-suave">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Dato({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <div className="tarjeta p-4">
      <p className="text-xs text-suave">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{valor}</p>
      {nota && <p className="mt-0.5 text-xs text-suave">{nota}</p>}
    </div>
  );
}
