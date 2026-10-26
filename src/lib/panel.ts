import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Restaurante } from "@/lib/types";

// Usuario con sesión y su restaurante (el primero, si administra varios).
export const obtenerContexto = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membresia } = await supabase
    .from("usuarios")
    .select("rol, restaurantes(*)")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const restaurante = (membresia?.restaurantes ?? null) as unknown as Restaurante | null;
  return { supabase, user, restaurante, rol: membresia?.rol as "dueno" | "staff" | undefined };
});

export async function requerirRestaurante() {
  const ctx = await obtenerContexto();
  if (!ctx.restaurante) redirect("/panel");
  return ctx as typeof ctx & { restaurante: Restaurante };
}
