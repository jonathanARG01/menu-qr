import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Restaurante } from "@/lib/types";

// Restaurante elegido en el panel cuando el usuario administra varios.
export const COOKIE_RESTAURANTE = "restaurante_activo";

type Membresia = { rol: "dueno" | "staff"; restaurantes: Restaurante | null };

// Usuario con sesión y el restaurante que está editando (el elegido, o el primero si administra varios).
export const obtenerContexto = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data }, { data: esSuperadmin }, almacen] = await Promise.all([
    supabase.from("usuarios").select("rol, restaurantes(*)").eq("user_id", user.id).order("created_at"),
    // Si aún no se ejecutó la migración 0003 la función no existe y devuelve error: no es superadmin.
    supabase.rpc("es_superadmin"),
    cookies(),
  ]);

  const membresias = ((data ?? []) as unknown as Membresia[]).filter((m) => m.restaurantes);
  const elegido = almacen.get(COOKIE_RESTAURANTE)?.value;
  const actual = membresias.find((m) => m.restaurantes!.id === elegido) ?? membresias[0];

  return {
    supabase,
    user,
    restaurante: actual?.restaurantes ?? null,
    rol: actual?.rol,
    restaurantes: membresias.map((m) => ({ id: m.restaurantes!.id, nombre: m.restaurantes!.nombre, rol: m.rol })),
    esSuperadmin: esSuperadmin === true,
  };
});

export async function requerirRestaurante() {
  const ctx = await obtenerContexto();
  if (!ctx.restaurante) redirect("/panel");
  return ctx as typeof ctx & { restaurante: Restaurante };
}
