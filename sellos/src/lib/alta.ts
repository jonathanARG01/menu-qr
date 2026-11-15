import type { SupabaseClient } from "@supabase/supabase-js";
import { rubroDe } from "./rubros";

// Datos del negocio que se piden al registrarse. Si Supabase pide confirmar el correo, quedan guardados en la cuenta
// (user_metadata) y el panel termina el alta en la primera entrada.
export type DatosAlta = { nombre: string; slug: string; rubro: string; tu_nombre: string; telefono: string };

export async function crearNegocio(supabase: SupabaseClient, d: DatosAlta) {
  const r = rubroDe(d.rubro);
  return supabase.rpc("crear_negocio", {
    p_nombre: d.nombre,
    p_slug: d.slug,
    p_rubro: d.rubro,
    p_tu_nombre: d.tu_nombre,
    p_telefono: d.telefono || null,
    p_programa: { meta: r.meta, premio: r.premio, icono: r.icono, color: r.color },
  });
}
