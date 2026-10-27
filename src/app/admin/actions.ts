"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_RESTAURANTE } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { mensajeError } from "@/lib/utils";
import { factorEjemplo, prepararRestaurante } from "@/lib/planes";

// Cambia el plan o pausa/reactiva un restaurante. Las funciones de la base comprueban que seas superadmin.
export async function actualizarRestaurante(id: string, slug: string, cambios: { plan?: string; activo?: boolean }) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_actualizar_restaurante", {
    p_id: id,
    p_plan: cambios.plan ?? null,
    p_activo: cambios.activo ?? null,
  });
  if (error) return mensajeError(error);
  // Al pausar o reactivar, la carta pública tiene que dejar de verse (o volver) al momento.
  revalidatePath(`/${slug}`);
  revalidatePath("/admin");
  return null;
}

// Fin de la prueba: una fecha (ISO) o null para que no venza. Si la prueba lo había pausado, vuelve a verse.
export async function cambiarPrueba(id: string, slug: string, fin: string | null) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_prueba", { p_id: id, p_fin: fin });
  if (error) return mensajeError(error);
  revalidatePath(`/${slug}`);
  revalidatePath("/admin");
  return null;
}

// Día en que empezó a pagar (AAAA-MM-DD), para el contador de días como cliente.
export async function cambiarPlanInicio(id: string, fecha: string | null) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_plan_inicio", { p_id: id, p_fecha: fecha || null });
  if (error) return mensajeError(error);
  revalidatePath("/admin");
  return null;
}

// Carga los 12 platos de ejemplo en un restaurante sin platos (para mostrarle a un cliente cómo queda).
export async function cargarEjemplo(id: string, slug: string, moneda: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cargar_carta_ejemplo", { p_restaurante: id, p_factor: factorEjemplo(moneda) });
  if (error) return mensajeError(error);
  if (!data) return "Ya tiene platos: no se cargó el ejemplo.";
  revalidatePath(`/${slug}`);
  revalidatePath("/admin");
  return null;
}

// Te suma como staff del restaurante y abre su panel para editar la carta.
export async function editarRestaurante(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_unirse", { p_id: id, p_unirse: true });
  if (error) return mensajeError(error);
  await elegir(id);
  redirect("/panel");
}

export async function dejarRestaurante(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_unirse", { p_id: id, p_unirse: false });
  if (error) return mensajeError(error);
  revalidatePath("/admin");
  return null;
}

// Alta de un restaurante para un cliente: quedas como dueño y luego le pasas la cuenta o lo sumas.
export async function crearParaCliente(_prev: string | null, formData: FormData): Promise<string | null> {
  const supabase = await createClient();
  const slug = String(formData.get("slug") ?? "");
  const { data, error } = await supabase.rpc("crear_restaurante", {
    p_nombre: String(formData.get("nombre") ?? ""),
    p_slug: slug,
  });
  if (error) return mensajeError(error);
  await prepararRestaurante(supabase, (data as { id: string }).id, String(formData.get("pais") ?? ""), {
    ejemplo: formData.get("ejemplo") === "on",
  });
  revalidatePath(`/${slug}`);
  await elegir((data as { id: string }).id);
  redirect("/panel");
}

async function elegir(id: string) {
  const almacen = await cookies();
  almacen.set(COOKIE_RESTAURANTE, id, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/panel", "layout");
}
