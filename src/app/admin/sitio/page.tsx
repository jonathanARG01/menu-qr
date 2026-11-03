import { createClient } from "@/lib/supabase/server";
import { leerAjustesSitio } from "@/lib/sitio";
import { EditorSitio, type MensajeContacto } from "./EditorSitio";

export const metadata = { title: "Sitio web · Administración" };
export const dynamic = "force-dynamic";

// Contacto, redes sociales y mensajes del formulario de platovi.cl. El acceso lo controla el layout de /admin.
export default async function AdminSitio() {
  const supabase = await createClient();
  const [ajustes, mensajes] = await Promise.all([
    supabase.from("sitio_ajustes").select("contacto, redes").eq("id", 1).maybeSingle(),
    supabase.from("mensajes_contacto").select("*").order("created_at", { ascending: false }).limit(100),
  ]);
  const falta = !!ajustes.error;
  return (
    <EditorSitio
      inicial={leerAjustesSitio(ajustes.data)}
      mensajes={(mensajes.data ?? []) as MensajeContacto[]}
      faltaSql={falta}
    />
  );
}
