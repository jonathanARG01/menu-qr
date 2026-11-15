"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MARCA } from "@/lib/marca";
import { useToast } from "@/components/Toast";
import { Icono } from "@/components/Icono";
import { NOMBRE_ROL, TEXTO_ROL, type Negocio, type Rol, type Sucursal } from "@/lib/tipos";
import { mensajeError, urlSitio } from "@/lib/utils";

type Miembro = { user_id: string; rol: Rol; nombre: string; created_at: string; sucursal_id: string | null };
type Invitacion = { codigo: string; rol: Rol; nombre: string; expira_at: string };

// Equipo: quién puede sumar sellos. Se invita con un enlace (vale 7 días y una sola vez).
export function Equipo({
  negocio,
  yo,
  miembros,
  invitaciones,
  sucursales,
}: {
  negocio: Negocio;
  yo: string;
  miembros: Miembro[];
  invitaciones: Invitacion[];
  sucursales: Sucursal[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const avisar = useToast();
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<Rol>("empleado");
  const [creando, setCreando] = useState(false);

  async function invitar(e: React.FormEvent) {
    e.preventDefault();
    setCreando(true);
    const { error } = await supabase.from("invitaciones").insert({ negocio_id: negocio.id, rol, nombre: nombre.trim() });
    setCreando(false);
    if (error) return avisar(mensajeError(error), "error");
    setNombre("");
    avisar("Invitación creada: envíale el enlace");
    router.refresh();
  }

  async function borrarInvitacion(codigo: string) {
    const { error } = await supabase.from("invitaciones").delete().eq("codigo", codigo);
    if (error) return avisar(mensajeError(error), "error");
    router.refresh();
  }

  async function sacar(m: Miembro) {
    if (!confirm(`¿Sacar a ${m.nombre || "esta persona"} del equipo? Ya no podrá entrar a ${negocio.nombre}.`)) return;
    const { error } = await supabase.from("miembros").delete().eq("negocio_id", negocio.id).eq("user_id", m.user_id);
    if (error) return avisar(mensajeError(error), "error");
    router.refresh();
  }

  async function cambiarRol(m: Miembro, nuevo: Rol) {
    const { error } = await supabase.rpc("cambiar_rol", { p_negocio: negocio.id, p_usuario: m.user_id, p_rol: nuevo });
    if (error) return avisar(mensajeError(error), "error");
    avisar("Rol cambiado");
    router.refresh();
  }

  async function cambiarLocal(m: Miembro, local: string) {
    const { error } = await supabase
      .from("miembros")
      .update({ sucursal_id: local || null })
      .eq("negocio_id", negocio.id)
      .eq("user_id", m.user_id);
    if (error) return avisar(mensajeError(error), "error");
    avisar("Local asignado");
    router.refresh();
  }

  const enlace = (codigo: string) => `${urlSitio()}/equipo/${codigo}`;

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Equipo</h1>
        <p className="text-sm text-suave">Usuarios ilimitados en todos los planes. Cada uno entra con su correo.</p>
        <ul className="mt-2 space-y-0.5 text-xs text-suave">
          {(Object.keys(NOMBRE_ROL) as Rol[]).map((r) => (
            <li key={r}>
              <b className="text-tinta">{NOMBRE_ROL[r]}:</b> {TEXTO_ROL[r]}
            </li>
          ))}
        </ul>
      </div>

      <ul className="tarjeta divide-y divide-borde">
        {miembros.map((m) => (
          <li key={m.user_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {m.nombre || "Sin nombre"} {m.user_id === yo && <span className="text-suave">(tú)</span>}
              </span>
              <span className="text-xs text-suave">{NOMBRE_ROL[m.rol]}</span>
            </span>
            {sucursales.length > 0 && (
              <select
                value={m.sucursal_id ?? ""}
                onChange={(e) => cambiarLocal(m, e.target.value)}
                className="campo w-auto py-1 text-sm"
                aria-label="Local"
              >
                <option value="">Todos los locales</option>
                {sucursales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            )}
            {m.user_id !== yo && (
              <select value={m.rol} onChange={(e) => cambiarRol(m, e.target.value as Rol)} className="campo w-auto py-1 text-sm" aria-label="Rol">
                {(Object.keys(NOMBRE_ROL) as Rol[]).map((r) => (
                  <option key={r} value={r}>
                    {NOMBRE_ROL[r]}
                  </option>
                ))}
              </select>
            )}
            {m.user_id !== yo && (
              <button type="button" className="text-sm text-suave hover:text-red-600" onClick={() => sacar(m)}>
                Sacar
              </button>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={invitar} className="tarjeta space-y-3 p-5">
        <h2 className="font-semibold">Invitar a alguien</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={60}
            placeholder="Nombre (opcional)"
            aria-label="Nombre"
            className="campo"
          />
          <select value={rol} onChange={(e) => setRol(e.target.value as Rol)} className="campo" aria-label="Rol">
            <option value="empleado">Equipo</option>
            <option value="encargado">Encargado</option>
            <option value="dueno">Dueño o socio</option>
          </select>
          <button className="boton" disabled={creando}>
            Crear invitación
          </button>
        </div>
      </form>

      {invitaciones.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Invitaciones pendientes</h2>
          <ul className="tarjeta divide-y divide-borde">
            {invitaciones.map((i) => {
              const url = enlace(i.codigo);
              const wa = `https://wa.me/?text=${encodeURIComponent(
                `Hola${i.nombre ? ` ${i.nombre}` : ""}, te invito al equipo de ${negocio.nombre} en ${MARCA} para atender a los clientes: ${url}`,
              )}`;
              return (
                <li key={i.codigo} className="space-y-2 px-4 py-3 text-sm">
                  <p className="font-medium">
                    {i.nombre || "Invitación"} · {NOMBRE_ROL[i.rol]}
                  </p>
                  <p className="break-all font-mono text-xs text-suave">{url}</p>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#25d366] px-3 py-1.5 font-semibold text-white"
                    >
                      <Icono nombre="whatsapp" className="h-4 w-4" /> Enviar por WhatsApp
                    </a>
                    <button
                      type="button"
                      className="boton-secundario py-1.5"
                      onClick={() => navigator.clipboard.writeText(url).then(() => avisar("Enlace copiado"))}
                    >
                      Copiar enlace
                    </button>
                    <button type="button" className="text-suave hover:text-red-600" onClick={() => borrarInvitacion(i.codigo)}>
                      Anular
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
