"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { Icono } from "@/components/Icono";
import { LOCAL_EXTRA, PLANES, nombrePlan, type Plan } from "@/lib/marca";
import { rubroDe } from "@/lib/rubros";
import { NOMBRE_ROL, emojiSello, type Rol } from "@/lib/tipos";
import { formatoFecha, formatoPrecio, mensajeError, numeroWhatsapp } from "@/lib/utils";
import { cambiarCorreo, confirmarCuenta, enlaceNuevaClave, ponerClave } from "./acciones";

export type FilaAdmin = {
  id: string;
  slug: string;
  nombre: string;
  rubro: string;
  telefono: string | null;
  plan: Plan;
  estado: "prueba" | "activo" | "pausado";
  prueba_hasta: string;
  notas_admin: string | null;
  created_at: string;
  dueno_email: string | null;
  tarjetas: number;
  sellos_30d: number;
  ultima_actividad: string | null;
  max_locales: number;
  locales: number;
};

type Miembro = {
  user_id: string;
  email: string;
  nombre: string;
  rol: Rol;
  desde: string;
  ultimo_ingreso: string | null;
  confirmado: boolean;
};

type Filtro = "todos" | "activo" | "prueba" | "atencion";

const hoy = () => new Date().toISOString().slice(0, 10);
const sumarDias = (fecha: string, d: number) => {
  const base = fecha > hoy() ? new Date(`${fecha}T12:00:00`) : new Date();
  base.setDate(base.getDate() + d);
  return base.toISOString().slice(0, 10);
};
const precioDe = (f: FilaAdmin) => (PLANES[f.plan]?.precio ?? 0) + (f.plan === "cadena" ? Math.max(0, f.max_locales - 5) * LOCAL_EXTRA : 0);
const vencida = (f: FilaAdmin) => f.estado === "prueba" && f.prueba_hasta < hoy();

export function Admin({ filas, correo }: { filas: FilaAdmin[]; correo: string }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const avisar = useToast();
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [abierto, setAbierto] = useState<string | null>(null);

  const activos = filas.filter((f) => f.estado === "activo");
  const enPrueba = filas.filter((f) => f.estado === "prueba" && !vencida(f));
  const atencion = filas.filter((f) => f.estado === "pausado" || vencida(f));
  const mensual = activos.reduce((n, f) => n + precioDe(f), 0);
  const clientes = filas.reduce((n, f) => n + Number(f.tarjetas), 0);

  async function cambiar(
    f: FilaAdmin,
    c: { estado?: string; plan?: string; prueba_hasta?: string; notas?: string; max_locales?: number },
    ok = "Guardado",
  ) {
    const { error } = await supabase.rpc("admin_negocio", {
      p_id: f.id,
      p_estado: c.estado ?? null,
      p_plan: c.plan ?? null,
      p_prueba_hasta: c.prueba_hasta ?? null,
      p_notas: c.notas ?? null,
      p_max_locales: c.max_locales ?? null,
    });
    if (error) return avisar(mensajeError(error), "error");
    avisar(ok);
    router.refresh();
  }

  const texto = q.trim().toLowerCase();
  const visibles = filas
    .filter((f) => `${f.nombre} ${f.slug} ${f.dueno_email ?? ""} ${f.telefono ?? ""}`.toLowerCase().includes(texto))
    .filter((f) =>
      filtro === "todos"
        ? true
        : filtro === "activo"
          ? f.estado === "activo"
          : filtro === "prueba"
            ? f.estado === "prueba" && !vencida(f)
            : f.estado === "pausado" || vencida(f),
    );

  const FILTROS: [Filtro, string, number][] = [
    ["todos", "Todos", filas.length],
    ["activo", "Pagando", activos.length],
    ["prueba", "En prueba", enPrueba.length],
    ["atencion", "Vencidos o pausados", atencion.length],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-suave">Hola{correo ? `, ${correo.split("@")[0]}` : ""} 👋</p>
          <h1 className="text-[clamp(1.6rem,1.2rem+1.2vw,2.1rem)] font-bold leading-tight tracking-tight">
            Todos tus <span className="texto-degradado">negocios</span>
          </h1>
          <p className="text-sm text-suave">Planes, pruebas y soporte. Entra al panel de cualquiera como desarrollador.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Dato titulo="Negocios" valor={filas.length.toLocaleString("es-CL")} icono="restaurantes" tono="from-sky-400 to-blue-600" />
        <Dato titulo="Pagando" valor={activos.length.toLocaleString("es-CL")} icono="check" tono="from-emerald-400 to-teal-600" />
        <Dato titulo="En prueba" valor={enPrueba.length.toLocaleString("es-CL")} icono="reloj" tono="from-amber-400 to-orange-500" />
        <Dato titulo="Clientes con tarjeta" valor={clientes.toLocaleString("es-CL")} icono="personas" tono="from-indigo-400 to-violet-600" />
        <Dato
          titulo="Ingreso mensual (+ IVA)"
          valor={formatoPrecio(mensual, "CLP")}
          icono="estadisticas"
          tono="from-fuchsia-400 to-pink-600"
          ancho
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative w-full sm:w-80">
          <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-suave">
            <BuscarIcono />
          </span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar negocio, correo o teléfono…"
            aria-label="Buscar"
            className="campo py-2 pl-9 text-sm"
          />
        </label>
        <div className="sin-barra flex gap-1 overflow-x-auto">
          {FILTROS.map(([id, nombre, n]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFiltro(id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                filtro === id ? "bg-marca text-white shadow-sm" : "bg-superficie text-suave ring-1 ring-borde hover:text-tinta"
              }`}
            >
              {nombre} <span className="opacity-70">{n}</span>
            </button>
          ))}
        </div>
      </div>

      <ul className="space-y-3">
        {visibles.map((f) => (
          <Negocio
            key={f.id}
            f={f}
            abierto={abierto === f.id}
            onAbrir={() => setAbierto(abierto === f.id ? null : f.id)}
            cambiar={cambiar}
          />
        ))}
        {!visibles.length && <li className="tarjeta p-8 text-center text-sm text-suave">No hay negocios con ese filtro.</li>}
      </ul>
    </div>
  );
}

function Negocio({
  f,
  abierto,
  onAbrir,
  cambiar,
}: {
  f: FilaAdmin;
  abierto: boolean;
  onAbrir: () => void;
  cambiar: (f: FilaAdmin, c: { estado?: string; plan?: string; prueba_hasta?: string; notas?: string; max_locales?: number }, ok?: string) => Promise<unknown>;
}) {
  const rubro = rubroDe(f.rubro);
  const estado =
    f.estado === "activo"
      ? { texto: `Pagando · ${nombrePlan(f.plan)}`, clase: "bg-emerald-100 text-emerald-800 ring-emerald-500/30" }
      : f.estado === "pausado"
        ? { texto: "Pausado", clase: "bg-red-50 text-red-700 ring-red-500/30" }
        : vencida(f)
          ? { texto: "Prueba vencida", clase: "bg-red-50 text-red-700 ring-red-500/30" }
          : {
              texto: `Prueba hasta el ${formatoFecha(`${f.prueba_hasta}T12:00:00`, { day: "numeric", month: "short" })}`,
              clase: "bg-amber-50 text-amber-900 ring-amber-500/30",
            };

  return (
    <li className="tarjeta overflow-hidden">
      <div className="flex flex-wrap items-start gap-4 p-4 sm:p-5">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-stone-100 text-2xl ring-1 ring-borde" aria-hidden>
          {emojiSello(rubro.icono)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-lg font-semibold leading-tight">{f.nombre}</p>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${estado.clase}`}>{estado.texto}</span>
          </div>
          <p className="mt-0.5 truncate text-sm text-suave">
            {rubro.nombre} · {f.dueno_email ?? "sin dueño"}
            {f.telefono && (
              <>
                {" · "}
                <a href={`https://wa.me/${numeroWhatsapp(f.telefono)}`} target="_blank" rel="noreferrer" className="text-marca hover:underline">
                  {f.telefono}
                </a>
              </>
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Chip icono="personas">{Number(f.tarjetas).toLocaleString("es-CL")} clientes</Chip>
            <Chip icono="sellos">{Number(f.sellos_30d).toLocaleString("es-CL")} visitas en 30 días</Chip>
            <Chip icono="ubicacion">
              {f.locales} de {f.max_locales} locales
            </Chip>
            <Chip icono="reloj">
              Última actividad {f.ultima_actividad ? formatoFecha(f.ultima_actividad, { day: "numeric", month: "short" }) : "—"}
            </Chip>
            <Chip icono="calendario">Alta {formatoFecha(f.created_at, { day: "numeric", month: "short", year: "2-digit" })}</Chip>
            {f.estado === "activo" && <Chip icono="estrella">{formatoPrecio(precioDe(f), "CLP")} / mes</Chip>}
          </div>
          {f.notas_admin && (
            <p className="mt-3 rounded-xl bg-stone-50 px-3 py-2 text-xs text-suave ring-1 ring-borde">
              <b className="text-tinta">Notas:</b> {f.notas_admin}
            </p>
          )}
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-col sm:items-stretch">
          <a href={`/panel/soporte?n=${f.id}`} className="boton flex-1 py-2 sm:flex-none">
            <Icono nombre="externo" className="h-4 w-4" /> Entrar al panel
          </a>
          <button type="button" onClick={onAbrir} className="boton-secundario flex-1 py-2 sm:flex-none" aria-expanded={abierto}>
            <Icono nombre="personalizar" className="h-4 w-4" /> {abierto ? "Cerrar" : "Gestionar"}
          </button>
        </div>
      </div>
      {abierto && <Gestion f={f} cambiar={cambiar} />}
    </li>
  );
}

function Gestion({
  f,
  cambiar,
}: {
  f: FilaAdmin;
  cambiar: (f: FilaAdmin, c: { estado?: string; plan?: string; prueba_hasta?: string; notas?: string; max_locales?: number }, ok?: string) => Promise<unknown>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const avisar = useToast();
  const [miembros, setMiembros] = useState<Miembro[] | null>(null);
  const [datos, setDatos] = useState({ nombre: f.nombre, slug: f.slug, telefono: f.telefono ?? "" });
  const [notas, setNotas] = useState(f.notas_admin ?? "");
  const [locales, setLocales] = useState(f.max_locales);
  const [borrar, setBorrar] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    supabase.rpc("admin_miembros", { p_negocio: f.id }).then(({ data, error }) => {
      if (error) avisar(mensajeError(error), "error");
      setMiembros((data ?? []) as Miembro[]);
    });
  }, [supabase, f.id, avisar]);

  async function guardarDatos(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    const { error } = await supabase.rpc("admin_datos_negocio", {
      p_id: f.id,
      p_nombre: datos.nombre,
      p_slug: datos.slug,
      p_telefono: datos.telefono,
    });
    setOcupado(false);
    if (error) return avisar(mensajeError(error), "error");
    avisar("Datos guardados");
    router.refresh();
  }

  async function borrarNegocio() {
    if (!confirm(`¿Borrar ${f.nombre} con todos sus clientes y sellos? No se puede deshacer.`)) return;
    setOcupado(true);
    const { error } = await supabase.rpc("admin_borrar_negocio", { p_id: f.id, p_slug: borrar });
    setOcupado(false);
    if (error) return avisar(mensajeError(error), "error");
    avisar("Negocio borrado");
    router.refresh();
  }

  return (
    <div className="grid gap-4 border-t border-borde bg-stone-50/60 p-4 sm:p-5 lg:grid-cols-2">
      <Seccion titulo="Plan y prueba">
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-stone-100 p-1">
          {(Object.keys(PLANES) as Plan[]).map((id) => {
            const elegido = f.estado === "activo" && f.plan === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => cambiar(f, { estado: "activo", plan: id }, `Plan ${PLANES[id].nombre} activado`)}
                className={`rounded-xl px-2 py-2 text-sm font-medium transition ${
                  elegido ? "bg-superficie text-tinta shadow-sm ring-1 ring-borde" : "text-suave hover:text-tinta"
                }`}
              >
                {PLANES[id].nombre}
                <span className="block text-[11px] font-normal text-suave">{formatoPrecio(PLANES[id].precio, "CLP")}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="boton-secundario py-2"
            onClick={() => cambiar(f, { estado: "prueba", prueba_hasta: sumarDias(f.prueba_hasta, 14) }, "Prueba alargada 14 días")}
          >
            +14 días de prueba
          </button>
          {f.estado === "pausado" ? (
            <button type="button" className="boton-secundario py-2" onClick={() => cambiar(f, { estado: "activo" }, "Reactivado")}>
              Reactivar
            </button>
          ) : (
            <button type="button" className="boton-secundario py-2 text-red-700" onClick={() => cambiar(f, { estado: "pausado" }, "Pausado")}>
              Pausar
            </button>
          )}
        </div>
        <div className="flex items-end gap-2">
          <label className="block flex-1 text-sm">
            <span className="etiqueta-campo">Locales que permite (Cadena incluye 5)</span>
            <input
              type="number"
              min={1}
              max={200}
              value={locales}
              onChange={(e) => setLocales(Math.max(1, Math.min(200, Math.round(Number(e.target.value) || 1))))}
              className="campo py-2"
            />
          </label>
          <button
            type="button"
            className="boton-secundario py-2"
            disabled={locales === f.max_locales}
            onClick={() => cambiar(f, { max_locales: locales }, "Locales actualizados")}
          >
            Guardar
          </button>
        </div>
      </Seccion>

      <Seccion titulo="Datos del negocio">
        <form onSubmit={guardarDatos} className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="etiqueta-campo">Nombre</span>
            <input required maxLength={80} value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} className="campo py-2" />
          </label>
          <label className="block text-sm">
            <span className="etiqueta-campo">Dirección (/u/…)</span>
            <input
              required
              pattern="[a-z0-9][a-z0-9\-]{1,48}[a-z0-9]"
              value={datos.slug}
              onChange={(e) => setDatos({ ...datos, slug: e.target.value.toLowerCase() })}
              className="campo py-2 font-mono text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="etiqueta-campo">Teléfono</span>
            <input maxLength={30} value={datos.telefono} onChange={(e) => setDatos({ ...datos, telefono: e.target.value })} className="campo py-2" />
          </label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button className="boton py-2" disabled={ocupado}>
              Guardar datos
            </button>
            <a href={`/u/${f.slug}`} target="_blank" rel="noreferrer" className="text-sm text-marca hover:underline">
              Ver página para unirse ↗
            </a>
          </div>
        </form>
      </Seccion>

      <Seccion titulo="Equipo y acceso" ancho>
        {miembros === null ? (
          <p className="text-sm text-suave">Cargando…</p>
        ) : miembros.length === 0 ? (
          <p className="text-sm text-suave">Este negocio no tiene cuentas.</p>
        ) : (
          <ul className="divide-y divide-borde overflow-hidden rounded-2xl ring-1 ring-borde">
            {miembros.map((m) => (
              <Persona key={m.user_id} m={m} onCambio={() => supabase.rpc("admin_miembros", { p_negocio: f.id }).then(({ data }) => setMiembros((data ?? []) as Miembro[]))} />
            ))}
          </ul>
        )}
      </Seccion>

      <Seccion titulo="Notas (solo tú las ves)">
        <textarea rows={3} maxLength={1000} value={notas} onChange={(e) => setNotas(e.target.value)} className="campo resize-none text-sm" />
        <button type="button" className="boton-secundario self-start py-2" disabled={notas === (f.notas_admin ?? "")} onClick={() => cambiar(f, { notas }, "Notas guardadas")}>
          Guardar notas
        </button>
      </Seccion>

      <Seccion titulo="Borrar negocio" peligro>
        <p className="text-sm text-suave">
          Borra el negocio con sus clientes, sellos y premios. Las cuentas de las personas no se borran. Escribe <b className="font-mono text-tinta">{f.slug}</b> para
          confirmar.
        </p>
        <div className="flex gap-2">
          <input value={borrar} onChange={(e) => setBorrar(e.target.value)} placeholder={f.slug} className="campo py-2 font-mono text-sm" aria-label="Dirección del negocio" />
          <button
            type="button"
            className="boton shrink-0 bg-red-600 py-2 hover:bg-red-700"
            disabled={ocupado || borrar.trim().toLowerCase() !== f.slug}
            onClick={borrarNegocio}
          >
            Borrar
          </button>
        </div>
      </Seccion>
    </div>
  );
}

function Persona({ m, onCambio }: { m: Miembro; onCambio: () => void }) {
  const avisar = useToast();
  const [enlace, setEnlace] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function correr(fn: () => Promise<{ ok: boolean; error?: string; enlace?: string }>, ok: string) {
    setOcupado(true);
    const r = await fn();
    setOcupado(false);
    if (!r.ok) return avisar(r.error ?? "No se pudo", "error");
    if (r.enlace) setEnlace(r.enlace);
    avisar(ok);
    onCambio();
  }

  return (
    <li className="space-y-2 bg-superficie/60 p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="icono-activo grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold">
          {(m.nombre || m.email).charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {m.nombre || m.email.split("@")[0]} <span className="font-normal text-suave">· {NOMBRE_ROL[m.rol] ?? m.rol}</span>
          </p>
          <p className="truncate text-xs text-suave">
            {m.email} · {m.ultimo_ingreso ? `entró el ${formatoFecha(m.ultimo_ingreso, { day: "numeric", month: "short" })}` : "nunca ha entrado"}
            {!m.confirmado && <span className="ml-1 font-semibold text-amber-900">· sin confirmar</span>}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 text-xs">
        <button type="button" disabled={ocupado} className="boton-secundario px-3 py-1.5 text-xs" onClick={() => correr(() => enlaceNuevaClave(m.email), "Enlace listo para copiar")}>
          <Icono nombre="candado" className="h-3.5 w-3.5" /> Enlace para nueva contraseña
        </button>
        <button
          type="button"
          disabled={ocupado}
          className="boton-secundario px-3 py-1.5 text-xs"
          onClick={() => {
            const clave = prompt(`Contraseña nueva para ${m.email} (mínimo 8 caracteres)`);
            if (clave) correr(() => ponerClave(m.user_id, clave), "Contraseña cambiada");
          }}
        >
          <Icono nombre="lapiz" className="h-3.5 w-3.5" /> Poner contraseña
        </button>
        <button
          type="button"
          disabled={ocupado}
          className="boton-secundario px-3 py-1.5 text-xs"
          onClick={() => {
            const email = prompt("Correo nuevo para entrar", m.email);
            if (email && email !== m.email) correr(() => cambiarCorreo(m.user_id, email), "Correo cambiado");
          }}
        >
          <Icono nombre="correo" className="h-3.5 w-3.5" /> Cambiar correo
        </button>
        {!m.confirmado && (
          <button type="button" disabled={ocupado} className="boton-secundario px-3 py-1.5 text-xs" onClick={() => correr(() => confirmarCuenta(m.user_id), "Cuenta confirmada")}>
            <Icono nombre="check" className="h-3.5 w-3.5" /> Confirmar cuenta
          </button>
        )}
      </div>
      {enlace && (
        <div className="flex items-center gap-2 rounded-xl bg-stone-100 p-2">
          <input readOnly value={enlace} className="min-w-0 flex-1 bg-transparent font-mono text-[11px] text-suave outline-none" onFocus={(e) => e.target.select()} />
          <button
            type="button"
            className="boton px-3 py-1.5 text-xs"
            onClick={() => navigator.clipboard.writeText(enlace).then(() => avisar("Copiado. Dura 1 hora."))}
          >
            <Icono nombre="copiar" className="h-3.5 w-3.5" /> Copiar
          </button>
        </div>
      )}
    </li>
  );
}

function Seccion({ titulo, children, ancho, peligro }: { titulo: string; children: React.ReactNode; ancho?: boolean; peligro?: boolean }) {
  return (
    <section className={`tarjeta flex flex-col gap-3 p-4 ${ancho ? "lg:col-span-2" : ""} ${peligro ? "ring-1 ring-red-500/25" : ""}`}>
      <h3 className={`text-sm font-semibold ${peligro ? "text-red-700" : ""}`}>{titulo}</h3>
      {children}
    </section>
  );
}

function Chip({ icono, children }: { icono: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-suave ring-1 ring-borde">
      <Icono nombre={icono} className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

function Dato({ titulo, valor, icono, tono, ancho }: { titulo: string; valor: string; icono: string; tono: string; ancho?: boolean }) {
  return (
    <div className={`tarjeta relative overflow-hidden p-4 ${ancho ? "col-span-2 lg:col-span-1" : ""}`}>
      <span aria-hidden className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${tono} opacity-20 blur-2xl`} />
      <div className="flex items-center gap-2">
        <span className={`grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br ${tono} text-white shadow-lg`}>
          <Icono nombre={icono} className="h-4 w-4" />
        </span>
        <p className="text-xs font-medium text-suave">{titulo}</p>
      </div>
      <p className="mt-3 text-[1.7rem] font-bold leading-none tracking-tight tabular-nums">{valor}</p>
    </div>
  );
}

function BuscarIcono() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
