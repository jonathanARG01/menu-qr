import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ToastProvider } from "@/components/Toast";
import { MarcoAdmin } from "./MarcoAdmin";

export const metadata = { title: "Administración · Mesitto" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const [{ data: esSuperadmin }, { data: sesion }] = await Promise.all([supabase.rpc("es_superadmin"), supabase.auth.getUser()]);
  if (!sesion.user) redirect("/login");

  if (esSuperadmin !== true) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-semibold">Solo para administradores</h1>
        <p className="mt-2 text-sm text-suave">
          Tu cuenta no tiene acceso a esta sección. Si eres el dueño del servicio, mira el README: se activa con una línea de SQL
          en Supabase.
        </p>
        <Link href="/panel" className="boton-secundario mt-6 inline-block">
          Volver al panel
        </Link>
      </main>
    );
  }

  const tema = (await cookies()).get("panel-tema")?.value === "claro" ? "claro" : "oscuro";
  return (
    <MarcoAdmin tema={tema} email={sesion.user.email ?? ""}>
      <ToastProvider>{children}</ToastProvider>
    </MarcoAdmin>
  );
}
