"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { faltaFuncion } from "@/components/Autorizar";
import { NOMBRE_ROL, esAdmin, nombreVisible } from "@/lib/salon";
import { mensajeError } from "@/lib/utils";
import type { Miembro } from "./EditorEquipo";

type Pin = { user_id: string; tiene_pin: boolean; autoriza: boolean };

// PIN de cada persona del equipo y quién puede autorizar anulaciones y descuentos (migración 0023).
export function PinesEquipo({
  restauranteId,
  miembros,
  activo,
}: {
  restauranteId: string;
  miembros: Miembro[];
  // Si el restaurante pide el PIN (Personalizar).
  activo: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const avisar = useToast();
  const [pines, setPines] = useState<Map<string, Pin> | null>(null);
  const [falta, setFalta] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [pin, setPin] = useState("");

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc("pines_equipo", { p_restaurante: restauranteId });
    if (error) {
      setFalta(faltaFuncion(error));
      setPines(new Map());
      return;
    }
    setPines(new Map(((data ?? []) as Pin[]).map((p) => [p.user_id, p])));
  }, [supabase, restauranteId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardar(user: string, nuevo: string | null, autoriza: boolean | null) {
    const { error } = await supabase.rpc("guardar_pin", {
      p_restaurante: restauranteId,
      p_user: user,
      p_pin: nuevo,
      p_autoriza: autoriza,
    });
    if (error) return avisar(mensajeError(error), "error");
    avisar(nuevo ? "PIN guardado" : autoriza !== null ? "Listo" : "PIN borrado");
    setEditando(null);
    setPin("");
    await cargar();
  }

  const activos = miembros.filter((m) => m.user_id && !m.pendiente);

  return (
    <section id="pin" className="tarjeta scroll-mt-24 space-y-3 p-5">
      <div>
        <h2 className="font-semibold">PIN de autorización</h2>
        <p className="text-sm text-suave">
          Cada persona puede tener un PIN de 4 a 6 números. Con el PIN de un administrador o de alguien marcado “Autoriza”, un
          mesero puede anular una mesa, quitar algo que ya está en cocina o hacer un descuento. Todo queda en Reportes →
          Autorizaciones.
        </p>
        {!activo && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Hoy el PIN solo se pide para descuentos. Para pedirlo también al anular o quitar platos, actívalo en{" "}
            <Link href="/panel/personalizar" className="underline">
              Personalizar → Pedir PIN de encargado
            </Link>
            .
          </p>
        )}
      </div>
      {falta ? (
        <p className="text-sm text-suave">
          Falta ejecutar el SQL <code>0023_pin_descuentos_caja.sql</code> en Supabase.
        </p>
      ) : !pines ? (
        <p className="text-sm text-suave">Cargando…</p>
      ) : (
        <ul className="divide-y divide-borde">
          {activos.map((m) => {
            const p = pines.get(m.user_id!);
            const admin = esAdmin(m.rol);
            return (
              <li key={m.user_id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{m.nombre || nombreVisible(m.email.split("@")[0])}</span>
                  <span className="block text-xs text-suave">
                    {NOMBRE_ROL[m.rol]} · {p?.tiene_pin ? "Tiene PIN" : "Sin PIN"}
                  </span>
                </span>
                {!admin && (
                  <label className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={!!p?.autoriza}
                      onChange={(e) => guardar(m.user_id!, null, e.target.checked)}
                    />
                    Autoriza
                  </label>
                )}
                {admin && <span className="text-xs text-suave">Autoriza siempre</span>}
                {editando === m.user_id ? (
                  <form
                    className="flex items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (/^\d{4,6}$/.test(pin)) guardar(m.user_id!, pin, null);
                    }}
                  >
                    <input
                      type="password"
                      inputMode="numeric"
                      autoComplete="new-password"
                      maxLength={6}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                      className="campo w-24 text-center tracking-widest"
                      placeholder="PIN"
                      autoFocus
                    />
                    <button type="submit" className="boton px-3 py-1.5" disabled={!/^\d{4,6}$/.test(pin)}>
                      Guardar
                    </button>
                    <button type="button" className="text-xs text-suave" onClick={() => setEditando(null)}>
                      Cancelar
                    </button>
                  </form>
                ) : (
                  <span className="flex gap-2">
                    <button
                      type="button"
                      className="boton-secundario px-3 py-1.5"
                      onClick={() => {
                        setPin("");
                        setEditando(m.user_id);
                      }}
                    >
                      {p?.tiene_pin ? "Cambiar PIN" : "Poner PIN"}
                    </button>
                    {p?.tiene_pin && (
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => confirm("¿Borrar el PIN?") && guardar(m.user_id!, null, null)}
                      >
                        Borrar
                      </button>
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
