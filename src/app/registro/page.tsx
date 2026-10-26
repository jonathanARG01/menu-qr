import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { RegistroForm } from "./RegistroForm";

export const metadata = { title: "Crear cuenta · Menús QR" };

export default function RegistroPage() {
  return (
    <AuthShell
      titulo="Crea la carta de tu restaurante"
      pie={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-marca">
            Entra
          </Link>
        </>
      }
    >
      <RegistroForm />
    </AuthShell>
  );
}
