import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/server";
import { Admin, type FilaAdmin } from "./Admin";

export const metadata = { title: "Admin · Sellito", robots: { index: false } };
export const dynamic = "force-dynamic";

// Solo para ti (superadmin): todos los negocios, su prueba, activar o pausar.
export default async function PaginaAdmin() {
  const supabase = await createClient();
  const { data: esAdmin } = await supabase.rpc("es_superadmin");
  if (!esAdmin) redirect("/panel");
  const { data, error } = await supabase.rpc("admin_negocios");
  return (
    <div className="min-h-dvh bg-fondo">
      <header className="border-b border-borde bg-superficie">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Logo className="text-xl" />
          <span className="rounded-full bg-tinta px-2 py-0.5 text-xs font-semibold text-white">Admin</span>
          <form action="/salir" method="post" className="ml-auto">
            <button className="text-sm text-suave hover:text-tinta">Salir</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {error ? (
          <p className="tarjeta p-5 text-sm text-red-700">{error.message}</p>
        ) : (
          <Admin filas={(data ?? []) as FilaAdmin[]} />
        )}
      </main>
    </div>
  );
}
