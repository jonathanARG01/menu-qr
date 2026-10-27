"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { Icono } from "@/components/Icono";
import { NOMBRE_TIPO, regionDe, type Ajustes, type Cuenta, type Pedido, type TipoCuenta } from "@/lib/salon";
import type { Categoria, Plato, Restaurante, Sucursal } from "@/lib/types";
import { formatoPrecio, mensajeError } from "@/lib/utils";
import { totalLineas } from "@/lib/cuenta";
import { formatoHora, numeroWhatsapp, paisDe } from "@/lib/region";
import { avisarComensal, avisarEnCamino } from "@/lib/push";
import { sonar } from "@/lib/sonidos";
import { minutosDesde, useAhora, useServicio, type DatosServicio } from "@/lib/useServicio";
import { MesaPanel } from "../salon/MesaPanel";
import type { ClienteResumen } from "../salon/ClienteCuenta";

type Props = {
  restaurante: Restaurante;
  admin: boolean;
  ajustes: Ajustes;
  categorias: Categoria[];
  platos: Plato[];
  sucursales: Sucursal[];
  servicio: DatosServicio;
};

// En qué va cada pedido, según sus comandas.
type Etapa = "aceptar" | "cocina" | "listo" | "camino" | "entregado";

const COLUMNAS: { id: Etapa; texto: string; ayuda: string }[] = [
  { id: "aceptar", texto: "Por aceptar", ayuda: "Llegaron desde la carta" },
  { id: "cocina", texto: "En preparación", ayuda: "En cocina o barra" },
  { id: "listo", texto: "Listos", ayuda: "Para entregar o despachar" },
  { id: "camino", texto: "En camino", ayuda: "Delivery que ya salió" },
];

function etapaDe(cuenta: Cuenta, pedidos: Pedido[]): Etapa {
  if (pedidos.some((p) => p.estado === "pendiente")) return "aceptar";
  if (pedidos.length === 0 || pedidos.some((p) => p.estado === "nuevo" || p.estado === "preparando")) return "cocina";
  if (cuenta.tipo === "delivery" && cuenta.despachado_at) return "camino";
  if (pedidos.every((p) => p.estado === "entregado")) return "entregado";
  return "listo";
}

// Pedidos para llevar y delivery: los que llegan desde la carta y los que toma el personal por teléfono.
export function Llevar({ restaurante, admin, ajustes, categorias, platos, sucursales, servicio }: Props) {
  const avisar = useToast();
  const vivo = useServicio(restaurante.id, servicio);
  const { supabase, recargar } = vivo;
  const ahora = useAhora();
  const region = regionDe(ajustes);
  const formato = (n: number) => formatoPrecio(n, restaurante.moneda);
  const [abierta, setAbierta] = useState<{ id: string; inicio?: "mesa" | "pedido" | "cobro" } | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const vistos = useRef<Set<string> | null>(null);

  const lista = useMemo(() => {
    return vivo.cuentas
      .filter((c) => c.tipo && c.tipo !== "mesa")
      .map((c) => {
        const pedidos = vivo.pedidos.filter((p) => p.cuenta_id === c.id && p.estado !== "cancelado");
        const pagos = vivo.pagos.filter((p) => p.cuenta_id === c.id);
        const total = totalLineas(pedidos.flatMap((p) => p.pedido_items ?? [])) + Number(c.envio ?? 0);
        const pagado = pagos.reduce((t, p) => t + Number(p.monto), 0);
        return { cuenta: c, pedidos, total, pagado, etapa: etapaDe(c, pedidos) };
      })
      .sort((a, b) => (a.cuenta.para_hora ?? a.cuenta.abierta_at).localeCompare(b.cuenta.para_hora ?? b.cuenta.abierta_at));
  }, [vivo.cuentas, vivo.pedidos, vivo.pagos]);

  // Suena cuando entra un pedido desde la carta.
  useEffect(() => {
    const desdeCarta = lista.filter((x) => x.cuenta.origen === "cliente").map((x) => x.cuenta.id);
    if (vistos.current === null) {
      vistos.current = new Set(desdeCarta);
      return;
    }
    const llegaron = desdeCarta.filter((id) => !vistos.current!.has(id));
    llegaron.forEach((id) => vistos.current!.add(id));
    if (llegaron.length) {
      sonar("cuenta");
      avisar(llegaron.length === 1 ? "Llegó un pedido para llevar" : `Llegaron ${llegaron.length} pedidos para llevar`);
    }
  }, [lista, avisar]);

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

  function whatsapp(c: Cuenta, mensaje: string) {
    if (!c.cliente_telefono) return;
    window.open(
      `https://wa.me/${numeroWhatsapp(c.cliente_telefono, paisDe(ajustes.pais))}?text=${encodeURIComponent(mensaje)}`,
      "_blank",
      "noopener",
    );
  }

  async function aceptar(x: (typeof lista)[number]) {
    if (ajustes.llevar.pago_obligatorio && x.cuenta.origen === "cliente" && x.pagado < x.total - 0.009) {
      if (!confirm("Este pedido todavía no está pagado. ¿Mandarlo a cocina igual?")) return;
    }
    const pendientes = x.pedidos.filter((p) => p.estado === "pendiente");
    const ok = await hacer(
      supabase
        .from("pedidos")
        .update({ estado: "nuevo" })
        .in(
          "id",
          pendientes.map((p) => p.id),
        ),
      "Pedido aceptado: va a cocina",
    );
    if (ok) pendientes.forEach((p) => avisarComensal(p.id));
  }

  async function rechazar(x: (typeof lista)[number]) {
    if (!confirm(`¿Rechazar el pedido de ${x.cuenta.cliente_nombre ?? "este cliente"}?`)) return;
    if (x.pagado > 0 && !confirm("Ya pagó online: tendrás que devolverle el dinero desde Mercado Pago. ¿Rechazar igual?")) return;
    const ok = await hacer(
      supabase
        .from("pedidos")
        .update({ estado: "cancelado" })
        .in(
          "id",
          x.pedidos.map((p) => p.id),
        ),
    );
    if (!ok) return;
    await hacer(
      supabase
        .from("cuentas")
        .update({ estado: "anulada", cerrada_at: new Date().toISOString(), aviso: null })
        .eq("id", x.cuenta.id),
      "Pedido rechazado",
    );
    whatsapp(
      x.cuenta,
      `Hola ${x.cuenta.cliente_nombre ?? ""}, lo sentimos: en ${restaurante.nombre} no podemos tomar tu pedido ahora.`,
    );
  }

  async function despachar(x: (typeof lista)[number]) {
    const ok = await hacer(
      supabase.from("cuentas").update({ despachado_at: new Date().toISOString() }).eq("id", x.cuenta.id),
      "Delivery en camino",
    );
    if (ok) avisarEnCamino(x.cuenta.id);
  }

  // Lo retiraron (o llegó el delivery): las comandas quedan entregadas y, si ya está pago, el pedido se cierra.
  async function entregar(x: (typeof lista)[number]) {
    const listos = x.pedidos.filter((p) => p.estado === "listo");
    if (listos.length) {
      const ok = await hacer(
        supabase
          .from("pedidos")
          .update({ estado: "entregado" })
          .in(
            "id",
            listos.map((p) => p.id),
          ),
      );
      if (!ok) return;
    }
    if (x.pagado >= x.total - 0.009) {
      await hacer(
        supabase
          .from("cuentas")
          .update({ estado: "cerrada", cerrada_at: new Date().toISOString(), aviso: null })
          .eq("id", x.cuenta.id),
        "Entregado y cerrado",
      );
    } else if (ajustes.modulos.cobros) {
      setAbierta({ id: x.cuenta.id, inicio: "cobro" });
    } else {
      await hacer(
        supabase
          .from("cuentas")
          .update({ estado: "cerrada", cerrada_at: new Date().toISOString(), aviso: null })
          .eq("id", x.cuenta.id),
        "Entregado",
      );
    }
  }

  const porEtapa = (e: Etapa) =>
    lista.filter((x) => (e === "listo" ? x.etapa === "listo" || x.etapa === "entregado" : x.etapa === e));
  const columnas = COLUMNAS.filter((c) => c.id !== "camino" || ajustes.llevar.delivery || porEtapa("camino").length > 0);
  const elegida = abierta && vivo.cuentas.find((c) => c.id === abierta.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto min-w-0">
          <h1 className="text-xl font-semibold">Para llevar y delivery</h1>
          <p className="flex items-center gap-2 text-sm text-suave">
            <span className={`inline-block h-2 w-2 rounded-full ${vivo.enVivo ? "bg-emerald-500" : "bg-stone-300"}`} />
            {lista.length === 0
              ? "Sin pedidos abiertos"
              : `${lista.length} ${lista.length === 1 ? "pedido abierto" : "pedidos abiertos"}`}
          </p>
        </div>
        {admin && !ajustes.llevar.online && (
          <Link href="/panel/personalizar#llevar" className="text-sm text-marca hover:underline">
            Recibir pedidos desde la carta
          </Link>
        )}
        <button type="button" className="boton" onClick={() => setNuevo(true)}>
          <Icono nombre="mas_simple" className="h-4 w-4" /> Nuevo pedido
        </button>
      </div>

      {lista.length === 0 ? (
        <div className="tarjeta flex flex-col items-center gap-2 p-10 text-center text-sm text-suave">
          <Icono nombre="llevar" className="h-10 w-10 text-stone-300" />
          <p className="max-w-md">
            Aquí llegan los pedidos para llevar y delivery.{" "}
            {ajustes.llevar.online
              ? "Los clientes piden desde la carta (sin escanear el QR de una mesa) y tú los aceptas."
              : "Anota los pedidos por teléfono con “Nuevo pedido”, o enciende los pedidos desde la carta en Personalizar."}
          </p>
        </div>
      ) : (
        <div className={`grid gap-3 md:grid-cols-2 ${columnas.length === 4 ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
          {columnas.map((col) => {
            const items = porEtapa(col.id);
            return (
              <section key={col.id} className="flex min-h-[8rem] flex-col gap-2 rounded-2xl bg-stone-100/60 p-2">
                <header className="flex items-baseline justify-between px-2 pt-1">
                  <h2 className="font-semibold">{col.texto}</h2>
                  <span className="text-sm tabular-nums text-suave">{items.length}</span>
                </header>
                {items.length === 0 && <p className="px-2 pb-2 text-xs text-suave">{col.ayuda}</p>}
                {items.map((x) => (
                  <Tarjeta
                    key={x.cuenta.id}
                    dato={x}
                    ahora={ahora}
                    formato={formato}
                    hora={(iso) => formatoHora(iso, region)}
                    pagoObligatorio={ajustes.llevar.pago_obligatorio}
                    onAbrir={() => setAbierta({ id: x.cuenta.id })}
                    onAceptar={() => aceptar(x)}
                    onRechazar={() => rechazar(x)}
                    onDespachar={() => despachar(x)}
                    onEntregar={() => entregar(x)}
                  />
                ))}
              </section>
            );
          })}
        </div>
      )}

      {nuevo && (
        <NuevoPedido
          restaurante={restaurante}
          ajustes={ajustes}
          sucursales={sucursales}
          supabase={supabase}
          formato={formato}
          onCerrar={() => setNuevo(false)}
          onCreado={async (id) => {
            setNuevo(false);
            await recargar();
            setAbierta({ id, inicio: "pedido" });
          }}
        />
      )}

      {abierta && elegida && (
        <MesaPanel
          key={`${abierta.id}-${abierta.inicio ?? ""}`}
          cuentaId={abierta.id}
          inicio={abierta.inicio}
          restaurante={restaurante}
          ajustes={ajustes}
          admin={admin}
          categorias={categorias}
          platos={platos}
          servicio={vivo}
          onCerrar={() => setAbierta(null)}
        />
      )}
    </div>
  );
}

function Tarjeta({
  dato: x,
  ahora,
  formato,
  hora,
  pagoObligatorio,
  onAbrir,
  onAceptar,
  onRechazar,
  onDespachar,
  onEntregar,
}: {
  dato: { cuenta: Cuenta; pedidos: Pedido[]; total: number; pagado: number; etapa: Etapa };
  ahora: number;
  formato: (n: number) => string;
  hora: (iso: string) => string;
  pagoObligatorio: boolean;
  onAbrir: () => void;
  onAceptar: () => void;
  onRechazar: () => void;
  onDespachar: () => void;
  onEntregar: () => void;
}) {
  const c = x.cuenta;
  const pagado = x.total > 0 && x.pagado >= x.total - 0.009;
  const items = x.pedidos.flatMap((p) => p.pedido_items ?? []);
  const minutos = minutosDesde(c.abierta_at, ahora);
  // Atrasado: ya pasó la hora pedida y todavía no se entregó.
  const tarde = !!c.para_hora && Date.parse(c.para_hora) < ahora && x.etapa !== "camino" && x.etapa !== "entregado";
  const esperandoPago = x.etapa === "aceptar" && pagoObligatorio && c.origen === "cliente" && !pagado;
  return (
    <article className={`tarjeta space-y-2 p-3 ${tarde ? "ring-2 ring-red-400" : ""}`}>
      <button type="button" onClick={onAbrir} className="block w-full text-left">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${c.tipo === "delivery" ? "bg-sky-100 text-sky-800" : "bg-amber-100 text-amber-900"}`}
            title={NOMBRE_TIPO[c.tipo as TipoCuenta]}
          >
            <Icono nombre={c.tipo === "delivery" ? "delivery" : "llevar"} className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{c.cliente_nombre || NOMBRE_TIPO[c.tipo as TipoCuenta]}</span>
            <span className="block text-xs text-suave" suppressHydrationWarning>
              {c.para_hora ? `Para las ${hora(c.para_hora)}` : "Lo antes posible"} · hace {minutos} min
              {x.pedidos[0] ? ` · #${x.pedidos.map((p) => p.numero).join(", #")}` : ""}
            </span>
          </span>
          <span className="text-right">
            <span className="block font-bold tabular-nums">{formato(x.total)}</span>
            <span
              className={`block text-xs font-semibold ${pagado ? "text-emerald-700" : esperandoPago ? "text-red-600" : "text-suave"}`}
            >
              {pagado ? (c.aviso?.tipo === "pago" ? "Pagó online" : "Pagado") : esperandoPago ? "Esperando pago" : "Por cobrar"}
            </span>
          </span>
        </div>
        <p className="mt-1.5 line-clamp-2 text-sm text-suave">
          {items.length ? items.map((i) => `${i.cantidad} ${i.nombre}`).join(", ") : "Sin platos todavía: toca para agregarlos"}
        </p>
        {c.direccion && <p className="mt-1 truncate text-xs text-suave">📍 {c.direccion}</p>}
        {x.pedidos.some((p) => p.nota) && (
          <p className="mt-1 truncate text-xs text-amber-700">{x.pedidos.find((p) => p.nota)?.nota}</p>
        )}
      </button>
      <div className="flex flex-wrap gap-2">
        {x.etapa === "aceptar" && (
          <>
            <button type="button" className="boton flex-1 py-1.5 text-sm" onClick={onAceptar}>
              Aceptar
            </button>
            <button type="button" className="boton-secundario py-1.5 text-sm" onClick={onRechazar}>
              Rechazar
            </button>
          </>
        )}
        {x.etapa === "listo" && c.tipo === "delivery" && (
          <button type="button" className="boton flex-1 bg-sky-600 py-1.5 text-sm hover:bg-sky-700" onClick={onDespachar}>
            <Icono nombre="delivery" className="h-4 w-4" /> Despachar
          </button>
        )}
        {((x.etapa === "listo" && c.tipo === "llevar") || x.etapa === "camino" || x.etapa === "entregado") && (
          <button type="button" className="boton flex-1 bg-emerald-600 py-1.5 text-sm hover:bg-emerald-700" onClick={onEntregar}>
            <Icono nombre="check" className="h-4 w-4" /> {x.etapa === "entregado" && !pagado ? "Cobrar y cerrar" : "Entregado"}
          </button>
        )}
      </div>
    </article>
  );
}

// El personal anota un pedido (por teléfono o en el mostrador). Con el teléfono se completa el cliente si ya vino.
function NuevoPedido({
  restaurante,
  ajustes,
  sucursales,
  supabase,
  formato,
  onCerrar,
  onCreado,
}: {
  restaurante: Restaurante;
  ajustes: Ajustes;
  sucursales: Sucursal[];
  supabase: ReturnType<typeof useServicio>["supabase"];
  formato: (n: number) => string;
  onCerrar: () => void;
  onCreado: (id: string) => void;
}) {
  const avisar = useToast();
  const [tipo, setTipo] = useState<"llevar" | "delivery">("llevar");
  const [telefono, setTelefono] = useState("");
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [cuando, setCuando] = useState<"ya" | "hora">("ya");
  const [hora, setHora] = useState(() => {
    const d = new Date(Date.now() + ajustes.llevar.minutos * 60000);
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
  const [envio, setEnvio] = useState(ajustes.llevar.envio);
  const [sucursal, setSucursal] = useState(sucursales.length > 1 ? sucursales[0].id : (sucursales[0]?.id ?? null));
  const [conocido, setConocido] = useState<ClienteResumen | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Cliente que ya pidió o reservó con ese teléfono: se completan su nombre y su dirección.
  useEffect(() => {
    const digitos = telefono.replace(/\D/g, "");
    if (digitos.length < 8) return setConocido(null);
    const id = setTimeout(async () => {
      const { data } = await supabase
        .from("clientes_resumen")
        .select("*")
        .eq("restaurante_id", restaurante.id)
        .eq("telefono_clave", digitos.slice(-9))
        .maybeSingle();
      const c = (data as ClienteResumen | null) ?? null;
      setConocido(c);
      if (c) {
        setNombre((n) => n || c.nombre);
        setDireccion((d) => d || c.direccion || "");
      }
    }, 300);
    return () => clearTimeout(id);
  }, [telefono, supabase, restaurante.id]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    let paraHora: string | null = null;
    if (cuando === "hora") {
      const [h, m] = hora.split(":").map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      // Si la hora ya pasó hoy, es para mañana.
      if (d.getTime() < Date.now() - 30 * 60000) d.setDate(d.getDate() + 1);
      paraHora = d.toISOString();
    }
    const { data, error } = await supabase
      .from("cuentas")
      .insert({
        restaurante_id: restaurante.id,
        sucursal_id: sucursal,
        tipo,
        comensales: 1,
        cliente_nombre: nombre.trim() || null,
        cliente_telefono: telefono.trim() || null,
        cliente_id: conocido?.id ?? null,
        direccion: tipo === "delivery" ? direccion.trim() || null : null,
        para_hora: paraHora,
        envio: tipo === "delivery" ? Math.max(0, Number(envio) || 0) : 0,
      })
      .select("id")
      .single();
    setGuardando(false);
    if (error) return avisar(mensajeError(error), "error");
    onCreado(data.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCerrar}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Nuevo pedido para llevar"
        onClick={(e) => e.stopPropagation()}
        onSubmit={crear}
        className="max-h-[92vh] w-full max-w-md space-y-3 overflow-y-auto rounded-2xl bg-superficie p-5 shadow-2xl"
      >
        <h2 className="text-lg font-semibold">Nuevo pedido</h2>
        <div className="flex rounded-xl bg-stone-100 p-1 text-sm" role="group" aria-label="Tipo de pedido">
          {(["llevar", "delivery"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tipo === t}
              onClick={() => setTipo(t)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 font-medium ${tipo === t ? "bg-superficie shadow-sm" : "text-suave"}`}
            >
              <Icono nombre={t} className="h-4 w-4" /> {NOMBRE_TIPO[t]}
            </button>
          ))}
        </div>
        <label className="block text-sm">
          Teléfono (WhatsApp)
          <input
            type="tel"
            maxLength={30}
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="9 1234 5678"
            className="campo mt-1"
            autoFocus
          />
          {conocido && (
            <span className="mt-1 block text-xs text-emerald-700">
              Ya es cliente: {conocido.visitas} {conocido.visitas === 1 ? "visita" : "visitas"}
              {conocido.nota ? ` · ${conocido.nota}` : ""}
            </span>
          )}
        </label>
        <label className="block text-sm">
          Nombre
          <input required maxLength={60} value={nombre} onChange={(e) => setNombre(e.target.value)} className="campo mt-1" />
        </label>
        {tipo === "delivery" && (
          <>
            <label className="block text-sm">
              Dirección
              <input
                required
                maxLength={200}
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Calle, número, depto, comuna"
                className="campo mt-1"
              />
            </label>
            <label className="block text-sm">
              Costo de envío
              <input
                type="number"
                min={0}
                step="any"
                value={envio}
                onChange={(e) => setEnvio(Number(e.target.value))}
                className="campo mt-1"
              />
              <span className="mt-1 block text-xs text-suave">
                {envio > 0 ? `Se suma ${formato(envio)} a la cuenta.` : "Gratis"}
              </span>
            </label>
          </>
        )}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span>{tipo === "delivery" ? "Entregar" : "Retira"}</span>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={cuando === "ya"} onChange={() => setCuando("ya")} /> lo antes posible
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={cuando === "hora"} onChange={() => setCuando("hora")} /> a las
            <input
              type="time"
              step={300}
              value={hora}
              onChange={(e) => {
                setHora(e.target.value);
                setCuando("hora");
              }}
              className="rounded-lg border border-borde px-2 py-1"
            />
          </label>
        </div>
        {sucursales.length > 1 && (
          <label className="block text-sm">
            Local
            <select value={sucursal ?? ""} onChange={(e) => setSucursal(e.target.value)} className="campo mt-1">
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="boton-secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" className="boton" disabled={guardando || !nombre.trim()}>
            {guardando ? "Creando…" : "Elegir platos"}
          </button>
        </div>
      </form>
    </div>
  );
}
