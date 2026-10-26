"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { mensajeError, urlSitio } from "@/lib/utils";
import { Aviso } from "@/components/AuthShell";
import { CamposRestaurante } from "@/components/CamposRestaurante";

export function RegistroForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [revisarCorreo, setRevisarCorreo] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const nombre = String(datos.get("nombre")).trim();
    const slug = String(datos.get("slug")).trim();
    setCargando(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: String(datos.get("email")),
      password: String(datos.get("password")),
      options: {
        emailRedirectTo: `${urlSitio()}/auth/confirm?next=/panel`,
        // Se guardan para terminar el alta tras confirmar el correo.
        data: { restaurante_nombre: nombre, restaurante_slug: slug },
      },
    });

    if (error) {
      setError(mensajeError(error));
      setCargando(false);
      return;
    }

    if (!data.session) {
      setRevisarCorreo(true);
      setCargando(false);
      return;
    }

    const { error: errorAlta } = await supabase.rpc("crear_restaurante", { p_nombre: nombre, p_slug: slug });
    if (errorAlta) {
      // La cuenta ya existe: el panel le pedirá corregir los datos del restaurante.
      router.replace(`/panel?error=${encodeURIComponent(mensajeError(errorAlta))}`);
      return;
    }
    router.replace("/panel");
    router.refresh();
  }

  if (revisarCorreo) {
    return (
      <Aviso tipo="ok">
        Te enviamos un correo para confirmar tu cuenta. Ábrelo desde este dispositivo y entrarás directo a tu panel.
      </Aviso>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <CamposRestaurante />
      <div>
        <label htmlFor="email" className="etiqueta-campo">
          Tu correo
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className="campo" />
      </div>
      <div>
        <label htmlFor="password" className="etiqueta-campo">
          Contraseña
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
      {error && <Aviso>{error}</Aviso>}
      <button type="submit" className="boton w-full" disabled={cargando}>
        {cargando ? "Creando…" : "Crear cuenta"}
      </button>
    </form>
  );
}
