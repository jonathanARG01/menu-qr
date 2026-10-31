"use client";

import { useState } from "react";
import { Icono } from "@/components/Icono";
import { useToast } from "@/components/Toast";
import { useUrlSitio } from "@/lib/useUrlSitio";
import {
  NOMBRE_ESTADO_REFERIDO,
  colorNivel,
  descuentoVigente,
  nombreNivel,
  textoNivel,
  urlInvitacion,
  type Descuento,
  type EstadoReferido,
  type Nivel,
} from "@/lib/referidos";
import { PAGA_CADA, type Ciclo } from "@/lib/planes";
import { PAIS_BASE } from "@/lib/region";

type Props = {
  slug: string;
  nombre: string;
  ciclo?: Ciclo;
  activo: boolean;
  niveles: Nivel[];
  descuentos: Descuento[];
  referidos: { nombre: string; estado: EstadoReferido; created_at: string }[];
};

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString(PAIS_BASE.locale, { day: "numeric", month: "short", year: "numeric" });

export function Referidos({ slug, nombre, ciclo, activo, niveles, descuentos, referidos }: Props) {
  const avisar = useToast();
  const enlace = urlInvitacion(useUrlSitio(), slug);
  const confirmados = referidos.filter((r) => r.estado === "confirmado").length;
  const siguiente = niveles.find((n) => n.referidos > confirmados);
  const vigente = descuentoVigente(descuentos);
  const mensaje = `Hola! En ${nombre} usamos esta carta digital con QR y pedidos desde la mesa. Si te sumas con mi link, los dos salimos ganando: ${enlace}`;
  const actual = [...niveles].reverse().find((n) => n.referidos <= confirmados);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Invitar y ahorrar</h1>
        <p className="text-sm text-suave">
          Recomienda el sistema a otros restaurantes. Cada uno que contrate un plan con tu link te acerca a un descuento en tu
          suscripción.
        </p>
      </div>

      {!activo && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          El programa está en pausa: por ahora no se entregan descuentos nuevos. Lo que ya ganaste se respeta.
        </p>
      )}

      <section className="tarjeta space-y-3 p-5">
        <p className="font-semibold">Tu link de invitación</p>
        <div className="flex flex-wrap gap-2">
          <input
            readOnly
            value={enlace}
            className="campo min-w-0 flex-1 basis-64"
            onFocus={(e) => e.target.select()}
            aria-label="Link"
          />
          <button
            type="button"
            className="boton-secundario"
            onClick={() => navigator.clipboard?.writeText(enlace).then(() => avisar("Link copiado"))}
          >
            Copiar
          </button>
          <a className="boton" href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noreferrer">
            <Icono nombre="whatsapp" className="h-4 w-4" />
            Enviar por WhatsApp
          </a>
          <InvitarPorCorreo nombre={nombre} enlace={enlace} />
        </div>
        <p className="text-xs text-suave">
          Cuenta cuando el restaurante crea su cuenta con este link y después contrata un plan pago.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Dato titulo="Contrataron" valor={String(confirmados)} nota={actual ? `Nivel ${nombreNivel(actual)}` : undefined} />
        <Dato
          titulo="Descuento en tu próximo cobro"
          valor={vigente.porcentaje > 0 ? `${vigente.porcentaje} %` : "—"}
          nota={
            vigente.permanente
              ? "Permanente"
              : vigente.mesesPendientes > 1
                ? `${vigente.mesesPendientes} meses con descuento`
                : undefined
          }
        />
        <Dato
          titulo={siguiente ? `Para llegar a ${nombreNivel(siguiente)}` : "Nivel máximo"}
          valor={siguiente ? `faltan ${siguiente.referidos - confirmados}` : "¡Logrado!"}
          nota={vigente.prioridad ? "Acceso prioritario a las mejoras" : undefined}
        />
      </section>

      <section className="tarjeta p-5">
        <p className="mb-3 font-semibold">Niveles</p>
        {niveles.length === 0 ? (
          <p className="text-sm text-suave">Todavía no hay niveles definidos.</p>
        ) : (
          <ol className="space-y-3">
            {niveles.map((n) => {
              const ganado = descuentos.some((d) => d.referidos === n.referidos);
              const avance = Math.min(1, confirmados / n.referidos);
              return (
                <li key={n.referidos} className="flex items-center gap-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      ganado ? "bg-emerald-600 text-white" : "bg-stone-100 text-tinta"
                    }`}
                  >
                    {ganado ? "✓" : n.referidos}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${colorNivel(n.nombre)}`}>
                        {nombreNivel(n)}
                      </span>
                      {n.referidos} {n.referidos === 1 ? "restaurante" : "restaurantes"}: {textoNivel(n)}
                    </p>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100">
                      <div className="h-full rounded-full bg-marca" style={{ width: `${avance * 100}%` }} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <div className="mt-4 space-y-1 text-xs text-suave">
          <p>
            Los descuentos se cuentan en meses.{" "}
            {ciclo && ciclo !== "mensual"
              ? `Como pagas ${PAGA_CADA[ciclo]}, a tu cobro se le resta el descuento de cada mes que cubre (además del descuento por pagar varios meses juntos).`
              : "Como pagas por mes, se restan de tus próximos cobros mensuales."}{" "}
            Los permanentes se aplican a todos los meses.
          </p>
          {niveles.some((n) => n.prioridad) && (
            <p>Acceso prioritario: recibes primero las funciones nuevas que se van sumando al sistema.</p>
          )}
        </div>
      </section>

      {descuentos.length > 0 && (
        <section className="tarjeta divide-y divide-borde">
          <p className="px-5 py-3 font-semibold">Descuentos ganados</p>
          {descuentos.map((d) => {
            const quedan = d.periodos == null ? null : d.periodos - d.periodos_usados;
            return (
              <div key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className="flex-1">
                  <strong>{nombreNivel(d)}</strong> · {d.porcentaje} %{d.prioridad && " · acceso prioritario"}
                </span>
                <span className={quedan === 0 ? "text-suave" : "font-medium text-emerald-700"}>
                  {quedan == null
                    ? "Permanente"
                    : quedan === 0
                      ? "Ya usado"
                      : `Te queda${quedan > 1 ? "n" : ""} ${quedan} ${quedan > 1 ? "meses" : "mes"}`}
                </span>
              </div>
            );
          })}
        </section>
      )}

      <section className="tarjeta divide-y divide-borde">
        <p className="px-5 py-3 font-semibold">Restaurantes que invitaste</p>
        {referidos.length === 0 ? (
          <p className="px-5 py-4 text-sm text-suave">Todavía ninguno. Comparte tu link y aparecerán aquí.</p>
        ) : (
          referidos.map((r, i) => (
            <div key={i} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
              <span className="min-w-0 flex-1 basis-full truncate font-medium sm:basis-auto">{r.nombre}</span>
              <span className="text-xs text-suave">desde {fecha(r.created_at)}</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  r.estado === "confirmado"
                    ? "bg-emerald-100 text-emerald-800"
                    : r.estado === "pendiente"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-stone-100 text-suave"
                }`}
              >
                {NOMBRE_ESTADO_REFERIDO[r.estado]}
              </span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function Dato({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <div className="tarjeta p-4">
      <p className="text-xs text-suave">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{valor}</p>
      {nota && <p className="mt-0.5 text-xs text-emerald-700">{nota}</p>}
    </div>
  );
}

// Abre un correo ya escrito con el link. Gmail y Outlook en el navegador (sirven en cualquier computador)
// o la app de correo del equipo.
function InvitarPorCorreo({ nombre, enlace }: { nombre: string; enlace: string }) {
  const [abierto, setAbierto] = useState(false);
  const asunto = `${nombre} te recomienda su carta digital con QR`;
  const cuerpo = [
    "Hola,",
    "",
    `En ${nombre} usamos Platovi para la carta con QR, los pedidos desde la mesa y la cocina en vivo. Nos ha servido mucho y creo que a ustedes también les puede servir.`,
    "",
    `Pueden crear su cuenta y probarlo gratis 14 días con mi link: ${enlace}`,
    "",
    "Saludos,",
    nombre,
  ].join("\n");
  const q = (s: string) => encodeURIComponent(s);
  const opciones = [
    { texto: "Gmail", href: `https://mail.google.com/mail/?view=cm&fs=1&su=${q(asunto)}&body=${q(cuerpo)}` },
    { texto: "Outlook", href: `https://outlook.live.com/mail/0/deeplink/compose?subject=${q(asunto)}&body=${q(cuerpo)}` },
    { texto: "App de correo", href: `mailto:?subject=${q(asunto)}&body=${q(cuerpo)}` },
  ];
  return (
    <div className="relative">
      <button
        type="button"
        className="boton-secundario"
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
      >
        <Icono nombre="correo" className="h-4 w-4" />
        Enviar por correo
      </button>
      {abierto && (
        <>
          <button type="button" className="fixed inset-0 z-10 cursor-default" aria-label="Cerrar" onClick={() => setAbierto(false)} />
          <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-2xl border border-borde bg-superficie py-1 shadow-lg">
            {opciones.map((o) => (
              <a
                key={o.texto}
                href={o.href}
                target={o.href.startsWith("mailto:") ? undefined : "_blank"}
                rel="noreferrer"
                className="block px-4 py-2 text-sm hover:bg-stone-50"
                onClick={() => setAbierto(false)}
              >
                {o.texto}
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
