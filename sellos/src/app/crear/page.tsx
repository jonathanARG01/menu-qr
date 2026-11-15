import { redirect } from "next/navigation";
import { AuthShell, Aviso } from "@/components/AuthShell";
import { createClient } from "@/lib/supabase/server";
import { FormCrear } from "./FormCrear";

export const metadata = { title: "Nuevo negocio · Sellito" };

// Crear un negocio con una cuenta que ya existe (otro local, o alguien del equipo que abre el suyo).
export default async function PaginaCrear({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?next=/crear");
  const { error } = await searchParams;
  return (
    <AuthShell titulo="Crea tu negocio" pie={<a href="/panel">Volver al panel</a>}>
      {error && (
        <div className="mb-4">
          <Aviso>{error}</Aviso>
        </div>
      )}
      <FormCrear />
    </AuthShell>
  );
}
