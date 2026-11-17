import { Suspense } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { FormRegistro } from "./FormRegistro";

export const metadata = { title: "Prueba gratis" };

type Props = { searchParams: Promise<{ invitacion?: string; rubro?: string; demo?: string }> };

export default async function PaginaRegistro({ searchParams }: Props) {
  const { invitacion, rubro, demo } = await searchParams;
  return (
    <AuthShell
      titulo={invitacion ? "Crea tu cuenta del equipo" : "Crea tu tarjeta de sellos"}
      pie={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link href={invitacion ? `/entrar?next=/equipo/${invitacion}` : "/entrar"} className="font-medium text-marca">
            Entra aquí
          </Link>
        </>
      }
    >
      <Suspense>
        <FormRegistro invitacion={invitacion ?? null} rubroInicial={rubro ?? null} desdeDemo={demo === "1" && !invitacion} />
      </Suspense>
    </AuthShell>
  );
}
