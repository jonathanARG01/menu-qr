"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { Aviso } from "@/components/AuthShell";
import { CamposRestaurante } from "@/components/CamposRestaurante";
import { Icono } from "@/components/Icono";
import { Interruptor } from "@/components/Interruptor";
import { useToast } from "@/components/Toast";
import { PLANES } from "@/components/inicio/datos";
import { DIAS_PRUEBA, NOMBRE_PLAN, estadoPrueba, periodoPlan, type EstadoPrueba, type Plan } from "@/lib/planes";
import { PAIS_BASE, numeroWhatsapp } from "@/lib/region";
import { formatoPrecio } from "@/lib/utils";
import {
  actualizarRestaurante,
  cambiarPlanInicio,
  cambiarPrueba,
  cargarEjemplo,
  crearParaCliente,
  dejarRestaurante,
  editarRestaurante,
} from "./actions";

export type FilaAdmin = {
  id: string;
  slug: string;
  nombre: string;
  plan: Plan;
  ciclo: "mensual" | "anual";
  activo: boolean;
  pausa_motivo: "prueba" | "manual" | null;
  created_at: string;
  prueba_inicio: string | null;
  prueba_fin: string | null;
  plan_inicio: string | null;
  whatsapp: string | null;
  moneda: string;
  duenos: string | null;
  platos: number;
  ejemplos: number;
  sucursales: number;
  visitas_30d: number;
  pedidos_30d: number;
  soy_staff: boolean;
};

const PLANES_SELECT: Plan[] = ["free", "carta", "pro", "grupo"];
const PRECIO = Object.fromEntries(PLANES.map((p) => [p.id, p.precio])) as Record<string, number>;
const DIA = 86400000;

type Filtro = "todos" | "prueba" | "pago" | "pausados" | "demos";
const FILTROS: [Filtro, string][] = [
  ["todos", "Todos"],
  ["prueba", "En prueba"],
  ["pago", "Con plan pago"],
  ["pausados", "Pausados"],
  ["demos", "Demos"],
];

const fecha = (d: string | Date, conAno = true) =>
  new Date(d).toLocaleDateString(PAIS_BASE.locale, { day: "numeric", month: "short", ...(conAno ? { year: "numeric" } : {}) });
const numero = (n: number) => Number(n).toLocaleString(PAIS_BASE.locale);
const plural = (n: number, uno: string, varios: string) => `${numero(n)} ${n === 1 ? uno : varios}`;
// Fecha local (AAAA-MM-DD) para los campos de fecha.
const isoDia = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const esDemo = (f: FilaAdmin) => !f.duenos;

export function ListaAdmin({ filas: iniciales }: { filas: FilaAdmin[] }) {
  const avisar = useToast();
  const [filas, setFilas] = useState(iniciales);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [creando, setCreando] = useState(false);
  const [pendiente, empezar] = useTransition();
  // Los días se calculan en el navegador (la página no se cachea, pero así no hay desfase con la hora del servidor).
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => setAhora(Date.now()), []);

  useEffect(() => setFilas(iniciales), [iniciales]);

  const prueba = (f: FilaAdmin) => (ahora == null || esDemo(f) ? null : estadoPrueba(f, ahora));

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return filas.filter((f) => {
      if (q && ![f.nombre, f.slug, f.duenos ?? ""].some((t) => t.toLowerCase().includes(q))) return false;
      if (filtro === "prueba") return f.plan === "free" && !esDemo(f);
      if (filtro === "pago") return f.plan !== "free";
      if (filtro === "pausados") return !f.activo;
      if (filtro === "demos") return esDemo(f);
      return true;
    });
  }, [filas, busqueda, filtro]);

  // Pruebas que vencen en 4 días o menos, o que ya se pausaron por vencer: para escribirles hoy.
  const porVencer = useMemo(
    () =>
      ahora == null
        ? []
        : filas
            .filter((f) => !esDemo(f) && f.plan === "free")
            .map((f) => ({ f, p: estadoPrueba(f, ahora) }))
            .filter((x): x is { f: FilaAdmin; p: EstadoPrueba } => !!x.p && x.p.quedan <= 4)
            .sort((a, b) => a.p.fin.getTime() - b.p.fin.getTime()),
    [filas, ahora],
  );

  const resumen = useMemo(() => {
    const pagos = filas.filter((f) => f.plan !== "free" && f.activo);
    return {
      total: filas.length,
      prueba: filas.filter((f) => f.plan === "free" && f.activo && !esDemo(f)).length,
      pagos: pagos.length,
      ingreso: pagos.reduce((n, f) => n + (PRECIO[f.plan] ?? 0), 0),
      visitas: filas.reduce((n, f) => n + Number(f.visitas_30d), 0),
      pedidos: filas.reduce((n, f) => n + Number(f.pedidos_30d), 0),
    };
  }, [filas]);

  // Cambio optimista: se ve al instante y se deshace si la base lo rechaza.
  function hacer(fila: FilaAdmin, cambios: Partial<FilaAdmin>, accion: () => Promise<string | null>, ok = "Guardado") {
    const antes = filas;
    setFilas((fs) => fs.map((f) => (f.id === fila.id ? { ...f, ...cambios } : f)));
    empezar(async () => {
      const error = await accion();
      if (error) {
        setFilas(antes);
        avisar(error, "error");
      } else avisar(ok);
    });
  }

  function cambiarPlan(f: FilaAdmin, plan: Plan) {
    const pago = plan !== "free";
    const cambios: Partial<FilaAdmin> = { plan };
    if (pago && !f.plan_inicio) cambios.plan_inicio = isoDia(new Date());
    if (pago && f.pausa_motivo === "prueba") Object.assign(cambios, { activo: true, pausa_motivo: null });
    hacer(
      f,
      cambios,
      () => actualizarRestaurante(f.id, f.slug, { plan }),
      pago ? `${f.nombre}: plan ${NOMBRE_PLAN[plan]}` : "Guardado",
    );
  }

  function cambiarActivo(f: FilaAdmin, activo: boolean) {
    const p = prueba(f);
    const extiende = activo && p?.vencida;
    const cambios: Partial<FilaAdmin> = { activo, pausa_motivo: activo ? null : "manual" };
    if (extiende) cambios.prueba_fin = new Date(Date.now() + 7 * DIA).toISOString();
    hacer(
      f,
      cambios,
      () => actualizarRestaurante(f.id, f.slug, { activo }),
      !activo ? `${f.nombre} pausado: su carta ya no se ve` : extiende ? "Reactivado con 7 días más de prueba" : "Reactivado",
    );
  }

  function extender(f: FilaAdmin, dias: number | null) {
    const p = prueba(f);
    // Se suman a lo que le queda (o desde hoy si ya venció).
    const base = p && !p.vencida ? p.fin.getTime() : Date.now();
    const fin = dias == null ? null : new Date(base + dias * DIA).toISOString();
    const cambios: Partial<FilaAdmin> = { prueba_fin: fin };
    if (f.pausa_motivo === "prueba") Object.assign(cambios, { activo: true, pausa_motivo: null });
    hacer(
      f,
      cambios,
      () => cambiarPrueba(f.id, f.slug, fin),
      dias == null ? "Prueba sin vencimiento" : `Prueba extendida ${dias} días`,
    );
  }

  const acciones: Acciones = {
    pendiente,
    cambiarPlan,
    cambiarActivo,
    extender,
    finPrueba: (f, dia) => {
      const fin = dia ? new Date(`${dia}T23:59:00`).toISOString() : null;
      hacer(f, { prueba_fin: fin }, () => cambiarPrueba(f.id, f.slug, fin), "Fin de prueba cambiado");
    },
    planInicio: (f, dia) => hacer(f, { plan_inicio: dia || null }, () => cambiarPlanInicio(f.id, dia || null)),
    ejemplo: (f) =>
      hacer(f, { platos: 12, ejemplos: 12 }, () => cargarEjemplo(f.id, f.slug, f.moneda), "Carta de ejemplo cargada"),
    editar: (f) =>
      empezar(async () => {
        const error = await editarRestaurante(f.id);
        if (error) avisar(error, "error");
      }),
    dejar: (f) => hacer(f, { soy_staff: false }, () => dejarRestaurante(f.id), "Ya no editas este restaurante"),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Restaurantes</h1>
          <p className="text-sm text-suave">Pruebas, planes y cómo le va a cada local.</p>
        </div>
        <button type="button" className="boton" onClick={() => setCreando(true)}>
          + Restaurante para un cliente
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Dato titulo="Restaurantes" valor={numero(resumen.total)} icono="restaurantes" />
        <Dato titulo="En prueba" valor={numero(resumen.prueba)} icono="reloj" />
        <Dato titulo="Con plan pago" valor={numero(resumen.pagos)} icono="estrella" acento />
        <Dato
          titulo="Ingreso al mes"
          valor={formatoPrecio(resumen.ingreso, "CLP")}
          icono="caja"
          ayuda="Precio de lista, sin descuentos"
        />
        <Dato titulo="Visitas 30 días" valor={numero(resumen.visitas)} icono="ojo" />
        <Dato titulo="Pedidos 30 días" valor={numero(resumen.pedidos)} icono="carta" />
      </div>

      {porVencer.length > 0 && (
        <section className="tarjeta overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-borde px-5 py-3">
            <Icono nombre="campana" className="h-5 w-5 text-amber-500" />
            <h2 className="flex-1 font-semibold">Pruebas por vencer</h2>
            <span className="text-xs text-suave">Buen momento para escribirles y cerrar la venta</span>
          </div>
          <ul className="divide-y divide-borde">
            {porVencer.map(({ f, p }) => (
              <li key={f.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="font-semibold">{f.nombre}</p>
                  <p className="truncate text-xs text-suave">{f.duenos}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    p.vencida ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {p.vencida ? "Venció · carta pausada" : p.quedan === 1 ? "Último día" : `Quedan ${p.quedan} días`}
                </span>
                <Contacto f={f} texto={p.vencida ? "Tu prueba de Mesitto terminó" : "Tu prueba de Mesitto termina pronto"} />
                <button
                  type="button"
                  className="boton-secundario py-1.5 text-xs"
                  disabled={pendiente}
                  onClick={() => extender(f, 7)}
                >
                  +7 días
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1 basis-56">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, dirección o correo"
            className="campo"
          />
        </div>
        <div className="sin-barra flex gap-1 overflow-x-auto">
          {FILTROS.map(([id, texto]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFiltro(id)}
              aria-pressed={filtro === id}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                filtro === id ? "border-marca bg-marca text-white" : "border-borde bg-superficie text-suave hover:text-tinta"
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="tarjeta p-6 text-center text-sm text-suave">No hay restaurantes que coincidan.</p>
      ) : (
        <ul className="grid gap-4 xl:grid-cols-2">
          {visibles.map((f) => (
            <TarjetaRestaurante key={f.id} f={f} prueba={prueba(f)} ahora={ahora} acciones={acciones} />
          ))}
        </ul>
      )}

      {creando && <CrearParaCliente onCerrar={() => setCreando(false)} />}
    </div>
  );
}

type Acciones = {
  pendiente: boolean;
  cambiarPlan: (f: FilaAdmin, plan: Plan) => void;
  cambiarActivo: (f: FilaAdmin, activo: boolean) => void;
  extender: (f: FilaAdmin, dias: number | null) => void;
  finPrueba: (f: FilaAdmin, dia: string) => void;
  planInicio: (f: FilaAdmin, dia: string) => void;
  ejemplo: (f: FilaAdmin) => void;
  editar: (f: FilaAdmin) => void;
  dejar: (f: FilaAdmin) => void;
};

const COLOR_PLAN: Record<Plan, string> = {
  free: "bg-amber-100 text-amber-800",
  carta: "bg-sky-100 text-sky-800",
  pro: "bg-violet-100 text-violet-800",
  grupo: "bg-emerald-100 text-emerald-800",
};

function TarjetaRestaurante({
  f,
  prueba,
  ahora,
  acciones: a,
}: {
  f: FilaAdmin;
  prueba: EstadoPrueba | null;
  ahora: number | null;
  acciones: Acciones;
}) {
  const demo = esDemo(f);
  return (
    <li className={`tarjeta flex min-w-0 flex-col p-4 sm:p-5 ${f.activo ? "" : "opacity-80"}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-lg font-bold">
          {f.nombre.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate font-semibold">{f.nombre}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${demo ? "bg-stone-100 text-stone-600" : COLOR_PLAN[f.plan]}`}
            >
              {demo ? "Demo" : NOMBRE_PLAN[f.plan]}
            </span>
            {!f.activo && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800">
                {f.pausa_motivo === "prueba" ? "Pausado: venció la prueba" : "Pausado"}
              </span>
            )}
          </div>
          <a href={`/${f.slug}`} target="_blank" className="inline-flex items-center gap-1 text-sm text-marca hover:underline">
            /{f.slug} <Icono nombre="externo" className="h-3.5 w-3.5" />
          </a>
          <p className="truncate text-xs text-suave">
            {f.duenos ?? "Sin dueño"} · alta {fecha(f.created_at)}
          </p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-4 gap-1.5 text-center sm:gap-2">
        <Cifra titulo="Platos" valor={f.platos} nota={f.ejemplos > 0 ? `${f.ejemplos} de ejemplo` : undefined} />
        <Cifra titulo="Sucursales" valor={f.sucursales} />
        <Cifra titulo="Visitas 30d" valor={f.visitas_30d} />
        <Cifra titulo="Pedidos 30d" valor={f.pedidos_30d} />
      </dl>

      <div className="mt-4 flex-1">
        {demo ? (
          <p className="rounded-2xl bg-stone-50 px-4 py-3 text-sm text-suave">Demo sin dueño: no tiene prueba ni vence.</p>
        ) : f.plan === "free" ? (
          <BloquePrueba f={f} prueba={prueba} acciones={a} />
        ) : (
          <BloquePlan f={f} ahora={ahora} acciones={a} />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-borde pt-4 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-suave">Plan</span>
          <select
            value={f.plan}
            onChange={(e) => a.cambiarPlan(f, e.target.value as Plan)}
            disabled={a.pendiente}
            className="campo w-auto py-1.5"
          >
            {PLANES_SELECT.map((p) => (
              <option key={p} value={p}>
                {NOMBRE_PLAN[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <Interruptor activo={f.activo} onChange={(v) => a.cambiarActivo(f, v)} etiqueta="Carta activa" />
          <span className="text-suave">{f.activo ? "Activa" : "Pausada"}</span>
        </label>
        <div className="flex-1" />
        {f.platos === 0 && (
          <button type="button" className="text-suave hover:text-tinta" disabled={a.pendiente} onClick={() => a.ejemplo(f)}>
            Cargar ejemplo
          </button>
        )}
        {f.soy_staff && (
          <button type="button" className="text-suave hover:text-red-600" onClick={() => a.dejar(f)}>
            Dejar de editar
          </button>
        )}
        <button type="button" className="boton-secundario py-1.5" disabled={a.pendiente} onClick={() => a.editar(f)}>
          <Icono nombre="lapiz" className="h-4 w-4" />
          Editar carta
        </button>
      </div>
    </li>
  );
}

// Barra de días de prueba: usados y restantes, con atajos para extenderla.
function BloquePrueba({ f, prueba, acciones: a }: { f: FilaAdmin; prueba: EstadoPrueba | null; acciones: Acciones }) {
  if (!f.prueba_fin) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-stone-50 px-4 py-3 text-sm">
        <Icono nombre="reloj" className="h-5 w-5 text-suave" />
        <p className="flex-1">Prueba sin vencimiento</p>
        <button type="button" className="text-marca hover:underline" onClick={() => a.extender(f, DIAS_PRUEBA)}>
          Darle {DIAS_PRUEBA} días desde hoy
        </button>
      </div>
    );
  }
  if (!prueba) return <div className="h-[92px] rounded-2xl bg-stone-50" />;
  const color = prueba.vencida ? "bg-red-500" : prueba.quedan <= 4 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="space-y-2.5 rounded-2xl bg-stone-50 px-4 py-3">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold">
          {prueba.vencida ? "Prueba vencida" : `Prueba · día ${Math.min(prueba.total, prueba.usados + 1)} de ${prueba.total}`}
        </span>
        <span
          className={`text-xs font-semibold ${prueba.vencida ? "text-red-600" : prueba.quedan <= 4 ? "text-amber-600" : "text-suave"}`}
        >
          {prueba.vencida
            ? `venció el ${fecha(prueba.fin, false)}`
            : `${plural(prueba.quedan, "día restante", "días restantes")}`}
        </span>
      </div>
      <Barra partes={prueba.total} llenas={prueba.usados} color={color} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-suave">
        <span>
          {plural(prueba.usados, "día usado", "días usados")} · termina el {fecha(prueba.fin, false)}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          className="font-semibold text-marca hover:underline"
          disabled={a.pendiente}
          onClick={() => a.extender(f, 7)}
        >
          +7 días
        </button>
        <label className="inline-flex items-center gap-1">
          Fin
          <input
            type="date"
            value={isoDia(prueba.fin)}
            onChange={(e) => e.target.value && a.finPrueba(f, e.target.value)}
            className="rounded-lg border border-borde bg-superficie px-1.5 py-0.5 text-xs"
          />
        </label>
        <button type="button" className="hover:text-tinta" onClick={() => a.extender(f, null)}>
          Sin vencimiento
        </button>
      </div>
    </div>
  );
}

// Contador de días como cliente pago y avance del período actual (próximo cobro).
function BloquePlan({ f, ahora, acciones: a }: { f: FilaAdmin; ahora: number | null; acciones: Acciones }) {
  const campoFecha = (
    <input
      type="date"
      value={f.plan_inicio ?? ""}
      onChange={(e) => a.planInicio(f, e.target.value)}
      className="rounded-lg border border-borde bg-superficie px-1.5 py-0.5 text-xs"
      aria-label="Inicio del plan"
    />
  );
  if (!f.plan_inicio) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-stone-50 px-4 py-3 text-sm">
        <Icono nombre="calendario" className="h-5 w-5 text-suave" />
        <p className="flex-1">¿Desde cuándo paga? Marca el día en que empezó el plan.</p>
        {campoFecha}
      </div>
    );
  }
  if (ahora == null) return <div className="h-[92px] rounded-2xl bg-stone-50" />;
  const p = periodoPlan(f.plan_inicio, f.ciclo, new Date(ahora));
  return (
    <div className="space-y-2.5 rounded-2xl bg-stone-50 px-4 py-3">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold">
          {p.futuro ? "Empieza pronto" : `Cliente hace ${plural(p.dias, "día", "días")}`}
          <span className="font-normal text-suave"> · paga {f.ciclo === "anual" ? "por año" : "por mes"}</span>
        </span>
        <span className="text-xs font-semibold text-suave">{formatoPrecio(PRECIO[f.plan] ?? 0, "CLP")}/mes</span>
      </div>
      {!p.futuro && (
        <>
          <div className="h-2 overflow-hidden rounded-full bg-stone-200">
            <div className="h-full rounded-full bg-marca" style={{ width: `${(p.transcurridos / p.total) * 100}%` }} />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-suave">
            <span>
              {f.ciclo === "anual" ? "Año" : "Mes"} {p.periodos + 1} · próximo cobro el {fecha(p.proximo, false)} (
              {p.quedan === 0 ? "hoy" : `en ${plural(p.quedan, "día", "días")}`})
            </span>
            <div className="flex-1" />
            <label className="inline-flex items-center gap-1">Desde {campoFecha}</label>
          </div>
        </>
      )}
    </div>
  );
}

// Barra por días (hasta ~31 casillas); más allá, una barra continua.
function Barra({ partes, llenas, color }: { partes: number; llenas: number; color: string }) {
  if (partes > 31) {
    return (
      <div className="h-2 overflow-hidden rounded-full bg-stone-200">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${(llenas / partes) * 100}%` }} />
      </div>
    );
  }
  return (
    <div className="flex gap-[3px]" aria-hidden>
      {Array.from({ length: partes }, (_, i) => (
        <span key={i} className={`h-2 flex-1 rounded-full ${i < llenas ? color : "bg-stone-200"}`} />
      ))}
    </div>
  );
}

function Contacto({ f, texto }: { f: FilaAdmin; texto: string }) {
  const mensaje = `Hola, te escribo de Mesitto por la carta de ${f.nombre}. ${texto}: ¿te ayudo a elegir un plan para que siga en línea?`;
  const correo = f.duenos?.split(",")[0]?.trim();
  return (
    <span className="flex gap-1.5">
      {f.whatsapp && (
        <a
          href={`https://wa.me/${numeroWhatsapp(f.whatsapp)}?text=${encodeURIComponent(mensaje)}`}
          target="_blank"
          className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
        >
          <Icono nombre="whatsapp" className="h-4 w-4" /> WhatsApp
        </a>
      )}
      {correo && (
        <a
          href={`mailto:${correo}?subject=${encodeURIComponent(texto)}&body=${encodeURIComponent(mensaje)}`}
          className="inline-flex items-center gap-1 rounded-full border border-borde px-3 py-1.5 text-xs font-semibold hover:bg-stone-100"
        >
          Correo
        </a>
      )}
    </span>
  );
}

function Dato({
  titulo,
  valor,
  icono,
  acento,
  ayuda,
}: {
  titulo: string;
  valor: string;
  icono: string;
  acento?: boolean;
  ayuda?: string;
}) {
  return (
    <div className="tarjeta p-4" title={ayuda}>
      <div className="flex items-center gap-2">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-xl ${
            acento ? "bg-marca-claro text-marca-tinta" : "bg-stone-100 text-stone-500"
          }`}
        >
          <Icono nombre={icono} className="h-[18px] w-[18px]" />
        </span>
        <p className="text-xs text-suave">{titulo}</p>
      </div>
      <p className="mt-2 truncate text-xl font-semibold tabular-nums">{valor}</p>
    </div>
  );
}

function Cifra({ titulo, valor, nota }: { titulo: string; valor: number; nota?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-stone-50 px-1 py-2">
      <dd className="text-base font-semibold tabular-nums">{numero(valor)}</dd>
      <dt className="truncate text-[11px] text-suave">{titulo}</dt>
      {nota && <p className="text-[10px] text-amber-600">{nota}</p>}
    </div>
  );
}

function CrearParaCliente({ onCerrar }: { onCerrar: () => void }) {
  const [error, accion, pendiente] = useActionState(crearParaCliente, null);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onCerrar}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-crear"
        className="w-full max-w-md rounded-t-3xl border border-borde bg-superficie p-6 shadow-2xl sm:rounded-3xl"
      >
        <h2 id="titulo-crear" className="mb-4 text-lg font-semibold">
          Restaurante para un cliente
        </h2>
        <form action={accion} className="space-y-4">
          <p className="text-sm text-suave">
            Quedas como dueño para armarle la carta. Empieza con {DIAS_PRUEBA} días de prueba, el diseño Vitrina y las imágenes
            por defecto.
          </p>
          <CamposRestaurante />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="ejemplo" />
            Cargar 12 platos de ejemplo
          </label>
          {error && <Aviso>{error}</Aviso>}
          <div className="flex gap-3">
            <button type="button" onClick={onCerrar} className="boton-secundario flex-1">
              Cancelar
            </button>
            <button type="submit" className="boton flex-1" disabled={pendiente}>
              {pendiente ? "Creando…" : "Crear y editar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
