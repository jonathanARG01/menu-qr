"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { NOMBRE_ROL, type Rol } from "@/lib/salon";
import { mensajeError } from "@/lib/utils";
import { useUrlSitio } from "@/lib/useUrlSitio";

export type Miembro = { user_id: string | null; email: string; rol: Rol; pendiente: boolean; soy_yo: boolean };

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

export function EditorEquipo({ restauranteId, iniciales }: { restauranteId: string; iniciales: Miembro[] }) {
  const supabase = useMemo(() => createClient(), []);
  const avisar = useToast();
  const [miembros, setMiembros] = useState(iniciales);
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<Exclude<Rol, "staff">>("mesero");
  const [enviando, setEnviando] = useState(false);
  const enlace = `${useUrlSitio()}/unirse`;

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
        <div className="grid gap-3 sm:grid-cols-[1fr_170px_auto]">
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
        {miembros.map((m) => (
          <div key={m.email} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {m.email} {m.soy_yo && <span className="text-xs text-suave">(tú)</span>}
              </p>
              {m.pendiente && <p className="text-xs text-amber-700">Invitado: se suma al crear su cuenta</p>}
            </div>
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
        ))}
      </div>

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
