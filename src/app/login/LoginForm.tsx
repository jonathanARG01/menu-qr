"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { mensajeError } from "@/lib/utils";
import { Aviso } from "@/components/AuthShell";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const siguiente = params.get("next")?.startsWith("/") ? params.get("next")! : "/panel";
  const [error, setError] = useState<string | null>(params.get("error"));
  const [cargando, setCargando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    setCargando(true);
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({
      email: String(datos.get("email")),
      password: String(datos.get("password")),
    });
    if (error) {
      setError(mensajeError(error));
      setCargando(false);
      return;
    }
    router.replace(siguiente);
    router.refresh();
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div>
        <label htmlFor="email" className="etiqueta-campo">
          Correo
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className="campo" />
      </div>
      <div>
        <label htmlFor="password" className="etiqueta-campo">
          Contraseña
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="campo" />
      </div>
      {error && <Aviso>{error}</Aviso>}
      <button type="submit" className="boton w-full" disabled={cargando}>
        {cargando ? "Entrando…" : "Entrar"}
      </button>
      <p className="text-center text-sm">
        <Link href="/recuperar" className="text-suave hover:text-tinta">
          Olvidé mi contraseña
        </Link>
      </p>
    </form>
  );
}
