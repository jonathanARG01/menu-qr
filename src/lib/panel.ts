import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { esAdmin, leerAjustes, seccionesVisibles, type Rol, type Seccion } from "@/lib/salon";
import type { Restaurante } from "@/lib/types";

// Restaurante elegido en el panel cuando el usuario administra varios.
export const COOKIE_RESTAURANTE = "restaurante_activo";

type Membresia = { rol: Rol; restaurantes: Restaurante | null };

// Usuario con sesión y el restaurante que está editando (el elegido, o el primero si administra varios).
export const obtenerContexto = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membresias = () => supabase.from("usuarios").select("rol, restaurantes(*)").eq("user_id", user.id).order("created_at");
  const [primera, { data: esSuperadmin }, { data: aceptadas }, almacen] = await Promise.all([
    membresias(),
    // Si aún no se ejecutó la migración 0003 la función no existe y devuelve error: no es superadmin.
    supabase.rpc("es_superadmin"),
    // Quien fue invitado al equipo entra solo la primera vez (sin la migración 0004 no hace nada).
    supabase.rpc("aceptar_invitaciones"),
    cookies(),
  ]);
  const { data } = Number(aceptadas) > 0 ? await membresias() : primera;

  const lista = ((data ?? []) as unknown as Membresia[]).filter((m) => m.restaurantes);
  const elegido = almacen.get(COOKIE_RESTAURANTE)?.value;
  const actual = lista.find((m) => m.restaurantes!.id === elegido) ?? lista[0];
  const ajustes = leerAjustes(actual?.restaurantes?.ajustes);

  return {
    supabase,
    user,
    restaurante: actual?.restaurantes ?? null,
    rol: actual?.rol,
    admin: esAdmin(actual?.rol),
    ajustes,
    secciones: seccionesVisibles(actual?.rol, ajustes),
    restaurantes: lista.map((m) => ({ id: m.restaurantes!.id, nombre: m.restaurantes!.nombre, rol: m.rol })),
    esSuperadmin: esSuperadmin === true,
  };
});

export async function requerirRestaurante() {
  const ctx = await obtenerContexto();
  if (!ctx.restaurante) redirect("/panel");
  return ctx as typeof ctx & { restaurante: Restaurante };
}

// Para cada página del panel: si esta persona no la tiene a la vista, la lleva a su primera sección.
export async function requerirSeccion(seccion: Seccion) {
  const ctx = await requerirRestaurante();
  if (!ctx.secciones.some((s) => s.id === seccion)) {
    const destino = ctx.secciones[0]?.href;
    redirect(destino && destino !== "/panel" ? destino : "/panel/sin-acceso");
  }
  return ctx;
}
