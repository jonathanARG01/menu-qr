import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Icono } from "@/components/Icono";
import { ScriptTema, SelectorTema, Tema } from "@/components/Tema";
import { createClient } from "@/lib/supabase/server";
import { Admin, type FilaAdmin } from "./Admin";

export const metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

// Solo para ti (superadmin): todos los negocios, su plan y su prueba, y el modo soporte para entrar a cualquiera.
export default async function PaginaAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?next=/admin");
  const { data: esAdmin } = await supabase.rpc("es_superadmin");
  if (!esAdmin) redirect("/panel");
  const [{ data, error }, { count: propios }] = await Promise.all([
    supabase.rpc("admin_negocios"),
    supabase.from("miembros").select("negocio_id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);
  return (
    <div className="panel-app min-h-dvh">
      <ScriptTema />
      <Tema />
      <header className="vidrio-barra sticky top-0 z-30 rounded-b-3xl border-t-0">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
          <a href="/admin" className="flex items-center gap-2.5" aria-label="Admin">
            <Logo className="text-lg" />
            <span className="icono-activo rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider">Admin</span>
          </a>
          <div className="ml-auto flex items-center gap-2">
            <SelectorTema className="hidden sm:grid" />
            {(propios ?? 0) > 0 && (
              <a href="/panel/soporte?salir=1&volver=panel" className="boton-secundario hidden py-2 sm:inline-flex">
                Mi panel
              </a>
            )}
            <form action="/salir" method="post">
              <button className="grid h-10 w-10 place-items-center rounded-xl text-suave hover:bg-stone-100 hover:text-tinta" title="Salir" aria-label="Salir">
                <Icono nombre="salir" className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-14 pt-6 lg:px-6">
        {error ? (
          <p className="tarjeta p-5 text-sm text-red-700">{error.message}</p>
        ) : (
          <Admin filas={(data ?? []) as FilaAdmin[]} correo={user.email ?? ""} />
        )}
        <SelectorTema className="mx-auto mt-10 max-w-xs sm:hidden" />
      </main>
    </div>
  );
}
