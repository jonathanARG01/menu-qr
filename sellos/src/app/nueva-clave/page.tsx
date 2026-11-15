"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { mensajeError } from "@/lib/utils";
import { AuthShell, Aviso } from "@/components/AuthShell";

export default function NuevaClavePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const password = String(datos.get("password"));
    if (password !== String(datos.get("repetir"))) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setCargando(true);
    setError(null);
    const { error } = await createClient().auth.updateUser({ password });
    if (error) {
      setError(mensajeError(error));
      setCargando(false);
      return;
    }
    router.replace("/panel");
    router.refresh();
  }

  return (
    <AuthShell titulo="Crea una contraseña nueva">
      <form onSubmit={enviar} className="space-y-4">
        <div>
          <label htmlFor="password" className="etiqueta-campo">
            Contraseña nueva
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
            className="campo"
          />
        </div>
        <div>
          <label htmlFor="repetir" className="etiqueta-campo">
            Repítela
          </label>
          <input
            id="repetir"
            name="repetir"
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
            className="campo"
          />
        </div>
        {error && <Aviso>{error}</Aviso>}
        <button type="submit" className="boton w-full" disabled={cargando}>
          {cargando ? "Guardando…" : "Guardar y entrar"}
        </button>
      </form>
    </AuthShell>
  );
}
