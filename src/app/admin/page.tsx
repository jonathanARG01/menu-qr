import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ToastProvider } from "@/components/Toast";
import { ListaAdmin, type FilaAdmin } from "./ListaAdmin";

export const metadata = { title: "Administración · Menús QR" };
export const dynamic = "force-dynamic";

export default async function Admin() {
  const supabase = await createClient();
  const { data: esSuperadmin } = await supabase.rpc("es_superadmin");

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

  const { data, error } = await supabase.rpc("admin_restaurantes");

  return (
    <div className="min-h-screen pb-10">
      <header className="sticky top-0 z-20 border-b border-borde bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <span className="rounded-lg bg-stone-900 px-2.5 py-1 text-xs font-semibold text-white">Admin</span>
          <h1 className="flex-1 font-semibold">Todos los restaurantes</h1>
          <Link href="/panel" className="text-sm text-suave hover:text-tinta">
            Ir a mi panel
          </Link>
        </div>
      </header>
      <ToastProvider>
        <main className="mx-auto max-w-5xl px-4 py-5">
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error.message}</p>
          ) : (
            <ListaAdmin filas={(data ?? []) as FilaAdmin[]} />
          )}
        </main>
      </ToastProvider>
    </div>
  );
}
