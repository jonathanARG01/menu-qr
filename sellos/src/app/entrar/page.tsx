import { Suspense } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { FormEntrar } from "./FormEntrar";
import { DIAS_PRUEBA } from "@/lib/marca";

export const metadata = { title: "Entrar" };

export default function PaginaEntrar() {
  return (
    <AuthShell
      titulo="Entra a tu panel"
      pie={
        <>
          ¿Aún no tienes cuenta?{" "}
          <Link href="/registro" className="font-medium text-marca">
            Prueba gratis {DIAS_PRUEBA} días
          </Link>
        </>
      }
    >
      <Suspense>
        <FormEntrar />
      </Suspense>
    </AuthShell>
  );
}
