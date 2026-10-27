"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { Icono } from "@/components/Icono";
import { NOMBRE_TIPO, regionDe, type Ajustes, type TipoCuenta } from "@/lib/salon";
import { formatoFecha, numeroWhatsapp, paisDe } from "@/lib/region";
import type { Restaurante } from "@/lib/types";
import { formatoPrecio, mensajeError } from "@/lib/utils";
import { premioDe, type ClienteResumen } from "../salon/ClienteCuenta";

type Filtro = "todos" | "frecuentes" | "premio" | "vuelvan";

const FILTROS: { id: Filtro; texto: string }[] = [
  { id: "todos", texto: "Todos" },
  { id: "frecuentes", texto: "Frecuentes" },
  { id: "premio", texto: "Les toca premio" },
  { id: "vuelvan", texto: "Hace tiempo que no vienen" },
];

const DIA = 86400000;

// Clientes que vuelven: se guardan solos con el teléfono de reservas y pedidos para llevar, o el mesero los anota en
// la mesa. Se ven sus visitas, lo gastado y cuándo vinieron por última vez, para premiarlos o invitarlos a volver.
export function Clientes({
  restaurante,
  admin,
  ajustes,
  iniciales,
}: {
  restaurante: Restaurante;
  admin: boolean;
  ajustes: Ajustes;
  iniciales: ClienteResumen[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const avisar = useToast();
  const region = regionDe(ajustes);
  const formato = (n: number) => formatoPrecio(n, restaurante.moneda);
  const [lista, setLista] = useState(iniciales);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [elegido, setElegido] = useState<ClienteResumen | "nuevo" | null>(null);
  const [ahora] = useState(() => Date.now());

  async function recargar() {
    const { data } = await supabase
      .from("clientes_resumen")
      .select("*")
      .eq("restaurante_id", restaurante.id)
      .order("visitas", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(3000);
    if (data) setLista(data as ClienteResumen[]);
  }

  const visibles = useMemo(() => {
    const texto = q.trim().toLowerCase();
    const digitos = texto.replace(/\D/g, "");
    return lista.filter((c) => {
      if (
        texto &&
        !c.nombre.toLowerCase().includes(texto) &&
        !(digitos.length >= 3 && c.telefono?.replace(/\D/g, "").includes(digitos))
      )
        return false;
      if (filtro === "frecuentes") return c.visitas >= 3;
      if (filtro === "premio") return !!premioDe(c, ajustes)?.toca;
      if (filtro === "vuelvan") return c.visitas >= 2 && !!c.ultima_visita && ahora - Date.parse(c.ultima_visita) > 30 * DIA;
      return true;
    });
  }, [lista, q, filtro, ajustes, ahora]);

  const frecuentes = lista.filter((c) => c.visitas >= 3).length;
  const conPremio = ajustes.clientes.premio_cada >= 2;

  function exportar() {
    const filas = [
      ["Nombre", "Teléfono", "Correo", "Dirección", "Visitas", "Gastado", "Última visita", "Reservas", "No vino", "Nota"],
      ...visibles.map((c) => [
        c.nombre,
        c.telefono ?? "",
        c.email ?? "",
        c.direccion ?? "",
        String(c.visitas),
        String(c.gastado),
        c.ultima_visita ? formatoFecha(c.ultima_visita, region, { year: "numeric", month: "2-digit", day: "2-digit" }) : "",
        String(c.reservas),
        String(c.no_vino),
        c.nota ?? "",
      ]),
    ];
    const csv = filas.map((f) => f.map((v) => `"${v.replace(/"/g, '""')}"`).join(";")).join("\n");
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    enlace.download = `clientes-${restaurante.slug}.csv`;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto min-w-0">
          <h1 className="text-xl font-semibold">Clientes</h1>
          <p className="text-sm text-suave">
            {lista.length} {lista.length === 1 ? "cliente" : "clientes"} · {frecuentes}{" "}
            {frecuentes === 1 ? "frecuente" : "frecuentes"} (3 visitas o más)
          </p>
        </div>
        <button type="button" className="boton-secundario" onClick={exportar} disabled={!visibles.length}>
          Descargar lista
        </button>
        <button type="button" className="boton" onClick={() => setElegido("nuevo")}>
          + Cliente
        </button>
      </div>

      {!conPremio && admin && (
        <Link
          href="/panel/personalizar#clientes"
          className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 hover:border-emerald-400"
        >
          <Icono nombre="regalo" className="h-5 w-5 shrink-0" />
          Premia a los que vuelven: elige en Personalizar cada cuántas visitas les toca un regalo y el mesero lo ve al atenderlos.
        </Link>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o teléfono…"
          className="campo w-full max-w-xs py-2 text-sm"
        />
        <div className="flex flex-wrap gap-1.5">
          {FILTROS.filter((f) => f.id !== "premio" || conPremio).map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filtro === f.id}
              onClick={() => setFiltro(f.id)}
              className={`rounded-full px-3 py-1.5 text-sm ${filtro === f.id ? "bg-tinta text-white" : "bg-stone-100 text-suave hover:text-tinta"}`}
            >
              {f.texto}
            </button>
          ))}
        </div>
      </div>

      {visibles.length === 0 ? (
        <div className="tarjeta flex flex-col items-center gap-2 p-10 text-center text-sm text-suave">
          <Icono nombre="clientes" className="h-10 w-10 text-stone-300" />
          <p className="max-w-md">
            {lista.length === 0
              ? "Todavía no hay clientes. Se guardan solos con el teléfono de las reservas y los pedidos para llevar, y el mesero puede anotarlos en la ficha de la mesa."
              : "Nadie coincide con la búsqueda."}
          </p>
        </div>
      ) : (
        <ul className="tarjeta divide-y divide-borde">
          {visibles.slice(0, 300).map((c) => {
            const premio = premioDe(c, ajustes);
            const dias = c.ultima_visita ? Math.floor((ahora - Date.parse(c.ultima_visita)) / DIA) : null;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setElegido(c)}
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-stone-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-semibold">
                      <span className="truncate">{c.nombre}</span>
                      {c.visitas >= 3 && (
                        <span className="rounded-full bg-amber-100 px-2 text-xs font-semibold text-amber-900">Frecuente</span>
                      )}
                      {premio?.toca && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 text-xs font-semibold text-emerald-800">
                          <Icono nombre="regalo" className="h-3 w-3" /> Premio
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-sm text-suave">
                      {[c.telefono, c.nota].filter(Boolean).join(" · ") || "Sin teléfono"}
                    </span>
                  </span>
                  <span className="w-20 text-right">
                    <span className="block font-semibold tabular-nums">{c.visitas}</span>
                    <span className="block text-xs text-suave">{c.visitas === 1 ? "visita" : "visitas"}</span>
                  </span>
                  <span className="w-28 text-right">
                    <span className="block font-semibold tabular-nums">{formato(Number(c.gastado))}</span>
                    <span className="block text-xs text-suave">gastado</span>
                  </span>
                  <span className="w-28 text-right text-sm text-suave">
                    {dias === null ? "Sin visitas" : dias === 0 ? "Vino hoy" : `Hace ${dias} ${dias === 1 ? "día" : "días"}`}
                    {c.no_vino > 0 && <span className="block text-xs text-red-700">{c.no_vino} no vino</span>}
                  </span>
                </button>
              </li>
            );
          })}
          {visibles.length > 300 && (
            <li className="px-4 py-3 text-center text-sm text-suave">
              Y {visibles.length - 300} más: usa el buscador o descarga la lista.
            </li>
          )}
        </ul>
      )}

      {elegido && (
        <FichaCliente
          cliente={elegido === "nuevo" ? null : elegido}
          restaurante={restaurante}
          ajustes={ajustes}
          admin={admin}
          supabase={supabase}
          formato={formato}
          onCerrar={() => setElegido(null)}
          onGuardado={async (texto) => {
            setElegido(null);
            avisar(texto);
            await recargar();
          }}
          onError={(e) => avisar(e, "error")}
        />
      )}
    </div>
  );
}

type Visita = { id: string; tipo: TipoCuenta; cerrada_at: string; comensales: number; pagos: { monto: number }[] };

function FichaCliente({
  cliente,
  restaurante,
  ajustes,
  admin,
  supabase,
  formato,
  onCerrar,
  onGuardado,
  onError,
}: {
  cliente: ClienteResumen | null;
  restaurante: Restaurante;
  ajustes: Ajustes;
  admin: boolean;
  supabase: ReturnType<typeof createClient>;
  formato: (n: number) => string;
  onCerrar: () => void;
  onGuardado: (texto: string) => void;
  onError: (texto: string) => void;
}) {
  const region = regionDe(ajustes);
  const [nombre, setNombre] = useState(cliente?.nombre ?? "");
  const [telefono, setTelefono] = useState(cliente?.telefono ?? "");
  const [email, setEmail] = useState(cliente?.email ?? "");
  const [direccion, setDireccion] = useState(cliente?.direccion ?? "");
  const [nota, setNota] = useState(cliente?.nota ?? "");
  const [guardando, setGuardando] = useState(false);
  const [visitas, setVisitas] = useState<Visita[] | null>(null);

  useEffect(() => {
    if (!cliente) return;
    supabase
      .from("cuentas")
      .select("id, tipo, cerrada_at, comensales, pagos(monto)")
      .eq("cliente_id", cliente.id)
      .eq("estado", "cerrada")
      .order("cerrada_at", { ascending: false })
      .limit(10)
      .then(({ data }) => setVisitas((data ?? []) as Visita[]));
  }, [supabase, cliente]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    const datos = {
      nombre: nombre.trim(),
      telefono: telefono.trim() || null,
      email: email.trim() || null,
      direccion: direccion.trim() || null,
      nota: nota.trim() || null,
    };
    const { error } = cliente
      ? await supabase.from("clientes").update(datos).eq("id", cliente.id)
      : await supabase.from("clientes").insert({ ...datos, restaurante_id: restaurante.id });
    setGuardando(false);
    if (error)
      return onError(
        /clientes_telefono|duplicate/.test(error.message) ? "Ya hay un cliente con ese teléfono." : mensajeError(error),
      );
    onGuardado(cliente ? "Cliente guardado" : "Cliente anotado");
  }

  async function borrar() {
    if (!cliente || !confirm(`¿Borrar a ${cliente.nombre}? Sus visitas quedan en la caja, pero ya no se cuentan como suyas.`))
      return;
    const { error } = await supabase.from("clientes").delete().eq("id", cliente.id);
    if (error) return onError(mensajeError(error));
    onGuardado("Cliente borrado");
  }

  const premio = cliente && premioDe(cliente, ajustes);
  const wa = (mensaje: string) =>
    cliente?.telefono &&
    `https://wa.me/${numeroWhatsapp(cliente.telefono, paisDe(ajustes.pais))}?text=${encodeURIComponent(mensaje)}`;
  const nombreCorto = cliente?.nombre.split(" ")[0] ?? "";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={cliente?.nombre ?? "Nuevo cliente"}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-superficie shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-borde px-5 py-4">
          <p className="min-w-0 flex-1 truncate text-xl font-bold">{cliente?.nombre ?? "Nuevo cliente"}</p>
          <button type="button" onClick={onCerrar} className="rounded-lg p-2 text-suave hover:bg-stone-100" aria-label="Cerrar">
            <Icono nombre="cerrar" />
          </button>
        </div>

        {cliente && (
          <div className="grid grid-cols-3 gap-2 border-b border-borde px-5 py-4 text-center">
            <Dato valor={String(cliente.visitas)} texto={cliente.visitas === 1 ? "visita" : "visitas"} />
            <Dato valor={formato(Number(cliente.gastado))} texto="gastado" />
            <Dato valor={cliente.visitas ? formato(Number(cliente.gastado) / cliente.visitas) : "—"} texto="por visita" />
            {cliente.reservas > 0 && <Dato valor={String(cliente.reservas)} texto="reservas" />}
            {cliente.no_vino > 0 && <Dato valor={String(cliente.no_vino)} texto="no vino" />}
          </div>
        )}

        <div className="space-y-4 px-5 py-4">
          {premio && (
            <p
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${premio.toca ? "bg-emerald-50 font-semibold text-emerald-800" : "bg-stone-50 text-suave"}`}
            >
              <Icono nombre="regalo" className="h-4 w-4" />
              {premio.toca
                ? `En su próxima visita le toca ${premio.premio}.`
                : `Le faltan ${premio.faltan} ${premio.faltan === 1 ? "visita" : "visitas"} para ${premio.premio}.`}
            </p>
          )}

          {cliente?.telefono && (
            <div className="flex flex-wrap gap-2">
              <a
                href={wa(`Hola ${nombreCorto}, ¡te extrañamos en ${restaurante.nombre}! Te esperamos pronto.`) || undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#25d366] px-3 py-1.5 text-sm font-semibold text-white"
              >
                <Icono nombre="whatsapp" className="h-4 w-4" /> Invitar a volver
              </a>
              {premio?.toca && (
                <a
                  href={
                    wa(
                      `Hola ${nombreCorto}, gracias por elegirnos tantas veces. En tu próxima visita a ${restaurante.nombre} te regalamos ${premio.premio}.`,
                    ) || undefined
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-borde px-3 py-1.5 text-sm font-semibold hover:border-emerald-500"
                >
                  <Icono nombre="regalo" className="h-4 w-4" /> Avisar del premio
                </a>
              )}
            </div>
          )}

          <form id="form-cliente" onSubmit={guardar} className="space-y-3">
            <label className="block text-sm">
              Nombre
              <input required maxLength={60} value={nombre} onChange={(e) => setNombre(e.target.value)} className="campo mt-1" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                Teléfono
                <input
                  type="tel"
                  maxLength={30}
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="campo mt-1"
                />
              </label>
              <label className="block text-sm">
                Correo
                <input
                  type="email"
                  maxLength={120}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="campo mt-1"
                />
              </label>
            </div>
            <label className="block text-sm">
              Dirección <span className="text-suave">(para delivery)</span>
              <input maxLength={200} value={direccion} onChange={(e) => setDireccion(e.target.value)} className="campo mt-1" />
            </label>
            <label className="block text-sm">
              Nota para el equipo
              <textarea
                maxLength={300}
                rows={2}
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Alérgico al maní, le gusta la mesa de la ventana…"
                className="campo mt-1 resize-none"
              />
            </label>
          </form>

          {cliente && (
            <div>
              <p className="mb-1.5 text-sm font-semibold">Últimas visitas</p>
              {visitas === null ? (
                <p className="text-sm text-suave">Cargando…</p>
              ) : visitas.length === 0 ? (
                <p className="text-sm text-suave">Todavía no tiene visitas cerradas.</p>
              ) : (
                <ul className="divide-y divide-borde rounded-xl border border-borde text-sm">
                  {visitas.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span>
                        {formatoFecha(v.cerrada_at, region, { weekday: "short", day: "numeric", month: "short" })}
                        <span className="text-suave"> · {v.tipo === "mesa" ? `${v.comensales} pers.` : NOMBRE_TIPO[v.tipo]}</span>
                      </span>
                      <span className="tabular-nums">{formato(v.pagos.reduce((t, p) => t + Number(p.monto), 0))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="mt-auto flex gap-2 border-t border-borde px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          {cliente && admin && (
            <button type="button" className="boton-secundario text-red-600" onClick={borrar}>
              Borrar
            </button>
          )}
          <button type="submit" form="form-cliente" className="boton flex-1 py-3" disabled={guardando || !nombre.trim()}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Dato({ valor, texto }: { valor: string; texto: string }) {
  return (
    <div className="rounded-xl bg-stone-50 px-2 py-2">
      <p className="truncate font-bold tabular-nums">{valor}</p>
      <p className="text-xs text-suave">{texto}</p>
    </div>
  );
}
