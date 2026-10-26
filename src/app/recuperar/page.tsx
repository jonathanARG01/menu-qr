"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { mensajeError, urlSitio } from "@/lib/utils";
import { AuthShell, Aviso } from "@/components/AuthShell";

export default function RecuperarPage() {
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email"));
    setCargando(true);
    setError(null);
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${urlSitio()}/auth/confirm?next=/nueva-clave`,
    });
    setCargando(false);
    if (error) setError(mensajeError(error));
    else setEnviado(true);
  }

  return (
    <AuthShell
      titulo="Recuperar contraseña"
      pie={
        <Link href="/login" className="font-medium text-marca">
          Volver a entrar
        </Link>
      }
    >
      {enviado ? (
        <Aviso tipo="ok">Si el correo tiene una cuenta, te llegará un enlace para crear una contraseña nueva.</Aviso>
      ) : (
        <form onSubmit={enviar} className="space-y-4">
          <div>
            <label htmlFor="email" className="etiqueta-campo">
              Correo
            </label>
            <input id="email" name="email" type="email" autoComplete="email" required className="campo" />
          </div>
          {error && <Aviso>{error}</Aviso>}
          <button type="submit" className="boton w-full" disabled={cargando}>
            {cargando ? "Enviando…" : "Enviar enlace"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
