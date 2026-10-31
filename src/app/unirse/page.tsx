import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { RegistroForm } from "../registro/RegistroForm";

export const metadata = { title: "Unirme a un equipo · Platovi" };

// Para meseros y cocina: el administrador los suma por correo y ellos crean su cuenta aquí.
export default function UnirsePage() {
  return (
    <AuthShell
      titulo="Únete al equipo de tu restaurante"
      pie={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-marca">
            Entra
          </Link>
        </>
      }
    >
      <RegistroForm equipo />
    </AuthShell>
  );
}
