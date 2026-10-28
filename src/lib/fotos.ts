import type { SupabaseClient } from "@supabase/supabase-js";
import { comprimirImagen } from "@/lib/utils";

const BUCKET = "fotos";

// prefijo: subcarpeta y comienzo del nombre (las fotos de perfil van en "equipo/<id de la persona>-").
export async function subirFoto(supabase: SupabaseClient, restauranteId: string, archivo: File, ladoMax = 1200, prefijo = "") {
  if (!archivo.type.startsWith("image/")) throw new Error("El archivo no es una imagen");
  const blob = await comprimirImagen(archivo, ladoMax);
  const ruta = `${restauranteId}/${prefijo}${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, blob, {
    contentType: "image/webp",
    cacheControl: "31536000",
  });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
}

// Borra una foto anterior si es de nuestro bucket. Si falla no pasa nada: solo queda un archivo huérfano.
export async function borrarFoto(supabase: SupabaseClient, url: string | null | undefined) {
  if (!url) return;
  const marca = `/object/public/${BUCKET}/`;
  const i = url.indexOf(marca);
  if (i === -1) return;
  await supabase.storage.from(BUCKET).remove([decodeURIComponent(url.slice(i + marca.length))]);
}
