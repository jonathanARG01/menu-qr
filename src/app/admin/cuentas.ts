"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { mensajeError } from "@/lib/utils";
import { borrarRestauranteCompleto, listarFotos } from "@/lib/borrarRestaurante";

// Datos del restaurante y cuentas de su gente, editados desde /admin. Cambiar correos y contraseñas o borrar
// cuentas necesita la clave de servicio (SUPABASE_SERVICE_ROLE_KEY en Vercel), así que todo pasa por el servidor
// y siempre se comprueba antes que quien llama es superadmin.

export type Miembro = {
  user_id: string;
  email: string;
  rol: "dueno" | "staff" | "mesero" | "cocina";
  ultimo_ingreso: string | null;
  confirmado: boolean;
  superadmin: boolean;
  soy_yo: boolean;
  otros_restaurantes: number;
};

export type DatosRestaurante = {
  id: string;
  nombre: string;
  slug: string;
  whatsapp: string | null;
  miembros: Miembro[];
  totales: { platos: number; pedidos: number; reservas: number; fotos: number };
};

type Resultado<T = null> = { error: string } | { ok: T };

async function comoSuperadmin(): Promise<{ error: string } | { db: SupabaseClient; yo: string }> {
  const supabase = await createClient();
  const [{ data: es }, { data: sesion }] = await Promise.all([supabase.rpc("es_superadmin"), supabase.auth.getUser()]);
  if (es !== true || !sesion.user) return { error: "Solo para administradores" };
  const db = createAdminClient();
  if (!db) return { error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY en Vercel (ver la guía)." };
  return { db, yo: sesion.user.id };
}

async function contar(db: SupabaseClient, tabla: string, id: string) {
  const { count } = await db.from(tabla).select("*", { count: "exact", head: true }).eq("restaurante_id", id);
  return count ?? 0;
}

export async function datosRestaurante(id: string): Promise<Resultado<DatosRestaurante>> {
  const s = await comoSuperadmin();
  if ("error" in s) return s;
  const { db, yo } = s;

  const { data: r, error } = await db.from("restaurantes").select("id, nombre, slug, whatsapp").eq("id", id).single();
  if (error || !r) return { error: error ? mensajeError(error) : "No existe ese restaurante" };

  const [{ data: filas }, { data: admins }] = await Promise.all([
    db.from("usuarios").select("user_id, rol").eq("restaurante_id", id),
    db.from("superadmins").select("user_id"),
  ]);
  const idsAdmin = new Set((admins ?? []).map((a: { user_id: string }) => a.user_id));

  const miembros = await Promise.all(
    (filas ?? []).map(async (u: { user_id: string; rol: Miembro["rol"] }) => {
      const [{ data }, { count }] = await Promise.all([
        db.auth.admin.getUserById(u.user_id),
        db.from("usuarios").select("*", { count: "exact", head: true }).eq("user_id", u.user_id).neq("restaurante_id", id),
      ]);
      return {
        user_id: u.user_id,
        email: data.user?.email ?? "(sin correo)",
        rol: u.rol,
        ultimo_ingreso: data.user?.last_sign_in_at ?? null,
        confirmado: !!data.user?.email_confirmed_at,
        superadmin: idsAdmin.has(u.user_id),
        soy_yo: u.user_id === yo,
        otros_restaurantes: count ?? 0,
      } satisfies Miembro;
    }),
  );
  // Dueños primero; tú (soporte) al final.
  const orden = { dueno: 0, mesero: 1, cocina: 2, staff: 3 };
  miembros.sort((a, b) => orden[a.rol] - orden[b.rol] || a.email.localeCompare(b.email));

  const [platos, pedidos, reservas, fotos] = await Promise.all([
    contar(db, "platos", id),
    contar(db, "pedidos", id),
    contar(db, "reservas", id),
    listarFotos(db, id).then((f) => f.length),
  ]);
  return { ok: { ...r, miembros, totales: { platos, pedidos, reservas, fotos } } };
}

export async function guardarDatos(
  id: string,
  datos: { nombre: string; slug: string; whatsapp: string },
): Promise<Resultado<{ slug: string }>> {
  const s = await comoSuperadmin();
  if ("error" in s) return s;
  const { data: antes } = await s.db.from("restaurantes").select("slug").eq("id", id).single();
  const slug = datos.slug.trim().toLowerCase();
  const whatsapp = datos.whatsapp.replace(/\D/g, "");
  const { error } = await s.db
    .from("restaurantes")
    .update({ nombre: datos.nombre.trim(), slug, whatsapp: whatsapp || null })
    .eq("id", id);
  if (error) {
    if (error.message.includes("whatsapp")) return { error: "El WhatsApp debe tener entre 6 y 15 dígitos, con código de país." };
    return { error: mensajeError(error) };
  }
  if (antes?.slug && antes.slug !== slug) revalidatePath(`/${antes.slug}`);
  revalidatePath(`/${slug}`);
  revalidatePath("/admin");
  return { ok: { slug } };
}

// La cuenta tiene que ser de este restaurante (no se puede tocar cualquier usuario pasando su id).
async function miembroDe(db: SupabaseClient, restauranteId: string, userId: string) {
  const { data } = await db
    .from("usuarios")
    .select("user_id")
    .eq("restaurante_id", restauranteId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export async function cambiarCorreo(restauranteId: string, userId: string, email: string): Promise<Resultado> {
  const s = await comoSuperadmin();
  if ("error" in s) return s;
  if (!(await miembroDe(s.db, restauranteId, userId))) return { error: "Esa cuenta no es de este restaurante" };
  const correo = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return { error: "Ese correo no parece válido." };
  // Queda confirmado al momento: lo cambias tú, no hace falta que el cliente lo valide.
  const { error } = await s.db.auth.admin.updateUserById(userId, { email: correo, email_confirm: true });
  if (error) {
    if (/already|registered|exists/i.test(error.message)) return { error: "Ya existe otra cuenta con ese correo." };
    return { error: mensajeError(error) };
  }
  revalidatePath("/admin");
  return { ok: null };
}

export async function cambiarClave(restauranteId: string, userId: string, clave: string): Promise<Resultado> {
  const s = await comoSuperadmin();
  if ("error" in s) return s;
  if (!(await miembroDe(s.db, restauranteId, userId))) return { error: "Esa cuenta no es de este restaurante" };
  if (clave.length < 8) return { error: "Usa al menos 8 caracteres." };
  const { error } = await s.db.auth.admin.updateUserById(userId, { password: clave });
  if (error) return { error: mensajeError(error) };
  return { ok: null };
}

// Enlace de un solo uso para que la persona elija su contraseña (vence en 1 hora). Tú se lo mandas por WhatsApp o correo.
export async function enlaceClave(restauranteId: string, userId: string, sitio: string): Promise<Resultado<string>> {
  const s = await comoSuperadmin();
  if ("error" in s) return s;
  if (!(await miembroDe(s.db, restauranteId, userId))) return { error: "Esa cuenta no es de este restaurante" };
  const { data: u } = await s.db.auth.admin.getUserById(userId);
  if (!u.user?.email) return { error: "La cuenta no tiene correo" };
  const { data, error } = await s.db.auth.admin.generateLink({ type: "recovery", email: u.user.email });
  if (error) return { error: mensajeError(error) };
  // La dirección desde la que abriste /admin (así sirve aunque todavía no esté el dominio definitivo).
  const base = (sitio || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const params = new URLSearchParams({ token_hash: data.properties.hashed_token, type: "recovery", next: "/nueva-clave" });
  return { ok: `${base}/auth/confirm?${params}` };
}

// Borra el restaurante con todo lo suyo (carta, mesas, pedidos, reservas, caja, clientes, referidos: todo cae en cascada)
// y sus fotos. Si se pide, también las cuentas que se quedan sin ningún restaurante (nunca la de un superadmin).
export async function eliminarRestaurante(
  id: string,
  confirmacion: string,
  borrarCuentas: boolean,
): Promise<Resultado<{ cuentas: number }>> {
  const s = await comoSuperadmin();
  if ("error" in s) return s;
  const { db } = s;

  const { data: r } = await db.from("restaurantes").select("slug").eq("id", id).single();
  if (!r) return { error: "No existe ese restaurante" };
  if (confirmacion.trim().toLowerCase() !== r.slug) return { error: `Escribe ${r.slug} para confirmar.` };

  const hecho = await borrarRestauranteCompleto(db, id, borrarCuentas);
  if ("error" in hecho) return { error: mensajeError(hecho.error) };
  const { cuentas } = hecho;

  revalidatePath(`/${r.slug}`);
  revalidatePath("/admin");
  return { ok: { cuentas } };
}
