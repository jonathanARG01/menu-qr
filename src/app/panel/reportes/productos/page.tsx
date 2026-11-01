import Link from "next/link";
import { requerirSeccion } from "@/lib/panel";
import { NOMBRE_TIPO, regionDe, type TipoCuenta } from "@/lib/salon";
import { formatoNumero } from "@/lib/region";
import { formatoPrecio } from "@/lib/utils";
import { NavReportes } from "../NavReportes";

export const dynamic = "force-dynamic";

type FilaRanking = { plato_id: string | null; nombre: string; tipo: TipoCuenta; unidades: number; monto: number };
type Ranking = { platos: FilaRanking[]; horas: { hora: number; unidades: number; monto: number }[] };
type Producto = {
  clave: string;
  nombre: string;
  categoria: string;
  unidades: number;
  monto: number;
  antes: { unidades: number; monto: number };
};

const RANGOS = [7, 30, 90];
const CANALES: (TipoCuenta | "todos")[] = ["todos", "mesa", "llevar", "delivery"];

// Ranking de productos: lo más vendido (por unidades y por monto), por canal y categoría, comparado con el período
// anterior, las horas de más venta y los platos que casi no salen.
export default async function RankingProductos({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string; canal?: string; orden?: string }>;
}) {
  const { supabase, restaurante, ajustes } = await requerirSeccion("reportes");
  const region = regionDe(ajustes);
  const q = await searchParams;
  const dias = RANGOS.includes(Number(q.dias)) ? Number(q.dias) : 30;
  const canal = (CANALES as string[]).includes(q.canal ?? "") ? (q.canal as TipoCuenta | "todos") : "todos";
  const orden = q.orden === "unidades" ? "unidades" : "monto";
  const hasta = new Date(Date.now() + 60000);
  const desde = new Date(hasta.getTime() - dias * 86400000);
  const antes = new Date(desde.getTime() - dias * 86400000);

  const [actual, previo, { data: platos }, { data: categorias }] = await Promise.all([
    supabase.rpc("ranking_productos", {
      p_restaurante: restaurante.id,
      p_desde: desde.toISOString(),
      p_hasta: hasta.toISOString(),
    }),
    supabase.rpc("ranking_productos", {
      p_restaurante: restaurante.id,
      p_desde: antes.toISOString(),
      p_hasta: desde.toISOString(),
    }),
    supabase.from("platos").select("id, nombre, categoria_id, disponible").eq("restaurante_id", restaurante.id),
    supabase.from("categorias").select("id, nombre, visible").eq("restaurante_id", restaurante.id).order("orden"),
  ]);

  const enlace = (cambios: Record<string, string | number>) => {
    const p = new URLSearchParams({
      dias: String(dias),
      canal,
      orden,
      ...Object.fromEntries(Object.entries(cambios).map(([k, v]) => [k, String(v)])),
    });
    return `/panel/reportes/productos?${p}`;
  };

  if (actual.error) {
    const falta = /ranking_productos/.test(actual.error.message);
    return (
      <div className="space-y-5">
        <NavReportes actual="/panel/reportes/productos" />
        <div className="tarjeta mx-auto max-w-lg p-6">
          <h1 className="font-semibold">{falta ? "Falta un paso en la base de datos" : "No se pudo cargar"}</h1>
          <p className="mt-2 text-sm text-suave">
            {falta ? (
              <>
                Para ver el ranking ejecuta el SQL <code>0023_pin_descuentos_caja.sql</code> en Supabase.
              </>
            ) : (
              actual.error.message
            )}
          </p>
        </div>
      </div>
    );
  }

  const listaPlatos = (platos ?? []) as { id: string; nombre: string; categoria_id: string; disponible: boolean }[];
  const listaCategorias = (categorias ?? []) as { id: string; nombre: string; visible: boolean }[];
  const categoriaDe = (id: string | null) =>
    listaCategorias.find((c) => c.id === listaPlatos.find((p) => p.id === id)?.categoria_id)?.nombre ?? "Fuera de carta";

  const r = actual.data as Ranking;
  const r0 = (previo.data as Ranking | null) ?? { platos: [], horas: [] };
  const filtrar = (f: FilaRanking) => canal === "todos" || f.tipo === canal;
  const clave = (f: FilaRanking) => f.plato_id ?? `n:${f.nombre}`;

  const productos = new Map<string, Producto>();
  for (const f of r.platos.filter(filtrar)) {
    const k = clave(f);
    const p = productos.get(k) ?? {
      clave: k,
      nombre: listaPlatos.find((x) => x.id === f.plato_id)?.nombre ?? f.nombre,
      categoria: categoriaDe(f.plato_id),
      unidades: 0,
      monto: 0,
      antes: { unidades: 0, monto: 0 },
    };
    p.unidades += f.unidades;
    p.monto += Number(f.monto);
    productos.set(k, p);
  }
  for (const f of r0.platos.filter(filtrar)) {
    const p = productos.get(clave(f));
    if (p) {
      p.antes.unidades += f.unidades;
      p.antes.monto += Number(f.monto);
    }
  }
  const lista = [...productos.values()].sort((a, b) => b[orden] - a[orden]);
  const total = lista.reduce((s, p) => s + p.monto, 0);
  const unidades = lista.reduce((s, p) => s + p.unidades, 0);
  const totalAntes = r0.platos.filter(filtrar).reduce((s, f) => s + Number(f.monto), 0);
  const maximo = Math.max(1, ...lista.map((p) => p[orden]));

  // Por categoría.
  const porCategoria = new Map<string, { unidades: number; monto: number }>();
  for (const p of lista) {
    const c = porCategoria.get(p.categoria) ?? { unidades: 0, monto: 0 };
    porCategoria.set(p.categoria, { unidades: c.unidades + p.unidades, monto: c.monto + p.monto });
  }

  // Platos disponibles de la carta que no se vendieron o casi (menos de 3 unidades).
  const vendidos = new Map(lista.map((p) => [p.clave, p.unidades]));
  const quietos = listaPlatos
    .filter((p) => p.disponible && listaCategorias.find((c) => c.id === p.categoria_id)?.visible !== false)
    .map((p) => ({ ...p, unidades: vendidos.get(p.id) ?? 0 }))
    .filter((p) => p.unidades < 3)
    .sort((a, b) => a.unidades - b.unidades)
    .slice(0, 15);

  const horas = r.horas;
  const maxHora = Math.max(1, ...horas.map((h) => Number(h.monto)));
  const formato = (n: number) => formatoPrecio(n, restaurante.moneda);
  const variacion = (ahora: number, antes: number) => (antes > 0 ? Math.round(((ahora - antes) / antes) * 100) : null);

  return (
    <div className="space-y-5">
      <NavReportes actual="/panel/reportes/productos" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Ranking de productos</h1>
          <p className="text-sm text-suave">Lo vendido en mesas y pedidos cerrados. Compara con los {dias} días anteriores.</p>
        </div>
        <nav className="flex rounded-xl bg-stone-100 p-1 text-sm" aria-label="Período">
          {RANGOS.map((d) => (
            <Link
              key={d}
              href={enlace({ dias: d })}
              aria-current={d === dias ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 font-medium ${d === dias ? "bg-superficie shadow-sm" : "text-suave hover:text-tinta"}`}
            >
              {d} días
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {CANALES.map((c) => (
          <Link
            key={c}
            href={enlace({ canal: c })}
            className={`rounded-full px-3 py-1 ${c === canal ? "bg-tinta text-white" : "bg-stone-100 text-suave hover:text-tinta"}`}
          >
            {c === "todos" ? "Todos los canales" : c === "mesa" ? "Salón" : NOMBRE_TIPO[c]}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Dato
          titulo="Vendido"
          valor={formato(total)}
          nota={
            variacion(total, totalAntes) === null ? undefined : `${signo(variacion(total, totalAntes)!)} vs. período anterior`
          }
        />
        <Dato titulo="Unidades" valor={formatoNumero(unidades, region)} />
        <Dato titulo="Productos distintos" valor={String(lista.length)} />
      </div>

      {lista.length === 0 ? (
        <p className="tarjeta p-10 text-center text-sm text-suave">Todavía no hay ventas cerradas en este período.</p>
      ) : (
        <section className="tarjeta p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Más vendidos</h2>
            <div className="flex rounded-lg bg-stone-100 p-0.5 text-xs">
              {(["monto", "unidades"] as const).map((o) => (
                <Link
                  key={o}
                  href={enlace({ orden: o })}
                  className={`rounded-md px-2.5 py-1 font-medium ${o === orden ? "bg-superficie shadow-sm" : "text-suave"}`}
                >
                  Por {o === "monto" ? "monto" : "unidades"}
                </Link>
              ))}
            </div>
          </div>
          <ol className="divide-y divide-borde">
            {lista.slice(0, 50).map((p, i) => {
              const v = variacion(p[orden], p.antes[orden]);
              return (
                <li key={p.clave} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-6 text-right text-xs font-semibold text-suave tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium">{p.nombre}</span>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {orden === "monto" ? formato(p.monto) : `${p.unidades} u.`}
                      </span>
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-stone-100">
                      <span className="block h-full rounded-full bg-marca" style={{ width: `${(p[orden] / maximo) * 100}%` }} />
                    </span>
                    <span className="mt-0.5 flex justify-between gap-2 text-xs text-suave">
                      <span className="truncate">
                        {p.categoria} · {orden === "monto" ? `${p.unidades} u.` : formato(p.monto)} ·{" "}
                        {total ? Math.round((p.monto / total) * 100) : 0}% de la venta
                      </span>
                      {v !== null && <span className={v >= 0 ? "text-emerald-700" : "text-red-600"}>{signo(v)}</span>}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {porCategoria.size > 0 && (
          <section className="tarjeta p-5">
            <h2 className="mb-3 font-semibold">Por categoría</h2>
            <ul className="divide-y divide-borde text-sm">
              {[...porCategoria]
                .sort((a, b) => b[1].monto - a[1].monto)
                .map(([nombre, c]) => (
                  <li key={nombre} className="flex justify-between gap-3 py-2">
                    <span className="truncate">{nombre}</span>
                    <span className="shrink-0 tabular-nums">
                      <span className="text-xs text-suave">{c.unidades} u. · </span>
                      <strong>{formato(c.monto)}</strong>
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        )}

        {horas.length > 0 && (
          <section className="tarjeta p-5">
            <h2 className="mb-3 font-semibold">Horas de más venta</h2>
            <div className="flex h-36 items-end gap-1" role="img" aria-label="Venta por hora del cierre de la cuenta">
              {Array.from({ length: 24 }, (_, h) => {
                const fila = horas.find((x) => x.hora === h);
                const m = Number(fila?.monto ?? 0);
                return (
                  <div key={h} className="flex flex-1 flex-col items-center gap-1" title={`${h}:00 · ${formato(m)}`}>
                    <div className="w-full rounded-t bg-marca/80" style={{ height: `${(m / maxHora) * 112}px` }} />
                    <span className="text-[9px] text-suave">{h % 3 === 0 ? h : ""}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-suave">Según la hora en que se cerró cada cuenta.</p>
          </section>
        )}
      </div>

      {quietos.length > 0 && (
        <section className="tarjeta p-5">
          <h2 className="font-semibold">Casi no se venden</h2>
          <p className="mb-3 text-sm text-suave">
            Platos de la carta con menos de 3 unidades en {dias} días: revisa si conviene cambiarlos, moverlos o sacarlos.
          </p>
          <ul className="flex flex-wrap gap-2 text-sm">
            {quietos.map((p) => (
              <li key={p.id} className="rounded-full bg-stone-100 px-3 py-1">
                {p.nombre} <span className="text-xs text-suave">· {p.unidades} u.</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const signo = (v: number) => `${v > 0 ? "+" : ""}${v}%`;

function Dato({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <div className="tarjeta p-4">
      <p className="text-xs text-suave">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{valor}</p>
      {nota && <p className="mt-0.5 text-xs text-suave">{nota}</p>}
    </div>
  );
}
