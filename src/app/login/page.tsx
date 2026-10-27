import { Suspense } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Entrar · Mesitto" };

export default function LoginPage() {
  return (
    <AuthShell
      titulo="Entrar al panel"
      pie={
        <>
          ¿No tienes cuenta?{" "}
          <Link href="/registro" className="font-medium text-marca">
            Crea una
          </Link>
        </>
      }
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
