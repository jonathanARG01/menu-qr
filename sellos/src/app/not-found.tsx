import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NoEncontrada() {
  return (
    <main className="club fondo-club flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo className="text-2xl" />
      <h1 className="text-xl font-semibold">No encontramos esta página</h1>
      <p className="max-w-sm text-sm text-suave">Revisa el enlace o el QR. Si es una tarjeta, pídele al negocio que te la envíe de nuevo.</p>
      <Link href="/" className="boton-oro">
        Ir al inicio
      </Link>
    </main>
  );
}
