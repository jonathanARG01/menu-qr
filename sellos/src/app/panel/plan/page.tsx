import { cargarPanelDueno } from "@/lib/panel";
import { DIAS_PRUEBA, PLANES, enlaceWhatsapp } from "@/lib/marca";
import { diasPrueba, vigente } from "@/lib/tipos";
import { formatoPrecio, formatoFecha } from "@/lib/utils";

export const metadata = { title: "Plan · Sellito" };

export default async function PaginaPlan() {
  const { supabase, negocio } = await cargarPanelDueno();
  const { count } = await supabase.from("tarjetas").select("id", { count: "exact", head: true }).eq("negocio_id", negocio.id);
  const dias = diasPrueba(negocio);
  const estado =
    negocio.estado === "activo"
      ? `Plan ${PLANES[negocio.plan].nombre} activo.`
      : negocio.estado === "pausado"
        ? "Cuenta pausada."
        : vigente(negocio)
          ? `Prueba gratis hasta el ${formatoFecha(`${negocio.prueba_hasta}T12:00:00`, { day: "numeric", month: "long" })} (${dias <= 0 ? "último día" : `${dias} días`}).`
          : "Tu prueba gratis terminó.";

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Tu plan</h1>
        <p className="text-sm text-suave">
          {estado} Llevas {count ?? 0} clientes con tarjeta.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(Object.keys(PLANES) as (keyof typeof PLANES)[]).map((id) => {
          const p = PLANES[id];
          const actual = negocio.estado === "activo" && negocio.plan === id;
          return (
            <div key={id} className={`tarjeta flex flex-col p-5 ${actual ? "ring-2 ring-marca" : ""}`}>
              <p className="font-semibold">{p.nombre}</p>
              <p className="mt-1 text-3xl font-bold">
                {formatoPrecio(p.precio, "CLP")}
                <span className="text-sm font-normal text-suave"> + IVA / mes</span>
              </p>
              <p className="mt-1 text-sm text-suave">{p.detalle}</p>
              <ul className="mt-3 space-y-1 text-sm">
                <li>✓ 12 diseños de tarjeta</li>
                <li>✓ Sello con QR o escaneando la tarjeta</li>
                <li>✓ Cumpleaños, sello doble y “te extrañamos”</li>
                <li>✓ Equipo sin límite</li>
              </ul>
              <a
                href={enlaceWhatsapp(`Hola, quiero contratar el plan ${p.nombre} de Sellito para ${negocio.nombre} (${negocio.slug}).`)}
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
      <p className="text-xs text-suave">
        Todos los negocios parten con {DIAS_PRUEBA} días gratis. Pagas por transferencia o con link de pago y te enviamos tu
        factura. Si dejas de pagar, tus clientes y sus sellos quedan guardados.
      </p>
    </div>
  );
}
