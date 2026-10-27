"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { Icono } from "@/components/Icono";
import { nombreMesa, type Ajustes } from "@/lib/salon";
import type { Mesa, Restaurante } from "@/lib/types";
import { mensajeError } from "@/lib/utils";
import { useAhora } from "@/lib/useServicio";

type Estado = "pendiente" | "confirmada" | "avisada" | "sentada" | "cancelada" | "no_vino";
export type Reserva = {
  id: string;
  sucursal_id: string | null;
  tipo: "reserva" | "espera";
  nombre: string;
  telefono: string | null;
  personas: number;
  fecha: string | null;
  estado: Estado;
  mesa_id: string | null;
  nota: string | null;
  origen: "cliente" | "personal";
  avisada_at: string | null;
  created_at: string;
};

const ESTADO: Record<Estado, { texto: string; color: string }> = {
  pendiente: { texto: "Por confirmar", color: "bg-amber-100 text-amber-900" },
  confirmada: { texto: "Confirmada", color: "bg-emerald-100 text-emerald-900" },
  avisada: { texto: "Avisado", color: "bg-sky-100 text-sky-900" },
  sentada: { texto: "Sentados", color: "bg-stone-100 text-stone-600" },
  cancelada: { texto: "Cancelada", color: "bg-stone-100 text-stone-500 line-through" },
  no_vino: { texto: "No vino", color: "bg-red-100 text-red-800" },
};

// WhatsApp necesita el número con código de país. Si lo anotaron sin él, se asume Argentina (54 9).
export function numeroWhatsapp(telefono: string) {
  let d = telefono.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  return d.length <= 10 ? `549${d}` : d;
}

const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
const dia = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });
const mismoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();

// Reservas del día y lista de espera: avisar por WhatsApp cuando la mesa está lista y sentarlos en una mesa libre.
export function Reservas({ restaurante, ajustes }: { restaurante: Restaurante; ajustes: Ajustes }) {
  const supabase = useMemo(() => createClient(), []);
  const avisar = useToast();
  const ahora = useAhora();
  const [lista, setLista] = useState<Reserva[] | null>(null);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [ocupadas, setOcupadas] = useState<Set<string>>(new Set());
  const [falta, setFalta] = useState(false);
  const [vista, setVista] = useState<"espera" | "hoy" | "proximas">("espera");
  const [nueva, setNueva] = useState<null | "espera" | "reserva">(null);
  const [sentando, setSentando] = useState<Reserva | null>(null);

  const cargar = useCallback(async () => {
    const hace12 = new Date(Date.now() - 12 * 3600000).toISOString();
    const inicioHoy = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const [espera, reservas, m, cuentas] = await Promise.all([
      supabase
        .from("reservas")
        .select("*")
        .eq("restaurante_id", restaurante.id)
        .eq("tipo", "espera")
        .gte("created_at", hace12)
        .order("created_at"),
      supabase
        .from("reservas")
        .select("*")
        .eq("restaurante_id", restaurante.id)
        .eq("tipo", "reserva")
        .gte("fecha", inicioHoy)
        .order("fecha")
        .limit(300),
      supabase.from("mesas").select("*").eq("restaurante_id", restaurante.id),
      supabase.from("cuentas").select("mesa_id").eq("restaurante_id", restaurante.id).eq("estado", "abierta"),
    ]);
    if (espera.error) return setFalta(true);
    setLista([...(espera.data ?? []), ...(reservas.data ?? [])] as Reserva[]);
    setMesas((m.data ?? []) as Mesa[]);
    setOcupadas(new Set((cuentas.data ?? []).map((c) => c.mesa_id as string)));
  }, [supabase, restaurante.id]);

  useEffect(() => {
    cargar();
    const canal = supabase
      .channel(`reservas-${restaurante.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservas", filter: `restaurante_id=eq.${restaurante.id}` },
        () => cargar(),
      )
      .subscribe();
    const intervalo = setInterval(cargar, 30000);
    return () => {
      supabase.removeChannel(canal);
      clearInterval(intervalo);
    };
  }, [supabase, restaurante.id, cargar]);

  async function cambiar(r: Reserva, cambios: Partial<Reserva>, texto?: string) {
    setLista((l) => l?.map((x) => (x.id === r.id ? { ...x, ...cambios } : x)) ?? null);
    const { error } = await supabase.from("reservas").update(cambios).eq("id", r.id);
    if (error) {
      avisar(mensajeError(error), "error");
      return cargar();
    }
    if (texto) avisar(texto);
  }

  function whatsapp(r: Reserva, mensaje: string) {
    if (!r.telefono) return;
    window.open(`https://wa.me/${numeroWhatsapp(r.telefono)}?text=${encodeURIComponent(mensaje)}`, "_blank", "noopener");
  }

  function avisarMesaLista(r: Reserva) {
    cambiar(r, { estado: "avisada" }, `${r.nombre}: avisado`);
    whatsapp(r, `Hola ${r.nombre}, tu mesa en ${restaurante.nombre} ya está lista. Te esperamos en la entrada.`);
  }

  function confirmar(r: Reserva) {
    cambiar(r, { estado: "confirmada" }, "Reserva confirmada");
    if (r.fecha)
      whatsapp(
        r,
        `Hola ${r.nombre}, te confirmamos la reserva en ${restaurante.nombre} para ${r.personas} ${r.personas === 1 ? "persona" : "personas"} el ${dia(r.fecha)} a las ${hora(r.fecha)}. ¡Te esperamos!`,
      );
  }

  async function sentar(r: Reserva, mesa: Mesa) {
    const { error } = await supabase.from("cuentas").insert({
      restaurante_id: restaurante.id,
      sucursal_id: mesa.sucursal_id ?? null,
      mesa_id: mesa.id,
      mesa_numero: mesa.numero,
      comensales: Math.min(99, r.personas),
    });
    if (error) {
      return avisar(
        /cuentas_mesa_abierta|duplicate/.test(error.message) ? "Esa mesa ya está ocupada." : mensajeError(error),
        "error",
      );
    }
    setSentando(null);
    await cambiar(r, { estado: "sentada", mesa_id: mesa.id }, `${r.nombre} en ${nombreMesa(mesa.numero)}`);
    cargar();
  }

  if (falta) {
    return (
      <div className="tarjeta mx-auto max-w-lg p-6">
        <h1 className="font-semibold">Falta un paso en la base de datos</h1>
        <p className="mt-2 text-sm text-suave">
          Para usar reservas y lista de espera ejecuta el SQL <code>0009_caja_reservas_cobro_online.sql</code> en Supabase.
        </p>
      </div>
    );
  }

  const hoy = new Date(ahora);
  const espera = (lista ?? []).filter((r) => r.tipo === "espera" && (r.estado === "pendiente" || r.estado === "avisada"));
  const reservas = (lista ?? []).filter((r) => r.tipo === "reserva");
  const deHoy = reservas.filter((r) => r.fecha && mismoDia(new Date(r.fecha), hoy));
  const proximas = reservas.filter((r) => r.fecha && !mismoDia(new Date(r.fecha), hoy) && r.estado !== "cancelada");
  const porConfirmar = reservas.filter((r) => r.estado === "pendiente").length;
  const atrasada = (r: Reserva) =>
    !!r.fecha &&
    (r.estado === "pendiente" || r.estado === "confirmada") &&
    ahora > Date.parse(r.fecha) + ajustes.reservas.tolerancia * 60000;
  const minutos = (iso: string) => Math.max(0, Math.round((ahora - Date.parse(iso)) / 60000));

  const pestanas = [
    { id: "espera" as const, texto: "Lista de espera", n: espera.length },
    { id: "hoy" as const, texto: "Reservas de hoy", n: deHoy.filter((r) => r.estado !== "cancelada").length },
    { id: "proximas" as const, texto: "Próximas", n: proximas.length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold">Reservas y lista de espera</h1>
          <p className="text-sm text-suave">
            {porConfirmar > 0
              ? `${porConfirmar} ${porConfirmar === 1 ? "reserva espera" : "reservas esperan"} tu confirmación.`
              : "Avisa por WhatsApp cuando la mesa está lista y siéntalos con un toque."}
          </p>
        </div>
        <button type="button" className="boton-secundario" onClick={() => setNueva("espera")}>
          + A la lista de espera
        </button>
        <button type="button" className="boton" onClick={() => setNueva("reserva")}>
          + Nueva reserva
        </button>
      </div>

      <nav className="flex gap-1 rounded-xl bg-stone-100 p-1 text-sm" aria-label="Vista">
        {pestanas.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={vista === p.id}
            onClick={() => setVista(p.id)}
            className={`flex-1 rounded-lg px-3 py-2 font-medium ${vista === p.id ? "bg-superficie shadow-sm" : "text-suave hover:text-tinta"}`}
          >
            {p.texto} <span className="tabular-nums text-suave">({p.n})</span>
          </button>
        ))}
      </nav>

      {lista === null ? (
        <p className="tarjeta p-6 text-center text-sm text-suave">Cargando…</p>
      ) : vista === "espera" ? (
        espera.length === 0 ? (
          <Vacio texto="Nadie esperando. Con el QR de la lista de espera (en Código QR) los clientes se anotan solos." />
        ) : (
          <ol className="space-y-2">
            {espera.map((r, i) => (
              <li key={r.id} className="tarjeta flex flex-wrap items-center gap-3 p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-marca/10 font-bold text-marca">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {r.nombre} · {r.personas} {r.personas === 1 ? "persona" : "personas"}
                  </p>
                  <p className="text-sm text-suave">
                    Esperando hace {minutos(r.created_at)} min
                    {r.telefono ? ` · ${r.telefono}` : ""}
                    {r.estado === "avisada" && r.avisada_at ? ` · avisado hace ${minutos(r.avisada_at)} min` : ""}
                  </p>
                </div>
                <Chip estado={r.estado} espera />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#25d366] px-3 py-1.5 text-sm font-semibold text-white"
                    onClick={() => avisarMesaLista(r)}
                  >
                    {r.telefono && <Icono nombre="whatsapp" className="h-4 w-4" />}
                    {r.estado === "avisada" ? "Avisar de nuevo" : r.telefono ? "Mesa lista" : "Marcar avisado"}
                  </button>
                  <button type="button" className="boton-secundario py-1.5 text-sm" onClick={() => setSentando(r)}>
                    Sentar
                  </button>
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1.5 text-sm text-suave hover:text-red-600"
                    onClick={() => cambiar(r, { estado: "cancelada" }, `${r.nombre} salió de la lista`)}
                  >
                    Quitar
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )
      ) : (
        <ListaReservas
          lista={vista === "hoy" ? deHoy : proximas}
          conDia={vista === "proximas"}
          atrasada={atrasada}
          mesas={mesas}
          onConfirmar={confirmar}
          onSentar={setSentando}
          onCambiar={cambiar}
          vacio={
            vista === "hoy"
              ? ajustes.reservas.online
                ? "No hay reservas para hoy."
                : "No hay reservas para hoy. Puedes encender “Reservas desde internet” en Personalizar."
              : "No hay reservas para los próximos días."
          }
        />
      )}

      {nueva && (
        <FormularioReserva
          tipo={nueva}
          onCerrar={() => setNueva(null)}
          onGuardar={async (datos) => {
            const { error } = await supabase.from("reservas").insert({ ...datos, restaurante_id: restaurante.id, tipo: nueva });
            if (error) return avisar(mensajeError(error), "error");
            avisar(nueva === "espera" ? "Anotado en la lista" : "Reserva guardada");
            setNueva(null);
            setVista(
              nueva === "espera" ? "espera" : datos.fecha && mismoDia(new Date(datos.fecha), new Date()) ? "hoy" : "proximas",
            );
            cargar();
          }}
        />
      )}

      {sentando && (
        <ElegirMesa
          reserva={sentando}
          mesas={mesas.filter((m) => !ocupadas.has(m.id) && (!sentando.sucursal_id || m.sucursal_id === sentando.sucursal_id))}
          onElegir={(m) => sentar(sentando, m)}
          onCerrar={() => setSentando(null)}
        />
      )}
    </div>
  );
}

function Chip({ estado, espera = false }: { estado: Estado; espera?: boolean }) {
  // En la lista de espera "pendiente" es simplemente que está esperando.
  const { texto, color } =
    espera && estado === "pendiente" ? { texto: "Esperando", color: "bg-violet-100 text-violet-900" } : ESTADO[estado];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>{texto}</span>;
}

function Vacio({ texto }: { texto: string }) {
  return (
    <div className="tarjeta flex flex-col items-center gap-2 p-8 text-center text-sm text-suave">
      <Icono nombre="reservas" className="h-8 w-8 text-stone-300" />
      {texto}
    </div>
  );
}

function ListaReservas({
  lista,
  conDia,
  atrasada,
  mesas,
  onConfirmar,
  onSentar,
  onCambiar,
  vacio,
}: {
  lista: Reserva[];
  conDia: boolean;
  atrasada: (r: Reserva) => boolean;
  mesas: Mesa[];
  onConfirmar: (r: Reserva) => void;
  onSentar: (r: Reserva) => void;
  onCambiar: (r: Reserva, c: Partial<Reserva>, texto?: string) => void;
  vacio: string;
}) {
  if (lista.length === 0) return <Vacio texto={vacio} />;
  const abierta = (r: Reserva) => r.estado === "pendiente" || r.estado === "confirmada";
  return (
    <ul className="space-y-2">
      {lista.map((r) => {
        const mesa = mesas.find((m) => m.id === r.mesa_id);
        const tarde = atrasada(r);
        return (
          <li
            key={r.id}
            className={`tarjeta flex flex-wrap items-center gap-3 p-4 ${abierta(r) ? "" : "opacity-60"} ${tarde ? "ring-2 ring-red-300" : ""}`}
          >
            <div className="w-16 text-center">
              <p className="text-lg font-bold tabular-nums">{r.fecha ? hora(r.fecha) : "—"}</p>
              {conDia && r.fecha && <p className="text-xs text-suave">{dia(r.fecha)}</p>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {r.nombre} · {r.personas} {r.personas === 1 ? "persona" : "personas"}
                {mesa && <span className="font-normal text-suave"> · {nombreMesa(mesa.numero)}</span>}
              </p>
              <p className="text-sm text-suave">
                {r.telefono ?? "Sin teléfono"}
                {r.origen === "cliente" ? " · reservó desde la carta" : ""}
                {r.nota ? ` · “${r.nota}”` : ""}
              </p>
              {tarde && <p className="text-sm font-semibold text-red-700">Todavía no llegaron</p>}
            </div>
            <Chip estado={r.estado} />
            {abierta(r) && (
              <div className="flex flex-wrap gap-2">
                {r.estado === "pendiente" && (
                  <button type="button" className="boton py-1.5 text-sm" onClick={() => onConfirmar(r)}>
                    Confirmar
                  </button>
                )}
                <button type="button" className="boton-secundario py-1.5 text-sm" onClick={() => onSentar(r)}>
                  Llegaron · sentar
                </button>
                <button
                  type="button"
                  className="rounded-lg px-2 py-1.5 text-sm text-suave hover:text-red-600"
                  onClick={() => onCambiar(r, { estado: "no_vino" }, "Marcada como no vino")}
                >
                  No vino
                </button>
                <button
                  type="button"
                  className="rounded-lg px-2 py-1.5 text-sm text-suave hover:text-red-600"
                  onClick={() =>
                    confirm(`¿Cancelar la reserva de ${r.nombre}?`) && onCambiar(r, { estado: "cancelada" }, "Reserva cancelada")
                  }
                >
                  Cancelar
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

type DatosNueva = { nombre: string; telefono: string | null; personas: number; fecha: string | null; nota: string | null };

function FormularioReserva({
  tipo,
  onGuardar,
  onCerrar,
}: {
  tipo: "espera" | "reserva";
  onGuardar: (d: DatosNueva) => Promise<unknown>;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [personas, setPersonas] = useState(2);
  const [fecha, setFecha] = useState(() => {
    const d = new Date(Date.now() + 3600000);
    d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCerrar}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label={tipo === "espera" ? "Anotar en la lista de espera" : "Nueva reserva"}
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          setGuardando(true);
          await onGuardar({
            nombre: nombre.trim(),
            telefono: telefono.trim() || null,
            personas,
            fecha: tipo === "reserva" ? new Date(fecha).toISOString() : null,
            nota: nota.trim() || null,
          });
          setGuardando(false);
        }}
        className="w-full max-w-md space-y-3 rounded-2xl bg-superficie p-5 shadow-2xl"
      >
        <h2 className="text-lg font-semibold">{tipo === "espera" ? "Anotar en la lista de espera" : "Nueva reserva"}</h2>
        <label className="block text-sm">
          Nombre
          <input
            required
            maxLength={60}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="campo mt-1"
            autoFocus
          />
        </label>
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <label className="block text-sm">
            WhatsApp {tipo === "espera" && <span className="text-suave">(para avisarle)</span>}
            <input
              type="tel"
              maxLength={30}
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="11 2345 6789"
              className="campo mt-1"
            />
          </label>
          <label className="block text-sm">
            Personas
            <input
              type="number"
              min={1}
              max={99}
              value={personas}
              onChange={(e) => setPersonas(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
              className="campo mt-1"
            />
          </label>
        </div>
        {tipo === "reserva" && (
          <label className="block text-sm">
            Día y hora
            <input
              type="datetime-local"
              required
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="campo mt-1"
            />
          </label>
        )}
        <label className="block text-sm">
          Nota <span className="text-suave">(opcional)</span>
          <input
            maxLength={200}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Cumpleaños, silla para bebé, afuera…"
            className="campo mt-1"
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="boton-secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" className="boton" disabled={guardando || !nombre.trim()}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ElegirMesa({
  reserva,
  mesas,
  onElegir,
  onCerrar,
}: {
  reserva: Reserva;
  mesas: Mesa[];
  onElegir: (m: Mesa) => Promise<unknown>;
  onCerrar: () => void;
}) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  // Primero las que tienen lugar justo para el grupo.
  const ordenadas = [...mesas].sort((a, b) => {
    const da = (a.capacidad ?? 4) - reserva.personas;
    const db = (b.capacidad ?? 4) - reserva.personas;
    return (da < 0 ? 100 - da : da) - (db < 0 ? 100 - db : db) || a.numero.localeCompare(b.numero, "es", { numeric: true });
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Elegir mesa"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-superficie shadow-2xl"
      >
        <div className="border-b border-borde p-5 pb-3">
          <h2 className="text-lg font-semibold">¿En qué mesa se sientan?</h2>
          <p className="text-sm text-suave">
            {reserva.nombre} · {reserva.personas} {reserva.personas === 1 ? "persona" : "personas"}. Se abre la mesa en el salón.
          </p>
        </div>
        <div className="grid min-h-0 grid-cols-3 gap-2 overflow-y-auto p-5 sm:grid-cols-4">
          {ordenadas.map((m) => {
            const chica = (m.capacidad ?? 4) < reserva.personas;
            return (
              <button
                key={m.id}
                type="button"
                disabled={!!ocupado}
                onClick={async () => {
                  setOcupado(m.id);
                  await onElegir(m);
                  setOcupado(null);
                }}
                className={`rounded-xl border-2 p-3 text-center transition hover:border-marca ${chica ? "border-dashed border-borde opacity-70" : "border-borde"}`}
              >
                <span className="block font-semibold">{ocupado === m.id ? "…" : nombreMesa(m.numero)}</span>
                <span className="block text-xs text-suave">{m.capacidad ?? "?"} lugares</span>
              </button>
            );
          })}
          {ordenadas.length === 0 && (
            <p className="col-span-full py-6 text-center text-sm text-suave">No hay mesas libres ahora.</p>
          )}
        </div>
      </div>
    </div>
  );
}
