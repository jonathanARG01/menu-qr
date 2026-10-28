"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Nivel } from "@/lib/referidos";
import { mensajeError } from "@/lib/utils";

// Todas pasan por funciones de la base que comprueban que seas superadmin.
async function llamar(funcion: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(funcion, args);
  if (error) return mensajeError(error);
  revalidatePath("/admin/referidos");
  return null;
}

export async function guardarNiveles(activo: boolean, niveles: Nivel[]) {
  return llamar("admin_guardar_referidos", { p_activo: activo, p_niveles: niveles });
}

export async function asignarReferente(id: string, ref: string) {
  return llamar("admin_asignar_referente", { p_id: id, p_ref: ref });
}

export async function cambiarEstado(id: string, estado: string) {
  return llamar("admin_estado_referido", { p_referido: id, p_estado: estado });
}

// Gasta los meses de descuento que cubre el cobro (1, 3, 6 o 12, según cómo paga).
export async function registrarCobro(id: string) {
  return llamar("admin_registrar_cobro", { p_restaurante: id });
}

export async function quitarDescuento(id: string) {
  return llamar("admin_quitar_descuento", { p_id: id });
}

export async function cambiarCiclo(id: string, ciclo: string) {
  return llamar("admin_ciclo", { p_id: id, p_ciclo: ciclo });
}
