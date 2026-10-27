"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { Icono } from "@/components/Icono";
import { ELEMENTOS, type Ajustes, type Elemento, type Piso, type TipoElemento } from "@/lib/salon";
import type { Categoria, Mesa, Plato, Restaurante, Sucursal } from "@/lib/types";
import { formatoPrecio, mensajeError } from "@/lib/utils";
import { totalLineas } from "@/lib/cuenta";
import { sonar } from "@/lib/sonidos";
import { minutosDesde, useAhora, useServicio, type DatosServicio } from "@/lib/useServicio";
import { cajaMesa, lugarLibre, Plano, primerHueco, tamanoPara, type Caja, type EstadoMesa, type Seleccion } from "./Plano";
import { MesaPanel } from "./MesaPanel";

type Props = {
  restaurante: Restaurante;
  admin: boolean;
  ajustes: Ajustes;
  pisosIniciales: Piso[];
  mesasIniciales: Mesa[];
  sucursales: Sucursal[];
  categorias: Categoria[];
  platos: Plato[];
  servicio: DatosServicio;
};

const nuevoId = () => Math.random().toString(36).slice(2, 10);

export function Salon({
  restaurante,
  admin,
  ajustes,
  pisosIniciales,
  mesasIniciales,
  sucursales,
  categorias,
  platos,
  servicio,
}: Props) {
  const avisar = useToast();
  const servicioVivo = useServicio(restaurante.id, servicio);
  const { supabase, cuentas, pedidos } = servicioVivo;
  const ahora = useAhora();
  const formato = (n: number) => formatoPrecio(n, restaurante.moneda);

  const [pisos, setPisos] = useState(pisosIniciales);
  const [mesas, setMesas] = useState(mesasIniciales);
  const [sucursalId, setSucursalId] = useState<string | null>(sucursales.length > 1 ? sucursales[0].id : null);
  const delLocal = <T extends { sucursal_id?: string | null }>(x: T) =>
    !sucursalId || !x.sucursal_id || x.sucursal_id === sucursalId;
  const pisosVisibles = pisos.filter(delLocal);
  const [pisoId, setPisoId] = useState<string | null>(pisosVisibles[0]?.id ?? null);
  const piso = pisosVisibles.find((p) => p.id === pisoId) ?? pisosVisibles[0] ?? null;
  const [vista, setVista] = useState<"plano" | "lista">(pisos.length ? "plano" : "lista");
  const [editando, setEditando] = useState(false);
  const avisosOidos = useRef<Set<string> | null>(null);

  // En el teléfono se empieza por la lista: el plano completo se ve mejor en tableta o computadora.
  useEffect(() => {
    if (window.innerWidth < 640) setVista("lista");
  }, []);
  const [seleccion, setSeleccion] = useState<Seleccion>(null);
  const [mesaAbierta, setMesaAbierta] = useState<string | null>(null);

  const mesasLocal = mesas.filter(delLocal);
  const sinUbicar = mesasLocal.filter((m) => !m.piso_id || !pisos.some((p) => p.id === m.piso_id));

  // Cómo está cada mesa: libre, ocupada, con pedido listo, con aviso del cliente…
  const estados = useMemo(() => {
    const mapa = new Map<string, EstadoMesa>();
    for (const c of cuentas) {
      if (!c.mesa_id) continue;
      const suyos = pedidos.filter((p) => p.cuenta_id === c.id && p.estado !== "cancelado");
      mapa.set(c.mesa_id, {
        ocupada: true,
        comensales: c.comensales,
        minutos: minutosDesde(c.abierta_at, ahora),
        total: totalLineas(suyos.flatMap((p) => p.pedido_items ?? [])),
        listo: suyos.some((p) => p.estado === "listo"),
        pendiente: suyos.some((p) => p.estado === "pendiente"),
        aviso: c.aviso?.tipo ?? null,
      });
    }
    return mapa;
  }, [cuentas, pedidos, ahora]);

  // Suena cuando una mesa llama al mesero o pide la cuenta (no al abrir la pantalla). Cada aviso suena distinto.
  useEffect(() => {
    const actuales = cuentas.filter((c) => c.aviso).map((c) => ({ clave: `${c.id}:${c.aviso!.at}`, tipo: c.aviso!.tipo }));
    if (avisosOidos.current === null) {
      avisosOidos.current = new Set(actuales.map((a) => a.clave));
      return;
    }
    const nuevos = actuales.filter((a) => !avisosOidos.current!.has(a.clave));
    nuevos.forEach((a) => avisosOidos.current!.add(a.clave));
    if (nuevos.some((a) => a.tipo === "cuenta")) sonar("cuenta");
    else if (nuevos.length) sonar("mozo");
  }, [cuentas]);

  const ocupadas = mesasLocal.filter((m) => estados.get(m.id)?.ocupada).length;
  const avisos = mesasLocal.filter((m) => estados.get(m.id)?.aviso || estados.get(m.id)?.pendiente);

  // ── Edición del plano (solo administrador) ─────────────

  async function guardar(promesa: PromiseLike<{ error: unknown }>, deshacer?: () => void) {
    const { error } = await promesa;
    if (error) {
      deshacer?.();
      avisar(mensajeError(error), "error");
      return false;
    }
    return true;
  }

  async function agregarPiso() {
    const nombre = prompt("Nombre del piso o salón", pisos.length ? "Planta alta" : "Planta baja")?.trim();
    if (!nombre) return;
    const { data, error } = await supabase
      .from("pisos")
      .insert({ restaurante_id: restaurante.id, sucursal_id: sucursalId, nombre: nombre.slice(0, 40), orden: pisos.length })
      .select()
      .single();
    if (error) return avisar(mensajeError(error), "error");
    setPisos((p) => [...p, data as Piso]);
    setPisoId(data.id);
    setVista("plano");
    setEditando(true);
  }

  function actualizarPiso(cambios: Partial<Piso>) {
    if (!piso) return;
    const antes = pisos;
    setPisos((ps) => ps.map((p) => (p.id === piso.id ? { ...p, ...cambios } : p)));
    return guardar(supabase.from("pisos").update(cambios).eq("id", piso.id), () => setPisos(antes));
  }

  async function borrarPiso() {
    if (!piso) return;
    const cuantas = mesas.filter((m) => m.piso_id === piso.id).length;
    if (!confirm(`¿Borrar "${piso.nombre}"?${cuantas ? ` Sus ${cuantas} mesas quedan sin ubicar (no se borran).` : ""}`)) return;
    if (await guardar(supabase.from("pisos").delete().eq("id", piso.id))) {
      setPisos((ps) => ps.filter((p) => p.id !== piso.id));
      setMesas((ms) => ms.map((m) => (m.piso_id === piso.id ? { ...m, piso_id: null } : m)));
      setPisoId(null);
    }
  }

  function siguienteNumero() {
    const numeros = mesas.map((m) => parseInt(m.numero, 10)).filter((n) => Number.isFinite(n));
    return String((numeros.length ? Math.max(...numeros) : 0) + 1);
  }

  async function agregarMesa(forma: NonNullable<Mesa["forma"]>, capacidad: number) {
    if (!piso) return;
    const { ancho, alto } = tamanoPara(forma, capacidad);
    const lugar = primerHueco(ancho, alto, piso, mesas, true);
    if (!lugar) return avisar("No queda lugar libre en este piso. Agrándalo o mueve algo.", "error");
    const { data, error } = await supabase
      .from("mesas")
      .insert({
        restaurante_id: restaurante.id,
        sucursal_id: piso.sucursal_id ?? sucursalId,
        numero: siguienteNumero(),
        piso_id: piso.id,
        forma,
        capacidad,
        ...lugar,
      })
      .select()
      .single();
    if (error) return avisar(mensajeError(error), "error");
    setMesas((m) => [...m, data as Mesa]);
    setSeleccion({ tipo: "mesa", id: data.id });
  }

  async function ubicarMesa(mesa: Mesa) {
    if (!piso) return;
    const { ancho, alto } = { ancho: mesa.ancho ?? 2, alto: mesa.alto ?? 2 };
    const lugar = primerHueco(ancho, alto, piso, mesas, true);
    if (!lugar) return avisar("No queda lugar libre en este piso.", "error");
    await actualizarMesa(mesa.id, { piso_id: piso.id, x: lugar.x, y: lugar.y });
    setSeleccion({ tipo: "mesa", id: mesa.id });
  }

  function actualizarMesa(id: string, cambios: Partial<Mesa>) {
    const antes = mesas;
    setMesas((ms) => ms.map((m) => (m.id === id ? { ...m, ...cambios } : m)));
    return guardar(supabase.from("mesas").update(cambios).eq("id", id), () => setMesas(antes));
  }

  // Cambia el tamaño de una mesa solo si en el nuevo tamaño no pisa nada.
  function redimensionarMesa(mesa: Mesa, cambios: Partial<Mesa>) {
    const nueva = { ...mesa, ...cambios };
    if (piso && mesa.piso_id === piso.id && !lugarLibre(cajaMesa(nueva), piso, mesas, mesa.id)) {
      // Si la capacidad cambió pero no entra más grande, se guarda la capacidad y se deja el tamaño.
      if (cambios.capacidad !== undefined) return actualizarMesa(mesa.id, { capacidad: cambios.capacidad });
      return avisar("No entra: hay algo al lado. Muévela primero.", "error");
    }
    return actualizarMesa(mesa.id, cambios);
  }

  async function borrarMesa(mesa: Mesa) {
    if (estados.get(mesa.id)?.ocupada) return avisar("La mesa está ocupada. Ciérrala antes de borrarla.", "error");
    if (!confirm(`¿Borrar la mesa ${mesa.numero}? Su QR impreso dejará de identificar la mesa.`)) return;
    if (await guardar(supabase.from("mesas").delete().eq("id", mesa.id))) {
      setMesas((ms) => ms.filter((m) => m.id !== mesa.id));
      setSeleccion(null);
    }
  }

  function guardarElementos(elementos: Elemento[]) {
    return actualizarPiso({ elementos });
  }

  function agregarElemento(tipo: TipoElemento) {
    if (!piso) return;
    const { ancho, alto } = ELEMENTOS[tipo];
    const lugar = primerHueco(ancho, alto, piso, mesas, false) ?? { x: 0, y: 0, ancho, alto };
    const el: Elemento = { id: nuevoId(), tipo, ...lugar };
    guardarElementos([...piso.elementos, el]);
    setSeleccion({ tipo: "elemento", id: el.id });
  }

  function actualizarElemento(id: string, cambios: Partial<Elemento>) {
    if (!piso) return;
    guardarElementos(piso.elementos.map((e) => (e.id === id ? { ...e, ...cambios } : e)));
  }

  function mover(tipo: "mesa" | "elemento", id: string, caja: Caja) {
    if (tipo === "mesa") actualizarMesa(id, { x: caja.x, y: caja.y });
    else actualizarElemento(id, { x: caja.x, y: caja.y });
  }

  const mesaElegida = seleccion?.tipo === "mesa" ? mesas.find((m) => m.id === seleccion.id) : undefined;
  const elementoElegido = seleccion?.tipo === "elemento" ? piso?.elementos.find((e) => e.id === seleccion.id) : undefined;
  const abierta = mesas.find((m) => m.id === mesaAbierta);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-semibold">Salón</h1>
          <p className="flex items-center gap-2 text-sm text-suave">
            <span className={`inline-block h-2 w-2 rounded-full ${servicioVivo.enVivo ? "bg-emerald-500" : "bg-stone-300"}`} />
            {ocupadas} de {mesasLocal.length} mesas ocupadas
          </p>
        </div>
        {sucursales.length > 1 && (
          <select
            value={sucursalId ?? ""}
            onChange={(e) => {
              setSucursalId(e.target.value);
              setPisoId(null);
            }}
            className="campo w-auto py-2 text-sm"
            aria-label="Sucursal"
          >
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        )}
        <div className="flex rounded-xl bg-stone-100 p-1 text-sm" role="tablist" aria-label="Vista">
          {(["plano", "lista"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={vista === v}
              onClick={() => setVista(v)}
              className={`rounded-lg px-3 py-1.5 font-medium ${vista === v ? "bg-superficie shadow-sm" : "text-suave hover:text-tinta"}`}
            >
              {v === "plano" ? "Plano" : "Lista"}
            </button>
          ))}
        </div>
        {admin && vista === "plano" && piso && (
          <button
            type="button"
            onClick={() => {
              setEditando(!editando);
              setSeleccion(null);
            }}
            className={editando ? "boton" : "boton-secundario"}
          >
            <Icono nombre={editando ? "check" : "lapiz"} className="h-4 w-4" />
            {editando ? "Listo" : "Editar plano"}
          </button>
        )}
      </div>

      {avisos.length > 0 && !editando && (
        <div className="flex flex-wrap gap-2">
          {avisos.map((m) => {
            const e = estados.get(m.id)!;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMesaAbierta(m.id)}
                className={`inline-flex animate-pulse items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold text-white ${
                  e.aviso === "cuenta" ? "bg-violet-600" : e.aviso ? "bg-sky-600" : "bg-red-600"
                }`}
              >
                {e.aviso === "cuenta" ? (
                  <span className="text-base leading-none">$</span>
                ) : (
                  <Icono nombre="campana" className="h-4 w-4" />
                )}
                Mesa {m.numero}:{" "}
                {e.aviso === "cuenta" ? "pide la cuenta" : e.aviso === "mozo" ? "llama al mesero" : "pedido por confirmar"}
              </button>
            );
          })}
        </div>
      )}

      {vista === "plano" && (
        <>
          {(pisosVisibles.length > 0 || admin) && (
            <div className="flex flex-wrap items-center gap-2">
              {pisosVisibles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPisoId(p.id);
                    setSeleccion(null);
                  }}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
                    piso?.id === p.id
                      ? "border-tinta bg-tinta text-white"
                      : "border-borde bg-superficie text-stone-600 hover:border-stone-400"
                  }`}
                >
                  {p.nombre}
                  <span className="ml-1.5 text-xs opacity-60">
                    {mesas.filter((m) => m.piso_id === p.id && estados.get(m.id)?.ocupada).length}/
                    {mesas.filter((m) => m.piso_id === p.id).length}
                  </span>
                </button>
              ))}
              {admin && (
                <button
                  type="button"
                  onClick={agregarPiso}
                  className="rounded-full border border-dashed border-stone-300 px-4 py-1.5 text-sm text-suave hover:border-marca hover:text-marca"
                >
                  + Piso o salón
                </button>
              )}
            </div>
          )}

          {!piso ? (
            <div className="tarjeta p-8 text-center">
              <p className="text-lg font-semibold">Arma el plano de tu local</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-suave">
                Crea un piso (o salón, terraza, patio) y arrastra las mesas a su lugar. Puedes tener varios pisos y marcar
                pasillos, barra, baños y escaleras.
              </p>
              {admin ? (
                <button type="button" onClick={agregarPiso} className="boton mt-4">
                  Crear el primer piso
                </button>
              ) : (
                <p className="mt-3 text-sm text-suave">Pídele al administrador que lo arme. Mientras tanto usa la vista Lista.</p>
              )}
            </div>
          ) : (
            <div className={`grid gap-4 ${editando ? "xl:grid-cols-[1fr_300px]" : ""}`}>
              <div className="space-y-3">
                <Plano
                  piso={piso}
                  mesas={mesas}
                  estados={estados}
                  editando={editando}
                  seleccion={seleccion}
                  onSeleccionar={setSeleccion}
                  onMover={mover}
                  onAbrirMesa={setMesaAbierta}
                  formato={formato}
                />
                {!editando && <Leyenda />}
              </div>
              {editando && (
                <PanelEdicion
                  piso={piso}
                  sinUbicar={sinUbicar}
                  mesa={mesaElegida}
                  elemento={elementoElegido}
                  onPiso={actualizarPiso}
                  onBorrarPiso={borrarPiso}
                  onAgregarMesa={agregarMesa}
                  onUbicar={ubicarMesa}
                  onMesa={redimensionarMesa}
                  onQuitarMesa={(m) => {
                    actualizarMesa(m.id, { piso_id: null });
                    setSeleccion(null);
                  }}
                  onBorrarMesa={borrarMesa}
                  onAgregarElemento={agregarElemento}
                  onElemento={actualizarElemento}
                  onBorrarElemento={(id) => {
                    guardarElementos(piso.elementos.filter((e) => e.id !== id));
                    setSeleccion(null);
                  }}
                />
              )}
            </div>
          )}

          {!editando && sinUbicar.length > 0 && (
            <div className="tarjeta p-4">
              <p className="mb-2 text-sm font-medium text-suave">
                Mesas sin lugar en el plano{admin ? " (ubícalas con Editar plano)" : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                {sinUbicar.map((m) => (
                  <BotonMesa
                    key={m.id}
                    mesa={m}
                    estado={estados.get(m.id)}
                    onClick={() => setMesaAbierta(m.id)}
                    formato={formato}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {vista === "lista" && (
        <div className="space-y-5">
          {[...pisosVisibles, null].map((p) => {
            const lista = p ? mesasLocal.filter((m) => m.piso_id === p.id) : sinUbicar;
            if (lista.length === 0) return null;
            return (
              <section key={p?.id ?? "sin"}>
                {(pisosVisibles.length > 0 || !p) && (
                  <h2 className="mb-2 text-sm font-semibold text-suave">
                    {p ? p.nombre : pisosVisibles.length ? "Sin ubicar" : "Mesas"}
                  </h2>
                )}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                  {lista
                    .sort((a, b) => a.numero.localeCompare(b.numero, "es", { numeric: true }))
                    .map((m) => (
                      <BotonMesa
                        key={m.id}
                        mesa={m}
                        estado={estados.get(m.id)}
                        onClick={() => setMesaAbierta(m.id)}
                        formato={formato}
                        grande
                      />
                    ))}
                </div>
              </section>
            );
          })}
          {mesasLocal.length === 0 && (
            <p className="tarjeta p-6 text-center text-sm text-suave">
              Todavía no hay mesas.{" "}
              {admin ? "Créalas desde el plano o desde la sección QR." : "Pídele al administrador que las cree."}
            </p>
          )}
        </div>
      )}

      {abierta && (
        <MesaPanel
          key={abierta.id}
          mesa={abierta}
          piso={pisos.find((p) => p.id === abierta.piso_id)?.nombre}
          restaurante={restaurante}
          ajustes={ajustes}
          admin={admin}
          categorias={categorias}
          platos={platos}
          servicio={servicioVivo}
          onCerrar={() => setMesaAbierta(null)}
        />
      )}
    </div>
  );
}

function Leyenda() {
  const items = [
    ["bg-superficie border-stone-300", "Libre"],
    ["bg-amber-50 border-amber-500", "Ocupada"],
    ["bg-emerald-50 border-emerald-500", "Pedido listo para llevar"],
    ["bg-sky-50 border-sky-500", "Pide la cuenta o llama"],
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-suave">
      {items.map(([c, t]) => (
        <span key={t} className="inline-flex items-center gap-1.5">
          <span className={`inline-block h-3 w-3 rounded border-2 ${c}`} /> {t}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-600 text-[8px] text-white">
          ●
        </span>
        Pedido del cliente por confirmar
      </span>
    </div>
  );
}

function BotonMesa({
  mesa,
  estado,
  onClick,
  formato,
  grande,
}: {
  mesa: Mesa;
  estado?: EstadoMesa;
  onClick: () => void;
  formato: (n: number) => string;
  grande?: boolean;
}) {
  const color = !estado?.ocupada
    ? "border-stone-200 bg-superficie"
    : estado.aviso === "cuenta"
      ? "border-violet-500 bg-violet-50"
      : estado.aviso
        ? "border-sky-500 bg-sky-50"
        : estado.listo
          ? "border-emerald-500 bg-emerald-50"
          : "border-amber-500 bg-amber-50";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-xl border-2 px-3 text-left transition hover:shadow-md ${color} ${grande ? "py-3" : "py-1.5"}`}
    >
      <span className="block font-bold">Mesa {mesa.numero}</span>
      <span className="block text-xs text-suave" suppressHydrationWarning>
        {estado?.ocupada
          ? `${estado.comensales} pers. · ${estado.minutos} min${estado.total ? ` · ${formato(estado.total)}` : ""}`
          : `Libre · ${mesa.capacidad ?? 4} lugares`}
      </span>
      {(estado?.aviso || estado?.pendiente) && (
        <span className="absolute right-2 top-2 h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" />
      )}
    </button>
  );
}

function Contador({
  valor,
  min,
  max,
  onChange,
  etiqueta,
}: {
  valor: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  etiqueta: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm">{etiqueta}</span>
      <span className="flex items-center rounded-lg border border-borde">
        <button
          type="button"
          className="h-8 w-8 text-lg"
          onClick={() => onChange(Math.max(min, valor - 1))}
          aria-label={`Menos ${etiqueta}`}
        >
          −
        </button>
        <span className="w-8 text-center text-sm font-semibold tabular-nums">{valor}</span>
        <button
          type="button"
          className="h-8 w-8 text-lg"
          onClick={() => onChange(Math.min(max, valor + 1))}
          aria-label={`Más ${etiqueta}`}
        >
          +
        </button>
      </span>
    </div>
  );
}

const NORTE: { valor: Piso["norte"]; texto: string }[] = [
  { valor: "arriba", texto: "Arriba" },
  { valor: "derecha", texto: "Derecha" },
  { valor: "abajo", texto: "Abajo" },
  { valor: "izquierda", texto: "Izquierda" },
];

function PanelEdicion({
  piso,
  sinUbicar,
  mesa,
  elemento,
  onPiso,
  onBorrarPiso,
  onAgregarMesa,
  onUbicar,
  onMesa,
  onQuitarMesa,
  onBorrarMesa,
  onAgregarElemento,
  onElemento,
  onBorrarElemento,
}: {
  piso: Piso;
  sinUbicar: Mesa[];
  mesa?: Mesa;
  elemento?: Elemento;
  onPiso: (c: Partial<Piso>) => void;
  onBorrarPiso: () => void;
  onAgregarMesa: (forma: NonNullable<Mesa["forma"]>, capacidad: number) => void;
  onUbicar: (m: Mesa) => void;
  onMesa: (m: Mesa, c: Partial<Mesa>) => void;
  onQuitarMesa: (m: Mesa) => void;
  onBorrarMesa: (m: Mesa) => void;
  onAgregarElemento: (t: TipoElemento) => void;
  onElemento: (id: string, c: Partial<Elemento>) => void;
  onBorrarElemento: (id: string) => void;
}) {
  return (
    <aside className="space-y-4">
      {mesa ? (
        <div className="tarjeta space-y-3 p-4">
          <p className="font-semibold">Mesa {mesa.numero}</p>
          <label className="block text-sm">
            Número o nombre
            <input
              key={mesa.id}
              defaultValue={mesa.numero}
              maxLength={12}
              onBlur={(e) =>
                e.target.value.trim() && e.target.value.trim() !== mesa.numero && onMesa(mesa, { numero: e.target.value.trim() })
              }
              className="campo mt-1 py-1.5"
            />
          </label>
          <div className="flex gap-1.5">
            {(["cuadrada", "redonda", "rectangular"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => onMesa(mesa, { forma: f, ...tamanoPara(f, mesa.capacidad ?? 4) })}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-xs capitalize ${mesa.forma === f ? "border-marca bg-marca/10 text-marca" : "border-borde"}`}
              >
                {f}
              </button>
            ))}
          </div>
          <Contador
            etiqueta="Personas"
            valor={mesa.capacidad ?? 4}
            min={1}
            max={40}
            onChange={(n) => onMesa(mesa, { capacidad: n, ...tamanoPara(mesa.forma ?? "cuadrada", n) })}
          />
          <Contador etiqueta="Ancho" valor={mesa.ancho ?? 2} min={1} max={12} onChange={(n) => onMesa(mesa, { ancho: n })} />
          <Contador etiqueta="Largo" valor={mesa.alto ?? 2} min={1} max={12} onChange={(n) => onMesa(mesa, { alto: n })} />
          <button
            type="button"
            className="boton-secundario w-full py-1.5"
            onClick={() => onMesa(mesa, { ancho: mesa.alto, alto: mesa.ancho })}
          >
            Girar
          </button>
          <div className="flex gap-2 pt-1 text-sm">
            <button type="button" className="text-suave hover:text-tinta" onClick={() => onQuitarMesa(mesa)}>
              Sacar del plano
            </button>
            <button type="button" className="ml-auto text-red-600 hover:underline" onClick={() => onBorrarMesa(mesa)}>
              Borrar mesa
            </button>
          </div>
        </div>
      ) : elemento ? (
        <div className="tarjeta space-y-3 p-4">
          <p className="font-semibold">{ELEMENTOS[elemento.tipo]?.texto}</p>
          <label className="block text-sm">
            Texto
            <input
              key={elemento.id}
              defaultValue={elemento.texto ?? ""}
              placeholder={ELEMENTOS[elemento.tipo]?.texto}
              maxLength={24}
              onBlur={(e) => onElemento(elemento.id, { texto: e.target.value.trim() || undefined })}
              className="campo mt-1 py-1.5"
            />
          </label>
          <Contador
            etiqueta="Ancho"
            valor={elemento.ancho}
            min={1}
            max={piso.columnas}
            onChange={(n) => onElemento(elemento.id, { ancho: n })}
          />
          <Contador
            etiqueta="Largo"
            valor={elemento.alto}
            min={1}
            max={piso.filas}
            onChange={(n) => onElemento(elemento.id, { alto: n })}
          />
          <button
            type="button"
            className="boton-secundario w-full py-1.5"
            onClick={() => onElemento(elemento.id, { ancho: elemento.alto, alto: elemento.ancho })}
          >
            Girar
          </button>
          <button type="button" className="text-sm text-red-600 hover:underline" onClick={() => onBorrarElemento(elemento.id)}>
            Quitar del plano
          </button>
        </div>
      ) : (
        <p className="rounded-xl bg-marca/5 p-3 text-sm text-marca">
          Arrastra mesas y elementos para acomodarlos. Toca uno para cambiar su tamaño, personas o forma.
        </p>
      )}

      <div className="tarjeta space-y-3 p-4">
        <p className="text-sm font-semibold">Agregar mesa</p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["cuadrada", 4, "Cuadrada · 4"],
              ["redonda", 2, "Redonda · 2"],
              ["rectangular", 6, "Larga · 6"],
            ] as const
          ).map(([forma, cap, texto]) => (
            <button
              key={forma}
              type="button"
              onClick={() => onAgregarMesa(forma, cap)}
              className="flex flex-col items-center gap-1 rounded-xl border border-borde p-2 text-[11px] hover:border-marca"
            >
              <span
                className={`block border-2 border-stone-400 bg-superficie ${forma === "redonda" ? "h-6 w-6 rounded-full" : forma === "rectangular" ? "h-5 w-10 rounded" : "h-6 w-6 rounded"}`}
              />
              {texto}
            </button>
          ))}
        </div>
        {sinUbicar.length > 0 && (
          <div>
            <p className="mb-1 text-xs text-suave">Mesas sin lugar (toca para ubicarlas):</p>
            <div className="flex flex-wrap gap-1.5">
              {sinUbicar.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onUbicar(m)}
                  className="rounded-lg border border-dashed border-stone-300 px-2 py-1 text-xs hover:border-marca"
                >
                  {m.numero}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="pt-1 text-sm font-semibold">Agregar al plano</p>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(ELEMENTOS) as TipoElemento[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onAgregarElemento(t)}
              className="rounded-lg border border-borde px-2.5 py-1 text-xs hover:border-marca"
            >
              {ELEMENTOS[t].texto}
            </button>
          ))}
        </div>
        <p className="text-xs text-suave">
          Las mesas no se pueden poner sobre pasillos, paredes, barra, baños, cocina, caja, escalera ni entrada.
        </p>
      </div>

      <div className="tarjeta space-y-3 p-4">
        <p className="text-sm font-semibold">Este piso</p>
        <label className="block text-sm">
          Nombre
          <input
            key={piso.id}
            defaultValue={piso.nombre}
            maxLength={40}
            onBlur={(e) =>
              e.target.value.trim() && e.target.value.trim() !== piso.nombre && onPiso({ nombre: e.target.value.trim() })
            }
            className="campo mt-1 py-1.5"
          />
        </label>
        <Contador etiqueta="Ancho (casillas)" valor={piso.columnas} min={8} max={60} onChange={(n) => onPiso({ columnas: n })} />
        <Contador etiqueta="Largo (casillas)" valor={piso.filas} min={6} max={40} onChange={(n) => onPiso({ filas: n })} />
        <label className="block text-sm">
          El norte queda
          <select
            value={piso.norte}
            onChange={(e) => onPiso({ norte: e.target.value as Piso["norte"] })}
            className="campo mt-1 py-1.5"
          >
            {NORTE.map((n) => (
              <option key={n.valor} value={n.valor}>
                {n.texto}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={onBorrarPiso} className="text-sm text-red-600 hover:underline">
          Borrar este piso
        </button>
      </div>
    </aside>
  );
}
