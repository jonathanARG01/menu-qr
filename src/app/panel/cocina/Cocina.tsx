"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icono } from "@/components/Icono";
import { useToast } from "@/components/Toast";
import {
  NOMBRE_ESTADO,
  regionDe,
  type Ajustes,
  type EstadoPedido,
  type Pedido,
  type PedidoItem,
  type Piso,
  nombreMesa,
} from "@/lib/salon";
import type { Mesa, Restaurante } from "@/lib/types";
import { avisarComensal } from "@/lib/push";
import { sonar } from "@/lib/sonidos";
import { mensajeError } from "@/lib/utils";
import { minutosDesde, useAhora, useServicio } from "@/lib/useServicio";
import { anchoGuardado, guardarAncho, horaCorta, imprimirTicket, type AnchoTicket, type LineaTicket } from "@/lib/imprimir";
import { Agotados, estaAgotado, type PlatoAgotable } from "./Agotados";

type Props = {
  restaurante: Restaurante;
  ajustes: Ajustes;
  pedidosIniciales: Pedido[];
  mesas: Mesa[];
  pisos: Pick<Piso, "id" | "nombre">[];
  platos: PlatoAgotable[];
  categorias: { id: string; nombre: string }[];
};

const SIGUIENTE: Partial<Record<EstadoPedido, { estado: EstadoPedido; texto: string; clase: string }>> = {
  nuevo: { estado: "preparando", texto: "Empezar", clase: "bg-emerald-600 hover:bg-emerald-700" },
  preparando: { estado: "listo", texto: "Terminar", clase: "bg-red-600 hover:bg-red-700" },
  listo: { estado: "entregado", texto: "Entregado", clase: "bg-stone-700 hover:bg-stone-800" },
};

const leer = (clave: string) => {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
};
const guardar = (clave: string, valor: string) => {
  try {
    localStorage.setItem(clave, valor);
  } catch {}
};

// Posición de una comanda en el tablero: su orden manual (si la movieron) o la hora de llegada.
const posicion = (p: Pedido, local: Record<string, number>) => local[p.id] ?? p.orden ?? Date.parse(p.created_at);

const sinClave = (o: Record<string, number>, id: string) => Object.fromEntries(Object.entries(o).filter(([x]) => x !== id));

type Arrastre = {
  id: string;
  x0: number;
  y0: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  ancho: number;
  activo: boolean;
  orden: string[];
};

// Pantalla de cocina (o de barra): comandas en tiempo real, del más viejo al más nuevo.
export function Cocina({ restaurante, ajustes, pedidosIniciales, mesas, pisos, platos, categorias }: Props) {
  const avisar = useToast();
  const { pedidos, supabase, recargar, enVivo } = useServicio(restaurante.id, {
    cuentas: [],
    pedidos: pedidosIniciales,
    pagos: [],
  });
  const ahora = useAhora(15000);
  const tablero = useRef<HTMLDivElement>(null);
  const [estacion, setEstacion] = useState<string>("Todas");
  const [sonido, setSonido] = useState(true);
  const [verEntregados, setVerEntregados] = useState(false);
  const [detalle, setDetalle] = useState<string | null>(null);
  const vistos = useRef<Set<string> | null>(null);
  // Orden movido en esta pantalla que todavía no volvió de la base (o que no se puede guardar sin la migración 0005).
  const [ordenLocal, setOrdenLocal] = useState<Record<string, number>>({});
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const recienArrastrado = useRef(false);
  const avisadoSinColumna = useRef(false);
  const [listaPlatos, setListaPlatos] = useState(platos);
  const [verAgotados, setVerAgotados] = useState(false);
  // Impresora de comandas de esta pantalla: imprime sola cada comanda nueva de su estación.
  const [imprimirAuto, setImprimirAuto] = useState(false);
  const [ancho, setAncho] = useState<AnchoTicket>("80");
  const [verImpresora, setVerImpresora] = useState(false);
  const agotadosAhora = listaPlatos.filter((p) => estaAgotado(p, ahora)).length;

  useEffect(() => {
    setEstacion(leer("cocina:estacion") ?? "Todas");
    setSonido(leer("cocina:sonido") !== "no");
    setImprimirAuto(leer("cocina:imprimir") === "si");
    setAncho(anchoGuardado());
    try {
      setOrdenLocal(JSON.parse(leer("cocina:orden") ?? "{}"));
    } catch {}
  }, []);

  const estaciones = useMemo(
    () => [...new Set([...ajustes.estaciones, ...pedidos.map((p) => p.estacion)])],
    [ajustes.estaciones, pedidos],
  );
  const deEstacion = pedidos.filter((p) => estacion === "Todas" || p.estacion === estacion);
  const activos = deEstacion
    .filter((p) => p.estado === "nuevo" || p.estado === "preparando")
    .sort((a, b) => posicion(a, ordenLocal) - posicion(b, ordenLocal) || a.numero - b.numero);
  // Mientras se arrastra, el tablero muestra dónde quedaría la comanda.
  const tarjetas = arrastre?.activo
    ? [
        ...arrastre.orden.map((id) => activos.find((p) => p.id === id)).filter((p): p is Pedido => !!p),
        ...activos.filter((p) => !arrastre.orden.includes(p.id)),
      ]
    : activos;
  const listos = deEstacion.filter((p) => p.estado === "listo");
  const pendientes = deEstacion.filter((p) => p.estado === "pendiente");
  const entregados = deEstacion
    .filter((p) => p.estado === "entregado")
    .slice(-12)
    .reverse();

  // Suena cuando entra una comanda nueva (no al abrir la pantalla).
  useEffect(() => {
    const nuevos = pedidos.filter((p) => p.estado === "nuevo").map((p) => p.id);
    if (vistos.current === null) {
      vistos.current = new Set(nuevos);
      return;
    }
    const llegaron = nuevos.filter((id) => !vistos.current!.has(id));
    nuevos.forEach((id) => vistos.current!.add(id));
    if (llegaron.length && sonido) sonar("cocina");
    if (imprimirAuto) {
      const aImprimir = pedidos.filter((p) => llegaron.includes(p.id) && (estacion === "Todas" || p.estacion === estacion));
      // Una tras otra, para que el navegador no junte los diálogos.
      aImprimir.reduce((cola, p) => cola.then(() => imprimirTicket(ticketComanda(p))), Promise.resolve());
    }
  }, [pedidos, sonido, imprimirAuto, estacion]); // eslint-disable-line react-hooks/exhaustive-deps

  function ticketComanda(p: Pedido): LineaTicket[] {
    const { mesa, piso } = lugar(p);
    return [
      { tipo: "titulo", texto: mesa },
      { tipo: "texto", texto: `${p.estacion} · #${p.numero}${piso ? ` · ${piso}` : ""}`, fuerte: true },
      {
        tipo: "texto",
        texto: `${horaCorta(p.created_at, regionDe(ajustes))} · ${p.origen === "cliente" ? "desde el QR" : "mesero"}${p.nombre ? ` · ${p.nombre}` : ""}`,
        chico: true,
      },
      { tipo: "separador" },
      ...(p.pedido_items ?? []).map((i) => ({
        tipo: "fila" as const,
        izq: `${i.cantidad} × ${i.nombre}`,
        fuerte: true,
        nota: [i.nota, i.comensal ? `Comensal ${i.comensal}` : ""].filter(Boolean).join(" · ") || undefined,
      })),
      ...(p.nota ? [{ tipo: "separador" as const }, { tipo: "texto" as const, texto: `Nota: ${p.nota}`, fuerte: true }] : []),
    ];
  }

  function lugar(p: Pedido) {
    const mesa = mesas.find(
      (m) => m.numero === p.mesa_numero && (!p.sucursal_id || !m.sucursal_id || m.sucursal_id === p.sucursal_id),
    );
    const piso = pisos.find((x) => x.id === mesa?.piso_id)?.nombre;
    return { mesa: nombreMesa(p.mesa_numero), piso };
  }

  async function cambiar(p: Pedido, estado: EstadoPedido) {
    const { error } = await supabase.from("pedidos").update({ estado }).eq("id", p.id);
    if (error) return avisar(mensajeError(error), "error");
    avisarComensal(p.id);
    recargar();
  }

  async function alternarItem(i: PedidoItem) {
    const { error } = await supabase.from("pedido_items").update({ listo: !i.listo }).eq("id", i.id);
    if (error) return avisar(mensajeError(error), "error");
    recargar();
  }

  // Guarda la nueva posición como un número entre sus vecinas: una sola fila cambia y las demás pantallas lo ven en vivo.
  async function ubicar(id: string, lista: string[]) {
    const k = lista.indexOf(id);
    const buscar = (x?: string) => activos.find((p) => p.id === x);
    const antes = buscar(lista[k - 1]);
    const despues = buscar(lista[k + 1]);
    const yo = buscar(id);
    if (!yo) return;
    const a = antes && posicion(antes, ordenLocal);
    const b = despues && posicion(despues, ordenLocal);
    const valor =
      a !== undefined && b !== undefined
        ? (a + b) / 2
        : a !== undefined
          ? a + 1000
          : b !== undefined
            ? b - 1000
            : posicion(yo, ordenLocal);
    if (valor === posicion(yo, ordenLocal)) return;
    setOrdenLocal((o) => ({ ...o, [id]: valor }));

    const { error } = await supabase.from("pedidos").update({ orden: valor }).eq("id", id);
    if (error && (error.code === "PGRST204" || /orden/.test(error.message))) {
      // Falta la migración 0005: el orden queda guardado solo en esta pantalla.
      const vigentes = new Set(pedidos.filter((p) => p.estado !== "entregado").map((p) => p.id));
      setOrdenLocal((o) => {
        const limpio = Object.fromEntries(Object.entries({ ...o, [id]: valor }).filter(([x]) => vigentes.has(x)));
        guardar("cocina:orden", JSON.stringify(limpio));
        return limpio;
      });
      if (!avisadoSinColumna.current) {
        avisadoSinColumna.current = true;
        avisar("El orden se guardó solo en esta pantalla. Ejecuta 0005_orden_comandas.sql para compartirlo.");
      }
      return;
    }
    if (error) {
      setOrdenLocal((o) => sinClave(o, id));
      return avisar(mensajeError(error), "error");
    }
    await recargar();
    setOrdenLocal((o) => sinClave(o, id));
  }

  function mover(id: string, paso: -1 | 1) {
    const lista = activos.map((p) => p.id);
    const k = lista.indexOf(id);
    const j = k + paso;
    if (k < 0 || j < 0 || j >= lista.length) return;
    [lista[k], lista[j]] = [lista[j], lista[k]];
    ubicar(id, lista);
  }

  // Arrastrar desde la cabecera de la comanda; un toque sin mover abre el detalle.
  function empezarArrastre(e: React.PointerEvent<HTMLButtonElement>, p: Pedido) {
    if (e.button !== 0) return;
    const r = e.currentTarget.closest("article")!.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    setArrastre({
      id: p.id,
      x0: e.clientX,
      y0: e.clientY,
      x: e.clientX,
      y: e.clientY,
      dx: e.clientX - r.left,
      dy: e.clientY - r.top,
      ancho: r.width,
      activo: false,
      orden: activos.map((x) => x.id),
    });
  }

  function moverArrastre(e: React.PointerEvent) {
    if (!arrastre) return;
    const { clientX: x, clientY: y } = e;
    if (!arrastre.activo && Math.hypot(x - arrastre.x0, y - arrastre.y0) < 6) return;
    let orden = arrastre.orden;
    const sobre = document
      .elementsFromPoint(x, y)
      .map((n) => n.closest<HTMLElement>("[data-comanda]"))
      .find((n) => n && n.dataset.comanda !== arrastre.id);
    if (sobre) {
      const r = sobre.getBoundingClientRect();
      // En una sola columna (celular) se ordena de arriba abajo; en la grilla, de izquierda a derecha.
      const columna = r.width > (sobre.parentElement?.clientWidth ?? 0) * 0.6;
      const despues = columna ? y > r.top + r.height / 2 : x > r.left + r.width / 2;
      const sinMi = orden.filter((id) => id !== arrastre.id);
      const k = sinMi.indexOf(sobre.dataset.comanda!) + (despues ? 1 : 0);
      orden = [...sinMi.slice(0, k), arrastre.id, ...sinMi.slice(k)];
    }
    setArrastre({ ...arrastre, x, y, activo: true, orden });
  }

  function soltar() {
    if (arrastre?.activo) {
      recienArrastrado.current = true;
      setTimeout(() => (recienArrastrado.current = false), 0);
      ubicar(arrastre.id, arrastre.orden);
    }
    setArrastre(null);
  }

  const color = (min: number) =>
    min >= ajustes.alertas.rojo ? "bg-red-600" : min >= ajustes.alertas.amarillo ? "bg-amber-500" : "bg-emerald-600";

  const elegido = pedidos.find((p) => p.id === detalle);

  return (
    <div
      ref={tablero}
      className="tema-fijo flex min-h-[calc(100vh-8rem)] flex-col gap-3 rounded-2xl bg-stone-900 p-3 text-white sm:p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 flex items-center gap-2 text-lg font-bold">
          <Icono nombre="cocina" /> {estacion === "Todas" ? "Comandas" : estacion}
        </h1>
        <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs">
          <span className={`h-2 w-2 rounded-full ${enVivo ? "bg-emerald-400" : "bg-stone-400"}`} />
          {enVivo ? "En vivo" : "Actualiza cada 15 s"}
        </span>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs">{activos.length} en curso</span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {["Todas", ...estaciones].map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                setEstacion(e);
                guardar("cocina:estacion", e);
              }}
              className={`rounded-full px-3 py-1 text-sm font-medium ${estacion === e ? "bg-superficie text-stone-900" : "bg-white/10 hover:bg-white/20"}`}
            >
              {e}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setSonido(!sonido);
              guardar("cocina:sonido", sonido ? "no" : "si");
              if (!sonido) sonar("cocina");
            }}
            className="rounded-full bg-white/10 p-2 hover:bg-white/20"
            aria-label={sonido ? "Silenciar" : "Activar sonido"}
            title={sonido ? "Sonido activado" : "Sonido apagado"}
          >
            <Icono nombre={sonido ? "sonido" : "silencio"} className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setVerAgotados(true)}
            className={`rounded-full px-3 py-1 text-sm font-medium ${agotadosAhora ? "bg-red-600 hover:bg-red-700" : "bg-white/10 hover:bg-white/20"}`}
            title="Marcar platos agotados"
          >
            Agotados{agotadosAhora ? ` (${agotadosAhora})` : ""}
          </button>
          <span className="relative">
            <button
              type="button"
              onClick={() => setVerImpresora(!verImpresora)}
              className={`rounded-full p-2 ${imprimirAuto ? "bg-emerald-600 hover:bg-emerald-700" : "bg-white/10 hover:bg-white/20"}`}
              aria-label="Impresora de comandas"
              title={imprimirAuto ? "Imprime cada comanda nueva" : "Impresora de comandas"}
            >
              <Icono nombre="impresora" className="h-4 w-4" />
            </button>
            {verImpresora && (
              <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-xl bg-superficie p-4 text-sm text-stone-900 shadow-2xl">
                <p className="font-semibold">Impresora de comandas</p>
                <label className="mt-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={imprimirAuto}
                    onChange={(e) => {
                      setImprimirAuto(e.target.checked);
                      guardar("cocina:imprimir", e.target.checked ? "si" : "no");
                    }}
                  />
                  Imprimir cada comanda nueva {estacion !== "Todas" ? `de ${estacion}` : ""}
                </label>
                <p className="mt-3 text-stone-500">Ancho del papel</p>
                <div className="mt-1 flex gap-2">
                  {(["58", "80"] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => {
                        setAncho(a);
                        guardarAncho(a);
                      }}
                      className={`flex-1 rounded-lg border px-2 py-1.5 ${ancho === a ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300"}`}
                    >
                      {a} mm
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="boton-secundario mt-3 w-full"
                  onClick={() =>
                    imprimirTicket([
                      { tipo: "titulo", texto: "Prueba" },
                      { tipo: "texto", texto: `${restaurante.nombre} · ${ancho} mm` },
                      { tipo: "fila", izq: "2 × Hamburguesa", fuerte: true, nota: "sin cebolla" },
                    ])
                  }
                >
                  Imprimir una prueba
                </button>
                <p className="mt-3 text-xs text-stone-500">
                  Para que imprima sin preguntar, abre Chrome con la opción <code>--kiosk-printing</code> (está en la guía).
                </p>
              </div>
            )}
          </span>
          <button
            type="button"
            onClick={() => (document.fullscreenElement ? document.exitFullscreen() : tablero.current?.requestFullscreen())}
            className="rounded-full bg-white/10 p-2 hover:bg-white/20"
            aria-label="Pantalla completa"
            title="Pantalla completa"
          >
            <Icono nombre="pantalla" className="h-4 w-4" />
          </button>
        </div>
      </div>

      {pendientes.length > 0 && (
        <p className="rounded-xl bg-white/10 px-3 py-2 text-sm text-stone-300">
          {pendientes.length} {pendientes.length === 1 ? "pedido espera" : "pedidos esperan"} que el mesero lo confirme (
          {pendientes.map((p) => lugar(p).mesa).join(", ")}).
        </p>
      )}

      <div className="grid flex-1 gap-3 lg:grid-cols-[1fr_260px]">
        <div className="grid content-start gap-3 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
          {activos.length === 0 && (
            <p className="col-span-full py-16 text-center text-stone-400">
              No hay comandas pendientes. Las nuevas aparecen solas aquí.
            </p>
          )}
          {tarjetas.map((p) => {
            const min = minutosDesde(p.created_at, ahora);
            const { mesa, piso } = lugar(p);
            const sig = SIGUIENTE[p.estado]!;
            const moviendo = arrastre?.activo && arrastre.id === p.id;
            return (
              <article
                key={p.id}
                data-comanda={p.id}
                className={`flex flex-col overflow-hidden rounded-xl bg-superficie text-stone-900 shadow-lg ${moviendo ? "opacity-30 outline-2 outline-dashed outline-white/70" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => !recienArrastrado.current && setDetalle(p.id)}
                  onPointerDown={(e) => empezarArrastre(e, p)}
                  onPointerMove={moverArrastre}
                  onPointerUp={soltar}
                  onPointerCancel={() => setArrastre(null)}
                  title="Toca para ver el detalle · arrastra para cambiar el orden"
                  className={`cursor-grab touch-none select-none px-3 py-2 text-left text-white active:cursor-grabbing ${color(min)}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-lg font-bold">{mesa}</span>
                    <span className="flex items-center gap-1 text-sm font-semibold tabular-nums" suppressHydrationWarning>
                      <Icono nombre="reloj" className="h-4 w-4" />
                      {min}′
                    </span>
                  </span>
                  <span className="flex justify-between text-xs opacity-90">
                    <span>
                      #{p.numero}
                      {piso ? ` · ${piso}` : ""}
                      {estacion === "Todas" ? ` · ${p.estacion}` : ""}
                    </span>
                    <span suppressHydrationWarning>{horaCorta(p.created_at, regionDe(ajustes))}</span>
                  </span>
                </button>
                {p.estado === "preparando" && (
                  <p className="bg-sky-100 px-3 py-0.5 text-xs font-semibold text-sky-800">En preparación</p>
                )}
                <ul className="flex-1 divide-y divide-stone-100 px-3 py-1">
                  {(p.pedido_items ?? []).map((i) => (
                    <li key={i.id}>
                      <button
                        type="button"
                        onClick={() => alternarItem(i)}
                        className={`flex w-full gap-2 py-1.5 text-left ${i.listo ? "text-stone-400 line-through" : ""}`}
                      >
                        <span className="w-6 shrink-0 text-right font-bold tabular-nums">{i.cantidad}×</span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold leading-tight">{i.nombre}</span>
                          {i.nota && (
                            <span className="block rounded bg-amber-100 px-1 text-xs font-medium text-amber-900">{i.nota}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {p.nota && <p className="mx-3 mb-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">Nota: {p.nota}</p>}
                <button
                  type="button"
                  onClick={() => cambiar(p, sig.estado)}
                  className={`m-2 mt-0 rounded-lg py-2.5 text-sm font-bold uppercase tracking-wide text-white ${sig.clase}`}
                >
                  {sig.texto}
                </button>
              </article>
            );
          })}
        </div>

        {arrastre?.activo &&
          (() => {
            const p = activos.find((x) => x.id === arrastre.id);
            if (!p) return null;
            return (
              <div
                aria-hidden
                className={`pointer-events-none fixed z-50 rotate-2 rounded-xl px-3 py-2 text-white shadow-2xl ${color(minutosDesde(p.created_at, ahora))}`}
                style={{ left: arrastre.x - arrastre.dx, top: arrastre.y - arrastre.dy, width: arrastre.ancho }}
              >
                <span className="block text-lg font-bold">{lugar(p).mesa}</span>
                <span className="block truncate text-xs opacity-90">
                  {(p.pedido_items ?? []).map((i) => `${i.cantidad} ${i.nombre}`).join(", ")}
                </span>
              </div>
            );
          })()}

        <aside className="space-y-2 rounded-xl bg-white/5 p-3">
          <p className="text-sm font-semibold text-emerald-300">Listos para llevar ({listos.length})</p>
          {listos.length === 0 && (
            <p className="text-xs text-stone-400">Lo que termines aparece aquí hasta que el mesero lo entregue.</p>
          )}
          {listos.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-lg bg-emerald-900/50 px-3 py-2">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setDetalle(p.id)}>
                <span className="block font-semibold">{lugar(p).mesa}</span>
                <span className="block truncate text-xs text-stone-300">
                  {(p.pedido_items ?? []).map((i) => `${i.cantidad} ${i.nombre}`).join(", ")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => cambiar(p, "entregado")}
                className="rounded-md bg-white/15 px-2 py-1 text-xs font-semibold hover:bg-white/25"
              >
                Entregado
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setVerEntregados(!verEntregados)}
            className="pt-2 text-xs text-stone-400 underline"
          >
            {verEntregados ? "Ocultar" : "Ver"} entregados recientes
          </button>
          {verEntregados &&
            entregados.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setDetalle(p.id)}
                className="block w-full truncate text-left text-xs text-stone-400 hover:text-white"
              >
                #{p.numero} · {lugar(p).mesa} · {(p.pedido_items ?? []).map((i) => i.nombre).join(", ")}
              </button>
            ))}
        </aside>
      </div>

      {verAgotados && (
        <Agotados
          supabase={supabase}
          platos={listaPlatos}
          categorias={categorias}
          onCambio={(id, hasta) => setListaPlatos((l) => l.map((p) => (p.id === id ? { ...p, agotado_hasta: hasta } : p)))}
          onCerrar={() => setVerAgotados(false)}
        />
      )}

      {elegido && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setDetalle(null)}>
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-superficie p-5 text-stone-900 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-2xl font-bold">{lugar(elegido).mesa}</p>
                <p className="text-sm text-stone-500">
                  Comanda #{elegido.numero} · {elegido.estacion} · {NOMBRE_ESTADO[elegido.estado]}
                  {lugar(elegido).piso ? ` · ${lugar(elegido).piso}` : ""}
                </p>
                <p className="text-sm text-stone-500" suppressHydrationWarning>
                  Pedido a las {horaCorta(elegido.created_at, regionDe(ajustes))} ({minutosDesde(elegido.created_at, ahora)} min)
                  · {elegido.origen === "cliente" ? "desde el QR" : "por el mesero"}
                  {elegido.nombre ? ` · ${elegido.nombre}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetalle(null)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100"
                aria-label="Cerrar"
              >
                <Icono nombre="cerrar" />
              </button>
            </div>
            <ul className="mt-4 space-y-2">
              {(elegido.pedido_items ?? []).map((i) => (
                <li key={i.id} className="flex gap-3 text-lg">
                  <span className="w-8 text-right font-bold">{i.cantidad}×</span>
                  <span className="flex-1">
                    <span className={`font-semibold ${i.listo ? "text-stone-400 line-through" : ""}`}>{i.nombre}</span>
                    {i.nota && <span className="block text-sm text-amber-700">{i.nota}</span>}
                    {i.comensal && <span className="block text-xs text-stone-400">Comensal {i.comensal}</span>}
                  </span>
                </li>
              ))}
            </ul>
            {elegido.nota && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">Nota: {elegido.nota}</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              {activos.length > 1 && activos.some((p) => p.id === elegido.id) && (
                <span className="flex overflow-hidden rounded-lg border border-stone-200 text-sm font-medium">
                  <button
                    type="button"
                    className="px-3 py-2 hover:bg-stone-100 disabled:opacity-40"
                    disabled={activos[0].id === elegido.id}
                    onClick={() => mover(elegido.id, -1)}
                    title="Mover antes"
                  >
                    ← Antes
                  </button>
                  <button
                    type="button"
                    className="border-l border-stone-200 px-3 py-2 hover:bg-stone-100 disabled:opacity-40"
                    disabled={activos[activos.length - 1].id === elegido.id}
                    onClick={() => mover(elegido.id, 1)}
                    title="Mover después"
                  >
                    Después →
                  </button>
                </span>
              )}
              <button type="button" className="boton-secundario" onClick={() => imprimirTicket(ticketComanda(elegido))}>
                <Icono nombre="impresora" className="h-4 w-4" /> Imprimir
              </button>
              {elegido.estado !== "nuevo" && elegido.estado !== "pendiente" && (
                <button
                  type="button"
                  className="boton-secundario"
                  onClick={() => cambiar(elegido, elegido.estado === "listo" ? "preparando" : "nuevo")}
                >
                  Volver atrás
                </button>
              )}
              {SIGUIENTE[elegido.estado] && (
                <button
                  type="button"
                  className={`ml-auto rounded-lg px-4 py-2.5 text-sm font-bold text-white ${SIGUIENTE[elegido.estado]!.clase}`}
                  onClick={() => {
                    cambiar(elegido, SIGUIENTE[elegido.estado]!.estado);
                    setDetalle(null);
                  }}
                >
                  {SIGUIENTE[elegido.estado]!.texto}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
