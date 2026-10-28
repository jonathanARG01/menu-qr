"use client";

import { useEffect, useMemo, useState } from "react";
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
  textoOpciones,
} from "@/lib/salon";
import { avisarComensal } from "@/lib/push";
import { fechaCorta, horaCorta, imprimirTicket } from "@/lib/imprimir";
import { conReintentos, esErrorDeRed } from "@/lib/reintentos";
import { nombrePersona, useEquipo } from "@/lib/equipo";
import { Avatar } from "@/components/Avatar";
import { EnOtrasMonedas } from "@/components/carta/EnOtrasMonedas";
import type { Categoria, Mesa, Plato, Restaurante } from "@/lib/types";
import { formatoOtraMoneda, formatoPrecio, mensajeError } from "@/lib/utils";
import { minutosDesde, tiempo, useAhora, type useServicio } from "@/lib/useServicio";
import { formatoHora, numeroWhatsapp, paisDe } from "@/lib/region";
import { ClienteCuenta, Atiende } from "./ClienteCuenta";
import { Cobro, type NuevoPago } from "./Cobro";
import { TomarPedido, type LineaNueva } from "./TomarPedido";

export const COLOR_ESTADO: Record<EstadoPedido, string> = {
  pendiente: "bg-red-100 text-red-800",
  retenido: "bg-violet-100 text-violet-800",
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
  // Mesas del local, para mover o juntar la cuenta con otra mesa.
  mesas?: Mesa[];
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
  mesas = [],
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
  // Mover la cuenta a otra mesa, juntarla con otra o pasar un plato (el item elegido) a otra mesa.
  const [moviendo, setMoviendo] = useState<null | "mover" | "juntar" | PedidoItem>(null);
  const { persona, yo } = useEquipo(supabase, restaurante.id);
  const atiende = persona(cuenta?.mesero_id);
  const asignado = persona(mesa?.mesero_id);
  // La mesa es de otro mesero: se avisa antes de tomarle el pedido.
  const deOtro = ajustes.modulos.equipo && !!yo && !!cuenta && !llevar && !!atiende && atiende.user_id !== yo;

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

  // Primero se crean las comandas "en espera" (no se ven en cocina), después sus platos y al final se marchan.
  // Todo lleva ids generados en el teléfono: si se corta la conexión y se reintenta, nada se duplica ni queda vacío.
  async function enviarPedido(nuevas: LineaNueva[]) {
    if (!cuenta) return false;
    const estacionDe = (p: Plato) => categorias.find((c) => c.id === p.categoria_id)?.estacion ?? "Cocina";
    const grupos = new Map<string, LineaNueva[]>();
    for (const l of nuevas) {
      const clave = `${estacionDe(l.plato)}|${l.despues ? "despues" : "ya"}`;
      grupos.set(clave, [...(grupos.get(clave) ?? []), l]);
    }
    // La comanda toma el id de su primer plato (son tablas distintas): el mismo borrador arma siempre la misma.
    const comandas = [...grupos].map(([clave, ls]) => ({
      id: ls[0].id,
      estacion: clave.split("|")[0],
      despues: clave.endsWith("|despues"),
      lineas: ls,
    }));

    const fallo = (error: unknown) => {
      avisar(
        esErrorDeRed(error)
          ? "Sin conexión: la comanda quedó guardada en este teléfono y se reintenta sola."
          : mensajeError(error),
        "error",
      );
      return false;
    };

    const r1 = await conReintentos(() =>
      supabase.from("pedidos").upsert(
        comandas.map((c) => ({
          id: c.id,
          restaurante_id: restaurante.id,
          cuenta_id: cuenta.id,
          sucursal_id: cuenta.sucursal_id,
          mesa_numero: mesa?.numero ?? null,
          estacion: c.estacion,
          origen: "personal",
          estado: "retenido",
          nombre: llevar ? (cuenta.cliente_nombre?.slice(0, 40) ?? null) : null,
        })),
        { onConflict: "id", ignoreDuplicates: true },
      ),
    );
    if (r1.error) return fallo(r1.error);

    const r2 = await conReintentos(() =>
      supabase.from("pedido_items").upsert(
        comandas.flatMap((c) =>
          c.lineas.map((l) => ({
            id: l.id,
            pedido_id: c.id,
            restaurante_id: restaurante.id,
            plato_id: l.plato.id,
            // El precio y el nombre los pone la base de datos desde la carta (con las opciones elegidas).
            nombre: l.plato.nombre,
            precio: l.plato.precio,
            cantidad: l.cantidad,
            nota: l.nota.trim() || null,
            comensal: l.comensal,
            ...(l.opciones.length ? { opciones: l.opciones } : {}),
          })),
        ),
        { onConflict: "id", ignoreDuplicates: true },
      ),
    );
    if (r2.error) {
      if (!esErrorDeRed(r2.error)) {
        await supabase
          .from("pedidos")
          .update({ estado: "cancelado" })
          .in(
            "id",
            comandas.map((c) => c.id),
          );
      }
      return fallo(r2.error);
    }

    const ya = comandas.filter((c) => !c.despues);
    if (ya.length) {
      const r3 = await conReintentos(() =>
        supabase
          .from("pedidos")
          .update({ estado: "nuevo" })
          .in(
            "id",
            ya.map((c) => c.id),
          )
          .eq("estado", "retenido"),
      );
      if (r3.error) return fallo(r3.error);
    }
    const estaciones = [...new Set(ya.map((c) => c.estacion))];
    avisar(
      ya.length === 0
        ? "Comanda guardada en espera: márchala cuando toque"
        : estaciones.length > 1
          ? `Pedido enviado a ${estaciones.join(" y ")}`
          : "Pedido enviado",
    );
    await recargar();
    setPantalla("mesa");
    return true;
  }

  // Marchar: la comanda en espera pasa a cocina, con la hora de ahora (así la cocina mide bien su tiempo).
  const marchar = (lista: Pedido[]) =>
    hacer(
      supabase
        .from("pedidos")
        .update({ estado: "nuevo", created_at: new Date().toISOString() })
        .in(
          "id",
          lista.map((p) => p.id),
        ),
      lista.length > 1 ? "Comandas marchadas a cocina" : "Marchado a cocina",
    );

  async function moverA(destino: Mesa) {
    if (!cuenta) return;
    const ocupada = servicio.cuentas.find((c) => c.mesa_id === destino.id && c.estado === "abierta");
    if (moviendo === "mover") {
      if (await hacer(supabase.rpc("mover_cuenta", { p_cuenta: cuenta.id, p_mesa: destino.id }), `Pasó a ${nombreMesa(destino.numero)}`))
        onCerrar();
    } else if (moviendo === "juntar" && ocupada) {
      if (!confirm(`¿Juntar ${titulo} con ${nombreMesa(destino.numero)}? Todo queda en ${nombreMesa(destino.numero)}.`)) return;
      if (
        await hacer(
          supabase.rpc("juntar_cuentas", { p_destino: ocupada.id, p_origen: cuenta.id }),
          `Mesas juntas en ${nombreMesa(destino.numero)}`,
        )
      )
        onCerrar();
    } else if (moviendo && typeof moviendo === "object" && ocupada) {
      let cantidad = moviendo.cantidad;
      if (cantidad > 1) {
        const n = Number(prompt(`¿Cuántos de "${moviendo.nombre}" pasan a ${nombreMesa(destino.numero)}?`, String(cantidad)));
        if (!Number.isFinite(n) || n < 1) return;
        cantidad = Math.min(n, cantidad);
      }
      await hacer(
        supabase.rpc("mover_item", { p_item: moviendo.id, p_cuenta: ocupada.id, p_cantidad: cantidad }),
        `${moviendo.nombre} pasó a ${nombreMesa(destino.numero)}`,
      );
    }
    setMoviendo(null);
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
      const nombre = i.opciones?.length ? `${i.nombre} (${textoOpciones(i.opciones)})` : i.nombre;
      const a = agrupado.get(nombre) ?? { cantidad: 0, importe: 0 };
      agrupado.set(nombre, { cantidad: a.cantidad + i.cantidad, importe: a.importe + Number(i.precio) * i.cantidad });
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
      ...ajustes.otras_monedas.map((m) => ({
        tipo: "fila" as const,
        izq: `Aprox. en ${m.codigo}`,
        der: formatoOtraMoneda(total / m.tasa, m.codigo),
      })),
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
          {ajustes.avatares && (atiende ?? asignado) && (
            <Avatar persona={atiende ?? asignado} className="h-10 w-10 text-sm" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-bold">{titulo}</p>
            <p className="text-sm text-suave" suppressHydrationWarning>
              {[
                piso,
                mesa && `${mesa.capacidad ?? 4} lugares`,
                cuenta && `${llevar ? "pedido" : "abierta"} hace ${tiempo(minutosDesde(cuenta.abierta_at, ahora))}`,
                atiende ? `atiende ${nombrePersona(atiende)}` : asignado && `a cargo de ${nombrePersona(asignado)}`,
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
          {deOtro && pantalla !== "cobro" && (
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              <Avatar persona={atiende} className="h-8 w-8 text-xs" />
              <p className="min-w-0 flex-1">
                Esta mesa la atiende <strong>{nombrePersona(atiende)}</strong>. Avísale antes de tomar el pedido.
              </p>
              <button
                type="button"
                className="rounded-lg bg-superficie px-2.5 py-1 text-xs font-semibold shadow-sm"
                onClick={() => hacer(supabase.from("cuentas").update({ mesero_id: yo }).eq("id", cuenta!.id), "Ahora la atiendes tú")}
              >
                Pasármela
              </button>
            </div>
          )}
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
              tipo={cuenta.tipo ?? "mesa"}
              borrador={cuenta.id}
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
              {!llevar && mesas.length > 1 && (
                <div className="flex gap-2">
                  <button type="button" className="boton-secundario flex-1 py-2 text-sm" onClick={() => setMoviendo("mover")}>
                    Cambiar de mesa
                  </button>
                  <button type="button" className="boton-secundario flex-1 py-2 text-sm" onClick={() => setMoviendo("juntar")}>
                    Juntar con otra
                  </button>
                </div>
              )}
              {pedidos.filter((p) => p.estado === "retenido").length > 1 && (
                <button
                  type="button"
                  className="boton w-full bg-violet-600 py-2.5 hover:bg-violet-700"
                  onClick={() => marchar(pedidos.filter((p) => p.estado === "retenido"))}
                >
                  Marchar todo lo que está en espera
                </button>
              )}

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
                        <span className="text-xs text-suave" suppressHydrationWarning title="Hora del pedido">
                          {horaCorta(p.created_at, regionDe(ajustes))} · hace {tiempo(minutosDesde(p.created_at, ahora))}
                        </span>
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
                              {i.opciones?.length ? (
                                <span className="block truncate text-xs text-suave">{textoOpciones(i.opciones)}</span>
                              ) : null}
                              {i.nota && <span className="block truncate text-xs text-amber-700">{i.nota}</span>}
                            </span>
                            {!llevar && mesas.length > 1 && (
                              <button
                                type="button"
                                className="rounded-md px-1 text-suave hover:bg-stone-100 hover:text-tinta"
                                onClick={() => setMoviendo(i)}
                                aria-label={`Pasar ${i.nombre} a otra mesa`}
                                title="Pasar a otra mesa"
                              >
                                ⇄
                              </button>
                            )}
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
                      {(p.estado === "pendiente" || p.estado === "retenido" || p.estado === "listo" || p.nota || p.nombre) && (
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
                          {p.estado === "retenido" && (
                            <button
                              type="button"
                              className="boton ml-auto bg-violet-600 px-3 py-1.5 hover:bg-violet-700"
                              onClick={() => marchar([p])}
                            >
                              Marchar
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

        {moviendo && cuenta && (
          <ElegirMesa
            titulo={
              moviendo === "mover"
                ? "¿A qué mesa libre pasa?"
                : moviendo === "juntar"
                  ? `¿Con qué mesa se junta ${titulo}?`
                  : `¿A qué mesa pasa "${moviendo.nombre}"?`
            }
            mesas={mesas.filter((m) => {
              if (m.id === mesa?.id) return false;
              const ocupada = servicio.cuentas.some((c) => c.mesa_id === m.id && c.estado === "abierta");
              return moviendo === "mover" ? !ocupada : ocupada;
            })}
            vacio={moviendo === "mover" ? "No hay mesas libres." : "No hay otras mesas abiertas."}
            onElegir={moverA}
            onCerrar={() => setMoviendo(null)}
          />
        )}

        {cuenta && pantalla === "mesa" && (
          <div className="space-y-3 border-t border-borde px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-suave">
                {pagado > 0 ? `Pagado ${formato(pagado)}` : "Total"}
                {propinas > 0 ? ` · Propinas ${formato(propinas)}` : ""}
              </span>
              <span className="text-right">
                <span className="block text-2xl font-bold tabular-nums">{formato(total)}</span>
                <EnOtrasMonedas total={total} monedas={ajustes.otras_monedas} texto="Aprox." />
              </span>
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

// Lista de mesas para mover o juntar (las del mismo piso primero, por número).
function ElegirMesa({
  titulo,
  mesas,
  vacio,
  onElegir,
  onCerrar,
}: {
  titulo: string;
  mesas: Mesa[];
  vacio: string;
  onElegir: (m: Mesa) => void;
  onCerrar: () => void;
}) {
  const ordenadas = useMemo(
    () => [...mesas].sort((a, b) => a.numero.localeCompare(b.numero, "es", { numeric: true })),
    [mesas],
  );
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-2xl bg-superficie p-5 shadow-2xl sm:rounded-2xl"
      >
        <p className="mb-3 font-semibold">{titulo}</p>
        {ordenadas.length === 0 ? (
          <p className="py-4 text-sm text-suave">{vacio}</p>
        ) : (
          <ul className="grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
            {ordenadas.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onElegir(m)}
                  className="w-full rounded-xl border border-borde px-2 py-3 text-sm font-semibold hover:border-marca hover:bg-marca/5"
                >
                  {nombreMesa(m.numero)}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={onCerrar} className="boton-secundario mt-4 w-full">
          Cancelar
        </button>
      </div>
    </div>
  );
}
