"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { NOMBRE_ROL, type Rol } from "@/lib/salon";
import { mensajeError } from "@/lib/utils";
import { useUrlSitio } from "@/lib/useUrlSitio";
import { Avatar } from "@/components/Avatar";
import { EditorPerfil, type MesaElegible } from "./EditorPerfil";

export type Miembro = {
  user_id: string | null;
  email: string;
  rol: Rol;
  pendiente: boolean;
  soy_yo: boolean;
  // Migración 0018: perfil y mesas a cargo.
  nombre?: string | null;
  avatar?: string | null;
  color?: string | null;
  mesas?: string[] | null;
  // Migración 0031: local donde trabaja (todas = todas las sucursales; si no, sucursal_id vacío = principal).
  todas_sucursales?: boolean;
  sucursal_id?: string | null;
};

const ROLES: { id: Exclude<Rol, "staff">; puede: string[]; noPuede: string[] }[] = [
  {
    id: "dueno",
    puede: ["Todo: carta, precios, marca, plano, equipo y ajustes", "Cobrar, anular mesas y corregir pagos"],
    noPuede: [],
  },
  {
    id: "mesero",
    puede: ["Abrir mesas y tomar pedidos", "Cambiar lo pedido y dividir la cuenta", "Cobrar y registrar propinas"],
    noPuede: ["Cambiar precios ni platos de la carta", "Borrar pagos ya registrados"],
  },
  {
    id: "cocina",
    puede: ["Ver las comandas en tiempo real", "Marcarlas en preparación, listas o entregadas"],
    noPuede: ["Cobrar", "Cambiar la carta"],
  },
];

// Local de cada persona: "todas", "principal" o el id de la sucursal.
const TODAS = "todas";
const PRINCIPAL = "principal";
const claveLocal = (m: Miembro) => (m.todas_sucursales === false ? (m.sucursal_id ?? PRINCIPAL) : TODAS);

export function EditorEquipo({
  restauranteId,
  iniciales,
  mesas = [],
  ordenInicial = [],
  sucursales = [],
  nombrePrincipal = "Local principal",
}: {
  restauranteId: string;
  iniciales: Miembro[];
  mesas?: MesaElegible[];
  // Orden elegido por el administrador (correos). Se guarda en los ajustes del restaurante, sin SQL.
  ordenInicial?: string[];
  // Sucursales del restaurante (sin contar la principal) para asignar a cada persona su local.
  sucursales?: { id: string; nombre: string }[];
  nombrePrincipal?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const avisar = useToast();
  const [orden, setOrden] = useState(ordenInicial);
  const ordenar = (lista: Miembro[], o: string[]) => {
    const pos = (m: Miembro) => (o.includes(m.email) ? o.indexOf(m.email) : o.length + lista.indexOf(m));
    return [...lista].sort((a, b) => pos(a) - pos(b));
  };
  const [crudos, setMiembros] = useState(iniciales);
  const miembros = useMemo(() => ordenar(crudos, orden), [crudos, orden]);
  const filas = useRef<Map<string, HTMLDivElement>>(new Map());
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<Exclude<Rol, "staff">>("mesero");
  const [localNuevo, setLocalNuevo] = useState<string>(PRINCIPAL);
  const [enviando, setEnviando] = useState(false);
  const enlace = `${useUrlSitio()}/unirse`;
  const [perfil, setPerfil] = useState<Miembro | null>(null);
  // Sin la migración 0018 el equipo no trae perfiles: no se ofrece editarlos.
  const conPerfiles = miembros.some((m) => "avatar" in m);
  // Con sucursales y la migración 0031, cada persona tiene su local y el equipo se ve separado por local.
  const sqlLocales = miembros.some((m) => "todas_sucursales" in m);
  const conLocales = sucursales.length > 0 && sqlLocales;
  const [filtro, setFiltro] = useState<string>("");
  const nombreMesas = (ids?: string[] | null) =>
    (ids ?? [])
      .map((id) => mesas.find((m) => m.id === id)?.numero)
      .filter(Boolean)
      .join(", ");

  const locales = [
    { id: PRINCIPAL, nombre: `${nombrePrincipal} (principal)` },
    ...sucursales.map((s) => ({ id: s.id, nombre: s.nombre })),
    { id: TODAS, nombre: "Todas las sucursales" },
  ];
  // Grupos en pantalla: primero quienes ven todos los locales, luego el principal y cada sucursal.
  const grupos = conLocales
    ? [locales[locales.length - 1], ...locales.slice(0, -1)]
        .map((l) => ({ ...l, miembros: miembros.filter((m) => claveLocal(m) === l.id) }))
        .filter((g) => g.id !== TODAS || g.miembros.length > 0)
    : [{ id: "", nombre: "", miembros }];
  const gruposVisibles = grupos.filter((g) => !filtro || g.id === filtro);
  const grupoDe = (correo: string) => grupos.find((g) => g.miembros.some((m) => m.email === correo));

  // Guarda el orden en restaurantes.ajustes.orden_equipo, leyendo antes lo último guardado para no pisar otros ajustes.
  async function guardarOrden(nuevo: string[]) {
    const { data, error } = await supabase.from("restaurantes").select("ajustes").eq("id", restauranteId).single();
    if (error) return avisar(mensajeError(error), "error");
    const { error: e } = await supabase
      .from("restaurantes")
      .update({ ajustes: { ...(data?.ajustes ?? {}), orden_equipo: nuevo } })
      .eq("id", restauranteId);
    if (e) avisar(mensajeError(e), "error");
  }

  // Mueve a alguien dentro de su local. El orden total queda local por local, en el orden de los grupos.
  function mover(email: string, hacia: number) {
    const lista = grupos.map((g) => g.miembros.map((m) => m.email));
    const suyo = lista.find((g) => g.includes(email));
    if (!suyo) return lista.flat();
    const desde = suyo.indexOf(email);
    const destino = Math.max(0, Math.min(suyo.length - 1, hacia));
    if (desde === destino) return lista.flat();
    suyo.splice(destino, 0, ...suyo.splice(desde, 1));
    const total = lista.flat();
    setOrden(total);
    return total;
  }

  // Arrastrar con el dedo o el mouse desde la manija ⋮⋮ (igual que en cocina), dentro del mismo local. Al soltar se guarda.
  function empezarArrastre(e: React.PointerEvent, email: string) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setArrastrando(email);
  }
  function arrastrar(e: React.PointerEvent) {
    if (!arrastrando) return;
    const lista = (grupoDe(arrastrando)?.miembros ?? []).map((m) => m.email);
    let hacia = lista.length;
    for (let i = 0; i < lista.length; i++) {
      const caja = filas.current.get(lista[i])?.getBoundingClientRect();
      if (caja && e.clientY < caja.top + caja.height / 2) {
        hacia = i;
        break;
      }
    }
    const desde = lista.indexOf(arrastrando);
    // Bajando, la fila arrastrada sigue contada arriba: el lugar real es uno menos.
    if (hacia > desde) hacia -= 1;
    if (hacia !== desde) mover(arrastrando, hacia);
  }
  function soltar() {
    if (!arrastrando) return;
    setArrastrando(null);
    guardarOrden(grupos.flatMap((g) => g.miembros.map((m) => m.email)));
  }

  async function recargar() {
    const { data } = await supabase.rpc("equipo", { p_restaurante: restauranteId });
    if (data) setMiembros(data as Miembro[]);
  }

  // "todas" → todas las sucursales; "principal" → el local principal; si no, el id de la sucursal.
  const paramsLocal = (clave: string) => ({
    p_todas: clave === TODAS,
    p_sucursal: clave === TODAS || clave === PRINCIPAL ? null : clave,
  });

  async function invitar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const { data, error } = await supabase.rpc("invitar_miembro", {
      p_restaurante: restauranteId,
      p_email: email,
      p_rol: rol,
      ...(conLocales ? paramsLocal(localNuevo) : {}),
    });
    setEnviando(false);
    if (error) return avisar(mensajeError(error), "error");
    avisar(
      data === "invitado"
        ? "Invitación guardada: cuando cree su cuenta con ese correo, entra directo."
        : data === "actualizado"
          ? "Rol actualizado"
          : "Ya es parte del equipo",
    );
    setEmail("");
    recargar();
  }

  async function cambiarRol(m: Miembro, nuevo: string) {
    const { error } = m.pendiente
      ? await supabase.rpc("invitar_miembro", {
          p_restaurante: restauranteId,
          p_email: m.email,
          p_rol: nuevo,
          // La invitación se vuelve a guardar: que no pierda su local.
          ...(conLocales ? paramsLocal(claveLocal(m)) : {}),
        })
      : await supabase.rpc("cambiar_rol", { p_restaurante: restauranteId, p_usuario: m.user_id, p_rol: nuevo });
    if (error) avisar(mensajeError(error), "error");
    else avisar("Rol actualizado");
    recargar();
  }

  async function cambiarLocal(m: Miembro, clave: string) {
    const { error } = await supabase.rpc("asignar_local", {
      p_restaurante: restauranteId,
      p_usuario: m.user_id,
      p_email: m.email,
      ...paramsLocal(clave),
    });
    if (error) return avisar(mensajeError(error), "error");
    avisar(`${m.nombre || m.email} ahora está en ${locales.find((l) => l.id === clave)?.nombre ?? "otro local"}`);
    recargar();
  }

  async function quitar(m: Miembro) {
    if (!confirm(`¿Quitar a ${m.email} del equipo?`)) return;
    const { error } = await supabase.rpc("quitar_miembro", {
      p_restaurante: restauranteId,
      p_usuario: m.user_id,
      p_email: m.email,
    });
    if (error) return avisar(mensajeError(error), "error");
    avisar("Quitado del equipo");
    recargar();
  }

  function fila(m: Miembro, i: number, delGrupo: Miembro[]) {
    const ordenable = delGrupo.length > 1;
    return (
      <div
        key={m.email}
        ref={(el) => {
          if (el) filas.current.set(m.email, el);
          else filas.current.delete(m.email);
        }}
        className={`flex flex-wrap items-center gap-3 px-3 py-3 sm:px-5 ${arrastrando === m.email ? "relative z-10 bg-marca/10 shadow-lg" : ""}`}
      >
        {ordenable && (
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              aria-label={`Arrastrar a ${m.email}`}
              title="Arrastrar para ordenar"
              onPointerDown={(e) => empezarArrastre(e, m.email)}
              onPointerMove={arrastrar}
              onPointerUp={soltar}
              onPointerCancel={soltar}
              className="cursor-grab touch-none select-none px-1 py-2 text-lg leading-none text-suave active:cursor-grabbing"
            >
              ⋮⋮
            </button>
            <span className="flex flex-col">
              <button
                type="button"
                aria-label="Subir"
                disabled={i === 0}
                onClick={() => guardarOrden(mover(m.email, i - 1))}
                className="px-1 text-xs text-suave hover:text-tinta disabled:opacity-30"
              >
                ▲
              </button>
              <button
                type="button"
                aria-label="Bajar"
                disabled={i === delGrupo.length - 1}
                onClick={() => guardarOrden(mover(m.email, i + 1))}
                className="px-1 text-xs text-suave hover:text-tinta disabled:opacity-30"
              >
                ▼
              </button>
            </span>
          </div>
        )}
        {!m.pendiente && (
          <Avatar
            persona={{ nombre: m.nombre || m.email.split("@")[0], avatar: m.avatar, color: m.color }}
            className="h-9 w-9 text-xs"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="break-all font-medium sm:truncate sm:break-normal">
            {m.nombre || m.email} {m.soy_yo && <span className="text-xs text-suave">(tú)</span>}
          </p>
          {m.nombre && <p className="truncate text-xs text-suave">{m.email}</p>}
          {m.pendiente && <p className="text-xs text-amber-700">Invitado: se suma al crear su cuenta</p>}
          {!!m.mesas?.length && <p className="truncate text-xs text-suave">Mesas a cargo: {nombreMesas(m.mesas)}</p>}
        </div>
        {/* En el celular los controles bajan a su propia línea: el correo se lee completo. */}
        <div className="flex w-full flex-wrap items-center justify-end gap-3 pl-12 sm:w-auto sm:pl-0">
          {conPerfiles && !m.pendiente && m.user_id && (
            <button type="button" onClick={() => setPerfil(m)} className="text-sm text-marca hover:underline">
              {m.rol === "mesero" ? "Perfil y mesas" : "Perfil"}
            </button>
          )}
          {conLocales && m.rol !== "staff" && (
            <select
              value={claveLocal(m)}
              onChange={(e) => cambiarLocal(m, e.target.value)}
              className="max-w-[12rem] rounded-lg border border-borde px-2 py-1.5 text-sm"
              aria-label={`Local de ${m.email}`}
              title="Local donde trabaja"
            >
              {locales.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
              ))}
            </select>
          )}
          {m.rol === "staff" ? (
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold">Soporte</span>
          ) : (
            <select
              value={m.rol}
              onChange={(e) => cambiarRol(m, e.target.value)}
              className="rounded-lg border border-borde px-2 py-1.5 text-sm"
              aria-label={`Rol de ${m.email}`}
            >
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {NOMBRE_ROL[r.id]}
                </option>
              ))}
            </select>
          )}
          {!m.soy_yo && m.rol !== "staff" && (
            <button type="button" onClick={() => quitar(m)} className="text-sm text-red-600 hover:underline">
              Quitar
            </button>
          )}
        </div>
      </div>
    );
  }

  const cuantas = (n: number) => `${n} ${n === 1 ? "persona" : "personas"}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Equipo</h1>
        <p className="text-sm text-suave">
          Cada persona entra con su correo y ve solo lo que su rol permite.
          {conLocales && " Con un local asignado, en Salón, Cocina y Para llevar ve solo lo de ese local."}
        </p>
      </div>

      <form onSubmit={invitar} className="tarjeta space-y-3 p-5">
        <p className="font-semibold">Sumar a alguien</p>
        <div
          className={`grid grid-cols-1 gap-3 ${conLocales ? "sm:grid-cols-[minmax(0,1fr)_150px_190px_auto]" : "sm:grid-cols-[minmax(0,1fr)_170px_auto]"}`}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@ejemplo.com"
            className="campo"
            aria-label="Correo"
          />
          <select value={rol} onChange={(e) => setRol(e.target.value as typeof rol)} className="campo" aria-label="Rol">
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {NOMBRE_ROL[r.id]}
              </option>
            ))}
          </select>
          {conLocales && (
            <select value={localNuevo} onChange={(e) => setLocalNuevo(e.target.value)} className="campo" aria-label="Local">
              {locales.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
              ))}
            </select>
          )}
          <button type="submit" className="boton" disabled={enviando}>
            {enviando ? "Guardando…" : "Sumar"}
          </button>
        </div>
        <p className="text-sm text-suave">
          Si todavía no tiene cuenta, pásale este enlace para que la cree con ese mismo correo:{" "}
          <button
            type="button"
            className="font-medium text-marca underline"
            onClick={() => navigator.clipboard?.writeText(enlace).then(() => avisar("Enlace copiado"))}
          >
            {enlace}
          </button>
        </p>
        {sucursales.length > 0 && !sqlLocales && (
          <p className="text-sm text-amber-700">
            Para asignar a cada persona su sucursal falta ejecutar el SQL <code>0031_equipo_por_sucursal.sql</code> en Supabase.
          </p>
        )}
      </form>

      {conLocales && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Ver local">
          {[{ id: "", nombre: "Todos", miembros }, ...grupos].map((g) => (
            <button
              key={g.id || "todos"}
              type="button"
              aria-pressed={filtro === g.id}
              onClick={() => setFiltro(g.id)}
              className={`rounded-full border px-3 py-1.5 text-sm ${filtro === g.id ? "border-marca bg-marca text-white" : "border-borde hover:bg-stone-50"}`}
            >
              {g.nombre} <span className="opacity-70">· {g.miembros.length}</span>
            </button>
          ))}
        </div>
      )}

      {gruposVisibles.map((g) => (
        <section key={g.id || "equipo"} className="space-y-2">
          {conLocales && (
            <div className="flex items-baseline justify-between gap-2 px-1">
              <h2 className="font-semibold">{g.nombre}</h2>
              <span className="text-sm text-suave">{cuantas(g.miembros.length)}</span>
            </div>
          )}
          <div className="tarjeta divide-y divide-borde">
            {g.miembros.length > 1 && (
              <p className="px-5 py-2 text-xs text-suave">
                Arrastra ⋮⋮ (o usa las flechas) para ordenar {conLocales ? "a la gente de este local" : "el equipo"} como prefieras.
              </p>
            )}
            {g.miembros.length === 0 && (
              <p className="px-5 py-4 text-sm text-suave">Nadie asignado todavía. Elige este local al sumar a alguien o en su fila.</p>
            )}
            {g.miembros.map((m, i) => fila(m, i, g.miembros))}
          </div>
        </section>
      ))}

      {perfil?.user_id && (
        <EditorPerfil
          supabase={supabase}
          restauranteId={restauranteId}
          usuarioId={perfil.user_id}
          correo={perfil.email}
          inicial={{ nombre: perfil.nombre ?? null, avatar: perfil.avatar ?? null, color: perfil.color ?? null }}
          mesas={perfil.rol === "mesero" || perfil.rol === "dueno" ? mesas : undefined}
          mesasIniciales={perfil.mesas ?? []}
          onCerrar={() => setPerfil(null)}
          onGuardado={() => {
            setPerfil(null);
            recargar();
          }}
        />
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {ROLES.map((r) => (
          <div key={r.id} className="tarjeta p-4 text-sm">
            <p className="mb-2 font-semibold">{NOMBRE_ROL[r.id]}</p>
            <ul className="space-y-1">
              {r.puede.map((t) => (
                <li key={t} className="flex gap-1.5">
                  <span className="text-emerald-600">✓</span> {t}
                </li>
              ))}
              {r.noPuede.map((t) => (
                <li key={t} className="flex gap-1.5 text-suave">
                  <span className="text-red-500">✕</span> {t}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
