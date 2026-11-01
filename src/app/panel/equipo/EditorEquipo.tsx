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

export function EditorEquipo({
  restauranteId,
  iniciales,
  mesas = [],
  ordenInicial = [],
}: {
  restauranteId: string;
  iniciales: Miembro[];
  mesas?: MesaElegible[];
  // Orden elegido por el administrador (correos). Se guarda en los ajustes del restaurante, sin SQL.
  ordenInicial?: string[];
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
  const [enviando, setEnviando] = useState(false);
  const enlace = `${useUrlSitio()}/unirse`;
  const [perfil, setPerfil] = useState<Miembro | null>(null);
  // Sin la migración 0018 el equipo no trae perfiles: no se ofrece editarlos.
  const conPerfiles = miembros.some((m) => "avatar" in m);
  const nombreMesas = (ids?: string[] | null) =>
    (ids ?? [])
      .map((id) => mesas.find((m) => m.id === id)?.numero)
      .filter(Boolean)
      .join(", ");

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

  function mover(email: string, hacia: number) {
    const lista = miembros.map((m) => m.email);
    const desde = lista.indexOf(email);
    const destino = Math.max(0, Math.min(lista.length - 1, hacia));
    if (desde < 0 || desde === destino) return lista;
    lista.splice(destino, 0, ...lista.splice(desde, 1));
    setOrden(lista);
    return lista;
  }

  // Arrastrar con el dedo o el mouse desde la manija ⋮⋮ (igual que en cocina). Al soltar se guarda.
  function empezarArrastre(e: React.PointerEvent, email: string) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setArrastrando(email);
  }
  function arrastrar(e: React.PointerEvent) {
    if (!arrastrando) return;
    const lista = miembros.map((m) => m.email);
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
    guardarOrden(miembros.map((m) => m.email));
  }

  async function recargar() {
    const { data } = await supabase.rpc("equipo", { p_restaurante: restauranteId });
    if (data) setMiembros(data as Miembro[]);
  }

  async function invitar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const { data, error } = await supabase.rpc("invitar_miembro", { p_restaurante: restauranteId, p_email: email, p_rol: rol });
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
      ? await supabase.rpc("invitar_miembro", { p_restaurante: restauranteId, p_email: m.email, p_rol: nuevo })
      : await supabase.rpc("cambiar_rol", { p_restaurante: restauranteId, p_usuario: m.user_id, p_rol: nuevo });
    if (error) avisar(mensajeError(error), "error");
    else avisar("Rol actualizado");
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Equipo</h1>
        <p className="text-sm text-suave">Cada persona entra con su correo y ve solo lo que su rol permite.</p>
      </div>

      <form onSubmit={invitar} className="tarjeta space-y-3 p-5">
        <p className="font-semibold">Sumar a alguien</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_170px_auto]">
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
      </form>

      <div className="tarjeta divide-y divide-borde">
        {miembros.length > 1 && (
          <p className="px-5 py-2 text-xs text-suave">Arrastra ⋮⋮ (o usa las flechas) para ordenar el equipo como prefieras.</p>
        )}
        {miembros.map((m, i) => (
          <div
            key={m.email}
            ref={(el) => {
              if (el) filas.current.set(m.email, el);
              else filas.current.delete(m.email);
            }}
            className={`flex flex-wrap items-center gap-3 px-3 py-3 sm:px-5 ${arrastrando === m.email ? "relative z-10 bg-marca/10 shadow-lg" : ""}`}
          >
            {miembros.length > 1 && (
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
                    disabled={i === miembros.length - 1}
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
            <div className="flex w-full items-center justify-end gap-3 pl-12 sm:w-auto sm:pl-0">
              {conPerfiles && !m.pendiente && m.user_id && (
                <button type="button" onClick={() => setPerfil(m)} className="text-sm text-marca hover:underline">
                  {m.rol === "mesero" ? "Perfil y mesas" : "Perfil"}
                </button>
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
        ))}
      </div>

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
