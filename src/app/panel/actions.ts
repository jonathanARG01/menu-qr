"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_RESTAURANTE } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { mensajeError } from "@/lib/utils";
import { prepararRestaurante } from "@/lib/planes";

// Tras guardar en el panel: regenera la carta pública para que el cambio se vea al momento.
export async function revalidarCarta() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data } = await supabase.from("usuarios").select("restaurantes(slug)").eq("user_id", user.id);
  for (const fila of data ?? []) {
    const slug = (fila.restaurantes as unknown as { slug: string } | null)?.slug;
    if (slug) revalidatePath(`/${slug}`);
  }
}

export async function crearRestaurante(_prev: string | null, formData: FormData): Promise<string | null> {
  const supabase = await createClient();
  const slug = String(formData.get("slug") ?? "");
  const { data, error } = await supabase.rpc("crear_restaurante", {
    p_nombre: String(formData.get("nombre") ?? ""),
    p_slug: slug,
  });
  if (error) return mensajeError(error);
  await prepararRestaurante(supabase, (data as { id: string }).id, String(formData.get("pais") ?? ""));
  revalidatePath(`/${slug}`);
  revalidatePath("/panel", "layout");
  redirect("/panel");
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Cambia el restaurante que se edita en el panel (para quien administra varios).
export async function elegirRestaurante(formData: FormData) {
  const id = String(formData.get("restaurante") ?? "");
  const almacen = await cookies();
  almacen.set(COOKIE_RESTAURANTE, id, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  redirect("/panel");
}
