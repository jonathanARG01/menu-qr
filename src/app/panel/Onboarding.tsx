"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthShell, Aviso } from "@/components/AuthShell";
import { CamposRestaurante } from "@/components/CamposRestaurante";
import { crearRestaurante, cerrarSesion } from "./actions";

export function Onboarding({ nombre, slug }: { nombre?: string; slug?: string }) {
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
        <CamposRestaurante nombreInicial={nombre} slugInicial={slug} />
        {error && <Aviso>{error}</Aviso>}
        <button type="submit" className="boton w-full" disabled={pendiente}>
          {pendiente ? "Creando…" : "Crear mi carta"}
        </button>
      </form>
    </AuthShell>
  );
}
