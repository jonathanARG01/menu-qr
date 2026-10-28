"use client";

import { useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Avatar, colorDe } from "@/components/Avatar";
import { useToast } from "@/components/Toast";
import { borrarFoto, subirFoto } from "@/lib/fotos";
import { olvidarEquipo } from "@/lib/equipo";
import { mensajeError } from "@/lib/utils";
import { nombreMesa } from "@/lib/salon";

const EMOJIS = ["😀", "😎", "🧑‍🍳", "👩‍🍳", "🍕", "🍔", "🌮", "🍣", "☕", "🍷", "🍹", "🔥", "⭐", "🌵", "🐱", "🐶"];
const COLORES = ["#e76f51", "#2a9d8f", "#e9c46a", "#8e7dbe", "#f4a261", "#4d908e", "#577590", "#d1495b", "#1f2937"];

export type Perfil = { nombre: string | null; avatar: string | null; color: string | null };
export type MesaElegible = { id: string; numero: string; piso: string | null };

// Perfil de alguien del equipo: nombre visible, foto o emoji (o sus iniciales) y color. Para meseros, las mesas a cargo.
// Todo es opcional. Lo edita el administrador para cualquiera, o cada persona el suyo desde el menú.
export function EditorPerfil({
  supabase,
  restauranteId,
  usuarioId,
  correo,
  inicial,
  mesas,
  mesasIniciales = [],
  onCerrar,
  onGuardado,
}: {
  supabase: SupabaseClient;
  restauranteId: string;
  usuarioId: string;
  correo: string;
  inicial: Perfil;
  // Solo para meseros y si lo edita el administrador.
  mesas?: MesaElegible[];
  mesasIniciales?: string[];
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const avisar = useToast();
  const [nombre, setNombre] = useState(inicial.nombre ?? "");
  const [avatar, setAvatar] = useState(inicial.avatar ?? "");
  const [color, setColor] = useState(inicial.color ?? "");
  const [elegidas, setElegidas] = useState<string[]>(mesasIniciales);
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);
  const subidas = useRef<string[]>([]);
  const base = correo.split("@")[0];

  async function elegirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setSubiendo(true);
    try {
      const url = await subirFoto(supabase, restauranteId, f, 256, `equipo/${usuarioId}-`);
      subidas.current.push(url);
      setAvatar(url);
    } catch (err) {
      avisar(mensajeError(err), "error");
    } finally {
      setSubiendo(false);
    }
  }

  function cerrar() {
    subidas.current.forEach((u) => borrarFoto(supabase, u));
    onCerrar();
  }

  async function guardar() {
    setGuardando(true);
    const { error } = await supabase.rpc("guardar_perfil", {
      p_restaurante: restauranteId,
      p_usuario: usuarioId,
      p_nombre: nombre.trim() || null,
      p_avatar: avatar || null,
      p_color: color || null,
    });
    if (!error && mesas) {
      const r = await supabase.rpc("asignar_mesas", { p_restaurante: restauranteId, p_usuario: usuarioId, p_mesas: elegidas });
      if (r.error) {
        setGuardando(false);
        return avisar(mensajeError(r.error), "error");
      }
    }
    setGuardando(false);
    if (error) {
      return avisar(
        /guardar_perfil|function/.test(error.message) ? "Falta ejecutar el SQL 0018 en Supabase." : mensajeError(error),
        "error",
      );
    }
    // Las fotos que se subieron y no quedaron, y la anterior si se cambió.
    [...subidas.current, inicial.avatar].filter((u) => u && u !== avatar && u.startsWith("https://")).forEach((u) => borrarFoto(supabase, u));
    olvidarEquipo();
    avisar("Perfil guardado");
    onGuardado();
  }

  const vista = { nombre: nombre.trim() || base, avatar, color };
  const pisos = [...new Set((mesas ?? []).map((m) => m.piso ?? ""))];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={cerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Perfil"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-md flex-col rounded-t-2xl bg-superficie shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center gap-3 border-b border-borde px-5 py-4">
          <Avatar persona={vista} className="h-12 w-12 text-base" titulo={false} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{vista.nombre}</p>
            <p className="truncate text-xs text-suave">{correo}</p>
          </div>
        </div>
        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <label className="block text-sm font-medium">
            Nombre que ve el equipo
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={40}
              placeholder={base}
              className="campo mt-1"
            />
          </label>

          <div>
            <p className="mb-1.5 text-sm font-medium">Foto o emoji</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => archivo.current?.click()}
                disabled={subiendo}
                className="rounded-lg border border-borde px-2.5 py-1.5 text-sm hover:border-marca"
              >
                {subiendo ? "Subiendo…" : "📷 Subir foto"}
              </button>
              <button
                type="button"
                onClick={() => setAvatar("")}
                aria-pressed={!avatar}
                className={`rounded-lg border px-2.5 py-1.5 text-sm ${!avatar ? "border-marca bg-marca/10" : "border-borde"}`}
              >
                Iniciales
              </button>
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setAvatar(e)}
                  aria-pressed={avatar === e}
                  className={`h-9 w-9 rounded-lg border text-lg ${avatar === e ? "border-marca bg-marca/10" : "border-borde"}`}
                >
                  {e}
                </button>
              ))}
            </div>
            <input ref={archivo} type="file" accept="image/*" className="hidden" onChange={elegirFoto} />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium">Color</p>
            <div className="flex flex-wrap gap-2">
              {COLORES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  aria-pressed={(color || colorDe(vista.nombre)) === c}
                  className={`h-8 w-8 rounded-full ring-offset-2 ${(color || colorDe(vista.nombre)) === c ? "ring-2 ring-tinta" : ""}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          {mesas && (
            <div>
              <p className="text-sm font-medium">Mesas a cargo</p>
              <p className="mb-2 text-xs text-suave">
                Se abren a su nombre y el resto del equipo ve un aviso antes de atenderlas. Así dos meseros no van a la misma mesa.
              </p>
              {mesas.length === 0 ? (
                <p className="text-sm text-suave">Todavía no hay mesas en el plano.</p>
              ) : (
                pisos.map((piso) => (
                  <div key={piso} className="mb-2">
                    {pisos.length > 1 && <p className="mb-1 text-xs font-semibold text-suave">{piso || "Sin piso"}</p>}
                    <div className="flex flex-wrap gap-1.5">
                      {mesas
                        .filter((m) => (m.piso ?? "") === piso)
                        .map((m) => {
                          const activa = elegidas.includes(m.id);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              aria-pressed={activa}
                              onClick={() => setElegidas((l) => (activa ? l.filter((x) => x !== m.id) : [...l, m.id]))}
                              className={`rounded-lg border px-2.5 py-1 text-sm ${activa ? "border-marca bg-marca text-white" : "border-borde"}`}
                            >
                              {nombreMesa(m.numero)}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2 border-t border-borde px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={cerrar} className="boton-secundario">
            Cancelar
          </button>
          <button type="button" onClick={guardar} disabled={guardando || subiendo} className="boton flex-1">
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
