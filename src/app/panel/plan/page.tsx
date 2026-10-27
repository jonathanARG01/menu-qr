import Link from "next/link";
import { requerirRestaurante } from "@/lib/panel";
import { SECCIONES, type Modulo, type Seccion } from "@/lib/salon";
import { Icono } from "@/components/Icono";
import { PLANES } from "@/components/inicio/datos";
import {
  NOMBRE_PLAN,
  PLAN_DE_PRUEBA,
  PLAN_PEDIDOS_WHATSAPP,
  enlaceContratar,
  estadoPrueba,
  planDeModulo,
  planDeSeccion,
  type PlanPago,
} from "@/lib/planes";
import { formatoPrecio } from "@/lib/utils";

export const metadata = { title: "Tu plan · Mesitto" };
export const dynamic = "force-dynamic";

const NOMBRE_MODULO: Record<Modulo, string> = {
  salon: "Salón y mesas",
  llevar: "Para llevar y delivery",
  cocina: "Pantalla de cocina",
  cobros: "Cobros y caja",
  pedidos_mesa: "Pedidos desde la mesa",
  reservas: "Reservas y lista de espera",
  clientes: "Clientes frecuentes",
  estadisticas: "Estadísticas",
  sucursales: "Sucursales",
  equipo: "Equipo",
};

// Qué pidió ver: una sección (?s=salon), un módulo de Personalizar (?m=cocina) o los pedidos por WhatsApp (?s=pedidos).
function pedido(s?: string, m?: string): { nombre: string; plan: PlanPago } | null {
  if (s === "pedidos") return { nombre: "Pedidos por WhatsApp", plan: PLAN_PEDIDOS_WHATSAPP };
  const seccion = SECCIONES.find((x) => x.id === s);
  if (seccion) return { nombre: seccion.texto, plan: planDeSeccion(seccion.id as Seccion) };
  if (m && m in NOMBRE_MODULO) return { nombre: NOMBRE_MODULO[m as Modulo], plan: planDeModulo(m as Modulo) };
  return null;
}

const fecha = (d: Date | string) => new Date(d).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });

export default async function PaginaPlan({ searchParams }: { searchParams: Promise<{ s?: string; m?: string }> }) {
  const { restaurante } = await requerirRestaurante();
  const { s, m } = await searchParams;
  const quiere = pedido(s, m);
  const prueba = estadoPrueba(restaurante);
  const enPrueba = restaurante.plan === "free";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Tu plan</h1>
        <p className="text-sm text-suave">Lo que incluye tu plan y lo que suma cada uno.</p>
      </div>

      {quiere && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100">
            <Icono nombre="candado" className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold">
              {quiere.nombre} está disponible en el plan {NOMBRE_PLAN[quiere.plan]}
            </p>
            <p className="text-sm opacity-80">
              Tu plan actual es {NOMBRE_PLAN[restaurante.plan]}. Al cambiar de plan se activa al instante, con todo lo que ya
              tenías configurado.
            </p>
          </div>
        </div>
      )}

      <section className="tarjeta flex flex-wrap items-center gap-4 p-5">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-marca-claro text-marca-tinta">
          <Icono nombre={enPrueba ? "reloj" : "estrella"} className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-suave">Plan actual</p>
          <p className="text-lg font-semibold">{NOMBRE_PLAN[restaurante.plan]}</p>
          {enPrueba && prueba && (
            <p className="text-sm text-suave">
              {prueba.vencida
                ? "Tu prueba terminó y tu carta está pausada."
                : `Te ${prueba.quedan === 1 ? "queda 1 día" : `quedan ${prueba.quedan} días`} · termina el ${fecha(prueba.fin)}.`}{" "}
              Durante la prueba usas todo lo del plan {NOMBRE_PLAN[PLAN_DE_PRUEBA]}.
            </p>
          )}
          {enPrueba && !prueba && <p className="text-sm text-suave">Usas todo lo del plan {NOMBRE_PLAN[PLAN_DE_PRUEBA]}.</p>}
          {!enPrueba && restaurante.plan_inicio && (
            <p className="text-sm text-suave">Desde el {fecha(`${restaurante.plan_inicio}T12:00:00`)}.</p>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {PLANES.map((p) => {
          const actual = p.id === restaurante.plan;
          const destacado = quiere ? p.id === quiere.plan : "destacado" in p && p.destacado;
          const contratar = enlaceContratar(restaurante.nombre, p.nombre);
          return (
            <div
              key={p.id}
              className={`tarjeta flex flex-col p-5 ${destacado ? "ring-2 ring-marca-claro" : ""} ${actual ? "ring-2 ring-marca" : ""}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">{p.nombre}</h2>
                {actual && <span className="rounded-full bg-marca px-2 py-0.5 text-xs font-semibold text-white">Tu plan</span>}
              </div>
              <p className="mt-1 text-sm text-suave">{p.para}</p>
              <p className="mt-3 text-2xl font-semibold tabular-nums">
                {formatoPrecio(p.precio, "CLP")}
                <span className="text-sm font-normal text-suave"> /mes</span>
              </p>
              <ul className="mt-3 flex-1 space-y-1.5 text-sm">
                {p.incluye.map((i) => (
                  <li key={i} className="flex gap-2">
                    <Icono nombre="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    {i}
                  </li>
                ))}
              </ul>
              {!actual &&
                (contratar ? (
                  <a href={contratar} target="_blank" className={`mt-4 ${destacado ? "boton" : "boton-secundario"}`}>
                    Quiero el plan {p.nombre}
                  </a>
                ) : (
                  <p className="mt-4 text-center text-xs text-suave">Escríbenos para activarlo.</p>
                ))}
            </div>
          );
        })}
      </section>

      <p className="text-center text-sm text-suave">
        ¿Dudas?{" "}
        <Link href="/#precios" className="text-marca hover:underline">
          Mira los planes en detalle
        </Link>
        .
      </p>
    </div>
  );
}
