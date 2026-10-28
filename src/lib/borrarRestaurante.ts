import type { SupabaseClient } from "@supabase/supabase-js";

// Borrar un restaurante con todo lo suyo (carta, mesas, pedidos, reservas, caja, clientes, referidos: todo cae en
// cascada) y sus fotos. Si se pide, también las cuentas que se quedan sin ningún restaurante (nunca la de un
// superadmin). Lo usan /admin (superadmin) y el dueño desde Personalizar (Ley 21.719: derecho a supresión).
// Necesita el cliente con la clave de servicio.

export const BUCKET_FOTOS = "fotos";

// Archivos de la carpeta del restaurante en el bucket de fotos (logo, platos, portada, perfiles).
export async function listarFotos(db: SupabaseClient, id: string) {
  const rutas: string[] = [];
  const recorrer = async (carpeta: string) => {
    for (let desde = 0; ; desde += 1000) {
      const { data } = await db.storage.from(BUCKET_FOTOS).list(carpeta, { limit: 1000, offset: desde });
      if (!data?.length) break;
      rutas.push(...data.filter((a) => a.id).map((a) => `${carpeta}/${a.name}`));
      // Subcarpetas (las fotos del equipo van en <restaurante>/equipo).
      for (const sub of data.filter((a) => !a.id)) await recorrer(`${carpeta}/${sub.name}`);
      if (data.length < 1000) break;
    }
  };
  await recorrer(id);
  return rutas;
}

export async function borrarRestauranteCompleto(
  db: SupabaseClient,
  id: string,
  borrarCuentas: boolean,
): Promise<{ error: string } | { cuentas: number }> {
  const { data: filas } = await db.from("usuarios").select("user_id").eq("restaurante_id", id);
  const usuarios = (filas ?? []).map((u: { user_id: string }) => u.user_id);

  const fotos = await listarFotos(db, id);
  const { error } = await db.from("restaurantes").delete().eq("id", id);
  if (error) return { error: error.message };
  // Si las fotos no se pueden borrar no pasa nada: solo quedan archivos huérfanos.
  for (let i = 0; i < fotos.length; i += 500) await db.storage.from(BUCKET_FOTOS).remove(fotos.slice(i, i + 500));

  let cuentas = 0;
  if (borrarCuentas && usuarios.length) {
    const { data: admins } = await db.from("superadmins").select("user_id");
    const idsAdmin = new Set((admins ?? []).map((a: { user_id: string }) => a.user_id));
    for (const u of usuarios) {
      if (idsAdmin.has(u)) continue;
      const { count } = await db.from("usuarios").select("*", { count: "exact", head: true }).eq("user_id", u);
      if (count) continue;
      const { error: e } = await db.auth.admin.deleteUser(u);
      if (!e) cuentas++;
    }
  }
  return { cuentas };
}
