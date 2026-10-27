import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ToastProvider } from "@/components/Toast";
import { leerNiveles, type Descuento } from "@/lib/referidos";
import { AdminReferidos, type FilaReferidos } from "./AdminReferidos";

export const metadata = { title: "Referidos · Administración" };
export const dynamic = "force-dynamic";

export default async function PaginaReferidos() {
  const supabase = await createClient();
  const { data: esSuperadmin } = await supabase.rpc("es_superadmin");
  if (esSuperadmin !== true) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-semibold">Solo para administradores</h1>
        <Link href="/panel" className="boton-secundario mt-6 inline-block">
          Volver al panel
        </Link>
      </main>
    );
  }

  const [filas, config, descuentos] = await Promise.all([
    supabase.rpc("admin_referidos"),
    supabase.from("referidos_config").select("activo, niveles").maybeSingle(),
    supabase.from("descuentos_referido").select("*").order("referidos"),
  ]);
  const error = filas.error ?? config.error;

  return (
    <div className="min-h-screen pb-10">
      <header className="sticky top-0 z-20 border-b border-borde bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <span className="rounded-lg bg-stone-900 px-2.5 py-1 text-xs font-semibold text-white">Admin</span>
          <h1 className="flex-1 font-semibold">Referidos y descuentos</h1>
          <Link href="/admin" className="text-sm text-suave hover:text-tinta">
            Restaurantes
          </Link>
        </div>
      </header>
      <ToastProvider>
        <main className="mx-auto max-w-5xl px-4 py-5">
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error.message.includes("referidos") ? "Falta ejecutar el SQL 0012_referidos.sql en Supabase." : error.message}
            </p>
          ) : (
            <AdminReferidos
              filas={(filas.data ?? []) as FilaReferidos[]}
              activo={config.data?.activo ?? true}
              niveles={leerNiveles(config.data?.niveles)}
              descuentos={(descuentos.data ?? []) as Descuento[]}
            />
          )}
        </main>
      </ToastProvider>
    </div>
  );
}
