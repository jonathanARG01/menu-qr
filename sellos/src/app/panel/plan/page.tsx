import { cargarPanelDueno } from "@/lib/panel";
import { DESCUENTOS, DIAS_PRUEBA, EN_TODOS, LOCAL_EXTRA, MARCA, PLANES, enlaceWhatsapp, nombrePlan, type Plan } from "@/lib/marca";
import { diasPrueba, vigente } from "@/lib/tipos";
import { formatoPrecio, formatoFecha } from "@/lib/utils";

export const metadata = { title: "Plan" };

export default async function PaginaPlan() {
  const { supabase, negocio, sucursales } = await cargarPanelDueno();
  const { count } = await supabase.from("tarjetas").select("id", { count: "exact", head: true }).eq("negocio_id", negocio.id);
  const dias = diasPrueba(negocio);
  const estado =
    negocio.estado === "activo"
      ? `Plan ${nombrePlan(negocio.plan)} activo.`
      : negocio.estado === "pausado"
        ? "Cuenta pausada."
        : vigente(negocio)
          ? `Prueba gratis hasta el ${formatoFecha(`${negocio.prueba_hasta}T12:00:00`, { day: "numeric", month: "long" })} (${dias <= 0 ? "último día" : `${dias} días`}). En la prueba puedes usar todo, también lo del plan Cadena.`
          : "Tu prueba gratis terminó.";

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Tu plan</h1>
        <p className="text-sm text-suave">
          {estado} Llevas {count ?? 0} clientes con tarjeta{sucursales.length ? ` y ${sucursales.length} locales` : ""}.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(PLANES) as Plan[]).map((id) => {
          const p = PLANES[id];
          const actual = negocio.estado === "activo" && negocio.plan === id;
          return (
            <div key={id} className={`tarjeta flex flex-col p-5 ${actual ? "ring-2 ring-marca" : id === "pro" ? "ring-1 ring-marca/40" : ""}`}>
              <div className="flex items-center justify-between">
                <p className="font-semibold">{p.nombre}</p>
                {id === "pro" && <span className="rounded-full bg-marca/10 px-2 py-0.5 text-xs font-semibold text-marca">El más elegido</span>}
              </div>
              <p className="mt-1 text-3xl font-bold">
                {formatoPrecio(p.precio, "CLP")}
                <span className="text-sm font-normal text-suave"> + IVA / mes</span>
              </p>
              <p className="mt-1 text-sm text-suave">{p.detalle}</p>
              <ul className="mt-3 flex-1 space-y-1 text-sm">
                {p.incluye.map((x) => (
                  <li key={x}>✓ {x}</li>
                ))}
              </ul>
              <a
                href={enlaceWhatsapp(`Hola, quiero contratar el plan ${p.nombre} de ${MARCA} para ${negocio.nombre} (${negocio.slug}).`)}
                target="_blank"
                rel="noopener noreferrer"
                className={`${actual ? "boton-secundario" : "boton"} mt-4`}
              >
                {actual ? "Tu plan actual" : `Contratar ${p.nombre}`}
              </a>
            </div>
          );
        })}
      </div>
      <div className="tarjeta p-5">
        <p className="font-semibold">Todos los planes incluyen</p>
        <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          {EN_TODOS.map((x) => (
            <li key={x}>✓ {x}</li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-suave">
        Todos los negocios parten con {DIAS_PRUEBA} días gratis, con todo incluido. Pagando por adelantado:{" "}
        {DESCUENTOS.map((d) => `${d.meses} meses −${d.descuento} %`).join(", ")}. En el plan Cadena cada local sobre 5 suma{" "}
        {formatoPrecio(LOCAL_EXTRA, "CLP")} + IVA al mes. Pagas por transferencia o con link de pago y te enviamos tu factura. Si
        dejas de pagar, tus clientes y lo que acumularon quedan guardados.
      </p>
    </div>
  );
}
