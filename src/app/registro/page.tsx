import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { createClient } from "@/lib/supabase/server";
import { RegistroForm } from "./RegistroForm";

export const metadata = { title: "Crear cuenta · Menús QR" };

// Con ?ref=<dirección> viene del link de invitación de otro restaurante (programa de referidos).
export default async function RegistroPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const ref = (await searchParams).ref?.trim().toLowerCase().slice(0, 50) || undefined;
  let invita: string | null = null;
  if (ref) {
    const supabase = await createClient();
    // Sin la migración 0012 la función no existe: el registro sigue igual, sin invitación.
    const { data } = await supabase.rpc("nombre_referente", { p_ref: ref });
    invita = typeof data === "string" ? data : null;
  }

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
      {invita && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Te invitó <strong>{invita}</strong>.
        </p>
      )}
      <RegistroForm referido={invita ? ref : undefined} />
    </AuthShell>
  );
}
