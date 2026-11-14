import { Suspense } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { FormEntrar } from "./FormEntrar";

export const metadata = { title: "Entrar · Sellito" };

export default function PaginaEntrar() {
  return (
    <AuthShell
      titulo="Entra a tu panel"
      pie={
        <>
          ¿Aún no tienes cuenta?{" "}
          <Link href="/registro" className="font-medium text-marca">
            Prueba gratis 14 días
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
