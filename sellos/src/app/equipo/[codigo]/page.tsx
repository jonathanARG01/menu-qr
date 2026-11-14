import Link from "next/link";
import { AuthShell, Aviso } from "@/components/AuthShell";
import { createClient } from "@/lib/supabase/server";
import { limpiarCodigo } from "@/lib/tipos";
import { Aceptar } from "./Aceptar";

export const metadata = { title: "Invitación · Sellito", robots: { index: false } };
export const dynamic = "force-dynamic";

type Invitacion = { negocio: string; rol: string; nombre: string; vencida: boolean; usada: boolean };

// Enlace que el dueño manda a su equipo para sumarse al negocio.
export default async function PaginaInvitacion({ params }: { params: Promise<{ codigo: string }> }) {
  const codigo = limpiarCodigo((await params).codigo);
  const supabase = await createClient();
  const [{ data }, { data: sesion }] = await Promise.all([
    supabase.rpc("ver_invitacion", { p_codigo: codigo }),
    supabase.auth.getUser(),
  ]);
  const inv = data as Invitacion | null;

  return (
    <AuthShell titulo={inv ? `Únete al equipo de ${inv.negocio}` : "Invitación"}>
      {!inv ? (
        <Aviso>Esta invitación no existe. Pide un enlace nuevo.</Aviso>
      ) : inv.usada || inv.vencida ? (
        <Aviso>Esta invitación {inv.usada ? "ya se usó" : "venció"}. Pide un enlace nuevo a quien te invitó.</Aviso>
      ) : sesion.user ? (
        <Aceptar codigo={codigo} nombre={inv.nombre} email={sesion.user.email ?? ""} />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-suave">
            Te invitaron como {inv.rol === "dueno" ? "dueño o socio" : "parte del equipo"}. Crea tu cuenta (o entra si ya tienes
            una) para empezar a sumar sellos.
          </p>
          <Link href={`/registro?invitacion=${codigo}`} className="boton w-full">
            Crear mi cuenta
          </Link>
          <Link href={`/entrar?next=/equipo/${codigo}`} className="boton-secundario w-full">
            Ya tengo cuenta
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
