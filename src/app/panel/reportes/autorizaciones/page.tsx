import { requerirSeccion } from "@/lib/panel";
import { nombreVisible, regionDe } from "@/lib/salon";
import { formatoFecha } from "@/lib/region";
import { formatoPrecio } from "@/lib/utils";
import { NavReportes } from "../NavReportes";

export const dynamic = "force-dynamic";

type Fila = {
  id: string;
  accion: "anular_cuenta" | "quitar_item" | "descuento" | "quitar_descuento";
  detalle: string | null;
  motivo: string | null;
  monto: number;
  pedido_por: string | null;
  autorizado_por: string | null;
  created_at: string;
};

const NOMBRE_ACCION: Record<Fila["accion"], string> = {
  anular_cuenta: "Anuló",
  quitar_item: "Quitó de cocina",
  descuento: "Descuento",
  quitar_descuento: "Quitó descuento",
};
const COLOR: Record<Fila["accion"], string> = {
  anular_cuenta: "bg-red-100 text-red-800",
  quitar_item: "bg-amber-100 text-amber-800",
  descuento: "bg-sky-100 text-sky-800",
  quitar_descuento: "bg-stone-100 text-stone-600",
};

// Registro de anulaciones, platos quitados de cocina y descuentos: quién lo pidió y quién autorizó.
export default async function Autorizaciones() {
  const { supabase, restaurante, ajustes } = await requerirSeccion("reportes");
  const region = regionDe(ajustes);
  const [{ data, error }, { data: equipo }] = await Promise.all([
    supabase
      .from("autorizaciones")
      .select("*")
      .eq("restaurante_id", restaurante.id)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.rpc("equipo", { p_restaurante: restaurante.id }),
  ]);
  const personas = new Map(
    ((equipo ?? []) as { user_id: string | null; email: string; nombre?: string | null }[])
      .filter((p) => p.user_id)
      .map((p) => [p.user_id!, p.nombre || nombreVisible(p.email.split("@")[0])]),
  );
  const quien = (id: string | null) => (id ? (personas.get(id) ?? "Ya no está en el equipo") : "—");
  const lista = (data ?? []) as Fila[];
  const formato = (n: number) => formatoPrecio(n, restaurante.moneda);
  const hace30 = Date.now() - 30 * 86400000;
  const recientes = lista.filter((f) => Date.parse(f.created_at) > hace30);
  const suma = (a: Fila["accion"]) => recientes.filter((f) => f.accion === a).reduce((s, f) => s + Number(f.monto), 0);

  return (
    <div className="space-y-5">
      <NavReportes actual="/panel/reportes/autorizaciones" />
      <div>
        <h1 className="text-lg font-semibold">Autorizaciones</h1>
        <p className="text-sm text-suave">
          Anulaciones, platos quitados cuando ya estaban en cocina y descuentos: quién lo pidió, quién lo autorizó y por qué.
        </p>
      </div>

      {error ? (
        <div className="tarjeta mx-auto max-w-lg p-6">
          <h2 className="font-semibold">Falta un paso en la base de datos</h2>
          <p className="mt-2 text-sm text-suave">
            Ejecuta el SQL <code>0023_pin_descuentos_caja.sql</code> en Supabase.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Dato titulo="Anulado (30 días)" valor={formato(suma("anular_cuenta"))} />
            <Dato titulo="Quitado de cocina (30 días)" valor={formato(suma("quitar_item"))} />
            <Dato titulo="Descuentos (30 días)" valor={formato(suma("descuento"))} />
          </div>
          {lista.length === 0 ? (
            <p className="tarjeta p-10 text-center text-sm text-suave">Todavía no hay nada registrado.</p>
          ) : (
            <ul className="tarjeta divide-y divide-borde">
              {lista.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${COLOR[f.accion]}`}>
                    {NOMBRE_ACCION[f.accion]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {f.detalle}
                      {f.motivo ? <span className="font-normal text-suave"> · “{f.motivo}”</span> : null}
                    </span>
                    <span className="block text-xs text-suave">
                      {formatoFecha(f.created_at, region, {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · pidió {quien(f.pedido_por)}
                      {f.autorizado_por && f.autorizado_por !== f.pedido_por ? ` · autorizó ${quien(f.autorizado_por)}` : ""}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">{formato(Number(f.monto))}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="tarjeta p-4">
      <p className="text-xs text-suave">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{valor}</p>
    </div>
  );
}
