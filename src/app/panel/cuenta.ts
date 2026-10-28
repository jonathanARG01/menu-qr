"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { COOKIE_RESTAURANTE, obtenerContexto } from "@/lib/panel";
import { createAdminClient } from "@/lib/supabase/admin";
import { borrarRestauranteCompleto } from "@/lib/borrarRestaurante";
import { mensajeError } from "@/lib/utils";

// El dueño elimina su restaurante y todos sus datos (Ley 21.719: derecho de supresión). Las cuentas del equipo que se
// quedan sin ningún restaurante también se borran. No se puede deshacer.
export async function eliminarMiRestaurante(confirmacion: string): Promise<{ error: string } | { ok: true }> {
  const { supabase, restaurante, rol } = await obtenerContexto();
  if (!restaurante || rol !== "dueno") return { error: "Solo el dueño puede eliminar el restaurante." };
  if (confirmacion.trim().toLowerCase() !== restaurante.slug) return { error: `Escribe ${restaurante.slug} para confirmar.` };
  const db = createAdminClient();
  if (!db) return { error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY en Vercel. Escríbenos y lo hacemos por ti." };

  const hecho = await borrarRestauranteCompleto(db, restaurante.id, true);
  if ("error" in hecho) return { error: mensajeError(hecho.error) };
  revalidatePath(`/${restaurante.slug}`);
  (await cookies()).delete(COOKIE_RESTAURANTE);
  // Si la cuenta ya no existe, cerrar la sesión puede fallar: da igual.
  await supabase.auth.signOut().catch(() => {});
  return { ok: true };
}
