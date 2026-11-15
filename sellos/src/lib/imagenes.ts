import type { SupabaseClient } from "@supabase/supabase-js";
import { comprimirImagen } from "./utils";

// Sube una imagen del negocio (fondo del diseño a medida o foto del catálogo) al bucket público "imagenes".
export async function subirImagen(supabase: SupabaseClient, negocioId: string, archivo: File, nombre: string, ladoMax = 1200) {
  if (!archivo.type.startsWith("image/")) throw new Error("Elige una imagen (JPG, PNG o WebP)");
  if (archivo.size > 15 * 1024 * 1024) throw new Error("La imagen pesa más de 15 MB");
  const blob = await comprimirImagen(archivo, ladoMax, 0.86);
  const ruta = `${negocioId}/${nombre}-${Date.now()}.webp`;
  const { error } = await supabase.storage.from("imagenes").upload(ruta, blob, { contentType: "image/webp", upsert: true });
  if (error) throw error;
  return supabase.storage.from("imagenes").getPublicUrl(ruta).data.publicUrl;
}
