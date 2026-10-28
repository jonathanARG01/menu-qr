"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { Icono } from "@/components/Icono";
import { describirPropina, totalLineas } from "@/lib/cuenta";
import {
  NOMBRE_ESTADO,
  NOMBRE_TIPO,
  type Ajustes,
  type Cuenta,
  type EstadoPedido,
  type Pedido,
  type PedidoItem,
  type SolicitudCuenta,
  nombreMesa,
  regionDe,
} from "@/lib/salon";
import { avisarComensal } from "@/lib/push";
import { fechaCorta, imprimirTicket } from "@/lib/imprimir";
import type { Categoria, Mesa, Plato, Restaurante } from "@/lib/types";
import { formatoPrecio, mensajeError } from "@/lib/utils";
import { minutosDesde, tiempo, useAhora, type useServicio } from "@/lib/useServicio";
import { formatoHora, numeroWhatsapp, paisDe } from "@/lib/region";
import { ClienteCuenta, Atiende } from "./ClienteCuenta";
import { Cobro, type NuevoPago } from "./Cobro";
import { TomarPedido, type LineaNueva } from "./TomarPedido";

export const COLOR_ESTADO: Record<EstadoPedido, string> = {
  pendiente: "bg-red-100 text-red-800",
  nuevo: "bg-amber-100 text-amber-800",
  preparando: "bg-sky-100 text-sky-800",
  listo: "bg-emerald-100 text-emerald-800",
  entregado: "bg-stone-100 text-stone-600",
  cancelado: "bg-stone-100 text-stone-400 line-through",
};

type Props = {
  // Una mesa del plano, o un pedido para llevar o delivery (cuentaId, sin mesa).
  mesa?: Mesa;
  cuentaId?: string;
  piso?: string;
  restaurante: Restaurante;
  ajustes: Ajustes;
  admin: boolean;
  categorias: Categoria[];
  platos: Plato[];
  servicio: ReturnType<typeof useServicio>;
  onCerrar: () => void;
  // Pantalla con la que abre (un pedido para llevar recién creado va directo a la carta).
  inicio?: "mesa" | "pedido" | "cobro";
};

// Ficha de una mesa (o de un pedido para llevar): abrirla, tomar pedidos, cambiar lo pedido, asignar platos a cada
// comensal y cobrar.
export function MesaPanel({
  mesa,
  cuentaId,
  piso,
  restaurante,
  ajustes,
  admin,
  categorias,
  platos,
  servicio,
  onCerrar,
  inicio = "mesa",
}: Props) {
  const avisar = useToast();
  const ahora = useAhora();
  const { supabase, recargar } = servicio;
  const formato = (n: number) => formatoPrecio(n, restaurante.moneda);
  const cuenta = cuentaId
    ? servicio.cuentas.find((c) => c.id === cuentaId)
    : servicio.cuentas.find((c) => !!mesa && c.mesa_id === mesa.id);
  const llevar = !mesa;
  const titulo = mesa
    ? nombreMesa(mesa.numero)
    : `${NOMBRE_TIPO[cuenta?.tipo ?? "llevar"]}${cuenta?.cliente_nombre ? ` · ${cuenta.cliente_nombre}` : ""}`;
  const pedidos = cuenta ? servicio.pedidos.filter((p) => p.cuenta_id === cuenta.id && p.estado !== "cancelado") : [];
  const pagos = cuenta ? servicio.pagos.filter((p) => p.cuenta_id === cuenta.id) : [];
  const lineas = pedidos.flatMap((p) => p.pedido_items ?? []);
  const envio = Number(cuenta?.envio ?? 0);
  const total = totalLineas(lineas) + envio;
  const pagado = pagos.reduce((t, p) => t + Number(p.monto), 0);
  const propinas = pagos.reduce((t, p) => t + Number(p.propina), 0);
  const [pantalla, setPantalla] = useState<"mesa" | "pedido" | "cobro">(inicio);
  const [comensalesNuevos, setComensalesNuevos] = useState(mesa?.capacidad ?? 2);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onCerrar]);

  async function hacer(promesa: PromiseLike<{ error: unknown }>, ok?: string) {
    const { error } = await promesa;
    if (error) {
      avisar(mensajeError(error), "error");
      return false;
    }
    if (ok) avisar(ok);
    await recargar();
    return true;
  }

  const abrir = () =>
    mesa &&
    hacer(
      supabase.from("cuentas").insert({
        restaurante_id: restaurante.id,
        sucursal_id: mesa.sucursal_id ?? null,
        mesa_id: mesa.id,
        mesa_numero: mesa.numero,
        comensales: comensalesNuevos,
      }),
      `${nombreMesa(mesa.numero)} abierta`,
    );

  async function enviarPedido(nuevas: LineaNueva[]) {
    if (!cuenta) return;
    const estacionDe = (p: Plato) => categorias.find((c) => c.id === p.categoria_id)?.estacion ?? "Cocina";
    const grupos = new Map<string, LineaNueva[]>();
    for (const l of nuevas) grupos.set(estacionDe(l.plato), [...(grupos.get(estacionDe(l.plato)) ?? []), l]);

    for (const [estacion, ls] of grupos) {
      const { data, error } = await supabase
        .from("pedidos")
        .insert({
          restaurante_id: restaurante.id,
          cuenta_id: cuenta.id,
          sucursal_id: cuenta.sucursal_id,
          mesa_numero: mesa?.numero ?? null,
          estacion,
          origen: "personal",
          estado: "nuevo",
          nombre: llevar ? (cuenta.cliente_nombre?.slice(0, 40) ?? null) : null,
        })
        .select("id")
        .single();
      if (error) return avisar(mensajeError(error), "error");
      const { error: e2 } = await supabase.from("pedido_items").insert(
        ls.map((l) => ({
          pedido_id: data.id,
          restaurante_id: restaurante.id,
          plato_id: l.plato.id,
          // El precio y el nombre los pone la base de datos desde la carta.
          nombre: l.plato.nombre,
          precio: l.plato.precio,
          cantidad: l.cantidad,
          nota: l.nota.trim() || null,
          comensal: l.comensal,
        })),
      );
      if (e2) {
        await supabase.from("pedidos").update({ estado: "cancelado" }).eq("id", data.id);
        return avisar(mensajeError(e2), "error");
      }
    }
    avisar(grupos.size > 1 ? `Pedido enviado a ${[...grupos.keys()].join(" y ")}` : "Pedido enviado");
    await recargar();
    setPantalla("mesa");
  }

  const estadoPedido = async (p: Pedido, estado: EstadoPedido, ok?: string) => {
    const hecho = await hacer(supabase.from("pedidos").update({ estado }).eq("id", p.id), ok);
    if (hecho) avisarComensal(p.id);
    return hecho;
  };

  function cambiarItem(item: PedidoItem, cambios: Partial<PedidoItem>) {
    return hacer(supabase.from("pedido_items").update(cambios).eq("id", item.id));
  }

  async function quitarItem(item: PedidoItem, pedido: Pedido) {
    if (
      (pedido.estado === "preparando" || pedido.estado === "listo") &&
      !confirm(`"${item.nombre}" ya está en cocina. ¿Quitarlo igual?`)
    )
      return;
    const quedan = (pedido.pedido_items ?? []).length - 1;
    await hacer(supabase.from("pedido_items").delete().eq("id", item.id), "Quitado del pedido");
    if (quedan === 0) await estadoPedido(pedido, "cancelado");
  }

  // Precuenta para llevar a la mesa: lo consumido agrupado, lo pagado y lo que falta.
  function imprimirCuenta() {
    const agrupado = new Map<string, { cantidad: number; importe: number }>();
    for (const i of lineas) {
      const a = agrupado.get(i.nombre) ?? { cantidad: 0, importe: 0 };
      agrupado.set(i.nombre, { cantidad: a.cantidad + i.cantidad, importe: a.importe + Number(i.precio) * i.cantidad });
    }
    const sugerida = ajustes.propinas.activas && ajustes.propinas.sugerida ? ajustes.propinas.sugerida : null;
    imprimirTicket([
      { tipo: "titulo", texto: restaurante.nombre },
      {
        tipo: "texto",
        texto: `${llevar ? titulo : `${titulo} · ${cuenta?.comensales ?? 1} pers.`} · ${fechaCorta(Date.now(), regionDe(ajustes))}`,
        chico: true,
      },
      { tipo: "separador" },
      ...[...agrupado].map(([nombre, a]) => ({
        tipo: "fila" as const,
        izq: `${a.cantidad} × ${nombre}`,
        der: formato(a.importe),
      })),
      ...(envio > 0 ? [{ tipo: "fila" as const, izq: "Envío", der: formato(envio) }] : []),
      ...(llevar && cuenta?.direccion ? [{ tipo: "texto" as const, texto: cuenta.direccion, chico: true }] : []),
      { tipo: "separador" },
      { tipo: "fila", izq: "Total", der: formato(total), fuerte: true },
      ...(pagado > 0
        ? [
            { tipo: "fila" as const, izq: "Pagado", der: formato(pagado) },
            { tipo: "fila" as const, izq: "Falta", der: formato(Math.max(0, total - pagado)), fuerte: true },
          ]
        : []),
      ...(sugerida
        ? [
            {
              tipo: "texto" as const,
              texto: `Propina sugerida ${sugerida}%: ${formato(Math.round((total * sugerida) / 100))}`,
              chico: true,
            },
          ]
        : []),
      { tipo: "separador" },
      { tipo: "texto", texto: "No válido como factura. ¡Gracias!", chico: true },
    ]);
  }

  async function registrarPago(p: NuevoPago) {
    if (!cuenta) return false;
    return hacer(
      supabase.from("pagos").insert({ restaurante_id: restaurante.id, cuenta_id: cuenta.id, ...p }),
      "Pago registrado",
    );
  }

  async function cerrarMesa() {
    if (!cuenta) return;
    const falta = total - pagado;
    if (falta > 0.009 && !confirm(`Todavía faltan ${formato(falta)}. ¿Cerrar ${llevar ? "el pedido" : "la mesa"} igual?`)) return;
    if (
      await hacer(
        supabase
          .from("cuentas")
          .update({ estado: "cerrada", cerrada_at: new Date().toISOString(), aviso: null })
          .eq("id", cuenta.id),
        llevar ? "Pedido cerrado" : `${titulo} cerrada`,
      )
    )
      onCerrar();
  }

  async function anular() {
    if (!cuenta || !confirm(`¿Anular ${llevar ? "este pedido" : "esta mesa"}? Se descarta sin cobrar.`)) return;
    if (
      await hacer(
        supabase
          .from("cuentas")
          .update({ estado: "anulada", cerrada_at: new Date().toISOString(), aviso: null })
          .eq("id", cuenta.id),
        llevar ? "Pedido anulado" : "Mesa anulada",
      )
    )
      onCerrar();
  }

  const ancho = pantalla === "pedido" ? "max-w-4xl" : "max-w-lg";

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className={`flex h-full w-full ${ancho} flex-col bg-superficie shadow-2xl`}
      >
        <div className="flex items-center gap-3 border-b border-borde px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-bold">{titulo}</p>
            <p className="text-sm text-suave" suppressHydrationWarning>
              {[
                piso,
                mesa && `${mesa.capacidad ?? 4} lugares`,
                cuenta && `${llevar ? "pedido" : "abierta"} hace ${tiempo(minutosDesde(cuenta.abierta_at, ahora))}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <button type="button" onClick={onCerrar} className="rounded-lg p-2 text-suave hover:bg-stone-100" aria-label="Cerrar">
            <Icono nombre="cerrar" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4">
          {cuenta?.aviso && pantalla === "mesa" && (
            <div
              className={`mb-4 flex items-start gap-3 rounded-xl p-3 ${
                cuenta.aviso.tipo === "cuenta"
                  ? "bg-violet-50 text-violet-900"
                  : cuenta.aviso.tipo === "pago"
                    ? "bg-emerald-50 text-emerald-900"
                    : "bg-sky-50 text-sky-900"
              }`}
            >
              <Icono nombre="campana" className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0 flex-1 text-sm">
                {cuenta.aviso.tipo === "pago" ? (
                  <>
                    <p className="font-semibold">Pagó online con Mercado Pago</p>
                    {cuenta.aviso.detalle && (
                      <p>
                        {formato(Number(cuenta.aviso.detalle.monto))}
                        {Number(cuenta.aviso.detalle.propina) > 0
                          ? ` + ${formato(Number(cuenta.aviso.detalle.propina))} de propina`
                          : ""}
                        . Ya quedó registrado en la cuenta.
                      </p>
                    )}
                  </>
                ) : (
                  <AvisoCliente aviso={cuenta.aviso} formato={formato} />
                )}
              </div>
              <button
                type="button"
                className="rounded-lg bg-superficie px-2.5 py-1 text-xs font-semibold shadow-sm"
                onClick={() => hacer(supabase.from("cuentas").update({ aviso: null }).eq("id", cuenta.id), "Aviso atendido")}
              >
                Atendido
              </button>
            </div>
          )}

          {!cuenta && llevar ? (
            <p className="rounded-xl bg-stone-50 p-4 text-center text-suave">Este pedido ya se cerró.</p>
          ) : !cuenta ? (
            <div className="space-y-4">
              <p className="rounded-xl bg-stone-50 p-4 text-center text-suave">Mesa libre</p>
              <div className="flex items-center justify-between">
                <span className="font-medium">¿Cuántos son?</span>
                <Contador valor={comensalesNuevos} onChange={setComensalesNuevos} />
              </div>
              {mesa && comensalesNuevos > (mesa.capacidad ?? 4) && (
                <p className="text-sm text-amber-700">
                  Son más que los lugares de la mesa ({mesa.capacidad}): agrega sillas o junta mesas.
                </p>
              )}
              <button type="button" className="boton w-full py-3" onClick={abrir}>
                Abrir mesa
              </button>
            </div>
          ) : pantalla === "pedido" ? (
            <TomarPedido
              categorias={categorias}
              platos={platos}
              zona={ajustes.zona_horaria}
              comensales={llevar ? 1 : cuenta.comensales}
              formato={formato}
              onEnviar={enviarPedido}
              onCancelar={() => setPantalla("mesa")}
            />
          ) : pantalla === "cobro" ? (
            <Cobro
              total={total}
              pagos={pagos}
              comensales={llevar ? 1 : cuenta.comensales}
              lineas={lineas}
              ajustes={ajustes}
              solicitud={cuenta.aviso?.tipo === "cuenta" ? (cuenta.aviso.detalle ?? null) : null}
              formato={formato}
              onPagar={registrarPago}
              onCerrarMesa={cerrarMesa}
              onSalir={() => setPantalla("mesa")}
            />
          ) : (
            <div className="space-y-4">
              {llevar ? (
                <DatosLlevar cuenta={cuenta} ajustes={ajustes} formato={formato} />
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">Comensales</span>
                    <Contador
                      valor={cuenta.comensales}
                      onChange={(n) => hacer(supabase.from("cuentas").update({ comensales: n }).eq("id", cuenta.id))}
                    />
                  </div>
                  {mesa && cuenta.comensales > (mesa.capacidad ?? 4) && (
                    <p className="-mt-2 text-xs text-amber-700">Más que los {mesa.capacidad} lugares de la mesa.</p>
                  )}
                </>
              )}
              {ajustes.modulos.clientes && !llevar && (
                <ClienteCuenta supabase={supabase} cuenta={cuenta} ajustes={ajustes} formato={formato} onCambio={recargar} />
              )}
              {ajustes.modulos.equipo && <Atiende supabase={supabase} cuenta={cuenta} onCambio={recargar} />}

              <button type="button" className="boton w-full py-3" onClick={() => setPantalla("pedido")}>
                <Icono nombre="mas_simple" className="h-4 w-4" /> Tomar pedido
              </button>

              {pedidos.length === 0 ? (
                <p className="py-6 text-center text-sm text-suave">
                  Todavía no hay pedidos {llevar ? "en este pedido" : "en esta mesa"}.
                </p>
              ) : (
                <ul className="space-y-3">
                  {pedidos.filter((p) => p.estado === "listo").length > 1 && (
                    // Varios pedidos listos de la mesa: se llevan juntos y se marcan de una vez.
                    <li>
                      <button
                        type="button"
                        className="boton w-full bg-emerald-600 py-2.5 hover:bg-emerald-700"
                        onClick={async () => {
                          const listos = pedidos.filter((p) => p.estado === "listo");
                          const hecho = await hacer(
                            supabase
                              .from("pedidos")
                              .update({ estado: "entregado" })
                              .in(
                                "id",
                                listos.map((p) => p.id),
                              ),
                            "Pedidos entregados",
                          );
                          if (hecho) listos.forEach((p) => avisarComensal(p.id));
                        }}
                      >
                        Marcar entregados los {pedidos.filter((p) => p.estado === "listo").length} pedidos listos
                      </button>
                    </li>
                  )}
                  {pedidos.map((p) => (
                    <li key={p.id} className="rounded-xl border border-borde">
                      <div className="flex flex-wrap items-center gap-2 border-b border-borde bg-stone-50 px-3 py-2 text-sm">
                        <span className="font-semibold">#{p.numero}</span>
                        <span className="text-suave">{p.estacion}</span>
                        {p.origen === "cliente" && (
                          <span className="rounded bg-violet-100 px-1.5 text-xs text-violet-800">desde el QR</span>
                        )}
                        <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${COLOR_ESTADO[p.estado]}`}>
                          {NOMBRE_ESTADO[p.estado]}
                        </span>
                      </div>
                      <ul className="divide-y divide-borde">
                        {(p.pedido_items ?? []).map((i) => (
                          <li key={i.id} className="flex items-center gap-2 px-3 py-2">
                            <span className="flex items-center rounded-lg border border-borde text-sm">
                              <button
                                type="button"
                                className="h-7 w-7"
                                aria-label={`Menos ${i.nombre}`}
                                onClick={() => (i.cantidad > 1 ? cambiarItem(i, { cantidad: i.cantidad - 1 }) : quitarItem(i, p))}
                              >
                                −
                              </button>
                              <span className="w-5 text-center font-semibold tabular-nums">{i.cantidad}</span>
                              <button
                                type="button"
                                className="h-7 w-7"
                                aria-label={`Más ${i.nombre}`}
                                onClick={() => cambiarItem(i, { cantidad: Math.min(99, i.cantidad + 1) })}
                              >
                                +
                              </button>
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{i.nombre}</span>
                              {i.nota && <span className="block truncate text-xs text-amber-700">{i.nota}</span>}
                            </span>
                            <select
                              value={i.comensal ?? ""}
                              onChange={(e) => cambiarItem(i, { comensal: e.target.value ? Number(e.target.value) : null })}
                              className="rounded-md border border-borde px-1 py-0.5 text-xs"
                              aria-label={`De quién es ${i.nombre}`}
                              title="De quién es (para dividir por consumo)"
                            >
                              <option value="">Todos</option>
                              {Array.from({ length: llevar ? 0 : cuenta.comensales }, (_, k) => (
                                <option key={k} value={k + 1}>
                                  C{k + 1}
                                </option>
                              ))}
                            </select>
                            <span className="w-20 text-right text-sm tabular-nums">{formato(Number(i.precio) * i.cantidad)}</span>
                          </li>
                        ))}
                      </ul>
                      {(p.estado === "pendiente" || p.estado === "listo" || p.nota || p.nombre) && (
                        <div className="flex flex-wrap items-center gap-2 border-t border-borde px-3 py-2 text-sm">
                          {(p.nombre || p.nota) && (
                            <span className="text-xs text-suave">
                              {p.nombre && <strong>{p.nombre}</strong>} {p.nota}
                            </span>
                          )}
                          {p.estado === "pendiente" && (
                            <button
                              type="button"
                              className="boton ml-auto px-3 py-1.5"
                              onClick={() => estadoPedido(p, "nuevo", "Enviado a cocina")}
                            >
                              Confirmar y enviar
                            </button>
                          )}
                          {p.estado === "listo" && (
                            <button
                              type="button"
                              className="boton ml-auto bg-emerald-600 px-3 py-1.5 hover:bg-emerald-700"
                              onClick={() => estadoPedido(p, "entregado")}
                            >
                              Marcar entregado
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {cuenta && pantalla === "mesa" && (
          <div className="space-y-3 border-t border-borde px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-suave">
                {pagado > 0 ? `Pagado ${formato(pagado)}` : "Total"}
                {propinas > 0 ? ` · Propinas ${formato(propinas)}` : ""}
              </span>
              <span className="text-2xl font-bold tabular-nums">{formato(total)}</span>
            </div>
            <div className="flex gap-2">
              {admin && pedidos.length === 0 && pagos.length === 0 && (
                <button type="button" className="boton-secundario" onClick={anular}>
                  Anular
                </button>
              )}
              <button
                type="button"
                className="boton-secundario px-3"
                onClick={imprimirCuenta}
                disabled={total <= 0}
                aria-label="Imprimir la cuenta"
                title="Imprimir la cuenta (precuenta)"
              >
                <Icono nombre="impresora" className="h-4 w-4" />
              </button>
              {ajustes.modulos.cobros ? (
                <button
                  type="button"
                  className="boton flex-1 py-3"
                  onClick={() => setPantalla("cobro")}
                  disabled={total <= 0 && pagos.length === 0}
                >
                  Cobrar
                </button>
              ) : (
                <button type="button" className="boton flex-1 py-3" onClick={cerrarMesa}>
                  {llevar ? "Cerrar pedido" : "Cerrar mesa"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Contador({ valor, onChange }: { valor: number; onChange: (n: number) => void }) {
  return (
    <span className="flex items-center rounded-xl border border-borde">
      <button type="button" className="h-10 w-10 text-xl" onClick={() => onChange(Math.max(1, valor - 1))} aria-label="Menos">
        −
      </button>
      <span className="w-9 text-center text-lg font-semibold tabular-nums">{valor}</span>
      <button type="button" className="h-10 w-10 text-xl" onClick={() => onChange(Math.min(99, valor + 1))} aria-label="Más">
        +
      </button>
    </span>
  );
}

// Lo que pidió el cliente desde la carta: llamar al mesero o la cuenta (cómo dividirla, propina y medios).
function AvisoCliente({
  aviso,
  formato,
}: {
  aviso: { tipo: "cuenta" | "mozo"; detalle?: SolicitudCuenta | null };
  formato: (n: number) => string;
}) {
  const d = aviso.detalle;
  return (
    <>
      <p className="font-semibold">{aviso.tipo === "cuenta" ? "Pide la cuenta" : "Llama al mesero"}</p>
      {d && (
        <p>
          {d.modo === "iguales"
            ? `Dividir en ${d.partes} partes iguales`
            : d.modo === "consumo"
              ? "Cada uno paga lo suyo"
              : "Todo junto"}
          {d.propina ? ` · ${describirPropina(d.propina, formato)}` : ""}
          {d.metodo ? ` · ${d.metodo}` : ""}
        </p>
      )}
      {d?.metodos?.some(Boolean) && (
        <ul className="mt-1 space-y-0.5">
          {d.metodos.map((m, i) => (
            <li key={i}>
              {d.modo === "consumo" ? "Comensal" : "Persona"} {i + 1}: <strong>{m || "sin elegir"}</strong>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// Datos del pedido para llevar o delivery: cliente, teléfono, hora y dirección.
function DatosLlevar({ cuenta, ajustes, formato }: { cuenta: Cuenta; ajustes: Ajustes; formato: (n: number) => string }) {
  const region = regionDe(ajustes);
  const telefono = cuenta.cliente_telefono;
  return (
    <div className="space-y-1.5 rounded-xl bg-stone-50 p-3 text-sm">
      <p className="flex items-center gap-2 font-semibold">
        <Icono nombre={cuenta.tipo === "delivery" ? "delivery" : "llevar"} className="h-4 w-4" />
        {cuenta.cliente_nombre ?? "Sin nombre"}
        {cuenta.origen === "cliente" && (
          <span className="rounded bg-violet-100 px-1.5 text-xs font-normal text-violet-800">desde la carta</span>
        )}
      </p>
      {telefono && (
        <p>
          <a
            href={`https://wa.me/${numeroWhatsapp(telefono, paisDe(ajustes.pais))}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-emerald-700 hover:underline"
          >
            <Icono nombre="whatsapp" className="h-4 w-4" /> {telefono}
          </a>
        </p>
      )}
      <p className="text-suave">
        {cuenta.tipo === "delivery" ? "Entregar" : "Retira"}{" "}
        {cuenta.para_hora ? `a las ${formatoHora(cuenta.para_hora, region)}` : "lo antes posible"}
        {Number(cuenta.envio) > 0 ? ` · envío ${formato(Number(cuenta.envio))}` : ""}
      </p>
      {cuenta.direccion && (
        <p>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cuenta.direccion)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-marca hover:underline"
          >
            {cuenta.direccion}
          </a>
        </p>
      )}
    </div>
  );
}
