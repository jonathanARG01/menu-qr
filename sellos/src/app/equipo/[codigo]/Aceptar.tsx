"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Aviso } from "@/components/AuthShell";
import { mensajeError } from "@/lib/utils";

export function Aceptar({ codigo, nombre: inicial, email }: { codigo: string; nombre: string; email: string }) {
  const [nombre, setNombre] = useState(inicial);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function aceptar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    const { data, error } = await createClient().rpc("aceptar_invitacion", { p_codigo: codigo, p_nombre: nombre });
    if (error) {
      setCargando(false);
      return setError(mensajeError(error));
    }
    window.location.href = `/panel/cambiar?n=${data}`;
  }

  return (
    <form onSubmit={aceptar} className="space-y-4">
      <p className="text-sm text-suave">Entraste como {email}.</p>
      <label className="block text-sm">
        <span className="etiqueta-campo">Tu nombre</span>
        <input required maxLength={60} value={nombre} onChange={(e) => setNombre(e.target.value)} className="campo" />
      </label>
      {error && <Aviso>{error}</Aviso>}
      <button className="boton w-full" disabled={cargando}>
        {cargando ? "Uniéndote…" : "Unirme al equipo"}
      </button>
    </form>
  );
}
