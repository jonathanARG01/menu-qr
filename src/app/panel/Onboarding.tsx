"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthShell, Aviso } from "@/components/AuthShell";
import { CamposRestaurante } from "@/components/CamposRestaurante";
import { crearRestaurante, cerrarSesion } from "./actions";

export function Onboarding({ nombre, slug, pais, email }: { nombre?: string; slug?: string; pais?: string; email: string }) {
  const params = useSearchParams();
  const [error, accion, pendiente] = useActionState(crearRestaurante, params.get("error"));

  return (
    <AuthShell
      titulo="Último paso: tu restaurante"
      pie={
        <form action={cerrarSesion}>
          <button className="hover:text-tinta">Salir</button>
        </form>
      }
    >
      <form action={accion} className="space-y-4">
        <CamposRestaurante nombreInicial={nombre} slugInicial={slug} paisInicial={pais} />
        {error && <Aviso>{error}</Aviso>}
        <button type="submit" className="boton w-full" disabled={pendiente}>
          {pendiente ? "Creando…" : "Crear mi carta"}
        </button>
      </form>
      <p className="mt-5 rounded-xl bg-stone-50 p-3 text-sm text-suave">
        ¿Trabajas en un restaurante que ya usa el sistema? Pídele al administrador que te sume al equipo con tu correo{" "}
        <strong className="text-tinta">{email}</strong> y después recarga esta página.
      </p>
    </AuthShell>
  );
}
