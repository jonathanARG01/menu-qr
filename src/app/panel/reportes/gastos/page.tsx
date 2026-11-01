import Link from "next/link";
import { requerirSeccion } from "@/lib/panel";
import { regionDe } from "@/lib/salon";
import { formatoFecha } from "@/lib/region";
import { formatoPrecio } from "@/lib/utils";
import { NavReportes } from "../NavReportes";
import { ExportarGastos } from "./ExportarGastos";

export const dynamic = "force-dynamic";

type Gasto = {
  id: string;
  monto: number;
  detalle: string;
  medio: string;
  categoria?: string;
  proveedor?: string | null;
  tipo?: "gasto" | "retiro";
  created_at: string;
};

// Medianoche del día 1 del mes en la zona del local, como instante UTC.
function inicioMes(anio: number, mes: number, zona: string) {
  const utc = Date.UTC(anio, mes - 1, 1);
  const enZona = Date.parse(new Date(utc).toLocaleString("en-US", { timeZone: zona }));
  const enUtc = Date.parse(new Date(utc).toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(utc - (enZona - enUtc));
}

// Gastos del mes por categoría, con detalle y exportación para el contador.
export default async function ReporteGastos({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { supabase, restaurante, ajustes } = await requerirSeccion("reportes");
  const region = regionDe(ajustes);
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: ajustes.zona_horaria }).slice(0, 7);
  const pedido = (await searchParams).mes;
  const mes = pedido && /^\d{4}-\d{2}$/.test(pedido) ? pedido : hoy;
  const [anio, m] = mes.split("-").map(Number);
  const desde = inicioMes(anio, m, ajustes.zona_horaria);
  const hasta = inicioMes(m === 12 ? anio + 1 : anio, m === 12 ? 1 : m + 1, ajustes.zona_horaria);
  const mesAnterior = `${m === 1 ? anio - 1 : anio}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}`;
  const mesSiguiente = `${m === 12 ? anio + 1 : anio}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("gastos")
    .select("*")
    .eq("restaurante_id", restaurante.id)
    .gte("created_at", desde.toISOString())
    .lt("created_at", hasta.toISOString())
    .order("created_at");
  const lista = (data ?? []) as Gasto[];
  const gastos = lista.filter((g) => (g.tipo ?? "gasto") === "gasto");
  const retiros = lista.filter((g) => g.tipo === "retiro");
  const formato = (n: number) => formatoPrecio(n, restaurante.moneda);
  const total = gastos.reduce((s, g) => s + Number(g.monto), 0);
  const porCategoria = new Map<string, number>();
  for (const g of gastos)
    porCategoria.set(g.categoria ?? "Otros", (porCategoria.get(g.categoria ?? "Otros") ?? 0) + Number(g.monto));
  const categorias = [...porCategoria].sort((a, b) => b[1] - a[1]);
  const maximo = Math.max(1, ...categorias.map((c) => c[1]));
  const nombreMes = formatoFecha(`${mes}-15T12:00:00Z`, { ...region, zona: "UTC" }, { month: "long", year: "numeric" });
  const fecha = (iso: string) =>
    formatoFecha(iso, region, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-5">
      <NavReportes actual="/panel/reportes/gastos" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Gastos del mes</h1>
          <p className="text-sm text-suave">Lo anotado en Caja, por categoría. Expórtalo para tu contador.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/panel/reportes/gastos?mes=${mesAnterior}`}
            className="boton-secundario px-3 py-1.5"
            aria-label="Mes anterior"
          >
            ←
          </Link>
          <span className="min-w-32 text-center font-medium capitalize">{nombreMes}</span>
          <Link
            href={`/panel/reportes/gastos?mes=${mesSiguiente}`}
            className="boton-secundario px-3 py-1.5"
            aria-label="Mes siguiente"
          >
            →
          </Link>
          <ExportarGastos
            nombre={`gastos-${restaurante.slug}-${mes}.csv`}
            filas={lista.map((g) => ({
              fecha: fecha(g.created_at),
              tipo: g.tipo === "retiro" ? "Retiro a caja fuerte" : "Gasto",
              categoria: g.categoria ?? "Otros",
              detalle: g.detalle,
              proveedor: g.proveedor ?? "",
              medio: g.medio,
              monto: Number(g.monto),
            }))}
          />
        </div>
      </div>

      {error ? (
        <p className="tarjeta p-5 text-sm text-suave">{error.message}</p>
      ) : lista.length === 0 ? (
        <p className="tarjeta p-10 text-center text-sm text-suave">No hay gastos anotados en {nombreMes}.</p>
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <section className="tarjeta p-5">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-semibold">Por categoría</h2>
                <span className="text-lg font-bold tabular-nums">{formato(total)}</span>
              </div>
              <ul className="space-y-2.5 text-sm">
                {categorias.map(([c, monto]) => (
                  <li key={c}>
                    <span className="flex justify-between gap-3">
                      <span>{c}</span>
                      <span className="tabular-nums">
                        <span className="text-xs text-suave">{total ? Math.round((monto / total) * 100) : 0}% · </span>
                        <strong>{formato(monto)}</strong>
                      </span>
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-stone-100">
                      <span className="block h-full rounded-full bg-marca" style={{ width: `${(monto / maximo) * 100}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
              {retiros.length > 0 && (
                <p className="mt-4 text-xs text-suave">
                  Además hubo {retiros.length} {retiros.length === 1 ? "retiro" : "retiros"} a la caja fuerte por{" "}
                  {formato(retiros.reduce((s, g) => s + Number(g.monto), 0))} (no son gastos).
                </p>
              )}
            </section>

            <section className="tarjeta p-5">
              <h2 className="mb-3 font-semibold">Detalle</h2>
              <ul className="divide-y divide-borde text-sm">
                {lista.map((g) => (
                  <li key={g.id} className="flex items-center gap-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {g.detalle}
                        {g.tipo === "retiro" && <span className="ml-1 text-xs text-suave">(retiro)</span>}
                      </span>
                      <span className="block truncate text-xs text-suave">
                        {fecha(g.created_at)} · {g.categoria ?? "Otros"}
                        {g.proveedor ? ` · ${g.proveedor}` : ""} · {g.medio}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums">{formato(Number(g.monto))}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
