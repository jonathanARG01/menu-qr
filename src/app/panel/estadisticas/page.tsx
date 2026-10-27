import { nombreMesa, regionDe } from "@/lib/salon";
import { ZONAS, formatoFecha, formatoNumero, type Region } from "@/lib/region";
import Link from "next/link";
import { requerirSeccion } from "@/lib/panel";
import { NOMBRE_IDIOMA, type Idioma } from "@/lib/i18n";
import { formatoPrecio } from "@/lib/utils";
import { BarrasHorizontales, BarrasPorDia, BarrasPorHora } from "./Graficos";

export const dynamic = "force-dynamic";

type Resumen = {
  visitas: number;
  pedidos: number;
  monto_pedidos: number;
  por_dia: { dia: string; visitas: number; pedidos: number }[];
  por_hora: { hora: number; visitas: number }[];
  por_mesa: { mesa: string; visitas: number }[];
  por_idioma: { idioma: string; visitas: number }[];
  por_sucursal: { sucursal: string; visitas: number; pedidos: number }[];
  mas_pedidos: { nombre: string; cantidad: number }[];
};

const RANGOS = [7, 30, 90];

export default async function Estadisticas({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const { supabase, restaurante, ajustes } = await requerirSeccion("estadisticas");
  const region = regionDe(ajustes);
  const pedido = Number((await searchParams).dias);
  const dias = RANGOS.includes(pedido) ? pedido : 30;
  const desde = new Date(Date.now() - dias * 86400000).toISOString();
  const [{ data, error }, { data: opiniones }] = await Promise.all([
    supabase.rpc("estadisticas", { p_restaurante: restaurante.id, p_dias: dias, p_zona: region.zona }),
    // Sin la migración 0009 no hay tabla de opiniones: la sección no aparece.
    supabase
      .from("opiniones")
      .select("id, estrellas, comentario, mesa, created_at")
      .eq("restaurante_id", restaurante.id)
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  if (error) {
    return (
      <p className="tarjeta p-5 text-sm text-suave">
        {error.message.includes("estadisticas")
          ? "Para ver estadísticas falta ejecutar el SQL 0003_idiomas_pedidos_sucursales.sql en Supabase."
          : error.message}
      </p>
    );
  }

  const r = data as Resumen;
  const promedio = r.visitas / dias;
  const conversion = r.visitas ? (r.pedidos / r.visitas) * 100 : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Estadísticas</h1>
          <p className="text-sm text-suave">Cuántas personas abren tu carta y cuántos pedidos te llegan por WhatsApp.</p>
        </div>
        <nav className="flex rounded-xl bg-stone-100 p-1 text-sm" aria-label="Período">
          {RANGOS.map((d) => (
            <Link
              key={d}
              href={`/panel/estadisticas?dias=${d}`}
              aria-current={d === dias ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 font-medium ${d === dias ? "bg-superficie shadow-sm" : "text-suave hover:text-tinta"}`}
            >
              {d} días
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Dato titulo="Visitas a la carta" valor={formatoNumero(r.visitas, region)} />
        <Dato titulo="Promedio por día" valor={formatoNumero(promedio, region, { maximumFractionDigits: 1 })} />
        <Dato
          titulo="Pedidos por WhatsApp"
          valor={formatoNumero(r.pedidos, region)}
          nota={r.visitas ? `${conversion.toFixed(1)} % de las visitas` : undefined}
        />
        <Dato titulo="Monto pedido" valor={formatoPrecio(r.monto_pedidos, restaurante.moneda)} />
      </div>

      <section className="tarjeta p-5">
        <h2 className="font-semibold">Visitas por día</h2>
        <p className="mb-4 text-xs text-suave">Cada persona cuenta una vez por mesa en cada visita.</p>
        <BarrasPorDia datos={r.por_dia} />
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="tarjeta p-5">
          <h2 className="font-semibold">Horarios con más visitas</h2>
          <p className="mb-4 text-xs text-suave">Hora de {ZONAS.find(([z]) => z === region.zona)?.[1] ?? region.zona}.</p>
          <BarrasPorHora datos={r.por_hora} />
        </section>
        <section className="tarjeta p-5">
          <h2 className="mb-4 font-semibold">Lo más pedido por WhatsApp</h2>
          <BarrasHorizontales
            datos={r.mas_pedidos.map((p) => ({ etiqueta: p.nombre, valor: p.cantidad }))}
            unidad="unidades"
            vacio="Todavía no hay pedidos. Actívalos en Marca → Pedidos por WhatsApp."
          />
        </section>
        <section className="tarjeta p-5">
          <h2 className="mb-4 font-semibold">Mesas con más visitas</h2>
          <BarrasHorizontales
            datos={r.por_mesa.map((m) => ({ etiqueta: nombreMesa(m.mesa), valor: m.visitas }))}
            unidad="visitas"
            vacio="Aparece cuando los clientes escanean el QR de una mesa."
          />
        </section>
        <section className="tarjeta p-5">
          <h2 className="mb-4 font-semibold">Idioma de los clientes</h2>
          <BarrasHorizontales
            datos={r.por_idioma.map((i) => ({
              etiqueta: NOMBRE_IDIOMA[i.idioma as Idioma] ?? i.idioma.toUpperCase(),
              valor: i.visitas,
            }))}
            unidad="visitas"
            vacio="Sin visitas en este período."
          />
        </section>
        {opiniones && opiniones.length > 0 && <Opiniones lista={opiniones as Opinion[]} region={region} />}
        {r.por_sucursal.length > 1 && (
          <section className="tarjeta p-5 md:col-span-2">
            <h2 className="mb-4 font-semibold">Por sucursal</h2>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-suave">
                <tr>
                  <th className="pb-2 font-medium">Sucursal</th>
                  <th className="pb-2 text-right font-medium">Visitas</th>
                  <th className="pb-2 text-right font-medium">Pedidos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {r.por_sucursal.map((s) => (
                  <tr key={s.sucursal}>
                    <td className="py-2">{s.sucursal}</td>
                    <td className="py-2 text-right tabular-nums">{formatoNumero(s.visitas, region)}</td>
                    <td className="py-2 text-right tabular-nums">{formatoNumero(s.pedidos, region)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </div>
  );
}

type Opinion = { id: string; estrellas: number; comentario: string | null; mesa: string | null; created_at: string };

// Lo que dejaron los clientes al cerrar la mesa. Los comentarios con pocas estrellas solo los ves tú.
function Opiniones({ lista, region }: { lista: Opinion[]; region: Region }) {
  const promedio = lista.reduce((s, o) => s + o.estrellas, 0) / lista.length;
  const conteo = [5, 4, 3, 2, 1].map((n) => ({ n, cantidad: lista.filter((o) => o.estrellas === n).length }));
  const comentarios = lista.filter((o) => o.comentario).slice(0, 20);
  return (
    <section className="tarjeta p-5 md:col-span-2">
      <h2 className="font-semibold">Opiniones de los clientes</h2>
      <div className="mt-3 flex flex-wrap items-center gap-6">
        <div>
          <p className="text-3xl font-bold tabular-nums">{formatoNumero(promedio, region, { maximumFractionDigits: 1 })}</p>
          <p className="text-amber-500" aria-label={`${promedio.toFixed(1)} estrellas`}>
            {"★".repeat(Math.round(promedio))}
            <span className="text-stone-300">{"★".repeat(5 - Math.round(promedio))}</span>
          </p>
          <p className="text-xs text-suave">{lista.length} opiniones</p>
        </div>
        <div className="min-w-48 flex-1 space-y-1 text-xs">
          {conteo.map(({ n, cantidad }) => (
            <div key={n} className="flex items-center gap-2">
              <span className="w-6 tabular-nums">{n}★</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                <span
                  className="block h-full rounded-full bg-amber-400"
                  style={{ width: `${(cantidad / lista.length) * 100}%` }}
                />
              </span>
              <span className="w-8 text-right tabular-nums text-suave">{cantidad}</span>
            </div>
          ))}
        </div>
      </div>
      {comentarios.length > 0 && (
        <ul className="mt-4 divide-y divide-borde text-sm">
          {comentarios.map((o) => (
            <li key={o.id} className="py-2">
              <span className="text-amber-500">{"★".repeat(o.estrellas)}</span>{" "}
              <span className="text-xs text-suave">
                {formatoFecha(o.created_at, region, { day: "numeric", month: "short" })}
                {o.mesa ? ` · ${nombreMesa(o.mesa)}` : ""}
              </span>
              <p>{o.comentario}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
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
