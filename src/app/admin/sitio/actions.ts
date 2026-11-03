"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mensajeError } from "@/lib/utils";
import { leerContacto, REDES_SITIO, type ContactoSitio } from "@/lib/sitio";
import { leerRedes, type Redes } from "@/lib/redes";

// Guarda contacto y redes del sitio de venta (la política de la tabla exige ser superadmin) y refresca platovi.cl.
export async function guardarSitio(contacto: ContactoSitio, redes: Redes) {
  const supabase = await createClient();
  const soloSitio = Object.fromEntries(REDES_SITIO.map((r) => [r, leerRedes(redes)[r]]));
  const { data, error } = await supabase
    .from("sitio_ajustes")
    .update({ contacto: leerContacto(contacto), redes: soloSitio, updated_at: new Date().toISOString() })
    .eq("id", 1)
    .select("id");
  if (error) return /sitio_ajustes/.test(error.message) ? "Falta ejecutar el SQL 0028_sitio_contacto.sql en Supabase." : mensajeError(error);
  if (!data?.length) return "No se pudo guardar: tu cuenta no es superadmin o falta la fila del sitio (SQL 0028).";
  revalidatePath("/");
  revalidatePath("/admin/sitio");
  return null;
}

export async function marcarMensaje(id: string, leido: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("mensajes_contacto").update({ leido }).eq("id", id);
  if (error) return mensajeError(error);
  revalidatePath("/admin/sitio");
  return null;
}

export async function borrarMensaje(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("mensajes_contacto").delete().eq("id", id);
  if (error) return mensajeError(error);
  revalidatePath("/admin/sitio");
  return null;
}
